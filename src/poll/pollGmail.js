// fastPollGmail.js
// Import necessary libraries.
// If you haven't installed them, run:
// npm install googleapis fs dotenv
const { google } = require('googleapis');
const fs = require('fs').promises; // Use promises version for async/await
const path = require('path');
require('dotenv').config(); // For loading API key from .env file

// Load configuration from loadConfig.js
const config = require('../loadConfig');

// Import authorization function from authorizeGmail.js
const { authorizeGmail } = require('../utils/authorizeGmail');

// Add these constants near the top of your file, e.g., after `const config = require('./loadConfig');`
// const LAST_POLLED_EMAIL_FILE_NAME = 'last_polled_email.txt'; // Renamed to match config.json
// Use the path from config.google.lastPolledEmailPath which is now absolute
// Or, if readLastPolledEmail is independent and needs its own path logic:
// const LAST_POLLED_FILE_PATH = path.join(__dirname, '..', 'data', LAST_POLLED_FILE_NAME);

// --- Global Variables (derived from config) ---
let gmailUser = config.app.defaultPollGmailUser; // Initialized from config
let pollInterval = config.polling.defaultIntervalMilliseconds; // Initialized from config
let pollDurationMinutes = config.polling.defaultDurationMinutes; // Initialized from config

// --- Global Timestamp Formatter ---
let timestampFormatter = null;

/**
 * Generates a formatted timestamp string in 'yyyymmdd:hhMMss:' (US Eastern Time).
 * @returns {string} The formatted timestamp.
 */
function getTimestamp() {
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

    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;
    const hour = parts.find((p) => p.type === 'hour').value;
    const minute = parts.find((p) => p.type === 'minute').value;
    const second = parts.find((p) => p.type === 'second').value;

    return `${year}${month}${day}:${hour}${minute}${second}:`;
}

/**
 * Logs messages to the console with a prepended timestamp.
 * @param {...any} args The arguments to log.
 */
function logWithTimestamp(...args) {
    console.log(getTimestamp(), ...args);
}

/**
 * Checks if a file exists asynchronously.
 * @param {string} filePath The path to the file.
 * @returns {Promise<boolean>} True if file exists, false otherwise.
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads the last polled email from a file.
 * @returns {Promise<string|null>} The last polled email or null if not found/error.
 */
async function readLastPolledEmail() {
    try {
        // Use the path from the config object, which is now absolute
        if (await fileExists(config.google.lastPolledEmailPath)) {
            return (await fs.readFile(config.google.lastPolledEmailPath, 'utf8')).trim();
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File not found, normal for first run
        }
        logWithTimestamp(`Error reading last polled email file: ${error.message}`);
    }
    return null;
}

/**
 * Writes the last polled email to a file.
 * @param {string} email The email address to write.
 * @returns {Promise<void>}
 */
async function writeLastPolledEmail(email) {
    try {
        // Ensure the directory exists before writing
        await fs.mkdir(path.dirname(config.google.lastPolledEmailPath), { recursive: true });
        await fs.writeFile(config.google.lastPolledEmailPath, email, 'utf8');
    } catch (error) {
        logWithTimestamp(`Error writing last polled email file: ${error.message}`);
    }
}

/**
 * Reads the last processed historyId from a file.
 * @returns {string} The last historyId, or '0' if not found.
 */
async function readLastHistoryId() {
    try {
        if (await fileExists(config.google.lastHistoryIdPath)) {
            return (await fs.readFile(config.google.lastHistoryIdPath, 'utf8')).trim();
        }
    } catch (err) {
        logWithTimestamp('Error reading last history ID file:', err);
    }
    return '0'; // Default to '0' if file doesn't exist or error
}

/**
 * Writes the last processed historyId to a file.
 * @param {string} historyId The historyId to write.
 */
async function writeLastHistoryId(historyId) {
    try {
        await fs.writeFile(config.google.lastHistoryIdPath, historyId.toString(), 'utf8');
    } catch (err) {
        logWithTimestamp('Error writing last history ID file:', err);
    }
}

/**
 * Reads the total persistent poll cycle count from a file.
 * @returns {Promise<number>} The total poll cycle count, or 0 if not found.
 */
async function readTotalPollCycles() {
    try {
        if (await fileExists(config.google.totalPollCyclesPath)) {
            return parseInt(await fs.readFile(config.google.totalPollCyclesPath, 'utf8'), 10);
        }
    } catch (err) {
        logWithTimestamp('Error reading total poll cycles file:', err);
    }
    return 0; // Default to 0 if file doesn't exist or error
}

/**
 * Writes the total persistent poll cycle count to a file.
 * @param {number} count The count to write.
 */
async function writeTotalPollCycles(count) {
    try {
        await fs.writeFile(config.google.totalPollCyclesPath, count.toString(), 'utf8');
    } catch (err) {
        logWithTimestamp('Error writing total poll cycles file:', err);
    }
}

/**
 * Determines the Gmail user based on command line arguments or configuration,
 * and handles automatic clean if the email changes.
 * @param {Array<string>} args Command line arguments.
 * @returns {Promise<string>} The determined Gmail user email.
 */
async function determineGmailUser(args) {
    const emailFlagIndex = args.indexOf('--email');
    if (emailFlagIndex > -1 && args[emailFlagIndex + 1]) {
        const newEmail = args[emailFlagIndex + 1].toLowerCase();
        const lastPolledEmail = await readLastPolledEmail(); // From original pollGmail, assumes path in config

        if (lastPolledEmail && lastPolledEmail !== newEmail) {
            logWithTimestamp(
                `Email address changed from ${lastPolledEmail} to ${newEmail}. Triggering automatic clean.`
            );
            // Perform clean operation
            try {
                if (await fileExists(config.google.pollTokenPath)) {
                    await fs.unlink(config.google.pollTokenPath);
                    logWithTimestamp('Deleted token.json');
                }
                if (await fileExists(config.google.lastHistoryIdPath)) {
                    await fs.unlink(config.google.lastHistoryIdPath);
                    logWithTimestamp('Deleted last_history_id.txt');
                }
                if (await fileExists(config.google.totalPollCyclesPath)) {
                    await fs.unlink(config.google.totalPollCyclesPath);
                    logWithTimestamp('Deleted total_poll_cycles.txt');
                }
            } catch (err) {
                logWithTimestamp('Error during automatic clean operation:', err);
            }
        }
        gmailUser = newEmail;
        await writeLastPolledEmail(gmailUser); // From original pollGmail, assumes path in config
        logWithTimestamp(`Polling email set to: ${gmailUser}`);
    } else {
        const storedEmail = await readLastPolledEmail(); // From original pollGmail, assumes path in config
        if (storedEmail) {
            gmailUser = storedEmail;
            logWithTimestamp(`Using last polled email: ${gmailUser}`);
        } else {
            gmailUser = config.app.defaultPollGmailUser;
            logWithTimestamp(`No --email specified. Using default email: ${gmailUser}`);
            await writeLastPolledEmail(gmailUser);
        }
    }
    return gmailUser;
}

/**
 * Fetches new emails using the Gmail API, specifically looking for "chatterbox" subjects.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {number} runPollingCycleCount The current polling cycle count for this run.
 * @returns {Promise<Array<string>>} A list of Gmail message IDs for new chatterbox emails.
 */
async function fastPollForChatterboxEmails(auth, runPollingCycleCount) {
    const gmail = google.gmail({ version: 'v1', auth });
    let lastHistoryId = await readLastHistoryId();
    const currentTime = new Date().toLocaleString();
    let totalPersistentPollCycles = await readTotalPollCycles();

    let chatterboxMessageIds = [];
    let maxHistoryId = lastHistoryId;

    if (totalPersistentPollCycles === 0) {
        totalPersistentPollCycles = 1;
    }
    if (runPollingCycleCount > totalPersistentPollCycles) {
        totalPersistentPollCycles = runPollingCycleCount;
    }

    logWithTimestamp(`Polling for new emails for ${gmailUser} since historyId: ${lastHistoryId}`);
    logWithTimestamp(
        `POLL: cycle ${runPollingCycleCount} in this run out of ${totalPersistentPollCycles} persisted total`
    );

    try {
        if (lastHistoryId === '0') {
            logWithTimestamp('First run or history reset. Getting current mailbox history ID...');
            const profileRes = await gmail.users.getProfile({ userId: gmailUser });
            const currentHistoryId = profileRes.data.historyId;
            await writeLastHistoryId(currentHistoryId);
            logWithTimestamp(
                `Set initial history ID to: ${currentHistoryId}. New emails will be fetched from the next poll.`
            );
            await writeTotalPollCycles(totalPersistentPollCycles);
            logWithTimestamp(
                `Updated total persistent poll cycles to: ${totalPersistentPollCycles}`
            );
            return []; // No new messages to process in this initial run
        }

        const res = await gmail.users.history.list({
            userId: gmailUser,
            startHistoryId: lastHistoryId,
            historyTypes: ['messageAdded'],
        });

        const history = res.data.history;
        if (!history || history.length === 0) {
            logWithTimestamp(`0 messages since last poll at ${currentTime}`);
            totalPersistentPollCycles++;
            await writeTotalPollCycles(totalPersistentPollCycles);
            logWithTimestamp(
                `Updated total persistent poll cycles to: ${totalPersistentPollCycles}`
            );
            return [];
        }

        const newMessages = [];
        history.forEach((h) => {
            if (h.messagesAdded) {
                h.messagesAdded.forEach((msgAdded) => {
                    newMessages.push(msgAdded.message.id);
                });
            }
            if (h.id && h.id > maxHistoryId) {
                maxHistoryId = h.id;
            }
        });

        if (newMessages.length === 0) {
            logWithTimestamp(`0 messages since last poll at ${currentTime}`);
            totalPersistentPollCycles++;
            await writeTotalPollCycles(totalPersistentPollCycles);
            logWithTimestamp(
                `Updated total persistent poll cycles to: ${totalPersistentPollCycles}`
            );
            return [];
        }

        logWithTimestamp(`${newMessages.length} messages since last poll at ${currentTime}`);

        // Define the regex for "chatterbox" subject parsing
        const chatterboxSubjectRegex =
            /^chatterbox\s*(?::\s*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}))?\s*(.*)$/i;

        // Fetch subjects for each new message to identify chatterbox emails
        for (const messageId of newMessages) {
            try {
                const msgRes = await gmail.users.messages.get({
                    userId: gmailUser,
                    id: messageId,
                    format: 'metadata', // Only fetch metadata (headers) to save bandwidth
                    fields: 'payload.headers', // Request only headers
                });

                const headers = msgRes.data.payload.headers;
                const subjectHeader = headers.find((h) => h.name === 'Subject');
                const subject = subjectHeader ? subjectHeader.value : '';

                if (subject.match(chatterboxSubjectRegex)) {
                    chatterboxMessageIds.push(messageId);
                }
            } catch (msgErr) {
                logWithTimestamp(
                    `Error fetching metadata for message ${messageId}:`,
                    msgErr.message
                );
            }
        }

        if (chatterboxMessageIds.length > 0) {
            logWithTimestamp(`Found ${chatterboxMessageIds.length} new chatterbox messages.`);
            logWithTimestamp('New Chatterbox Message IDs:');
            chatterboxMessageIds.forEach((id) => logWithTimestamp(`- ${id}`));
        } else {
            logWithTimestamp('No new chatterbox messages found in this poll.');
        }

        // After processing all new messages, update the last history ID
        if (maxHistoryId !== lastHistoryId) {
            await writeLastHistoryId(maxHistoryId);
            logWithTimestamp(`Updated last history ID to: ${maxHistoryId}`);
        }

        // Increment persistent total poll cycles after a successful poll
        totalPersistentPollCycles++;
        await writeTotalPollCycles(totalPersistentPollCycles);
        logWithTimestamp(`Updated total persistent poll cycles to: ${totalPersistentPollCycles}`);

        return chatterboxMessageIds;
    } catch (err) {
        logWithTimestamp('Error polling for emails from Gmail API:', err.message);
        if (err.code === 401) {
            logWithTimestamp(
                'Authentication error. Your tokens might be expired or invalid. Please delete token.json and re-run to re-authorize.'
            );
        } else if (
            err.errors &&
            err.errors[0] &&
            err.errors[0].message.includes('Invalid startHistoryId')
        ) {
            logWithTimestamp(
                'Invalid startHistoryId. This might happen if the history ID is too old or invalid. Resetting to 0 to fetch all messages.'
            );
            await writeLastHistoryId('0');
        }
        return []; // Return empty array on error
    }
}

// --- Main execution ---
async function main() {
    const args = process.argv.slice(2);
    const scriptName = path.basename(process.argv[1]);

    const showHelp = () => {
        logWithTimestamp(`\nUsage: node ${scriptName} [options]`);
        logWithTimestamp('\nOptions:');
        logWithTimestamp('   --help, --?           Display this help message and exit.');
        logWithTimestamp(
            `   --interval <float>    Number of minutes between email polls. Default: ${config.polling.defaultIntervalMinutes} minutes.`
        );
        logWithTimestamp(
            `   --duration <int>      Number of minutes to poll before the script exits. Default: ${config.polling.defaultDurationMinutes} minutes (0 for continuous).`
        );
        logWithTimestamp(
            `   --email <address>     Specify the Gmail address to poll. Default: ${config.app.defaultPollGmailUser}. Changes trigger automatic clean.`
        );
        logWithTimestamp('\nExamples:');
        logWithTimestamp(`   node ${scriptName} --interval 0.5`);
        logWithTimestamp(`   node ${scriptName} --duration 60`);
        logWithTimestamp(`   node ${scriptName} --email newaddress@gmail.com`);
        process.exit(0);
    };

    if (args.includes('--help') || args.includes('--?')) {
        showHelp();
    }

    // Determine gmailUser based on args or stored value
    gmailUser = await determineGmailUser(args);
    logWithTimestamp(`Starting fast Gmail poller for ${gmailUser}...`);

    try {
        // Use the authorizeGmail function from the new module
        const authClient = await authorizeGmail(gmailUser, config);
        let runPollingCycleCount = 0;

        // Override interval if provided in args
        const intervalFlagIndex = args.indexOf('--interval');
        if (intervalFlagIndex > -1 && args[intervalFlagIndex + 1]) {
            const intervalValue = parseFloat(args[intervalFlagIndex + 1]);
            if (!isNaN(intervalValue) && intervalValue > 0) {
                pollInterval = intervalValue * 60 * 1000; // Update global pollInterval
                logWithTimestamp(`Polling interval overridden to ${intervalValue} minutes.`);
            } else {
                logWithTimestamp(
                    `Invalid --interval value: ${args[intervalFlagIndex + 1]}. Using default.`
                );
            }
        }

        // Override duration if provided in args
        const durationFlagIndex = args.indexOf('--duration');
        if (durationFlagIndex > -1 && args[durationFlagIndex + 1]) {
            const durationValue = parseInt(args[durationFlagIndex + 1], 10);
            if (!isNaN(durationValue) && durationValue >= 0) {
                pollDurationMinutes = durationValue; // Update global pollDurationMinutes
                logWithTimestamp(
                    `Script will run for ${pollDurationMinutes} minutes before exiting.`
                );
            } else {
                logWithTimestamp(
                    `Invalid --duration value: ${args[durationFlagIndex + 1]}. Using default.`
                );
            }
        }

        // Initial poll
        runPollingCycleCount++;
        const chatterboxIds = await fastPollForChatterboxEmails(authClient, runPollingCycleCount);
        if (chatterboxIds.length > 0) {
            // Here you would pass chatterboxIds to your handler function/module
            logWithTimestamp(`Handler should process: ${chatterboxIds.join(', ')}`);
        }

        // Set up interval for subsequent polls using the (potentially overridden) global pollInterval
        const intervalId = setInterval(async () => {
            runPollingCycleCount++;
            const currentChatterboxIds = await fastPollForChatterboxEmails(
                authClient,
                runPollingCycleCount
            );
            if (currentChatterboxIds.length > 0) {
                // Here you would pass currentChatterboxIds to your handler function/module
                logWithTimestamp(`Handler should process: ${currentChatterboxIds.join(', ')}`);
            }
        }, pollInterval); // Use the global pollInterval

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
        } else {
            logWithTimestamp('Script will poll continuously.');
        }
    } catch (err) {
        logWithTimestamp('Failed to start fast poller:', err);
        process.exit(1);
    }
}

main();

// Export the core polling function if other modules need to trigger it manually
module.exports = { fastPollForChatterboxEmails, determineGmailUser };
