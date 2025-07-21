// src/mail/processIncomingMail.ts
// Process incoming mail queries from pending email jobs

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';
import 'dotenv/config';
import config from '../loadConfig';

// Interfaces for query processing
interface EmailQuery {
    gmailId: string;
    userEmail: string;
    fromSender: string;
    subject: string;
    body: string;
    attachments: EmailAttachment[];
    conversationId?: string;
    modelName?: string;
    receivedDate: string;
    queryType: 'standalone' | 'conversation';
    rawEmail: any; // Full Gmail message object
}

interface EmailAttachment {
    filename: string;
    mimeType: string;
    size: number;
    data: Buffer;
}

interface ProcessedQuery {
    queryId: string;
    emailQuery: EmailQuery;
    standardizedQuery: string;
    modelToUse: string;
    conversationContext?: any;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    errorMessage?: string;
    createdAt: string;
    processedAt?: string;
}

interface PendingEmailJob {
    pk: string;
    sk: string;
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

interface LocalStorage {
    pendingEmails: PendingEmailJob[];
    lastUpdated: string;
}

// --- Global Timestamp Formatter ---
let timestampFormatter: Intl.DateTimeFormat | null = null;

function getTimestamp(): string {
    if (!timestampFormatter) {
        timestampFormatter = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'America/New_York',
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

function logWithTimestamp(...args: unknown[]): void {
    const timestamp = getTimestamp();
    console.log(timestamp, ...args);
}

/**
 * Gets the path to the local storage file for pending emails.
 */
function getPendingEmailsPath(gmailUser: string): string {
    const dataDir = path.join(process.cwd(), 'data');
    const safeUser = gmailUser.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(dataDir, `pending_emails_${safeUser}.json`);
}

/**
 * Loads pending emails from local storage.
 */
async function loadPendingEmails(gmailUser: string): Promise<PendingEmailJob[]> {
    const filePath = getPendingEmailsPath(gmailUser);

    try {
        const data = await fs.readFile(filePath, 'utf8');
        const storage: LocalStorage = JSON.parse(data);
        return storage.pendingEmails || [];
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
            return [];
        }
        logWithTimestamp(`Error loading pending emails: ${err}`);
        return [];
    }
}

/**
 * Updates the status of a pending email job.
 */
async function updatePendingEmailStatus(
    gmailUser: string,
    gmailId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string
): Promise<void> {
    const filePath = getPendingEmailsPath(gmailUser);

    try {
        const data = await fs.readFile(filePath, 'utf8');
        const storage: LocalStorage = JSON.parse(data);

        const emailIndex = storage.pendingEmails.findIndex((email) => email.gmailId === gmailId);
        if (emailIndex !== -1) {
            storage.pendingEmails[emailIndex].status = status;
            storage.pendingEmails[emailIndex].lastProcessedAt = new Date().toISOString();
            if (errorMessage) {
                storage.pendingEmails[emailIndex].errorMessage = errorMessage;
            }
            storage.lastUpdated = new Date().toISOString();

            await fs.writeFile(filePath, JSON.stringify(storage, null, 2), 'utf8');
            logWithTimestamp(`Updated email ${gmailId} status to: ${status}`);
        }
    } catch (err) {
        logWithTimestamp(`Error updating email status: ${err}`);
    }
}

/**
 * Extracts full email content including body and attachments.
 */
async function extractFullEmailContent(
    auth: OAuth2Client,
    gmailUser: string,
    gmailId: string
): Promise<EmailQuery | null> {
    const gmail = google.gmail({ version: 'v1', auth });

    try {
        const messageResponse = await gmail.users.messages.get({
            userId: gmailUser,
            id: gmailId,
            format: 'full',
        });

        const message = messageResponse.data;
        const headers = message.payload?.headers || [];

        // Extract basic metadata
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';

        // Extract body content
        const body = extractEmailBody(message);

        // Extract attachments
        const attachments = await extractEmailAttachments(gmail, gmailUser, gmailId, message);

        // Parse conversation ID and model name from subject/body
        const { conversationId, modelName, cleanSubject, cleanBody } = parseEmailDirectives(
            subject,
            body
        );

        // Determine query type
        const queryType = conversationId ? 'conversation' : 'standalone';

        return {
            gmailId,
            userEmail: gmailUser,
            fromSender: from,
            subject: cleanSubject,
            body: cleanBody,
            attachments,
            conversationId,
            modelName,
            receivedDate: date,
            queryType,
            rawEmail: message,
        };
    } catch (error) {
        logWithTimestamp(`Error extracting email content for ${gmailId}:`, error);
        return null;
    }
}

/**
 * Extracts the email body content.
 */
function extractEmailBody(message: any): string {
    if (!message.payload) return '';

    // Handle multipart messages
    if (message.payload.parts) {
        // Find the text/plain part
        const textPart = message.payload.parts.find((part: any) => part.mimeType === 'text/plain');

        if (textPart && textPart.body && textPart.body.data) {
            return Buffer.from(textPart.body.data, 'base64').toString('utf8');
        }

        // Fallback to text/html if no text/plain
        const htmlPart = message.payload.parts.find((part: any) => part.mimeType === 'text/html');

        if (htmlPart && htmlPart.body && htmlPart.body.data) {
            const htmlContent = Buffer.from(htmlPart.body.data, 'base64').toString('utf8');
            // Simple HTML to text conversion (basic)
            return htmlContent
                .replace(/<[^>]*>/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }
    }

    // Handle simple text messages
    if (message.payload.body && message.payload.body.data) {
        return Buffer.from(message.payload.body.data, 'base64').toString('utf8');
    }

    return '';
}

/**
 * Extracts email attachments.
 */
async function extractEmailAttachments(
    gmail: any,
    gmailUser: string,
    gmailId: string,
    message: any
): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    if (!message.payload || !message.payload.parts) {
        return attachments;
    }

    // Recursively find all attachment parts
    const findAttachments = (parts: any[]): void => {
        for (const part of parts) {
            if (part.filename && part.body && part.body.attachmentId) {
                // This is an attachment
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || 'application/octet-stream',
                    size: parseInt(part.body.size) || 0,
                    data: Buffer.alloc(0), // Will be filled when needed
                });
            } else if (part.parts) {
                findAttachments(part.parts);
            }
        }
    };

    findAttachments(message.payload.parts);

    // Download attachment data for smaller files (< 1MB)
    for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        if (attachment.size < 1024 * 1024) {
            // 1MB limit
            try {
                const attachmentResponse = await gmail.users.messages.attachments.get({
                    userId: gmailUser,
                    messageId: gmailId,
                    id: message.payload.parts.find(
                        (part: any) => part.filename === attachment.filename
                    )?.body?.attachmentId,
                });

                if (attachmentResponse.data.data) {
                    attachment.data = Buffer.from(attachmentResponse.data.data, 'base64');
                }
            } catch (error) {
                logWithTimestamp(`Error downloading attachment ${attachment.filename}:`, error);
            }
        }
    }

    return attachments;
}

/**
 * Parses email directives like conversation ID and model name.
 */
function parseEmailDirectives(
    subject: string,
    body: string
): {
    conversationId?: string;
    modelName?: string;
    cleanSubject: string;
    cleanBody: string;
} {
    let conversationId: string | undefined;
    let modelName: string | undefined;

    // Extract conversation ID (<<<guid>>> format)
    const conversationIdRegex =
        /<<<([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>>>/g;
    const conversationMatches = [
        ...subject.matchAll(conversationIdRegex),
        ...body.matchAll(conversationIdRegex),
    ];
    if (conversationMatches.length > 0) {
        conversationId = conversationMatches[0][1];
    }

    // Extract model name (<<<model_name>>> format)
    const modelNameRegex = /<<<([^>]+)>>>/g;
    const modelMatches = [...subject.matchAll(modelNameRegex), ...body.matchAll(modelNameRegex)];
    for (const match of modelMatches) {
        const potentialModel = match[1];
        // Skip if it's a GUID (conversation ID)
        if (
            !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(
                potentialModel
            )
        ) {
            modelName = potentialModel;
            break;
        }
    }

    // Clean subject and body by removing directives
    let cleanSubject = subject.replace(conversationIdRegex, '').replace(modelNameRegex, '').trim();
    const cleanBody = body.replace(conversationIdRegex, '').replace(modelNameRegex, '').trim();

    // Remove "chatterbox" from subject if it's the first word
    cleanSubject = cleanSubject.replace(/^chatterbox\s+/i, '').trim();

    return {
        conversationId,
        modelName,
        cleanSubject,
        cleanBody,
    };
}

/**
 * Standardizes the email query for LLM processing.
 */
function standardizeQuery(emailQuery: EmailQuery): string {
    let query = '';

    // Use body if available, otherwise use subject
    if (emailQuery.body && emailQuery.body.trim()) {
        query = emailQuery.body.trim();
    } else if (emailQuery.subject && emailQuery.subject.trim()) {
        query = emailQuery.subject.trim();
    } else {
        throw new Error('No query content found in email');
    }

    // Add attachment information if present
    if (emailQuery.attachments.length > 0) {
        query += '\n\nAttachments:\n';
        for (const attachment of emailQuery.attachments) {
            query += `- ${attachment.filename} (${attachment.mimeType}, ${attachment.size} bytes)\n`;
        }
    }

    return query;
}

/**
 * Determines which LLM model to use.
 */
function determineModelToUse(emailQuery: EmailQuery): string {
    // If model is specified in email, use it (if supported)
    if (emailQuery.modelName) {
        // TODO: Validate against supported models
        return emailQuery.modelName;
    }

    // TODO: Check user preferences for default model
    // For now, use system default
    return config.openai.llmModel;
}

/**
 * Main function to process pending email queries.
 */
export async function processIncomingMail(
    auth: OAuth2Client,
    gmailUser: string
): Promise<ProcessedQuery[]> {
    logWithTimestamp(`Processing incoming mail for ${gmailUser}...`);

    // Load pending emails
    const pendingEmails = await loadPendingEmails(gmailUser);
    const pendingJobs = pendingEmails.filter((email) => email.status === 'pending');

    logWithTimestamp(`Found ${pendingJobs.length} pending email jobs to process`);

    const processedQueries: ProcessedQuery[] = [];

    for (const job of pendingJobs) {
        try {
            // Update status to processing
            await updatePendingEmailStatus(gmailUser, job.gmailId, 'processing');

            // Extract full email content
            const emailQuery = await extractFullEmailContent(auth, gmailUser, job.gmailId);

            if (!emailQuery) {
                await updatePendingEmailStatus(
                    gmailUser,
                    job.gmailId,
                    'failed',
                    'Failed to extract email content'
                );
                continue;
            }

            // Standardize the query
            const standardizedQuery = standardizeQuery(emailQuery);

            // Determine model to use
            const modelToUse = determineModelToUse(emailQuery);

            // Create processed query
            const processedQuery: ProcessedQuery = {
                queryId: `${job.gmailId}_${Date.now()}`,
                emailQuery,
                standardizedQuery,
                modelToUse,
                processingStatus: 'pending',
                createdAt: new Date().toISOString(),
            };

            processedQueries.push(processedQuery);

            // Update status to completed
            await updatePendingEmailStatus(gmailUser, job.gmailId, 'completed');

            logWithTimestamp(`Successfully processed email ${job.gmailId}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await updatePendingEmailStatus(gmailUser, job.gmailId, 'failed', errorMessage);
            logWithTimestamp(`Failed to process email ${job.gmailId}: ${errorMessage}`);
        }
    }

    logWithTimestamp(`Completed processing ${processedQueries.length} email queries`);
    return processedQueries;
}

/**
 * Main function for standalone execution.
 */
async function main(): Promise<void> {
    const gmailUser = process.argv[2] || config.app.defaultPollGmailUser;

    try {
        // Import and use the authorization function
        const { authorizeGmail } = await import('./authorizeGmail');
        const auth = await authorizeGmail(gmailUser, config);

        const processedQueries = await processIncomingMail(auth, gmailUser);

        logWithTimestamp(`Processed ${processedQueries.length} queries successfully`);

        // Log details of each processed query
        for (const query of processedQueries) {
            logWithTimestamp(`Query ID: ${query.queryId}`);
            logWithTimestamp(`From: ${query.emailQuery.fromSender}`);
            logWithTimestamp(`Subject: ${query.emailQuery.subject}`);
            logWithTimestamp(`Model: ${query.modelToUse}`);
            logWithTimestamp(`Type: ${query.emailQuery.queryType}`);
            if (query.emailQuery.conversationId) {
                logWithTimestamp(`Conversation ID: ${query.emailQuery.conversationId}`);
            }
            logWithTimestamp(`Attachments: ${query.emailQuery.attachments.length}`);
            logWithTimestamp('---');
        }
    } catch (error) {
        logWithTimestamp('Failed to process incoming mail:', error);
        process.exit(1);
    }
}

// Only run main if this file is executed directly
if (require.main === module) {
    main();
}
