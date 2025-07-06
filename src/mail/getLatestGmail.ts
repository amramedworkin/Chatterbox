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
    endDays: number; // Days ago from today (0 = today)
}

/**
 * Default date range: last 30 days
 */
const DEFAULT_DATE_RANGE: DateRange = {
    startDays: 30,
    endDays: 0,
};

/**
 * Builds a Gmail search query for a date range
 * @param dateRange Date range parameters
 * @returns Gmail search query string
 */
function buildDateRangeQuery(dateRange: Partial<DateRange> = {}): string {
    const { startDays = DEFAULT_DATE_RANGE.startDays, endDays = DEFAULT_DATE_RANGE.endDays } =
        dateRange;

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
 * Gets the most recent Chatterbox Gmail ID
 * @param dateRange Date range parameters (optional, defaults to last 7 days)
 * @param userEmail Gmail user email (optional, defaults to config)
 * @param existingAuth Existing OAuth2 client (optional)
 * @returns Promise resolving to the most recent Gmail message ID, or null if none found
 */
export async function getMostRecentChatterboxGmailId(
    dateRange: Partial<DateRange> = { startDays: 30 },
    userEmail?: string,
    existingAuth?: OAuth2Client
): Promise<string | null> {
    const gmailUser = userEmail || config.app.defaultGetGmailUser;
    if (!existingAuth) {
        throw new Error(
            `OAuth2Client is required for Gmail user ${gmailUser}. Please ensure Gmail user is authorized via npm run mail:authorize`
        );
    }
    const gmail = google.gmail({ version: 'v1', auth: existingAuth });
    const dateQuery = buildDateRangeQuery(dateRange);
    const query = `subject:chatterbox ${dateQuery}`.trim();
    // Get only the first (most recent) result
    const { data } = await gmail.users.messages.list({
        userId: gmailUser,
        q: query,
        maxResults: 1, // Only get the most recent
    });
    if (data.messages && data.messages.length > 0) {
        return data.messages[0].id || null;
    }
    return null;
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
        throw new Error(
            `OAuth2Client is required for Gmail user ${gmailUser}. Please ensure Gmail user is authorized via npm run mail:authorize`
        );
    }

    const gmail = google.gmail({ version: 'v1', auth: existingAuth });

    const res = await gmail.users.messages.get({
        userId: gmailUser,
        id: messageId,
    });

    return res.data as GmailMessage;
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

    const subjectHeader = message.payload.headers.find(
        (header: any) => header.name.toLowerCase() === 'subject'
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

    const fromHeader = message.payload.headers.find(
        (header: any) => header.name.toLowerCase() === 'from'
    );

    return fromHeader ? fromHeader.value || '' : '';
}
