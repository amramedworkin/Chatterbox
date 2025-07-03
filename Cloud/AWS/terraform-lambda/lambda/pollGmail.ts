import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// AWS Clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const GMAIL_TOKENS_SECRET_NAME = process.env.GMAIL_TOKENS_SECRET_NAME || 'development-chatterbox-gmail-tokens';
const GOOGLE_CREDENTIALS_SECRET_NAME = process.env.GOOGLE_CREDENTIALS_SECRET_NAME || 'development-chatterbox-google-credentials';
const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET || 'chatterbox-email-archive';
const DEFAULT_GMAIL_USER = process.env.DEFAULT_GMAIL_USER || 'awsamram@gmail.com';
const PARAMETER_STORE_PREFIX = process.env.PARAMETER_STORE_PREFIX || '/chatterbox';

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
  processedEmails: EmailData[];
}

interface EmailData {
  address: string;
  id: string;
  threadId: string;
  sentDate: string;
  receivedDate: string;
  subject: string;
  fromSender: string;
  bodyText: string;
  attachments: EmailAttachment[];
  rawEmail: string;
}

interface EmailAttachment {
  name: string;
  size: number;
  mimeType: string;
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
    console.log(`No existing poll state found for ${userEmail}. Starting fresh.`);
    return {
      lastHistoryId: null,
      totalPollCycles: 0,
      lastPolledUser: null,
      lastPolledTimestamp: null
    };
  }
}

/**
 * Saves the poll state to AWS Parameter Store.
 * @param {string} userEmail The Gmail user email.
 * @param {PollState} state The poll state to save.
 * @returns {Promise<void>}
 */
async function savePollState(userEmail: string, state: PollState): Promise<void> {
  const userPrefix = `${PARAMETER_STORE_PREFIX}/polling/${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const timestamp = new Date().toISOString();
  
  // Debug logging to identify which value is causing the issue
  const lastHistoryIdValue = state.lastHistoryId || 'none';
  const totalPollCyclesValue = Math.max(1, state.totalPollCycles).toString(); // Ensure at least 1
  const lastPolledUserValue = userEmail || 'unknown';
  const lastPolledTimestampValue = timestamp;
  
  console.log(`Debug - Values to write to SSM:`);
  console.log(`  lastHistoryId: "${lastHistoryIdValue}" (length: ${lastHistoryIdValue.length})`);
  console.log(`  totalPollCycles: "${totalPollCyclesValue}" (length: ${totalPollCyclesValue.length})`);
  console.log(`  lastPolledUser: "${lastPolledUserValue}" (length: ${lastPolledUserValue.length})`);
  console.log(`  lastPolledTimestamp: "${lastPolledTimestampValue}" (length: ${lastPolledTimestampValue.length})`);
  
  await Promise.all([
    ssmClient.send(new PutParameterCommand({
      Name: `${userPrefix}/last_history_id`,
      Value: lastHistoryIdValue,
      Type: 'String',
      Overwrite: true
    })),
    ssmClient.send(new PutParameterCommand({
      Name: `${userPrefix}/total_poll_cycles`,
      Value: totalPollCyclesValue,
      Type: 'String',
      Overwrite: true
    })),
    ssmClient.send(new PutParameterCommand({
      Name: `${userPrefix}/last_polled_user`,
      Value: lastPolledUserValue,
      Type: 'String',
      Overwrite: true
    })),
    ssmClient.send(new PutParameterCommand({
      Name: `${userPrefix}/last_polled_timestamp`,
      Value: lastPolledTimestampValue,
      Type: 'String',
      Overwrite: true
    }))
  ]);
  
  console.log(`Saved poll state for ${userEmail}: historyId=${state.lastHistoryId}, cycles=${state.totalPollCycles}`);
}

/**
 * Checks if an email is a Chatterbox email by examining its subject and content.
 * @param {any} message The Gmail message object.
 * @returns {boolean} True if it's a Chatterbox email.
 */
function isChatterboxEmail(message: any): boolean {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
  // Check if subject contains "chatterbox" (case insensitive)
  if (subject.toLowerCase().includes('chatterbox')) {
    console.log(`[ChatterboxCheck] Subject matched: '${subject}'`);
    return true;
  }
  // Check body content for chatterbox indicators
  let bodyText = '';
  if (message.payload?.body?.data) {
    bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find((part: any) =>
      part.mimeType === 'text/plain' && part.body?.data
    );
    if (textPart) {
      bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }
  const chatterboxIndicators = ['conversation id:', 'sequential number:', 'chatterbox'];
  const matched = chatterboxIndicators.some(indicator => 
    bodyText.toLowerCase().includes(indicator.toLowerCase())
  );
  if (matched) {
    console.log(`[ChatterboxCheck] Body matched: Subject='${subject}', Body='${bodyText.slice(0, 80)}...'`);
  } else {
    console.log(`[ChatterboxCheck] No match: Subject='${subject}', Body='${bodyText.slice(0, 80)}...'`);
  }
  return matched;
}

/**
 * Extracts email data from a Gmail message.
 * @param {any} message The Gmail message object.
 * @param {string} userEmail The Gmail user email.
 * @returns {EmailData} The extracted email data.
 */
function extractEmailData(message: any, userEmail: string): EmailData {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
  const from = headers.find((h: any) => h.name === 'From')?.value || '';
  const date = headers.find((h: any) => h.name === 'Date')?.value || '';
  let bodyText = '';
  if (message.payload?.body?.data) {
    bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find((part: any) =>
      part.mimeType === 'text/plain' && part.body?.data
    );
    if (textPart) {
      bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }
  const attachments: EmailAttachment[] = [];
  if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          name: part.filename,
          size: part.body.size || 0,
          mimeType: part.mimeType || 'application/octet-stream',
        });
      }
    }
  }
  const rawEmail = message.raw ? Buffer.from(message.raw, 'base64').toString('utf-8') : '';
  return {
    address: userEmail,
    id: message.id,
    threadId: message.threadId,
    sentDate: date,
    receivedDate: message.internalDate ? new Date(parseInt(message.internalDate)).toISOString() : '',
    subject,
    fromSender: from,
    bodyText,
    attachments,
    rawEmail,
  };
}

/**
 * Stores an email in S3.
 * @param {EmailData} emailData The email data to store.
 * @returns {Promise<void>}
 */
async function storeEmailInS3(emailData: EmailData): Promise<void> {
  if (!emailData.rawEmail) return;
  const key = `emails/${emailData.id}/${new Date().toISOString().replace(/[:.]/g, '-')}.eml`;
  await s3Client.send(new PutObjectCommand({
    Bucket: EMAIL_STORAGE_BUCKET,
    Key: key,
    Body: emailData.rawEmail,
    ContentType: 'message/rfc822',
    ServerSideEncryption: 'AES256',
    Metadata: {
      'email-id': emailData.id,
      'thread-id': emailData.threadId,
      'subject': emailData.subject,
      'from': emailData.fromSender,
      'sent-date': emailData.sentDate,
      'received-date': emailData.receivedDate,
    },
  }));
  console.log(`Stored email ${emailData.id} in S3: ${key}`);
}

/**
 * Fetches new emails since the last history ID and filters for Chatterbox emails.
 * @param {OAuth2Client} auth The authenticated OAuth2 client.
 * @param {string} gmailUser The Gmail user email.
 * @returns {Promise<PollResult>} Object containing new message IDs, new history ID, and processed emails.
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
    const processedEmails: EmailData[] = [];

    try {
        // If we have a history ID, use the History API to get new messages
        if (state.lastHistoryId) {
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
                                    
                                    // Get RFC 5322 raw
                                    const rawResponse = await gmail.users.messages.get({
                                        userId: 'me',
                                        id: messageId,
                                        format: 'raw',
                                    });
                                    
                                    const fullMessage = { ...messageResponse.data, raw: rawResponse.data.raw };
                                    
                                    // Check if it's a Chatterbox email
                                    if (isChatterboxEmail(fullMessage)) {
                                        logWithTimestamp(`Processing Chatterbox email: ${messageId}`);
                                        const emailData = extractEmailData(fullMessage, gmailUser);
                                        await storeEmailInS3(emailData);
                                        processedEmails.push(emailData);
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
                                const rawResponse = await gmail.users.messages.get({
                                    userId: 'me',
                                    id: messageId,
                                    format: 'raw',
                                });
                                const fullMessage = { ...messageResponse.data, raw: rawResponse.data.raw };
                                if (isChatterboxEmail(fullMessage)) {
                                    logWithTimestamp(`Found Chatterbox email: ${messageId}`);
                                    newMessages.push(messageId);
                                    const emailData = extractEmailData(fullMessage, gmailUser);
                                    await storeEmailInS3(emailData);
                                    processedEmails.push(emailData);
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

    return { newMessages, newHistoryId, totalPollCycles: state.totalPollCycles, processedEmails };
}

/**
 * Lambda handler function.
 * @param {APIGatewayProxyEvent} event The API Gateway event.
 * @returns {Promise<APIGatewayProxyResult>} The Lambda response.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('=== LAMBDA FUNCTION STARTED - UPDATED CODE VERSION 2 ===');
  console.log('=== THIS SHOULD APPEAR IN CLOUDWATCH LOGS ===');
  
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
        data: result
      })
    };
  } catch (error) {
    console.error('Lambda execution error:', error);
    
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
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
}; 