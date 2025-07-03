import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';

// AWS clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const GMAIL_TOKENS_SECRET_NAME =
    process.env.GMAIL_TOKENS_SECRET_NAME || 'chatterbox-dev/gmail-tokens';
const GOOGLE_CREDENTIALS_SECRET_NAME =
    process.env.GOOGLE_CREDENTIALS_SECRET_NAME || 'chatterbox/google-credentials';
const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET || 'chatterbox-dev-email-archive';

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

interface GmailTokens {
    [userEmail: string]: {
        access_token: string;
        refresh_token: string;
        scope: string;
        token_type: string;
        expiry_date: number;
    };
}

interface GoogleCredentials {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
}

async function getGmailTokens(userEmail: string): Promise<GmailTokens[string]> {
    const command = new GetSecretValueCommand({ SecretId: GMAIL_TOKENS_SECRET_NAME });
    const response = await secretsClient.send(command);
    const tokens: GmailTokens = JSON.parse(response.SecretString || '{}');
    if (!tokens[userEmail]) throw new Error(`No tokens found for user: ${userEmail}`);
    return tokens[userEmail];
}

async function getGoogleCredentials(): Promise<GoogleCredentials> {
    const command = new GetSecretValueCommand({ SecretId: GOOGLE_CREDENTIALS_SECRET_NAME });
    const response = await secretsClient.send(command);
    return JSON.parse(response.SecretString || '{}');
}

async function createGmailAuthClient(userEmail: string): Promise<OAuth2Client> {
    const credentials = await getGoogleCredentials();
    const tokens = await getGmailTokens(userEmail);
    const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uris?.[0]
    );
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
}

interface GmailMessage {
    id: string;
    threadId: string;
    internalDate: string;
    payload?: {
        headers?: Array<{ name: string; value: string }>;
        body?: { data?: string };
        parts?: Array<{
            mimeType: string;
            body?: { data?: string; attachmentId?: string; size?: number };
            filename?: string;
        }>;
    };
    raw?: string;
}

async function getLatestChatterboxEmail(
    userEmail: string,
    authClient: OAuth2Client
): Promise<GmailMessage> {
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    const response = await gmail.users.messages.list({
        userId: userEmail,
        q: 'subject:chatterbox',
        maxResults: 1,
        // orderBy: 'internalDate', // Not a valid param for Gmail API
    });
    if (!response.data.messages || response.data.messages.length === 0) {
        throw new Error('No Chatterbox emails found');
    }
    const messageId = response.data.messages[0].id;
    if (!messageId) {
        throw new Error('Message ID is null or undefined');
    }
    const messageResponse = await gmail.users.messages.get({
        userId: userEmail,
        id: messageId,
        format: 'full',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
    });
    // Get RFC 5322 raw
    const rawResponse = await gmail.users.messages.get({
        userId: userEmail,
        id: messageId,
        format: 'raw',
    });
    const messageData = messageResponse.data;
    if (!messageData.id || !messageData.threadId || !messageData.internalDate) {
        throw new Error('Invalid message data received from Gmail API');
    }
    return {
        ...messageData,
        raw: rawResponse.data.raw || undefined,
    } as GmailMessage;
}

function extractEmailData(message: GmailMessage, userEmail: string): EmailData {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h) => h.name === 'Subject')?.value || '';
    const from = headers.find((h) => h.name === 'From')?.value || '';
    const date = headers.find((h) => h.name === 'Date')?.value || '';
    let bodyText = '';
    if (message.payload?.body?.data) {
        bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
        const textPart = message.payload.parts.find(
            (part) => part.mimeType === 'text/plain' && part.body?.data
        );
        if (textPart && textPart.body?.data) {
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
        receivedDate: message.internalDate
            ? new Date(parseInt(message.internalDate)).toISOString()
            : '',
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
    await s3Client.send(
        new PutObjectCommand({
            Bucket: EMAIL_STORAGE_BUCKET,
            Key: key,
            Body: emailData.rawEmail,
            ContentType: 'message/rfc822',
            Metadata: {
                'email-id': emailData.id,
                'thread-id': emailData.threadId,
                subject: emailData.subject,
                from: emailData.fromSender,
                'sent-date': emailData.sentDate,
                'received-date': emailData.receivedDate,
            },
        })
    );
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const userEmail =
            event.queryStringParameters?.userEmail || process.env.DEFAULT_GMAIL_USER || '';
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
