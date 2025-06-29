import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { google, Auth } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';

// Initialize AWS clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const GMAIL_TOKENS_SECRET_NAME = process.env.GMAIL_TOKENS_SECRET_NAME || 'chatterbox-gmail-tokens';
const GOOGLE_CREDENTIALS_SECRET_NAME = process.env.GOOGLE_CREDENTIALS_SECRET_NAME || 'chatterbox/google-credentials';
const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET || 'chatterbox-email-storage';

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

/**
 * Gets Gmail tokens from AWS Secrets Manager
 */
async function getGmailTokens(userEmail: string): Promise<any> {
    try {
        const command = new GetSecretValueCommand({
            SecretId: GMAIL_TOKENS_SECRET_NAME,
        });
        
        const response = await secretsClient.send(command);
        const tokens = JSON.parse(response.SecretString || '{}');
        
        if (!tokens[userEmail]) {
            throw new Error(`No tokens found for user: ${userEmail}`);
        }
        
        return tokens[userEmail];
    } catch (error) {
        console.error('Error getting Gmail tokens:', error);
        throw new Error(`Failed to retrieve Gmail tokens: ${error}`);
    }
}

/**
 * Gets Google credentials from AWS Secrets Manager
 */
async function getGoogleCredentials(): Promise<any> {
    try {
        const command = new GetSecretValueCommand({
            SecretId: GOOGLE_CREDENTIALS_SECRET_NAME,
        });
        
        const response = await secretsClient.send(command);
        return JSON.parse(response.SecretString || '{}');
    } catch (error) {
        console.error('Error getting Google credentials:', error);
        throw new Error(`Failed to retrieve Google credentials: ${error}`);
    }
}

/**
 * Creates OAuth2 client for Gmail
 */
async function createGmailAuthClient(userEmail: string): Promise<OAuth2Client> {
    const credentials = await getGoogleCredentials();
    const tokens = await getGmailTokens(userEmail);
    
    const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uris?.[0]
    );
    
    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date
    });
    
    return oauth2Client;
}

/**
 * Gets the most recent Chatterbox email
 */
async function getLatestChatterboxEmail(userEmail: string): Promise<any> {
    const authClient = await createGmailAuthClient(userEmail);
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    // Search for the most recent chatterbox email
    const response = await gmail.users.messages.list({
        userId: userEmail,
        q: 'subject:chatterbox',
        maxResults: 1,
        orderBy: 'internalDate'
    });
    
    if (!response.data.messages || response.data.messages.length === 0) {
        throw new Error('No Chatterbox emails found');
    }
    
    const messageId = response.data.messages[0].id;
    
    // Get the full message
    const messageResponse = await gmail.users.messages.get({
        userId: userEmail,
        id: messageId,
        format: 'full'
    });
    
    return messageResponse.data;
}

/**
 * Extracts email data from Gmail message
 */
function extractEmailData(message: any, userEmail: string): EmailData {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';
    
    // Extract body text
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
    
    // Extract attachments
    const attachments: EmailAttachment[] = [];
    if (message.payload?.parts) {
        for (const part of message.payload.parts) {
            if (part.filename && part.body?.data) {
                attachments.push({
                    name: part.filename,
                    size: part.body.size || 0,
                    mimeType: part.mimeType || 'application/octet-stream'
                });
            }
        }
    }
    
    // Get raw email for S3 storage
    const rawEmail = message.raw || '';
    
    return {
        address: userEmail,
        id: message.id,
        threadId: message.threadId,
        sentDate: date,
        receivedDate: new Date(parseInt(message.internalDate)).toISOString(),
        subject,
        fromSender: from,
        bodyText,
        attachments,
        rawEmail
    };
}

/**
 * Stores raw email in S3
 */
async function storeEmailInS3(emailData: EmailData): Promise<void> {
    if (!emailData.rawEmail) {
        console.warn('No raw email data to store');
        return;
    }
    
    const key = `emails/${emailData.id}/${new Date().toISOString().replace(/[:.]/g, '-')}.eml`;
    
    try {
        const command = new PutObjectCommand({
            Bucket: EMAIL_STORAGE_BUCKET,
            Key: key,
            Body: emailData.rawEmail,
            ContentType: 'message/rfc822',
            Metadata: {
                'email-id': emailData.id,
                'thread-id': emailData.threadId,
                'subject': emailData.subject,
                'from': emailData.fromSender,
                'sent-date': emailData.sentDate,
                'received-date': emailData.receivedDate
            }
        });
        
        await s3Client.send(command);
        console.log(`Email stored in S3: ${key}`);
    } catch (error) {
        console.error('Error storing email in S3:', error);
        throw new Error(`Failed to store email in S3: ${error}`);
    }
}

/**
 * Main Lambda handler
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        console.log('Lambda function started');
        
        // Get user email from query parameters or use default
        const userEmail = event.queryStringParameters?.userEmail || 'default@example.com';
        
        // Get the latest Chatterbox email
        const message = await getLatestChatterboxEmail(userEmail);
        
        // Extract email data
        const emailData = extractEmailData(message, userEmail);
        
        // Store raw email in S3
        await storeEmailInS3(emailData);
        
        // Return success response
        const response: LambdaResponse = {
            success: true,
            data: emailData
        };
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify(response)
        };
        
    } catch (error) {
        console.error('Lambda function error:', error);
        
        const response: LambdaResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify(response)
        };
    }
}; 