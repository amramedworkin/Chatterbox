// src/mail/pollGmail.ts
// Single Gmail polling functionality
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';
import 'dotenv/config';
import config from '../loadConfig';
import { authorizeGmail } from './authorizeGmail';

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
 * Determines the Gmail user based on command line arguments or default config.
 * @returns {string} The Gmail user email.
 */
function determineGmailUser(): string {
    const emailArgIndex = process.argv.indexOf('--email');
    if (emailArgIndex > -1 && process.argv[emailArgIndex + 1]) {
        return process.argv[emailArgIndex + 1];
    }
    return config.app.defaultPollGmailUser;
}

/**
 * Checks if the user is authorized and provides detailed instructions if not.
 * @param {string} gmailUser The Gmail user email.
 * @returns {Promise<OAuth2Client>} An authenticated OAuth2 client.
 */
async function checkAuthorizationAndGetAuth(gmailUser: string): Promise<OAuth2Client> {
    try {
        // Try to authorize the user
        const auth = await authorizeGmail(gmailUser, config);
        return auth;
    } catch {
        logWithTimestamp('❌ Authorization failed for Gmail polling.');
        logWithTimestamp('💡 To fix this issue:');
        logWithTimestamp('   1. Run: npm run mail:authorize');
        logWithTimestamp('   2. Follow the authorization prompts for each Gmail user');
        logWithTimestamp('   3. Make sure your google_credentials.json file is valid');
        logWithTimestamp('   4. If problems persist, run: npm run mail:authorize --force');
        logWithTimestamp('   5. Ensure you have the correct Gmail scopes configured');
        logWithTimestamp('   6. Check that your Google Cloud project has Gmail API enabled');
        logWithTimestamp('');
        logWithTimestamp('🔧 Additional troubleshooting:');
        logWithTimestamp('   • Verify your .env file contains valid configuration');
        logWithTimestamp('   • Check that google_credentials.json is in the correct location');
        logWithTimestamp('   • Ensure your Google account has 2FA enabled if required');
        logWithTimestamp('   • Try running the authorization process in a different browser');
        logWithTimestamp('');
        logWithTimestamp('📞 Need help?');
        logWithTimestamp('   • Check the project README for setup instructions');
        logWithTimestamp('   • Review Google Cloud Console for API settings');
        logWithTimestamp('   • Open an issue on GitHub if problem persists');

        throw new Error(`Authorization failed for ${gmailUser}. Please run authorization first.`);
    }
}

// Local storage interfaces (mimicking DynamoDB structure)
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

interface LocalStorage {
    pendingEmails: PendingEmailJob[];
    lastUpdated: string;
}

/**
 * Gets the path to the local storage file for pending emails.
 * @param {string} gmailUser The Gmail user email.
 * @returns {string} The file path.
 */
function getPendingEmailsPath(gmailUser: string): string {
    const dataDir = path.join(process.cwd(), 'data');
    const safeUser = gmailUser.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(dataDir, `pending_emails_${safeUser}.json`);
}

/**
 * Loads pending emails from local storage.
 * @param {string} gmailUser The Gmail user email.
 * @returns {Promise<PendingEmailJob[]>} Array of pending email jobs.
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
            // File doesn't exist, return empty array
            return [];
        }
        logWithTimestamp(`Error loading pending emails: ${err}`);
        return [];
    }
}

/**
 * Saves pending emails to local storage.
 * @param {string} gmailUser The Gmail user email.
 * @param {PendingEmailJob[]} pendingEmails Array of pending email jobs.
 */
async function savePendingEmails(
    gmailUser: string,
    pendingEmails: PendingEmailJob[]
): Promise<void> {
    const filePath = getPendingEmailsPath(gmailUser);
    const dataDir = path.dirname(filePath);

    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true });

    const storage: LocalStorage = {
        pendingEmails,
        lastUpdated: new Date().toISOString(),
    };

    await fs.writeFile(filePath, JSON.stringify(storage, null, 2), 'utf8');
}

/**
 * Checks if a Gmail ID is already stored as a pending job.
 * @param {string} gmailId The Gmail message ID.
 * @param {string} gmailUser The Gmail user email.
 * @returns {Promise<boolean>} True if already stored.
 */
async function isEmailAlreadyStored(gmailId: string, gmailUser: string): Promise<boolean> {
    const pendingEmails = await loadPendingEmails(gmailUser);
    return pendingEmails.some((job) => job.gmailId === gmailId);
}

/**
 * Stores a pending email job in local storage.
 * @param {PendingEmailJob} job The pending email job to store.
 * @param {string} gmailUser The Gmail user email.
 */
async function storePendingEmailJob(job: PendingEmailJob, gmailUser: string): Promise<void> {
    const pendingEmails = await loadPendingEmails(gmailUser);
    pendingEmails.push(job);
    await savePendingEmails(gmailUser, pendingEmails);
    logWithTimestamp(`Stored pending email job for Gmail ID: ${job.gmailId}`);
}

/**
 * Extracts email metadata from a Gmail message.
 * @param {any} message The Gmail message object.
 * @param {string} gmailUser The Gmail user email.
 * @returns {object} Extracted metadata.
 */
function extractEmailMetadata(
    message: any,
    gmailUser: string
): {
    gmailId: string;
    subject: string;
    fromSender: string;
    receivedDate: string;
} {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';

    return {
        gmailId: message.id,
        subject: subject.trim(),
        fromSender: from.trim(),
        receivedDate: date.trim(),
    };
}

/**
 * Checks if an email is a Chatterbox email based on subject.
 * @param {any} message The Gmail message object.
 * @returns {boolean} True if it's a Chatterbox email.
 */
function isChatterboxEmail(message: any): boolean {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

    // Check if subject starts with "chatterbox" (case insensitive, ignoring leading whitespace)
    const trimmedSubject = subject.trim();
    const subjectLower = trimmedSubject.toLowerCase();

    // Check if "chatterbox" is the first standalone word in the subject
    if (subjectLower.startsWith('chatterbox')) {
        // Check if it's followed by whitespace or end of string
        const afterChatterbox = subjectLower.substring(10); // "chatterbox" is 10 characters
        if (afterChatterbox === '' || afterChatterbox.startsWith(' ')) {
            return true;
        }
    }

    return false;
}

/**
 * Fetches new emails since the last history ID.
 * @param {OAuth2Client} auth The authenticated OAuth2 client.
 * @param {string} gmailUser The Gmail user email.
 * @returns {Promise<{newMessages: string[], newHistoryId: string | null, chatterboxEmailIds: string[]}>} Object containing new message IDs, new history ID, and Chatterbox email IDs.
 */
export async function pollGmail(
    auth: OAuth2Client,
    gmailUser: string
): Promise<{ newMessages: string[]; newHistoryId: string | null; chatterboxEmailIds: string[] }> {
    const gmail = google.gmail({ version: 'v1', auth });
    const lastHistoryIdPath = config.google.lastHistoryIdPath;
    const totalPollCyclesPath = config.google.totalPollCyclesPath;

    let lastHistoryId: string | null = null;
    let totalPollCycles = 0;

    try {
        lastHistoryId = await fs.readFile(lastHistoryIdPath, 'utf8');
        totalPollCycles = parseInt((await fs.readFile(totalPollCyclesPath, 'utf8')) || '0');
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
            logWithTimestamp(`No existing history ID or total poll cycles found. Starting fresh.`);
        } else {
            logWithTimestamp(`Error reading history ID or total poll cycles file:`, err);
        }
    }

    totalPollCycles++; // Increment total cycles for this run

    logWithTimestamp(`--- Single Poll (Total: ${totalPollCycles}) for ${gmailUser} ---`);

    const newMessages: string[] = [];
    let newHistoryId: string | null = null;
    const chatterboxEmailIds: string[] = [];

    // If no history ID, search for recent emails instead of using History API
    if (!lastHistoryId) {
        logWithTimestamp('No history ID found. Searching for recent emails...');

        try {
            // Search for emails from the last 30 days (1 month)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const searchQuery = `after:${thirtyDaysAgo.toISOString().split('T')[0]}`;

            logWithTimestamp(`Searching for emails with query: ${searchQuery}`);

            const searchResponse = await gmail.users.messages.list({
                userId: gmailUser,
                q: searchQuery,
                maxResults: 50,
            });

            const messages = searchResponse.data.messages || [];
            logWithTimestamp(
                `Found ${messages.length} recent messages. Checking for Chatterbox emails...`
            );

            let chatterboxCount = 0;
            for (const messageRef of messages) {
                if (messageRef.id) {
                    try {
                        const messageResponse = await gmail.users.messages.get({
                            userId: gmailUser,
                            id: messageRef.id,
                            format: 'full',
                            metadataHeaders: ['Subject', 'From', 'Date'],
                        });

                        const fullMessage = messageResponse.data;

                        if (isChatterboxEmail(fullMessage)) {
                            logWithTimestamp(`Found Chatterbox email: ${messageRef.id}`);
                            newMessages.push(messageRef.id);

                            // Check if already stored
                            if (!(await isEmailAlreadyStored(messageRef.id, gmailUser))) {
                                const metadata = extractEmailMetadata(fullMessage, gmailUser);

                                // Store as pending job
                                const pendingJob: PendingEmailJob = {
                                    pk: `PENDING_EMAIL#${messageRef.id}`,
                                    sk: `USER#${gmailUser}`,
                                    gmailId: messageRef.id,
                                    userEmail: gmailUser,
                                    subject: metadata.subject,
                                    fromSender: metadata.fromSender,
                                    receivedDate: metadata.receivedDate,
                                    createdAt: new Date().toISOString(),
                                    status: 'pending',
                                    retryCount: 0,
                                };

                                await storePendingEmailJob(pendingJob, gmailUser);
                                chatterboxEmailIds.push(messageRef.id);
                                logWithTimestamp(`Stored Chatterbox email ID: ${messageRef.id}`);
                            } else {
                                logWithTimestamp(
                                    `Chatterbox email already stored: ${messageRef.id}`
                                );
                            }
                            chatterboxCount++;
                        }
                    } catch (error) {
                        logWithTimestamp(`Error fetching message ${messageRef.id}:`, error);
                    }
                }
            }

            logWithTimestamp(`Found ${chatterboxCount} Chatterbox emails in recent messages.`);

            // Get current history ID for future polls
            const profileResponse = await gmail.users.getProfile({ userId: gmailUser });
            if (profileResponse.data.historyId) {
                newHistoryId = profileResponse.data.historyId;
                await fs.writeFile(lastHistoryIdPath, newHistoryId);
                logWithTimestamp(`Set initial history ID to: ${newHistoryId}`);
            }
        } catch {
            logWithTimestamp('Error searching for recent emails');
        }
    } else {
        // Use History API for incremental polling
        try {
            const response = await gmail.users.history.list({
                userId: gmailUser,
                startHistoryId: lastHistoryId,
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
                                        userId: gmailUser,
                                        id: messageId,
                                        format: 'full',
                                        metadataHeaders: ['Subject', 'From', 'Date'],
                                    });

                                    const fullMessage = messageResponse.data;

                                    // Check if it's a Chatterbox email
                                    if (isChatterboxEmail(fullMessage)) {
                                        logWithTimestamp(
                                            `Processing Chatterbox email: ${messageId}`
                                        );

                                        // Check if already stored
                                        if (!(await isEmailAlreadyStored(messageId, gmailUser))) {
                                            const metadata = extractEmailMetadata(
                                                fullMessage,
                                                gmailUser
                                            );

                                            // Store as pending job
                                            const pendingJob: PendingEmailJob = {
                                                pk: `PENDING_EMAIL#${messageId}`,
                                                sk: `USER#${gmailUser}`,
                                                gmailId: messageId,
                                                userEmail: gmailUser,
                                                subject: metadata.subject,
                                                fromSender: metadata.fromSender,
                                                receivedDate: metadata.receivedDate,
                                                createdAt: new Date().toISOString(),
                                                status: 'pending',
                                                retryCount: 0,
                                            };

                                            await storePendingEmailJob(pendingJob, gmailUser);
                                            chatterboxEmailIds.push(messageId);
                                            logWithTimestamp(
                                                `Stored Chatterbox email ID: ${messageId}`
                                            );
                                        } else {
                                            logWithTimestamp(
                                                `Chatterbox email already stored: ${messageId}`
                                            );
                                        }
                                    } else {
                                        logWithTimestamp(
                                            `Skipping non-Chatterbox email: ${messageId}`
                                        );
                                    }
                                } catch (error) {
                                    logWithTimestamp(
                                        `Error processing message ${messageId}:`,
                                        error
                                    );
                                }
                            }
                        }
                    }
                }
            } else {
                logWithTimestamp('No new messages found.');
            }
        } catch (err: unknown) {
            const error = err as NodeJS.ErrnoException & { code?: number };
            if (error.code === 404 || error.code === 400) {
                // Likely an invalid history ID or initial sync
                logWithTimestamp(
                    'Error fetching Gmail history (possibly invalid history ID or first run). Resetting history ID.'
                );
                await fs
                    .unlink(lastHistoryIdPath)
                    .catch((err) => logWithTimestamp('Failed to delete lastHistoryIdPath:', err)); // Attempt to delete, log if not found
            } else {
                logWithTimestamp('Error fetching new emails:', err);
                throw error;
            }
        }
    }

    // Save total poll cycles
    await fs.writeFile(totalPollCyclesPath, totalPollCycles.toString());

    return { newMessages, newHistoryId, chatterboxEmailIds };
}

/**
 * Main function for single Gmail poll.
 */
async function main(): Promise<void> {
    const gmailUser = determineGmailUser();

    // Check for a clean command line argument
    if (process.argv.includes('--clean')) {
        logWithTimestamp('Cleaning up previous authorization and state...');
        try {
            // Delete google_tokens.json and last_history_id.txt for the current user
            await fs
                .unlink(config.google.pollTokenPath)
                .catch((err) => logWithTimestamp('Failed to delete pollTokenPath:', err));
            await fs
                .unlink(config.google.lastHistoryIdPath)
                .catch((err) => logWithTimestamp('Failed to delete lastHistoryIdPath:', err));
            await fs
                .unlink(config.google.totalPollCyclesPath)
                .catch((err) => logWithTimestamp('Failed to delete totalPollCyclesPath:', err));

            logWithTimestamp(
                'Cleanup complete. Please re-run the script to re-authorize and start fresh.'
            );
            return;
        } catch (err: unknown) {
            logWithTimestamp('Error during clean operation:', err);
            process.exit(1);
        }
    }

    try {
        // Check authorization and get authenticated client
        const auth = await checkAuthorizationAndGetAuth(gmailUser);

        // Perform single poll
        const result = await pollGmail(auth, gmailUser);

        logWithTimestamp(`Poll completed. Found ${result.newMessages.length} new messages.`);
        logWithTimestamp(`Stored ${result.chatterboxEmailIds.length} new Chatterbox email IDs.`);

        if (result.newMessages.length > 0) {
            logWithTimestamp('New message IDs:', result.newMessages);
        }

        if (result.chatterboxEmailIds.length > 0) {
            logWithTimestamp('New Chatterbox email IDs:', result.chatterboxEmailIds);
        }
    } catch (err: unknown) {
        logWithTimestamp('Failed to poll Gmail:', err);
        process.exit(1);
    }
}

// Only run main if this file is executed directly
if (require.main === module) {
    main();
}
