// src/mail/generateResponses.ts
// Generate responses to processed email queries

import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';
import 'dotenv/config';
import config from '../loadConfig';
import { askAgent } from '../openai/askAgent';
import { sendEmail } from './sendGmail';

// Interfaces for response generation
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
    rawEmail: any;
}

interface EmailAttachment {
    filename: string;
    mimeType: string;
    size: number;
    data: Buffer;
}

interface ConversationContext {
    conversationId: string;
    messages: ConversationMessage[];
    lastUpdated: string;
    modelName: string;
    userEmail: string;
}

interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    gmailId?: string; // Link back to original email
}

interface GeneratedResponse {
    responseId: string;
    queryId: string;
    emailQuery: EmailQuery;
    responseContent: string;
    conversationId?: string;
    modelUsed: string;
    responseTime: number;
    errorMessage?: string;
    createdAt: string;
}

interface ResponseStorage {
    responses: GeneratedResponse[];
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
 * Gets the path to conversation storage file.
 */
function getConversationPath(conversationId: string): string {
    const dataDir = path.join(process.cwd(), 'data', 'conversations');
    return path.join(dataDir, `${conversationId}.json`);
}

/**
 * Gets the path to response storage file.
 */
function getResponseStoragePath(): string {
    const dataDir = path.join(process.cwd(), 'data');
    return path.join(dataDir, 'generated_responses.json');
}

/**
 * Loads conversation context from storage.
 */
async function loadConversation(conversationId: string): Promise<ConversationContext | null> {
    const filePath = getConversationPath(conversationId);
    
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
            return null;
        }
        logWithTimestamp(`Error loading conversation ${conversationId}: ${err}`);
        return null;
    }
}

/**
 * Saves conversation context to storage.
 */
async function saveConversation(conversation: ConversationContext): Promise<void> {
    const filePath = getConversationPath(conversation.conversationId);
    
    try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf8');
        logWithTimestamp(`Saved conversation ${conversation.conversationId}`);
    } catch (err) {
        logWithTimestamp(`Error saving conversation ${conversation.conversationId}: ${err}`);
    }
}

/**
 * Creates a new conversation context.
 */
function createNewConversation(
    conversationId: string,
    userEmail: string,
    modelName: string
): ConversationContext {
    return {
        conversationId,
        messages: [],
        lastUpdated: new Date().toISOString(),
        modelName,
        userEmail
    };
}

/**
 * Adds a message to conversation context.
 */
function addMessageToConversation(
    conversation: ConversationContext,
    role: 'user' | 'assistant',
    content: string,
    gmailId?: string
): void {
    conversation.messages.push({
        role,
        content,
        timestamp: new Date().toISOString(),
        gmailId
    });
    conversation.lastUpdated = new Date().toISOString();
}

/**
 * Formats conversation history for LLM context.
 */
function formatConversationHistory(conversation: ConversationContext): string {
    if (conversation.messages.length === 0) {
        return '';
    }
    
    let history = '\n\nPrevious conversation:\n';
    for (const message of conversation.messages) {
        const role = message.role === 'user' ? 'User' : 'Assistant';
        history += `${role}: ${message.content}\n`;
    }
    
    return history;
}

/**
 * Saves generated response to storage.
 */
async function saveGeneratedResponse(response: GeneratedResponse): Promise<void> {
    const filePath = getResponseStoragePath();
    
    try {
        let storage: ResponseStorage;
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            storage = JSON.parse(data);
        } catch (err: unknown) {
            const error = err as NodeJS.ErrnoException;
            if (error.code === 'ENOENT') {
                storage = { responses: [], lastUpdated: new Date().toISOString() };
            } else {
                throw error;
            }
        }
        
        storage.responses.push(response);
        storage.lastUpdated = new Date().toISOString();
        
        await fs.writeFile(filePath, JSON.stringify(storage, null, 2), 'utf8');
        logWithTimestamp(`Saved response ${response.responseId}`);
    } catch (err) {
        logWithTimestamp(`Error saving response: ${err}`);
    }
}

/**
 * Generates response content using LLM.
 */
async function generateResponseContent(
    query: string,
    conversationHistory: string,
    modelName: string,
    attachments: EmailAttachment[]
): Promise<string> {
    // Prepare the full prompt
    let fullQuery = query;
    
    if (conversationHistory) {
        fullQuery += conversationHistory;
    }
    
    // Add attachment information if present
    if (attachments.length > 0) {
        fullQuery += '\n\nAttachments provided:\n';
        for (const attachment of attachments) {
            fullQuery += `- ${attachment.filename} (${attachment.mimeType}, ${attachment.size} bytes)\n`;
        }
        fullQuery += '\nNote: Please reference any relevant information from the attachments in your response.';
    }
    
    try {
        const response = await askAgent({ prompt: fullQuery, model: modelName });
        return response.text;
    } catch (error) {
        logWithTimestamp(`Error generating response with LLM: ${error}`);
        throw error;
    }
}

/**
 * Formats email response subject.
 */
function formatResponseSubject(originalSubject: string, conversationId?: string): string {
    let subject = `Re: ${originalSubject}`;
    
    // Add conversation ID if present
    if (conversationId) {
        subject += ` <<<${conversationId}>>>`;
    }
    
    return subject;
}

/**
 * Formats email response body.
 */
function formatResponseBody(
    responseContent: string,
    conversationId?: string,
    modelName?: string
): string {
    let body = responseContent;
    
    // Add conversation ID if present
    if (conversationId) {
        body += `\n\n<<<${conversationId}>>>`;
    }
    
    // Add model name if specified
    if (modelName) {
        body += `\n<<<${modelName}>>>`;
    }
    
    return body;
}

/**
 * Sends email response.
 */
async function sendEmailResponse(
    auth: OAuth2Client,
    fromEmail: string,
    toEmail: string,
    subject: string,
    body: string
): Promise<void> {
    try {
        await sendEmail(
            fromEmail,
            {
                to: toEmail,
                subject,
                body
            },
            auth
        );
        logWithTimestamp(`Sent response email to ${toEmail}`);
    } catch (error) {
        logWithTimestamp(`Error sending response email: ${error}`);
        throw error;
    }
}

/**
 * Main function to generate responses for processed queries.
 */
export async function generateResponses(
    auth: OAuth2Client,
    processedQueries: ProcessedQuery[]
): Promise<GeneratedResponse[]> {
    logWithTimestamp(`Generating responses for ${processedQueries.length} queries...`);
    
    const generatedResponses: GeneratedResponse[] = [];
    
    for (const query of processedQueries) {
        const startTime = Date.now();
        
        try {
            logWithTimestamp(`Processing query ${query.queryId} from ${query.emailQuery.fromSender}`);
            
            // Load or create conversation context
            let conversation: ConversationContext | null = null;
            if (query.emailQuery.conversationId) {
                conversation = await loadConversation(query.emailQuery.conversationId);
                if (!conversation) {
                    // Create new conversation if not found
                    conversation = createNewConversation(
                        query.emailQuery.conversationId,
                        query.emailQuery.userEmail,
                        query.modelToUse
                    );
                }
            }
            
            // Add user message to conversation if it's a conversation
            if (conversation) {
                addMessageToConversation(
                    conversation,
                    'user',
                    query.standardizedQuery,
                    query.emailQuery.gmailId
                );
            }
            
            // Format conversation history
            const conversationHistory = conversation 
                ? formatConversationHistory(conversation)
                : '';
            
            // Generate response content
            const responseContent = await generateResponseContent(
                query.standardizedQuery,
                conversationHistory,
                query.modelToUse,
                query.emailQuery.attachments
            );
            
            // Add assistant response to conversation if it's a conversation
            if (conversation) {
                addMessageToConversation(conversation, 'assistant', responseContent);
                await saveConversation(conversation);
            }
            
            // Create generated response object
            const generatedResponse: GeneratedResponse = {
                responseId: `${query.queryId}_response_${Date.now()}`,
                queryId: query.queryId,
                emailQuery: query.emailQuery,
                responseContent,
                conversationId: conversation?.conversationId,
                modelUsed: query.modelToUse,
                responseTime: Date.now() - startTime,
                createdAt: new Date().toISOString()
            };
            
            generatedResponses.push(generatedResponse);
            
            // Save response to storage
            await saveGeneratedResponse(generatedResponse);
            
            // Send email response
            const responseSubject = formatResponseSubject(
                query.emailQuery.subject,
                conversation?.conversationId
            );
            
            const responseBody = formatResponseBody(
                responseContent,
                conversation?.conversationId,
                query.modelToUse
            );
            
            await sendEmailResponse(
                auth,
                query.emailQuery.userEmail,
                query.emailQuery.fromSender,
                responseSubject,
                responseBody
            );
            
            logWithTimestamp(`Successfully generated and sent response for query ${query.queryId}`);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logWithTimestamp(`Failed to generate response for query ${query.queryId}: ${errorMessage}`);
            
            // Create error response object
            const errorResponse: GeneratedResponse = {
                responseId: `${query.queryId}_error_${Date.now()}`,
                queryId: query.queryId,
                emailQuery: query.emailQuery,
                responseContent: '',
                conversationId: query.emailQuery.conversationId,
                modelUsed: query.modelToUse,
                responseTime: Date.now() - startTime,
                errorMessage,
                createdAt: new Date().toISOString()
            };
            
            generatedResponses.push(errorResponse);
            await saveGeneratedResponse(errorResponse);
        }
    }
    
    logWithTimestamp(`Completed generating responses for ${generatedResponses.length} queries`);
    return generatedResponses;
}

/**
 * Main function for standalone execution.
 */
async function main(): Promise<void> {
    try {
        // Import the processIncomingMail function to get processed queries
        const { processIncomingMail } = await import('./processIncomingMail');
        const { authorizeGmail } = await import('./authorizeGmail');
        
        const gmailUser = process.argv[2] || config.app.defaultPollGmailUser;
        const auth = await authorizeGmail(gmailUser, config);
        
        // Process incoming mail first
        const processedQueries = await processIncomingMail(auth, gmailUser);
        
        if (processedQueries.length === 0) {
            logWithTimestamp('No queries to process');
            return;
        }
        
        // Generate responses
        const generatedResponses = await generateResponses(auth, processedQueries);
        
        logWithTimestamp(`Generated ${generatedResponses.length} responses`);
        
        // Log summary
        const successfulResponses = generatedResponses.filter(r => !r.errorMessage);
        const failedResponses = generatedResponses.filter(r => r.errorMessage);
        
        logWithTimestamp(`Successful responses: ${successfulResponses.length}`);
        logWithTimestamp(`Failed responses: ${failedResponses.length}`);
        
        if (failedResponses.length > 0) {
            logWithTimestamp('Failed responses:');
            for (const response of failedResponses) {
                logWithTimestamp(`  ${response.queryId}: ${response.errorMessage}`);
            }
        }
        
    } catch (error) {
        logWithTimestamp('Failed to generate responses:', error);
        process.exit(1);
    }
}

// Only run main if this file is executed directly
if (require.main === module) {
    main();
} 