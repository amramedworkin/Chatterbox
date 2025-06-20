import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import config from '../loadConfig';

// Types for Gmail message data
export interface GmailMessage {
    id: string;
    threadId: string;
    labelIds?: string[];
    snippet?: string;
    historyId?: string;
    internalDate?: string;
    payload?: any;
    sizeEstimate?: number;
    raw?: string;
}

export interface DateRange {
    startDays: number; // Days ago from today
    endDays: number;   // Days ago from today (0 = today)
}

/**
 * Default date range: last 7 days
 */
const DEFAULT_DATE_RANGE: DateRange = {
    startDays: 7,
    endDays: 0
};

/**
 * Builds a Gmail search query for a date range
 * @param dateRange Date range parameters
 * @returns Gmail search query string
 */
function buildDateRangeQuery(dateRange: Partial<DateRange> = {}): string {
    const { startDays = DEFAULT_DATE_RANGE.startDays, endDays = DEFAULT_DATE_RANGE.endDays } = dateRange;
    
    const queryParts: string[] = [];
    
    if (startDays > 0) {
        queryParts.push(`newer_than:${startDays}d`);
    }
    
    if (endDays > 0) {
        queryParts.push(`older_than:${endDays}d`);
    }
    
    return queryParts.join(' ');
}

/**
 * Gets all Gmail unique IDs in a date range
 * @param dateRange Date range parameters (optional)
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to array of Gmail message IDs
 */
export async function getAllGmailIds(
    dateRange: Partial<DateRange> = {},
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<string[]> {
    const gmailUser = userEmail || config.app.defaultGetGmailUser;
    
    if (!existingAuth) {
        throw new Error(`OAuth2Client is required for Gmail user ${gmailUser}. Please ensure Gmail user is authorized via npm run mail:authorize`);
    }
    
    const gmail = google.gmail({ version: 'v1', auth: existingAuth });

    const query = buildDateRangeQuery(dateRange);
    const messageIds: string[] = [];
    let pageToken: string | undefined;
    const maxResults = 100;

    do {
        const res = await gmail.users.messages.list({
            userId: gmailUser,
            q: query,
            pageToken,
            maxResults,
        });

        if (res.data.messages) {
            for (const msg of res.data.messages) {
                if (msg.id) {
                    messageIds.push(msg.id);
                }
            }
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return messageIds;
}

/**
 * Gets all Chatterbox Gmail IDs in a date range
 * Chatterbox emails have subject line starting with "chatterbox" (case insensitive)
 * @param dateRange Date range parameters (optional)
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to array of Gmail message IDs
 */
export async function getChatterboxGmailIds(
    dateRange: Partial<DateRange> = {},
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<string[]> {
    const gmailUser = userEmail || config.app.defaultGetGmailUser;
    
    if (!existingAuth) {
        throw new Error(`OAuth2Client is required for Gmail user ${gmailUser}. Please ensure Gmail user is authorized via npm run mail:authorize`);
    }
    
    const gmail = google.gmail({ version: 'v1', auth: existingAuth });

    const dateQuery = buildDateRangeQuery(dateRange);
    const query = `subject:chatterbox ${dateQuery}`.trim();
    
    const messageIds: string[] = [];
    let pageToken: string | undefined;
    const maxResults = 100;

    do {
        const res = await gmail.users.messages.list({
            userId: gmailUser,
            q: query,
            pageToken,
            maxResults,
        });

        if (res.data.messages) {
            for (const msg of res.data.messages) {
                if (msg.id) {
                    messageIds.push(msg.id);
                }
            }
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return messageIds;
}

/**
 * Gets all Chatterbox conversation Gmail IDs in a date range
 * Conversation emails have a GUID right after "chatterbox" or separated by a colon
 * @param dateRange Date range parameters (optional)
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to array of Gmail message IDs
 */
export async function getChatterboxConversationGmailIds(
    dateRange: Partial<DateRange> = {},
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<string[]> {
    const gmailUser = userEmail || config.app.defaultGetGmailUser;
    
    if (!existingAuth) {
        throw new Error(`OAuth2Client is required for Gmail user ${gmailUser}. Please ensure Gmail user is authorized via npm run mail:authorize`);
    }
    
    const gmail = google.gmail({ version: 'v1', auth: existingAuth });

    const dateQuery = buildDateRangeQuery(dateRange);
    // Search for chatterbox followed by GUID pattern
    const query = `subject:chatterbox* ${dateQuery}`.trim();
    
    const messageIds: string[] = [];
    let pageToken: string | undefined;
    const maxResults = 100;

    do {
        const res = await gmail.users.messages.list({
            userId: gmailUser,
            q: query,
            pageToken,
            maxResults,
        });

        if (res.data.messages) {
            for (const msg of res.data.messages) {
                if (msg.id) {
                    messageIds.push(msg.id);
                }
            }
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return messageIds;
}

/**
 * Gets a Gmail message by unique ID
 * @param messageId Gmail message ID
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to Gmail message object
 */
export async function getGmailById(
    messageId: string,
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<GmailMessage> {
    const gmailUser = userEmail || config.app.defaultGetGmailUser;
    
    if (!existingAuth) {
        throw new Error(`OAuth2Client is required for Gmail user ${gmailUser}. Please ensure Gmail user is authorized via npm run mail:authorize`);
    }
    
    const gmail = google.gmail({ version: 'v1', auth: existingAuth });

    const res = await gmail.users.messages.get({
        userId: gmailUser,
        id: messageId,
    });

    return res.data as GmailMessage;
}

/**
 * Gets multiple Gmail messages by their IDs
 * @param messageIds Array of Gmail message IDs
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to array of Gmail message objects
 */
export async function getGmailsByIds(
    messageIds: string[],
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<GmailMessage[]> {
    const gmailUser = userEmail || config.app.defaultGetGmailUser;
    
    if (!existingAuth) {
        throw new Error(`OAuth2Client is required for Gmail user ${gmailUser}. Please ensure Gmail user is authorized via npm run mail:authorize`);
    }
    
    const gmail = google.gmail({ version: 'v1', auth: existingAuth });

    const messages: GmailMessage[] = [];
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (messageId) => {
            try {
                const res = await gmail.users.messages.get({
                    userId: gmailUser,
                    id: messageId,
                });
                return res.data as GmailMessage;
            } catch (error) {
                console.warn(`Failed to fetch message ${messageId}:`, error);
                return null;
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        messages.push(...batchResults.filter((msg): msg is GmailMessage => msg !== null));
    }

    return messages;
}

/**
 * Gets a range of Gmail messages (returns messages, not IDs)
 * @param dateRange Date range parameters (optional)
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to array of Gmail message objects
 */
export async function getGmailRange(
    dateRange: Partial<DateRange> = {},
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<GmailMessage[]> {
    const messageIds = await getAllGmailIds(dateRange, userEmail, existingAuth);
    return await getGmailsByIds(messageIds, userEmail, existingAuth);
}

/**
 * Gets a range of Chatterbox Gmail messages (returns messages, not IDs)
 * @param dateRange Date range parameters (optional)
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to array of Gmail message objects
 */
export async function getChatterboxGmailRange(
    dateRange: Partial<DateRange> = {},
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<GmailMessage[]> {
    const messageIds = await getChatterboxGmailIds(dateRange, userEmail, existingAuth);
    return await getGmailsByIds(messageIds, userEmail, existingAuth);
}

/**
 * Gets a range of Chatterbox conversation Gmail messages (returns messages, not IDs)
 * @param dateRange Date range parameters (optional)
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to array of Gmail message objects
 */
export async function getChatterboxConversationGmailRange(
    dateRange: Partial<DateRange> = {},
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<GmailMessage[]> {
    const messageIds = await getChatterboxConversationGmailIds(dateRange, userEmail, existingAuth);
    return await getGmailsByIds(messageIds, userEmail, existingAuth);
}

/**
 * Helper function to extract conversation ID from subject line
 * @param subject Email subject line
 * @returns Conversation ID if found, null otherwise
 */
export function extractConversationId(subject: string): string | null {
    const chatterboxPattern = /chatterbox\s*:?\s*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i;
    const match = subject.match(chatterboxPattern);
    return match ? match[1] : null;
}

/**
 * Helper function to get email subject from Gmail message
 * @param message Gmail message object
 * @returns Subject line or empty string
 */
export function getEmailSubject(message: GmailMessage): string {
    if (!message.payload || !message.payload.headers) {
        return '';
    }
    
    const subjectHeader = message.payload.headers.find((header: any) => 
        header.name.toLowerCase() === 'subject'
    );
    
    return subjectHeader ? subjectHeader.value || '' : '';
}

/**
 * Helper function to get email sender from Gmail message
 * @param message Gmail message object
 * @returns Sender email or empty string
 */
export function getEmailSender(message: GmailMessage): string {
    if (!message.payload || !message.payload.headers) {
        return '';
    }
    
    const fromHeader = message.payload.headers.find((header: any) => 
        header.name.toLowerCase() === 'from'
    );
    
    return fromHeader ? fromHeader.value || '' : '';
}

/**
 * Helper function to get email body from Gmail message
 * @param message Gmail message object
 * @returns Email body text or empty string
 */
export function getEmailBody(message: GmailMessage): string {
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