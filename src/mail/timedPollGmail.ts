// src/mail/timedPollGmail.ts
// Timed Gmail polling functionality
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import 'dotenv/config';
import config from '../loadConfig';
import { authorizeGmail } from './authorizeGmail';
import { pollGmail } from './pollGmail';

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
 * Performs a single polling cycle using the pollGmail function.
 * @param {OAuth2Client} auth The authenticated OAuth2 client.
 * @param {number} currentPollingCycle The current polling cycle number.
 */
async function performPollingCycle(auth: OAuth2Client, currentPollingCycle: number): Promise<void> {
    try {
        const result = await pollGmail(auth, gmailUser);

        logWithTimestamp(
            `Polling cycle ${currentPollingCycle} completed. Found ${result.newMessages.length} new messages.`
        );

        if (result.newMessages.length > 0) {
            logWithTimestamp('New message IDs:', result.newMessages);
            // Here you would integrate with your LLM interaction logic
            // For now, just logging the IDs
        }
    } catch (error) {
        logWithTimestamp(`Error during polling cycle ${currentPollingCycle}:`, error);
        // Continue polling even if one cycle fails
    }
}

/**
 * Main function to start the timed Gmail poller.
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
            // Delete google_tokens.json and last_history_id.txt for the current user
            await fs.unlink(config.google.pollTokenPath).catch(() => {});
            await fs.unlink(config.google.lastHistoryIdPath).catch(() => {});
            await fs.unlink(config.google.totalPollCyclesPath).catch(() => {});

            logWithTimestamp(
                'Cleanup complete. Please re-run the script to re-authorize and start fresh.'
            );
            return;
        } catch {
            logWithTimestamp('Error during clean operation');
            process.exit(1);
        }
    }

    try {
        // Check authorization and get authenticated client
        const auth = await checkAuthorizationAndGetAuth(gmailUser);

        logWithTimestamp(`Starting timed Gmail poller for ${gmailUser}`);
        logWithTimestamp(`Poll interval: ${pollInterval / 1000 / 60} minutes`);
        logWithTimestamp(`Duration: ${pollDurationMinutes} minutes`);
        logWithTimestamp(
            `Total cycles: ${Math.ceil((pollDurationMinutes * 60 * 1000) / pollInterval)}`
        );

        const startTime = Date.now();
        const endTime = startTime + pollDurationMinutes * 60 * 1000;
        let currentPollingCycle = 1;

        // Perform initial poll
        await performPollingCycle(auth, currentPollingCycle);

        // Set up interval for subsequent polls
        const intervalId = setInterval(async () => {
            currentPollingCycle++;

            // Check if we've exceeded the duration
            if (Date.now() >= endTime) {
                logWithTimestamp('Polling duration reached. Stopping poller.');
                clearInterval(intervalId);
                return;
            }

            await performPollingCycle(auth, currentPollingCycle);
        }, pollInterval);

        // Set up timeout to stop polling after the specified duration
        setTimeout(
            () => {
                logWithTimestamp('Polling duration reached. Stopping poller.');
                clearInterval(intervalId);
            },
            pollDurationMinutes * 60 * 1000
        );
    } catch (err: unknown) {
        logWithTimestamp('Failed to start poller:', err);
        process.exit(1);
    }
}

// Only run main if this file is executed directly
if (require.main === module) {
    main();
}
