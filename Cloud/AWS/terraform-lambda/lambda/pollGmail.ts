import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// AWS Clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const GMAIL_TOKENS_SECRET_NAME = process.env.GMAIL_TOKENS_SECRET_NAME || 'development-chatterbox-gmail-tokens';
const GOOGLE_CREDENTIALS_SECRET_NAME = process.env.GOOGLE_CREDENTIALS_SECRET_NAME || 'development-chatterbox-google-credentials';
const DEFAULT_GMAIL_USER = process.env.DEFAULT_GMAIL_USER || 'awsamram@gmail.com';
const PARAMETER_STORE_PREFIX = process.env.PARAMETER_STORE_PREFIX || '/chatterbox';
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'development-chatterbox-state-table';
const EMAIL_CONTENT_BUCKET = process.env.EMAIL_CONTENT_BUCKET || 'chatterbox-email-content-dev';

// Interfaces
interface PollState {
  lastHistoryId: string | null;
  totalPollCycles: number;
  lastPolledUser: string | null;
  lastPolledTimestamp: string | null;
}

interface PollResult {
  newMessages: string[];
  newHistoryId: string | null;
  totalPollCycles: number;
  chatterboxEmailIds: string[];
  totalChatterboxEmailsFound: number;
}

interface PendingEmailJob {
  pk: string; // "PENDING_EMAIL#<gmail_id>"
  sk: string; // "USER#<user_email>"
  gmailId: string;
  userEmail: string;
  subject: string;
  fromSender: string;
  receivedDate: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastProcessedAt?: string;
  errorMessage?: string;
}

interface EmailContent {
  gmailId: string;
  userEmail: string;
  fromSender: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  receivedDate: string;
  metadata: {
    messageId: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
  };
}

interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  data?: Buffer;
}

interface LambdaResponse {
  success: boolean;
  data?: PollResult;
  error?: string;
}

// --- Global Timestamp Formatter ---
let timestampFormatter: Intl.DateTimeFormat | null = null;

/**
 * Generates a formatted timestamp string in 'yyyymmdd:hhMMss:' (US Eastern Time).
 * @returns {string} The formatted timestamp.
 */
function getTimestamp(): string {
    if (!timestampFormatter) {
        timestampFormatter = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false, // 24-hour format
            timeZone: 'America/New_York', // US Eastern Time
        });
    }

    const now = new Date();
    const parts = timestampFormatter.formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const second = parts.find((p) => p.type === 'second')?.value;

    return `${year}${month}${day}:${hour}${minute}${second}:`;
}

/**
 * Logs a message with a timestamp.
 * @param {...any} args The arguments to log.
 */
function logWithTimestamp(...args: unknown[]): void {
    const timestamp = getTimestamp();
    console.log(timestamp, ...args);
}

/**
 * Gets Gmail tokens for a specific user from AWS Secrets Manager.
 * @param {string} userEmail The Gmail user email.
 * @returns {Promise<any>} The Gmail tokens for the user.
 */
async function getGmailTokens(userEmail: string): Promise<any> {
  console.log(`Getting Gmail tokens for user: ${userEmail}`);
  console.log(`Using secret name: ${GMAIL_TOKENS_SECRET_NAME}`);
  
  const command = new GetSecretValueCommand({ SecretId: GMAIL_TOKENS_SECRET_NAME });
  const response = await secretsClient.send(command);
  const tokens = JSON.parse(response.SecretString || '{}');
  
  console.log(`Available users in tokens: ${Object.keys(tokens).join(', ')}`);
  
  if (!tokens[userEmail]) {
    throw new Error(`No tokens found for user: ${userEmail}. Available users: ${Object.keys(tokens).join(', ')}`);
  }
  
  console.log(`Found tokens for user: ${userEmail}`);
  return tokens[userEmail];
}

/**
 * Gets Google credentials from AWS Secrets Manager.
 * @returns {Promise<any>} The Google credentials.
 */
async function getGoogleCredentials(): Promise<any> {
  console.log(`Getting Google credentials from secret: ${GOOGLE_CREDENTIALS_SECRET_NAME}`);
  
  const command = new GetSecretValueCommand({ SecretId: GOOGLE_CREDENTIALS_SECRET_NAME });
  const response = await secretsClient.send(command);
  const credentials = JSON.parse(response.SecretString || '{}');
  
  console.log(`Credentials type: ${credentials.type || 'unknown'}`);
  return credentials;
}

/**
 * Creates an authenticated Gmail OAuth2 client.
 * @param {string} userEmail The Gmail user email.
 * @returns {Promise<OAuth2Client>} An authenticated OAuth2 client.
 */
async function createGmailAuthClient(userEmail: string): Promise<OAuth2Client> {
  console.log(`Creating Gmail auth client for user: ${userEmail}`);
  
  const credentials = await getGoogleCredentials();
  const tokens = await getGmailTokens(userEmail);
  
  // Handle the credentials structure which may have a 'web' property
  const oauth2Credentials = credentials.web || credentials;
  
  console.log(`Setting up OAuth2 client with client_id: ${oauth2Credentials.client_id ? 'present' : 'missing'}`);
  
  const oauth2Client = new google.auth.OAuth2(
    oauth2Credentials.client_id,
    oauth2Credentials.client_secret,
    oauth2Credentials.redirect_uris?.[0]
  );
  
  console.log(`Setting credentials with access_token: ${tokens.access_token ? 'present' : 'missing'}`);
  console.log(`Setting credentials with refresh_token: ${tokens.refresh_token ? 'present' : 'missing'}`);
  
  oauth2Client.setCredentials(tokens);
  
  // Test the credentials by making a simple API call
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`Successfully authenticated with Gmail API for user: ${profile.data.emailAddress}`);
  } catch (error) {
    console.error(`Failed to authenticate with Gmail API: ${error}`);
    throw error;
  }
  
  return oauth2Client;
}

/**
 * Gets the current poll state from AWS Parameter Store.
 * @param {string} userEmail The Gmail user email.
 * @returns {Promise<PollState>} The current poll state.
 */
async function getPollState(userEmail: string): Promise<PollState> {
  const userPrefix = `${PARAMETER_STORE_PREFIX}/polling/${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  try {
    const [lastHistoryIdParam, totalPollCyclesParam, lastPolledUserParam, lastPolledTimestampParam] = await Promise.all([
      ssmClient.send(new GetParameterCommand({ Name: `${userPrefix}/last_history_id` })),
      ssmClient.send(new GetParameterCommand({ Name: `${userPrefix}/total_poll_cycles` })),
      ssmClient.send(new GetParameterCommand({ Name: `${userPrefix}/last_polled_user` })),
      ssmClient.send(new GetParameterCommand({ Name: `${userPrefix}/last_polled_timestamp` }))
    ]);

    return {
      lastHistoryId: lastHistoryIdParam.Parameter?.Value || null,
      totalPollCycles: parseInt(totalPollCyclesParam.Parameter?.Value || '0'),
      lastPolledUser: lastPolledUserParam.Parameter?.Value || null,
      lastPolledTimestamp: lastPolledTimestampParam.Parameter?.Value || null
    };
  } catch (error) {
    console.log(`Error getting poll state, using defaults: ${error}`);
    return {
      lastHistoryId: null,
      totalPollCycles: 0,
      lastPolledUser: null,
      lastPolledTimestamp: null
    };
  }
}

/**
 * Saves the current poll state to AWS Parameter Store.
 * @param {string} userEmail The Gmail user email.
 * @param {PollState} state The poll state to save.
 */
async function savePollState(userEmail: string, state: PollState): Promise<void> {
  const userPrefix = `${PARAMETER_STORE_PREFIX}/polling/${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const now = new Date().toISOString();
  
  try {
    await Promise.all([
      ssmClient.send(new PutParameterCommand({
        Name: `${userPrefix}/last_history_id`,
        Value: state.lastHistoryId || 'none',
        Type: 'String',
        Overwrite: true
      })),
      ssmClient.send(new PutParameterCommand({
        Name: `${userPrefix}/total_poll_cycles`,
        Value: state.totalPollCycles.toString(),
        Type: 'String',
        Overwrite: true
      })),
      ssmClient.send(new PutParameterCommand({
        Name: `${userPrefix}/last_polled_user`,
        Value: userEmail,
        Type: 'String',
        Overwrite: true
      })),
      ssmClient.send(new PutParameterCommand({
        Name: `${userPrefix}/last_polled_timestamp`,
        Value: now,
        Type: 'String',
        Overwrite: true
      }))
    ]);
    
    logWithTimestamp(`Poll state saved for user: ${userEmail}`);
  } catch (error) {
    console.error(`Error saving poll state: ${error}`);
    throw error;
  }
}

/**
 * Checks if an email is a Chatterbox email based on subject line.
 * @param {any} message The Gmail message object.
 * @returns {boolean} True if it's a Chatterbox email.
 */
function isChatterboxEmail(message: any): boolean {
  const subject = message.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || '';
  
  // Check if "chatterbox" is the first word in the subject (case insensitive)
  // Handle any amount of leading/trailing whitespace
  const subjectLower = subject.toLowerCase().trim();
  const words = subjectLower.split(/\s+/);
  
  if (words.length > 0 && words[0] === 'chatterbox') {
    console.log(`[ChatterboxCheck] Subject matched: '${subject}'`);
    return true;
  }
  
  return false;
}

/**
 * Extracts basic email metadata for storage.
 * @param {any} message The Gmail message object.
 * @param {string} userEmail The Gmail user email.
 * @returns {object} Basic email metadata.
 */
function extractEmailMetadata(message: any, userEmail: string): {
  gmailId: string;
  subject: string;
  fromSender: string;
  receivedDate: string;
} {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
  const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
  const date = headers.find((h: any) => h.name === 'Date')?.value || new Date().toISOString();
  
  return {
    gmailId: message.id,
    subject,
    fromSender: from,
    receivedDate: date
  };
}

/**
 * Uploads email content to S3 for processing by the email processor Lambda.
 * @param {EmailContent} emailContent The email content to upload.
 */
async function uploadEmailContentToS3(emailContent: EmailContent): Promise<void> {
  console.log(`Uploading email content to S3 for Gmail ID: ${emailContent.gmailId}`);
  
  const s3Key = `emails/${emailContent.gmailId}/metadata.json`;
  const content = JSON.stringify(emailContent, null, 2);
  
  const command = new PutObjectCommand({
    Bucket: EMAIL_CONTENT_BUCKET,
    Key: s3Key,
    Body: content,
    ContentType: 'application/json',
    Metadata: {
      gmailId: emailContent.gmailId,
      userEmail: emailContent.userEmail,
      fromSender: emailContent.fromSender,
      receivedDate: emailContent.receivedDate
    }
  });
  
  await s3Client.send(command);
  console.log(`Successfully uploaded email content to S3: ${s3Key}`);
}

/**
 * Extracts full email content including body and attachments.
 * @param {any} message The Gmail message object.
 * @param {string} userEmail The Gmail user email.
 * @returns {Promise<EmailContent>} The extracted email content.
 */
async function extractEmailContent(message: any, userEmail: string): Promise<EmailContent> {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
  const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
  const date = headers.find((h: any) => h.name === 'Date')?.value || new Date().toISOString();
  
  // Extract email body
  let body = '';
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    // Handle multipart messages
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        break;
      }
    }
  }
  
  // Extract attachments (basic implementation)
  const attachments: EmailAttachment[] = [];
  if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.filename && part.body?.data) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          data: Buffer.from(part.body.data, 'base64')
        });
      }
    }
  }
  
  return {
    gmailId: message.id,
    userEmail,
    fromSender: from,
    subject,
    body,
    attachments,
    receivedDate: date,
    metadata: {
      messageId: message.id,
      threadId: message.threadId,
      labelIds: message.labelIds || [],
      snippet: message.snippet || ''
    }
  };
}

/**
 * Stores a pending email job in DynamoDB.
 * @param {PendingEmailJob} job The pending email job to store.
 */
async function storePendingEmailJob(job: PendingEmailJob): Promise<void> {
  try {
    const command = new PutItemCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: marshall(job)
    });
    
    await dynamoClient.send(command);
    logWithTimestamp(`Stored pending email job for Gmail ID: ${job.gmailId}`);
  } catch (error) {
    console.error(`Error storing pending email job: ${error}`);
    throw error;
  }
}

/**
 * Checks if a Gmail ID is already stored as a pending job.
 * @param {string} gmailId The Gmail message ID.
 * @param {string} userEmail The Gmail user email.
 * @returns {Promise<boolean>} True if already stored.
 */
async function isEmailAlreadyStored(gmailId: string, userEmail: string): Promise<boolean> {
  try {
    const command = new QueryCommand({
      TableName: DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: marshall({
        ':pk': `PENDING_EMAIL#${gmailId}`,
        ':sk': `USER#${userEmail}`
      })
    });
    
    const response = await dynamoClient.send(command);
    return !!(response.Items && response.Items.length > 0);
  } catch (error) {
    console.error(`Error checking if email is already stored: ${error}`);
    return false;
  }
}

/**
 * Main Gmail polling function.
 * @param {OAuth2Client} auth The authenticated OAuth2 client.
 * @param {string} gmailUser The Gmail user email.
 * @returns {Promise<PollResult>} The polling result.
 */
async function pollGmail(
    auth: OAuth2Client,
    gmailUser: string
): Promise<PollResult> {
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Get current poll state
    const state = await getPollState(gmailUser);
    state.totalPollCycles++; // Increment total cycles for this run

    logWithTimestamp(`--- Single Poll (Total: ${state.totalPollCycles}) for ${gmailUser} ---`);

    const newMessages: string[] = [];
    let newHistoryId: string | null = null;
    const chatterboxEmailIds: string[] = [];

    try {
        // If we have a valid history ID (not "none"), use the History API to get new messages
        if (state.lastHistoryId && state.lastHistoryId !== 'none') {
            logWithTimestamp(`Using History API with startHistoryId: ${state.lastHistoryId}`);
            
            const response = await gmail.users.history.list({
                userId: 'me',
                startHistoryId: state.lastHistoryId,
                historyTypes: ['messageAdded'],
            });

            const history = response.data.history;
            if (history && history.length > 0) {
                logWithTimestamp(`Found ${history.length} new history entries.`);
                newHistoryId = response.data.historyId || null;

                // Process new messages
                for (const entry of history) {
                    if (entry.messagesAdded) {
                        for (const message of entry.messagesAdded) {
                            if (message.message?.id) {
                                const messageId = message.message.id;
                                logWithTimestamp(`New message ID: ${messageId}`);
                                newMessages.push(messageId);
                                
                                // Get full message details
                                try {
                                    const messageResponse = await gmail.users.messages.get({
                                        userId: 'me',
                                        id: messageId,
                                        format: 'full',
                                        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
                                    });
                                    
                                    const fullMessage = messageResponse.data;
                                    
                                    // Check if it's a Chatterbox email
                                    if (isChatterboxEmail(fullMessage)) {
                                        logWithTimestamp(`Processing Chatterbox email: ${messageId}`);
                                        
                                        // Check if already stored
                                        if (!(await isEmailAlreadyStored(messageId, gmailUser))) {
                                            // Extract full email content
                                            const emailContent = await extractEmailContent(fullMessage, gmailUser);
                                            
                                            // Upload email content to S3 for processing
                                            await uploadEmailContentToS3(emailContent);
                                            
                                            // Store as pending job
                                            const pendingJob: PendingEmailJob = {
                                                pk: `PENDING_EMAIL#${messageId}`,
                                                sk: `USER#${gmailUser}`,
                                                gmailId: messageId,
                                                userEmail: gmailUser,
                                                subject: emailContent.subject,
                                                fromSender: emailContent.fromSender,
                                                receivedDate: emailContent.receivedDate,
                                                createdAt: new Date().toISOString(),
                                                status: 'pending',
                                                retryCount: 0
                                            };
                                            
                                            await storePendingEmailJob(pendingJob);
                                            chatterboxEmailIds.push(messageId);
                                            logWithTimestamp(`Stored Chatterbox email ID: ${messageId} and uploaded to S3`);
                                        } else {
                                            logWithTimestamp(`Chatterbox email already stored: ${messageId}`);
                                        }
                                    } else {
                                        logWithTimestamp(`Skipping non-Chatterbox email: ${messageId}`);
                                    }
                                } catch (error) {
                                    console.error(`Error processing message ${messageId}:`, error);
                                }
                            }
                        }
                    }
                }
            } else {
                logWithTimestamp('No new messages found in history.');
            }
        } else {
            // No history ID - this is the first run, so search for recent emails
            logWithTimestamp('No history ID found. Searching for recent emails...');
            
            // Search for emails from the last 30 days (1 month)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const query = `after:${thirtyDaysAgo.toISOString().split('T')[0]}`;
            
            logWithTimestamp(`DEBUG: Current date: ${new Date().toISOString()}`);
            logWithTimestamp(`DEBUG: Thirty days ago: ${thirtyDaysAgo.toISOString()}`);
            logWithTimestamp(`DEBUG: Search query date: ${thirtyDaysAgo.toISOString().split('T')[0]}`);
            logWithTimestamp(`Searching for emails with query: ${query}`);
            
            let nextPageToken: string | undefined = undefined;
            let totalMessages = 0;
            do {
                const response: any = await gmail.users.messages.list({
                    userId: 'me',
                    q: query,
                    maxResults: 100,
                    pageToken: nextPageToken
                });
                const messages = response.data.messages;
                nextPageToken = response.data.nextPageToken;
                if (messages && messages.length > 0) {
                    logWithTimestamp(`Found ${messages.length} recent messages on this page. Checking for Chatterbox emails...`);
                    totalMessages += messages.length;
                    for (const message of messages) {
                        if (message.id) {
                            const messageId = message.id;
                            logWithTimestamp(`Checking message ID: ${messageId}`);
                            try {
                                const messageResponse = await gmail.users.messages.get({
                                    userId: 'me',
                                    id: messageId,
                                    format: 'full',
                                    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
                                });
                                
                                const fullMessage = messageResponse.data;
                                if (isChatterboxEmail(fullMessage)) {
                                    logWithTimestamp(`Found Chatterbox email: ${messageId}`);
                                    newMessages.push(messageId);
                                    
                                    // Check if already stored
                                    if (!(await isEmailAlreadyStored(messageId, gmailUser))) {
                                        // Extract full email content
                                        const emailContent = await extractEmailContent(fullMessage, gmailUser);
                                        
                                        // Upload email content to S3 for processing
                                        await uploadEmailContentToS3(emailContent);
                                        
                                        // Store as pending job
                                        const pendingJob: PendingEmailJob = {
                                            pk: `PENDING_EMAIL#${messageId}`,
                                            sk: `USER#${gmailUser}`,
                                            gmailId: messageId,
                                            userEmail: gmailUser,
                                            subject: emailContent.subject,
                                            fromSender: emailContent.fromSender,
                                            receivedDate: emailContent.receivedDate,
                                            createdAt: new Date().toISOString(),
                                            status: 'pending',
                                            retryCount: 0
                                        };
                                        
                                        await storePendingEmailJob(pendingJob);
                                        chatterboxEmailIds.push(messageId);
                                        logWithTimestamp(`Stored Chatterbox email ID: ${messageId} and uploaded to S3`);
                                    } else {
                                        logWithTimestamp(`Chatterbox email already stored: ${messageId}`);
                                    }
                                } else {
                                    logWithTimestamp(`Skipping non-Chatterbox email: ${messageId}`);
                                }
                            } catch (error) {
                                console.error(`Error processing message ${messageId}:`, error);
                            }
                        }
                    }
                } else {
                    logWithTimestamp('No recent messages found on this page.');
                }
            } while (nextPageToken);
            logWithTimestamp(`Total messages checked in 30-day window: ${totalMessages}`);
            // Get the current history ID for future polls
            try {
                const profileResponse = await gmail.users.getProfile({ userId: 'me' });
                newHistoryId = profileResponse.data.historyId || null;
                logWithTimestamp(`Got current history ID: ${newHistoryId}`);
            } catch (error) {
                logWithTimestamp('Error getting current history ID:', error);
            }
        }

        // Update state with new history ID
        if (newHistoryId) {
            state.lastHistoryId = newHistoryId;
        }

        // Save the updated state
        await savePollState(gmailUser, state);
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException & { code?: number };
        if (error.code === 404 || error.code === 400) {
            // Likely an invalid history ID or initial sync
            logWithTimestamp(
                'Error fetching Gmail history (possibly invalid history ID or first run). Resetting history ID.'
            );
            state.lastHistoryId = null;
            await savePollState(gmailUser, state);
        } else {
            logWithTimestamp('Error fetching new emails:', err);
            throw error;
        }
    }

    return { 
        newMessages, 
        newHistoryId, 
        totalPollCycles: state.totalPollCycles, 
        chatterboxEmailIds,
        totalChatterboxEmailsFound: chatterboxEmailIds.length
    };
}

/**
 * Lambda handler function.
 * @param {APIGatewayProxyEvent} event The API Gateway event.
 * @returns {Promise<APIGatewayProxyResult>} The Lambda response.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('=== LAMBDA FUNCTION STARTED - EMAIL ID STORAGE VERSION ===');
  console.log('=== FOCUSED ON STORING GMAIL IDs FOR FUTURE PROCESSING ===');
  
  try {
    const userEmail = event.queryStringParameters?.userEmail || DEFAULT_GMAIL_USER;
    if (!userEmail) throw new Error('No userEmail provided');
    
    logWithTimestamp(`Starting Gmail poll for user: ${userEmail}`);
    
    const authClient = await createGmailAuthClient(userEmail);
    const result = await pollGmail(authClient, userEmail);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: {
          message: `Gmail poll completed successfully for ${userEmail}`,
          totalMessagesFound: result.newMessages.length,
          chatterboxEmailsFound: result.totalChatterboxEmailsFound,
          chatterboxEmailIds: result.chatterboxEmailIds,
          totalPollCycles: result.totalPollCycles,
          newHistoryId: result.newHistoryId,
          timestamp: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    console.error('Lambda function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      })
    };
  }
}; 