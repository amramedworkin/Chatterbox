// src/poll/pollGmail.ts
// Import necessary libraries.
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import 'dotenv/config';

// Load configuration from loadConfig.ts
import config from '../loadConfig'; // Changed to import from TS file
import { authorizeGmail } from '../utils/authorizeGmail'; // Corrected relative path

// --- Global Variables (derived from config and potentially command line) ---
let gmailUser: string = config.app.defaultPollGmailUser; // Initialized from config

// Polling interval in milliseconds (default from config, can be overridden by --interval)
let pollInterval: number = config.polling.defaultIntervalMilliseconds as number; // Type assertion after ensuring it's always a number in loadConfig.ts

// Default duration for polling (default from config, can be overridden by --duration)
let pollDurationMinutes: number = config.polling.defaultDurationMinutes; // Initialized from config

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
    return gmailUser;
}

/**
 * Fetches new emails since the last history ID.
 * @param {OAuth2Client} auth The authenticated OAuth2 client.
 * @param {number} currentPollingCycle The current polling cycle number.
 */
async function fetchNewEmails(auth: OAuth2Client, currentPollingCycle: number): Promise<void> {
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

    logWithTimestamp(
        `--- Polling Cycle ${currentPollingCycle} (Total: ${totalPollCycles}) for ${gmailUser} ---`
    );

    try {
        const response = await gmail.users.history.list({
            userId: gmailUser,
            startHistoryId: lastHistoryId || undefined,
            historyTypes: ['messageAdded'],
        });

        const history = response.data.history;
        if (history && history.length > 0) {
            logWithTimestamp(`Found ${history.length} new history entries.`);
            const newHistoryId = response.data.historyId;

            // Process new messages
            for (const entry of history) {
                if (entry.messagesAdded) {
                    for (const message of entry.messagesAdded) {
                        if (message.message?.id) {
                            logWithTimestamp(`New message ID: ${message.message.id}`);
                            // Here you would integrate with your LLM interaction logic
                            // For now, just logging the ID
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

        // Save total poll cycles
        await fs.writeFile(totalPollCyclesPath, totalPollCycles.toString());
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
        }
    }
}

/**
 * Main function to start the Gmail poller.
 */
async function main(): Promise<void> {
    gmailUser = determineGmailUser();

    // Command line argument overrides for interval and duration
    const intervalArgIndex = process.argv.indexOf('--interval');
    if (intervalArgIndex > -1 && process.argv[intervalArgIndex + 1]) {
        pollInterval = parseFloat(process.argv[intervalArgIndex + 1]) * 60 * 1000;
    }

    const durationArgIndex = process.argv.indexOf('--duration');
    if (durationArgIndex > -1 && process.argv[durationArgIndex + 1]) {
        pollDurationMinutes = parseFloat(process.argv[durationArgIndex + 1]);
    }

    // Check for a clean command line argument
    if (process.argv.includes('--clean')) {
        logWithTimestamp('Cleaning up previous authorization and state...');
        try {
            // Delete token.json and last_history_id.txt for the current user
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
        const authClient = await authorizeGmail(gmailUser, config);
        let runPollingCycleCount = 0; // Initialize run-specific counter

        // Initial poll (will increment runPollingCycleCount to 1)
        runPollingCycleCount++;
        await fetchNewEmails(authClient, runPollingCycleCount);

        // Set up interval for subsequent polls
        const intervalId = setInterval(async () => {
            runPollingCycleCount++;
            await fetchNewEmails(authClient, runPollingCycleCount);
        }, pollInterval);

        // Set up duration timeout if specified
        if (pollDurationMinutes > 0) {
            setTimeout(
                () => {
                    logWithTimestamp(
                        `\nPolling duration of ${pollDurationMinutes} minutes reached. Exiting script.`
                    );
                    clearInterval(intervalId); // Stop polling
                    process.exit(0); // Exit the process
                },
                pollDurationMinutes * 60 * 1000
            );
        }
    } catch (err: unknown) {
        logWithTimestamp('Failed to start poller:', err);
        process.exit(1); // Exit if initial authorization fails
    }
}

main();
