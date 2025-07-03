// src/mail/pollGmail.ts
// Single Gmail polling functionality
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
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

/**
 * Checks if an email is a Chatterbox email based on sender or subject.
 * @param {any} message The Gmail message object.
 * @returns {boolean} True if it's a Chatterbox email.
 */
function isChatterboxEmail(message: any): boolean {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';

    // Check if subject contains "Chatterbox"
    if (subject.toLowerCase().includes('chatterbox')) {
        return true;
    }

    // Check if from address contains "chatterbox" or known Chatterbox addresses
    const fromLower = from.toLowerCase();
    if (
        fromLower.includes('chatterbox') ||
        fromLower.includes('amram.dworkin@gmail.com') ||
        fromLower.includes('awsamram@gmail.com')
    ) {
        return true;
    }

    return false;
}

/**
 * Fetches new emails since the last history ID.
 * @param {OAuth2Client} auth The authenticated OAuth2 client.
 * @param {string} gmailUser The Gmail user email.
 * @returns {Promise<{newMessages: string[], newHistoryId: string | null}>} Object containing new message IDs and new history ID.
 */
export async function pollGmail(
    auth: OAuth2Client,
    gmailUser: string
): Promise<{ newMessages: string[]; newHistoryId: string | null }> {
    const gmail = google.gmail({ version: 'v1', auth });
    const lastHistoryIdPath = config.google.lastHistoryIdPath;
    const totalPollCyclesPath = config.google.totalPollCyclesPath;

    let lastHistoryId: string | null = null;
    let totalPollCycles: number = 0;

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

    // If no history ID, search for recent emails instead of using History API
    if (!lastHistoryId) {
        logWithTimestamp('No history ID found. Searching for recent emails...');

        try {
            // Search for emails from the last 24 hours
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const searchQuery = `after:${yesterday.toISOString().split('T')[0]}`;

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
                            format: 'metadata',
                            metadataHeaders: ['Subject', 'From', 'Date'],
                        });

                        if (isChatterboxEmail(messageResponse.data)) {
                            logWithTimestamp(`Found Chatterbox email: ${messageRef.id}`);
                            newMessages.push(messageRef.id);
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
                            }
                        }
                    }
                }

                // Save the new history ID for the next poll
                if (newHistoryId) {
                    await fs.writeFile(lastHistoryIdPath, newHistoryId);
                    logWithTimestamp(`Updated last history ID to: ${newHistoryId}`);
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
                await fs.unlink(lastHistoryIdPath).catch(() => {}); // Attempt to delete, ignore if not found
            } else {
                logWithTimestamp('Error fetching new emails:', err);
                throw error;
            }
        }
    }

    // Save total poll cycles
    await fs.writeFile(totalPollCyclesPath, totalPollCycles.toString());

    return { newMessages, newHistoryId };
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
            await fs.unlink(config.google.pollTokenPath).catch(() => {});
            await fs.unlink(config.google.lastHistoryIdPath).catch(() => {});
            await fs.unlink(config.google.totalPollCyclesPath).catch(() => {});

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

        if (result.newMessages.length > 0) {
            logWithTimestamp('New message IDs:', result.newMessages);
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
