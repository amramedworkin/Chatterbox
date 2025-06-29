const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { google } = require('googleapis');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Get Gmail tokens from AWS Secrets Manager
 */
async function getGmailTokens(userEmail) {
    try {
        const secretName = `chatterbox-${process.env.ENVIRONMENT}-gmail-tokens-${userEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        const command = new GetSecretValueCommand({
            SecretId: secretName,
        });
        
        const response = await secretsClient.send(command);
        const tokens = JSON.parse(response.SecretString);
        
        return {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            scope: tokens.scope,
            token_type: tokens.token_type,
            expiry_date: tokens.expiry_date
        };
    } catch (error) {
        console.error('Error retrieving Gmail tokens:', error);
        throw new Error(`Failed to retrieve Gmail tokens for ${userEmail}: ${error.message}`);
    }
}

/**
 * Create OAuth2 client for Gmail API
 */
function createOAuth2Client(tokens) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
}

/**
 * Get Gmail message by ID
 */
async function getGmailById(messageId, userEmail, authClient) {
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    const response = await gmail.users.messages.get({
        userId: userEmail,
        id: messageId,
    });
    
    return response.data;
}

/**
 * Extract email subject from Gmail message
 */
function getEmailSubject(message) {
    if (!message.payload || !message.payload.headers) {
        return '';
    }
    
    const subjectHeader = message.payload.headers.find(header => 
        header.name.toLowerCase() === 'subject'
    );
    
    return subjectHeader ? subjectHeader.value || '' : '';
}

/**
 * Extract email sender from Gmail message
 */
function getEmailSender(message) {
    if (!message.payload || !message.payload.headers) {
        return '';
    }
    
    const fromHeader = message.payload.headers.find(header => 
        header.name.toLowerCase() === 'from'
    );
    
    return fromHeader ? fromHeader.value || '' : '';
}

/**
 * Extract email body from Gmail message
 */
function getEmailBody(message) {
    if (!message.payload) {
        return '';
    }
    
    // Try to get plain text body
    if (message.payload.body && message.payload.body.data) {
        return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }
    
    // Try to get body from parts
    if (message.payload.parts) {
        for (const part of message.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
    }
    
    return '';
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    try {
        // Extract Gmail ID from path parameters
        const gmailId = event.pathParameters?.gmailId;
        
        if (!gmailId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS'
                },
                body: JSON.stringify({
                    error: 'Gmail ID is required',
                    message: 'Please provide a Gmail ID in the URL path'
                })
            };
        }
        
        // Get user email from environment or default
        const userEmail = process.env.GMAIL_USER_EMAIL || 'default@example.com';
        
        // Get Gmail tokens from Secrets Manager
        const tokens = await getGmailTokens(userEmail);
        
        // Create OAuth2 client
        const authClient = createOAuth2Client(tokens);
        
        // Get the email by ID
        const emailMessage = await getGmailById(gmailId, userEmail, authClient);
        
        // Extract email details
        const emailData = {
            id: emailMessage.id,
            threadId: emailMessage.threadId,
            subject: getEmailSubject(emailMessage),
            sender: getEmailSender(emailMessage),
            body: getEmailBody(emailMessage),
            snippet: emailMessage.snippet,
            internalDate: emailMessage.internalDate,
            labelIds: emailMessage.labelIds || []
        };
        
        console.log('Email retrieved successfully:', {
            id: emailData.id,
            subject: emailData.subject,
            sender: emailData.sender
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                data: emailData
            })
        };
        
    } catch (error) {
        console.error('Error processing request:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}; 