import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';

// AWS clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const GMAIL_TOKENS_SECRET_NAME = process.env.GMAIL_TOKENS_SECRET_NAME || 'development-chatterbox-gmail-tokens';
const GOOGLE_CREDENTIALS_SECRET_NAME = process.env.GOOGLE_CREDENTIALS_SECRET_NAME || 'development-chatterbox-google-credentials';
const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET || 'chatterbox-email-archive';

interface EmailAttachment {
  name: string;
  size: number;
  mimeType: string;
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

interface LambdaResponse {
  success: boolean;
  data?: EmailData;
  error?: string;
}

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

async function getGoogleCredentials(): Promise<any> {
  console.log(`Getting Google credentials from secret: ${GOOGLE_CREDENTIALS_SECRET_NAME}`);
  
  const command = new GetSecretValueCommand({ SecretId: GOOGLE_CREDENTIALS_SECRET_NAME });
  const response = await secretsClient.send(command);
  const credentials = JSON.parse(response.SecretString || '{}');
  
  console.log(`Credentials type: ${credentials.type || 'unknown'}`);
  return credentials;
}

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

async function getLatestChatterboxEmail(userEmail: string, authClient: OAuth2Client): Promise<any> {
  console.log(`Getting latest Chatterbox email for user: ${userEmail}`);
  
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  
  // Use a date range query like the local version
  const query = 'subject:chatterbox newer_than:7d';
  console.log(`Using search query: ${query}`);
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 1,
  });
  
  console.log(`Found ${response.data.messages?.length || 0} messages`);
  
  if (!response.data.messages || response.data.messages.length === 0) {
    throw new Error('No Chatterbox emails found in the last 7 days');
  }
  
  const messageId = response.data.messages[0].id;
  console.log(`Getting full message details for ID: ${messageId}`);
  
  const messageResponse = await gmail.users.messages.get({
    userId: 'me',
    id: messageId!,
    format: 'full',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
  });
  
  // Get RFC 5322 raw
  const rawResponse = await gmail.users.messages.get({
    userId: 'me',
    id: messageId!,
    format: 'raw',
  });
  
  console.log(`Successfully retrieved message: ${messageResponse.data.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No subject'}`);
  
  return { ...messageResponse.data, raw: rawResponse.data.raw };
}

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
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userEmail = event.queryStringParameters?.userEmail || process.env.DEFAULT_GMAIL_USER || '';
    if (!userEmail) throw new Error('No userEmail provided');
    const authClient = await createGmailAuthClient(userEmail);
    const message = await getLatestChatterboxEmail(userEmail, authClient);
    const emailData = extractEmailData(message, userEmail);
    await storeEmailInS3(emailData);
    const response: LambdaResponse = { success: true, data: emailData };
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const response: LambdaResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify(response),
    };
  }
}; 