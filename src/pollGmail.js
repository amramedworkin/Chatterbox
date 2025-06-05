// Import necessary libraries.
// If you haven't installed them, run:
// npm install googleapis fs readline dotenv
const { google } = require('googleapis');
const fs = require('fs').promises; // Use promises version for async/await
const path = require('path');
const readline = require('readline');
const crypto = require('crypto'); // For generating GUIDs

// Load configuration from loadConfig.js
// This assumes loadConfig.js is located in the same directory as pollGmail.js (i.e., in 'src/')
const config = require('./loadConfig');

// --- Global Variables (derived from config and potentially command line) ---
// The email address to poll (default from config, can be overridden by --email)
let gmailUser = config.app.defaultPollGmailUser; // Initialized from config

// Polling interval in milliseconds (default from config, can be overridden by --interval)
let pollInterval = config.polling.defaultIntervalMilliseconds; // Initialized from config
// Default duration for polling (default from config, can be overridden by --duration)
let pollDurationMinutes = config.polling.defaultDurationMinutes; // Initialized from config

// --- Global Timestamp Formatter ---
let timestampFormatter = null;

/**
 * Generates a formatted timestamp string in 'yyyymmdd:hhMMss:' (US Eastern Time).
 * @returns {string} The formatted timestamp.
 */
function getTimestamp() {
    if (!timestampFormatter) {
        // Initialize formatter for 'yyyyMMdd:hhMMss:' in America/New_York (Eastern Time)
        // Adjust options for 2-digit month, day, hour, minute, second
        timestampFormatter = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false, // 24-hour format
            timeZone: 'America/New_York' // US Eastern Time
        });
    }

    const now = new Date();
    const parts = timestampFormatter.formatToParts(now);

    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;

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
 * Logs messages in a key-value pair format with vertical alignment.
 * @param {string} prompt The label for the value.
 * @param {any} value The value to log.
 * @param {number} [padding=11] The total width to pad the prompt to.
 */
function logFormatted(prompt, value, padding = 11) { // Max prompt "TIMESTAMP" is 9, so padding 11 for "prompt: " alignment
    logWithTimestamp(`${prompt.padEnd(padding)}: ${value}`);
}

// --- OAuth 2.0 Client Setup ---
let oAuth2Client;

/**
 * Reads credentials from a file, then authorizes the client.
 */
async function authorize() {
    try {
        // Use config.google.credentialsPath which loadConfig.js sets correctly (e.g., "../credentials.json")
        const credentials = await fs.readFile(config.google.credentialsPath);
        const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;

        oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, config.google.redirectUri // Use redirectUri from config
        );

        // Check if we have previously stored tokens
        // Use config.google.pollTokenPath which loadConfig.js sets correctly (e.g., "../data/token.json")
        if (await fileExists(config.google.pollTokenPath)) {
            const token = await fs.readFile(config.google.pollTokenPath);
            oAuth2Client.setCredentials(JSON.parse(token));
            logWithTimestamp(`Using existing tokens for ${gmailUser}.`);
        } else {
            // If no tokens, get new ones (first-time authorization)
            await getNewToken(oAuth2Client);
        }
        return oAuth2Client;
    } catch (err) {
        logWithTimestamp('Error loading client secret file or authorizing:', err);
        throw err;
    }
}

/**
 * Get and store new token after prompting for user authorization.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Request a refresh token
        scope: config.google.scopes, // Use scopes from config
    });
    logWithTimestamp(`Authorize this app for ${gmailUser} by visiting this URL:`);
    logWithTimestamp(authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', async (code) => {
            rl.close();
            try {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                // Store the tokens for future use
                // Use config.google.pollTokenPath
                await fs.writeFile(config.google.pollTokenPath, JSON.stringify(tokens));
                logWithTimestamp('Tokens stored to', config.google.pollTokenPath);
                resolve(oAuth2Client);
            } catch (err) {
                logWithTimestamp('Error retrieving access token', err);
                reject(err);
            }
        });
    });
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
 * Reads the last processed historyId from a file.
 * @returns {string} The last historyId, or '0' if not found.
 */
async function readLastHistoryId() {
    try {
        // Use config.google.lastHistoryIdPath
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
        // Use config.google.lastHistoryIdPath
        await fs.writeFile(config.google.lastHistoryIdPath, historyId.toString(), 'utf8');
    } catch (err) {
        logWithTimestamp('Error writing last history ID file:', err);
    }
}

/**
 * Reads the last polled email address from a file.
 * @returns {string|null} The last polled email address, or null if not found.
 */
async function readLastPolledEmail() {
    try {
        // Use config.google.lastPolledEmailPath
        if (await fileExists(config.google.lastPolledEmailPath)) {
            return (await fs.readFile(config.google.lastPolledEmailPath, 'utf8')).trim();
        }
    } catch (err) {
        logWithTimestamp('Error reading last polled email file:', err);
    }
    return null;
}

/**
 * Writes the current polled email address to a file.
 * @param {string} email The email address to write.
 */
async function writeLastPolledEmail(email) {
    try {
        // Use config.google.lastPolledEmailPath
        await fs.writeFile(config.google.lastPolledEmailPath, email, 'utf8');
    } catch (err) {
        logWithTimestamp('Error writing last polled email file:', err);
    }
}

/**
 * Reads the total persistent poll cycle count from a file.
 * @returns {Promise<number>} The total poll cycle count, or 0 if not found.
 */
async function readTotalPollCycles() {
    try {
        // Use config.google.totalPollCyclesPath
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
        // Use config.google.totalPollCyclesPath
        await fs.writeFile(config.google.totalPollCyclesPath, count.toString(), 'utf8');
    } catch (err) {
        logWithTimestamp('Error writing total poll cycles file:', err);
    }
}

/**
 * Recursively finds a part with a specific MIME type and collects attachment info.
 * @param {Array} parts The array of message parts.
 * @param {string} mimeType The MIME type to find for the email body.
 * @param {object} gmail The Gmail API client.
 * @param {string} messageId The ID of the current message.
 * @param {string} attachmentSavePath The path to save attachments.
 * @returns {object} An object containing the decoded body content and attachment info.
 * { prompt: string|null, attachments: Array<{filename: string, size: number}> }
 */
async function processMessageParts(parts, mimeType, gmail, messageId, attachmentSavePath) {
    let bodyContent = null;
    let attachments = []; // Array to store details of each attachment

    if (!parts) return { prompt: null, attachments: [] };

    for (const part of parts) {
        // Handle text/plain or text/html body content
        if (part.mimeType === mimeType && part.body && part.body.data) {
            bodyContent = Buffer.from(part.body.data, 'base64').toString('utf8');
        }

        // Handle attachments
        if (part.filename && part.body) {
            const attachmentFilename = part.filename;
            let attachmentData;

            if (part.body.data) {
                // Small attachment data directly in the part
                attachmentData = Buffer.from(part.body.data, 'base64');
            } else if (part.body.attachmentId) {
                // Larger attachment, requires a separate API call
                try {
                    const attachmentRes = await gmail.users.messages.attachments.get({
                        userId: gmailUser,
                        messageId: messageId,
                        id: part.body.attachmentId
                    });
                    attachmentData = Buffer.from(attachmentRes.data.data, 'base64');
                } catch (attachErr) {
                    logWithTimestamp(`Error fetching attachment ${attachmentFilename}:`, attachErr.message);
                    continue; // Skip this attachment
                }
            }

            if (attachmentData) {
                if (attachmentSavePath) { // Only save if a path is provided
                    const attachmentFilePath = path.join(attachmentSavePath, attachmentFilename);
                    try {
                        await fs.writeFile(attachmentFilePath, attachmentData);
                        // logWithTimestamp(`  Saved attachment: ${attachmentFilename} to ${attachmentSavePath}`); // Moved logging to main loop
                    } catch (saveErr) {
                        logWithTimestamp(`Error saving attachment ${attachmentFilename}:`, saveErr.message);
                    }
                }
                attachments.push({ filename: attachmentFilename, size: attachmentData.length });
            }
        }

        // Recursively process nested parts
        if (part.parts) {
            const nestedResult = await processMessageParts(part.parts, mimeType, gmail, messageId, attachmentSavePath);
            if (nestedResult.prompt) bodyContent = nestedResult.prompt;
            attachments = attachments.concat(nestedResult.attachments); // Concatenate attachments from nested parts
        }
    }
    return { prompt: bodyContent, attachments: attachments };
}

/**
 * Sends a confirmation email using the Gmail API.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {string} toEmail The recipient's email address.
 * @param {string} originalSubject The subject of the original email.
 * @param {string} conversationId The conversation ID (GUID or 'completion').
 * @param {number} bodyLength The length of the email body in bytes.
 * @param {number} attachmentCount The number of attachments.
 * @param {number} totalAttachmentSize The total size of attachments in bytes.
 * @param {string} title The extracted title from the subject.
 */
async function sendConfirmationEmail(auth, toEmail, originalSubject, conversationId, bodyLength, attachmentCount, totalAttachmentSize, title) {
    const gmail = google.gmail({ version: 'v1', auth });

    const confirmationSubject = `Re: ${originalSubject} - Confirmation of Receipt`;
    const sampleNextSubject = `chatterbox:${conversationId} ${title || 'Your Next Title Here'}`;

    let emailBody = `Dear sender,

This is an automated confirmation that your message has been received.

Details of your message:
- Original Subject: "${originalSubject}"
- Conversation ID: ${conversationId === 'completion' ? 'completion (new conversation)' : conversationId}
- Body Length: ${bodyLength} bytes
- Number of Attachments: ${attachmentCount}
- Total Attachment Size: ${totalAttachmentSize} bytes
- Extracted Title: "${title || 'N/A'}"

For your next communication in this conversation, please use a subject line similar to this example:
"${sampleNextSubject}"

Thank you.
`;

    const rawEmail = [
        `From: ${gmailUser}`, // Dynamic gmailUser
        `To: ${toEmail}`,
        `Subject: ${confirmationSubject}`,
        `Reply-To: ${gmailUser}`, // Set Reply-To header
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        emailBody
    ].join('\n');

    const encodedMessage = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
        await gmail.users.messages.send({
            userId: gmailUser, // Dynamic gmailUser
            requestBody: {
                raw: encodedMessage,
            },
        });
        logWithTimestamp(`Confirmation email sent from ${gmailUser} to ${toEmail} for message with Conversation ID: ${conversationId}`);
    } catch (sendErr) {
        logWithTimestamp(`Error sending confirmation email from ${gmailUser} to ${toEmail}:`, sendErr.message);
    }
}


/**
 * Fetches new emails using the Gmail API.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {number} runPollingCycleCount The current polling cycle count for this run.
 */
async function fetchNewEmails(auth, runPollingCycleCount) {
    const gmail = google.gmail({ version: 'v1', auth });
    let lastHistoryId = await readLastHistoryId(); // Await readLastHistoryId
    const currentTime = new Date().toLocaleString();
    let totalPersistentPollCycles = await readTotalPollCycles(); // Read persistent count

    // Initialize maxHistoryId here so it's always defined
    let maxHistoryId = lastHistoryId;

    // Ensure totalPersistentPollCycles is at least 1 when polling starts, and never less than runPollingCycleCount
    // If totalPersistentPollCycles is 0, it means it's the very first time (or cleaned), so start at 1.
    // If runPollingCycleCount is higher, it means the persistent count needs to catch up.
    if (totalPersistentPollCycles === 0) {
        totalPersistentPollCycles = 1;
    }
    if (runPollingCycleCount > totalPersistentPollCycles) {
        totalPersistentPollCycles = runPollingCycleCount;
    }


    logWithTimestamp(`Polling for new emails for ${gmailUser} since historyId: ${lastHistoryId}`);
    logWithTimestamp(`POLL: cycle ${runPollingCycleCount} in this run out of ${totalPersistentPollCycles} persisted total`);

    try {
        if (lastHistoryId === '0') {
            // If it's the first run or history was reset, get the current historyId
            // and save it. The actual polling for *new* emails will start from the next interval.
            logWithTimestamp('First run or history reset. Getting current mailbox history ID...');
            const profileRes = await gmail.users.getProfile({ userId: gmailUser });
            const currentHistoryId = profileRes.data.historyId;
            await writeLastHistoryId(currentHistoryId); // Await writeLastHistoryId
            logWithTimestamp(`Set initial history ID to: ${currentHistoryId}. New emails will be fetched from the next poll.`);
            // Increment persistent total poll cycles for this initial setup
            // This is already accounted for by the logic at the beginning of fetchNewEmails
            await writeTotalPollCycles(totalPersistentPollCycles); // Ensure the updated totalPersistentPollCycles is saved
            logWithTimestamp(`Updated total persistent poll cycles to: ${totalPersistentPollCycles}`);
            return; // Exit this poll cycle, next one will use the new historyId
        }

        // Use history.list to get changes since the last historyId
        // This is more efficient for polling than listing all messages.
        const res = await gmail.users.history.list({
            userId: gmailUser,
            startHistoryId: lastHistoryId,
            historyTypes: ['messageAdded'], // Only interested in new messages
        });

        const history = res.data.history;
        if (!history || history.length === 0) {
            logWithTimestamp(`0 messages since last poll at ${currentTime}`);
            // Even if no new messages, this was still a poll cycle
            totalPersistentPollCycles++;
            await writeTotalPollCycles(totalPersistentPollCycles);
            logWithTimestamp(`Updated total persistent poll cycles to: ${totalPersistentPollCycles}`);
            return;
        }

        // Extract message IDs from the history
        const newMessages = [];
        // maxHistoryId is already initialized at the beginning of the function
        history.forEach(h => {
            if (h.messagesAdded) {
                h.messagesAdded.forEach(msgAdded => {
                    newMessages.push(msgAdded.message.id);
                });
            }
            // Update maxHistoryId to the latest one found in the current batch
            if (h.id && h.id > maxHistoryId) {
                maxHistoryId = h.id;
            }
        });

        if (newMessages.length === 0) {
            logWithTimestamp(`0 messages since last poll at ${currentTime}`);
            // Even if no new messages, this was still a poll cycle
            totalPersistentPollCycles++;
            await writeTotalPollCycles(totalPersistentPollCycles);
            logWithTimestamp(`Updated total persistent poll cycles to: ${totalPersistentPollCycles}`);
            return;
        }

        logWithTimestamp(`${newMessages.length} messages since last poll at ${currentTime}`);

        // Define the regex for "chatterbox" subject parsing
        // This regex captures:
        // 1. "chatterbox" (case-insensitive)
        // 2. Optional whitespace after "chatterbox"
        // 3. Optional colon and more whitespace
        // 4. Optional GUID (UUID format) as the first capturing group
        // 5. The rest of the subject line (the title) as the second capturing group
        const chatterboxSubjectRegex = /^chatterbox\s*(?::\s*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}))?\s*(.*)$/i;

        let chatterboxMessageCount = 0;
        const parsedChatterboxMessages = [];

        // Fetch details for each new message
        for (let i = 0; i < newMessages.length; i++) {
            const messageId = newMessages[i];
            try {
                const msgRes = await gmail.users.messages.get({
                    userId: gmailUser,
                    id: messageId,
                    format: 'full', // Get full message data
                });

                const message = msgRes.data;
                const headers = message.payload.headers;

                const getHeader = (name) => {
                    const header = headers.find(h => h.name === name);
                    return header ? header.value : 'N/A';
                };

                const subject = getHeader('Subject');
                const fromHeader = getHeader('From'); // Capture sender
                const toHeader = getHeader('To'); // Capture recipient (for email logging)
                const dateHeader = getHeader('Date'); // Capture date for logging

                // --- Subject Parsing Logic ---
                let conversationId = null; // Initialize as null to check if found
                let title = '';
                let prompt = null; // Variable to hold the email body
                let attachmentDetails = []; // Array to hold details of each attachment {filename, size}

                const match = subject.match(chatterboxSubjectRegex);
                const isChatterbox = !!match; // True if regex matched

                // Determine conversation ID and save prompt/attachments if Chatterbox email
                if (isChatterbox) {
                    chatterboxMessageCount++;
                    conversationId = match[1] || null; // GUID is the first capturing group, or null if not present
                    title = (match[2] || '').trim(); // Title is the second capturing group, trimmed

                    // If no conversationId is provided, generate one
                    if (!conversationId) {
                        conversationId = crypto.randomUUID().replace(/-/g, ''); // Generate GUID without spaces
                        logWithTimestamp(`Generated new conversationId: ${conversationId} for message ${message.id}`);
                    }

                    // --- Attachment and Body Saving Setup ---
                    // Use config.app.interactionsBaseFolder for the base path
                    const conversationDir = path.join(config.app.interactionsBaseFolder, conversationId);
                    await fs.mkdir(conversationDir, { recursive: true }); // Ensure conversation folder exists

                    let nextSequenceNumber = '001';
                    try {
                        const existingFolders = await fs.readdir(conversationDir, { withFileTypes: true });
                        const numberedFolders = existingFolders
                            .filter(dirent => dirent.isDirectory() && /^\d{3}$/.test(dirent.name))
                            .map(dirent => parseInt(dirent.name, 10));

                        if (numberedFolders.length > 0) {
                            const maxNumber = Math.max(...numberedFolders);
                            nextSequenceNumber = (maxNumber + 1).toString().padStart(3, '0');
                        }
                    } catch (readDirErr) {
                        logWithTimestamp(`Could not read directory ${conversationDir} for sequence numbering. Starting with 001.`, readDirErr.message);
                    }

                    const messageContentSavePath = path.join(conversationDir, nextSequenceNumber);
                    await fs.mkdir(messageContentSavePath, { recursive: true }); // Create the numbered subfolder for content

                    // Process message parts to get prompt and attachment info
                    const textResult = await processMessageParts(message.payload.parts, 'text/plain', gmail, message.id, messageContentSavePath);
                    prompt = textResult.prompt;
                    attachmentDetails = textResult.attachments; // Collect attachment details from text part

                    if (!prompt) {
                        const htmlResult = await processMessageParts(message.payload.parts, 'text/html', gmail, message.id, messageContentSavePath);
                        prompt = htmlResult.prompt;
                        attachmentDetails = attachmentDetails.concat(htmlResult.attachments); // Concatenate attachments from HTML part too
                    }

                    // Save email body to a file in the message's sequence folder
                    if (prompt) {
                        const bodyFilePath = path.join(messageContentSavePath, 'body_text.txt');
                        await fs.writeFile(bodyFilePath, prompt, 'utf8');
                        logWithTimestamp(`Saved body text to: ${bodyFilePath}`);
                    } else {
                        logWithTimestamp(`No text body found for message ${message.id}. No body_text.txt saved.`);
                    }

                    parsedChatterboxMessages.push({
                        messageId: message.id,
                        sequence: i + 1, // 1-based sequence
                        conversationId: conversationId,
                        title: title
                    });

                    // Send confirmation email
                    const originalSenderEmailMatch = fromHeader.match(/<([^>]+)>/);
                    const originalSenderEmail = originalSenderEmailMatch ? originalSenderEmailMatch[1] : fromHeader;

                    const bodyLength = prompt ? Buffer.byteLength(prompt, 'utf8') : 0;
                    const totalAttachmentSize = attachmentDetails.reduce((sum, attach) => sum + attach.size, 0);

                    await sendConfirmationEmail(
                        auth,
                        originalSenderEmail,
                        subject, // Original subject for context
                        conversationId,
                        bodyLength,
                        attachmentDetails.length, // Number of attachments
                        totalAttachmentSize,    // Total size of attachments
                        title
                    );

                } else {
                    // For non-chatterbox emails, process parts to get prompt (but no saving attachments)
                    const textResult = await processMessageParts(message.payload.parts, 'text/plain', gmail, message.id, null);
                    prompt = textResult.prompt;
                    attachmentDetails = textResult.attachments; // Collect attachment details

                    if (!prompt) {
                        const htmlResult = await processMessageParts(message.payload.parts, 'text/html', gmail, message.id, null);
                        prompt = htmlResult.prompt;
                        attachmentDetails = attachmentDetails.concat(htmlResult.attachments); // Concatenate attachments
                    }
                }
                // --- End Subject Parsing Logic ---

                // --- Detailed Email Logging ---
                logWithTimestamp('----------------------------------------------------');
                logFormatted('FROM', fromHeader);
                logFormatted('TO', `${toHeader} (polled account: ${gmailUser})`);
                logFormatted('TIMESTAMP', `${new Date(dateHeader).toLocaleString()}, GMAIL ID: ${message.id}`);
                logFormatted('ITEM', `email ${i + 1} of ${newMessages.length} (read this polling cycle)`);
                logFormatted('SUBJECT', subject);

                let statusLine = isChatterbox ? 'IS Chatterbox' : 'ISNOT Chatterbox';
                if (isChatterbox) {
                    statusLine += conversationId ? ` HAS ConversationId ${conversationId}` : ' DOES NOT HAVE ConversationId';
                }
                statusLine += attachmentDetails.length > 0 ? ` CONTAINS Attachments ${attachmentDetails.length}` : ' NO ATTACHMENTS';
                logFormatted('STATUS', statusLine);

                if (attachmentDetails.length > 0) {
                    logWithTimestamp('  Attachments:');
                    attachmentDetails.forEach(attach => {
                        logWithTimestamp(`    - ${attach.filename} (${attach.size} bytes)`);
                    });
                }
                logFormatted('BODY', prompt ? prompt.substring(0, 500) + (prompt.length > 500 ? '...' : '') : '<No Text Body>'); // Log up to 500 chars of body
                logWithTimestamp('----------------------------------------------------');
                // --- End Detailed Email Logging ---


            } catch (msgErr) {
                logWithTimestamp(`Error fetching message ${messageId}:`, msgErr.message);
            }
        }

        // --- Summary of Chatterbox Messages (Original summary preserved) ---
        if (chatterboxMessageCount > 0) {
            logWithTimestamp(`${chatterboxMessageCount} chatterbox message${chatterboxMessageCount === 1 ? '' : 's'}`);
            logWithTimestamp('Messages');
            logWithTimestamp('----------');
            parsedChatterboxMessages.forEach(msg => {
                const conversationIdOutput = msg.conversationId === 'completion' ? 'completion' : `conversation:${msg.conversationId}`;
                logWithTimestamp(`${msg.messageId}|sequence ${msg.sequence}|${conversationIdOutput}|${msg.title}`);
            });
        } else {
            logWithTimestamp('No chatterbox messages found in this poll.');
        }
        // --- End Summary ---


        // After processing all new messages, update the last history ID
        if (maxHistoryId !== lastHistoryId) {
            await writeLastHistoryId(maxHistoryId); // Await writeLastHistoryId
            logWithTimestamp(`Updated last history ID to: ${maxHistoryId}`);
        }

        // Increment persistent total poll cycles after a successful poll
        totalPersistentPollCycles++;
        await writeTotalPollCycles(totalPersistentPollCycles);
        logWithTimestamp(`Updated total persistent poll cycles to: ${totalPersistentPollCycles}`);

    } catch (err) {
        logWithTimestamp('Error fetching new emails from Gmail API:', err.message);
        if (err.code === 401) {
            logWithTimestamp('Authentication error. Your tokens might be expired or invalid. Please delete token.json and re-run to re-authorize.');
        } else if (err.errors && err.errors[0] && err.errors[0].message.includes('Invalid startHistoryId')) {
             logWithTimestamp('Invalid startHistoryId. This might happen if the history ID is too old or invalid. Resetting to 0 to fetch all messages.');
             await writeLastHistoryId('0'); // Reset history ID to fetch all next time
        }
    }
}

/**
 * Displays information about credentials, tokens, history, and scopes.
 */
async function displayInfo() {
    logWithTimestamp('\n--- Script Information ---');
    logWithTimestamp(`Gmail User: ${gmailUser}`);
    logWithTimestamp(`Polling Interval: ${pollInterval / (60 * 1000)} minutes`);
    logWithTimestamp(`Polling Duration: ${pollDurationMinutes === 0 ? 'Continuous' : pollDurationMinutes + ' minutes'}`);

    logWithTimestamp('\n--- Requested Scopes ---');
    config.google.scopes.forEach(scope => logWithTimestamp(`- ${scope}`));

    logWithTimestamp('\n--- credentials.json ---');
    try {
        const credentialsContent = await fs.readFile(config.google.credentialsPath, 'utf8');
        logWithTimestamp(JSON.stringify(JSON.parse(credentialsContent), null, 2));
    } catch (err) {
        logWithTimestamp(`Error reading credentials.json: ${err.message}`);
        logWithTimestamp('<File not found or unreadable>');
    }

    logWithTimestamp('\n--- token.json ---');
    try {
        const tokenContent = await fs.readFile(config.google.pollTokenPath, 'utf8');
        logWithTimestamp(JSON.stringify(JSON.parse(tokenContent), null, 2));
    } catch (err) {
        logWithTimestamp(`Error reading token.json: ${err.message}`);
        logWithTimestamp('<File not found or unreadable>');
    }

    logWithTimestamp('\n--- last_history_id.txt ---');
    try {
        const historyId = await readLastHistoryId();
        logWithTimestamp(historyId === '0' ? '<Not set or reset>' : historyId);
    } catch (err) {
        logWithTimestamp(`Error reading last_history_id.txt: ${err.message}`);
        logWithTimestamp('<File not found or unreadable>');
    }

    logWithTimestamp('\n--- last_polled_email.txt ---');
    try {
        const lastEmail = await readLastPolledEmail();
        logWithTimestamp(lastEmail || '<Not set>');
    } catch (err) {
        logWithTimestamp(`Error reading last_polled_email.txt: ${err.message}`);
        logWithTimestamp('<File not found or unreadable>');
    }

    logWithTimestamp('\n--- total_poll_cycles.txt ---');
    try {
        const totalCycles = await readTotalPollCycles();
        logWithTimestamp(totalCycles.toString());
    } catch (err) {
        logWithTimestamp(`Error reading total_poll_cycles.txt: ${err.message}`);
        logWithTimestamp('<File not found or unreadable>');
    }

    process.exit(0);
}


// --- Main execution ---
async function main() {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const scriptName = path.basename(process.argv[1]);

    // Function to display help message
    const showHelp = () => {
        logWithTimestamp(`\nUsage: node ${scriptName} [options]`);
        logWithTimestamp('\nOptions:');
        logWithTimestamp('  --help, --?              Display this help message and exit.');
        logWithTimestamp('  --info                   Display current configuration, file contents, and exit.');
        logWithTimestamp('  --clean                  Delete existing token.json, last_history_id.txt, and total_poll_cycles.txt files. Requires re-authorization on next run.');
        logWithTimestamp(`  --interval <float>       Number of minutes between email polls. Default: ${config.polling.defaultIntervalMinutes} minutes.`); // Now using config.polling.defaultIntervalMinutes
        logWithTimestamp(`  --duration <int>         Number of minutes to poll before the script exits. Default: ${config.polling.defaultDurationMinutes} minutes (0 for continuous).`); // Now using config.polling.defaultDurationMinutes
        logWithTimestamp(`  --email <address>        Specify the Gmail address to poll. Default: ${config.app.defaultPollGmailUser}. Changes trigger automatic --clean.`); // Now using config.app.defaultPollGmailUser
        logWithTimestamp('\nExamples:');
        logWithTimestamp(`  node ${scriptName} --interval 0.5`);
        logWithTimestamp(`  node ${scriptName} --duration 60`);
        logWithTimestamp(`  node ${scriptName} --clean`);
        logWithTimestamp(`  node ${scriptName} --email newaddress@gmail.com`);
        logWithTimestamp(`  node ${scriptName} --info`);
        process.exit(0);
    };

    // Check for help or info flag first
    if (args.includes('--help') || args.includes('--?')) {
        showHelp();
    }
    if (args.includes('--info')) {
        await displayInfo();
        return; // displayInfo exits on its own
    }

    let forceCleanDueToEmailChange = false;

    // Parse --email parameter (needs to be parsed early to set gmailUser)
    const emailFlagIndex = args.indexOf('--email');
    if (emailFlagIndex > -1 && args[emailFlagIndex + 1]) {
        const newEmail = args[emailFlagIndex + 1].toLowerCase(); // Convert to lowercase for consistent comparison
        const lastPolledEmail = await readLastPolledEmail(); // Uses config.google.lastPolledEmailPath internally

        if (lastPolledEmail && lastPolledEmail !== newEmail) {
            logWithTimestamp(`Email address changed from ${lastPolledEmail} to ${newEmail}. Triggering automatic clean.`);
            forceCleanDueToEmailChange = true;
        }
        gmailUser = newEmail; // Update the global gmailUser for this run
        await writeLastPolledEmail(gmailUser); // Persist the current email (uses config.google.lastPolledEmailPath internally)
        logWithTimestamp(`Polling email set to: ${gmailUser}`);
    } else {
        const storedEmail = await readLastPolledEmail(); // Uses config.google.lastPolledEmailPath internally
        if (storedEmail) {
            gmailUser = storedEmail; // Use the last stored email if --email not provided
            logWithTimestamp(`Using last polled email: ${gmailUser}`);
        } else {
            gmailUser = config.app.defaultPollGmailUser; // Fallback to default from config
            logWithTimestamp(`No --email specified. Using default email: ${gmailUser}`);
            await writeLastPolledEmail(gmailUser); // Store the default if not already stored
        }
    }


    // Parse interval if provided
    const intervalFlagIndex = args.indexOf('--interval');
    if (intervalFlagIndex > -1 && args[intervalFlagIndex + 1]) {
        const intervalValue = parseFloat(args[intervalFlagIndex + 1]);
        if (!isNaN(intervalValue) && intervalValue > 0) {
            pollInterval = intervalValue * 60 * 1000; // Convert minutes to milliseconds
            logWithTimestamp(`Polling interval set to ${intervalValue} minutes.`);
        } else {
            logWithTimestamp(`Invalid --interval value: ${args[intervalFlagIndex + 1]}. Using default of ${config.polling.defaultIntervalMinutes} minutes.`);
            pollInterval = config.polling.defaultIntervalMilliseconds; // Reset to default from config
        }
    } else {
        logWithTimestamp(`Using default polling interval of ${config.polling.defaultIntervalMinutes} minutes.`);
        // pollInterval is already set to config.polling.defaultIntervalMilliseconds at the top
    }

    // Parse duration if provided
    const durationFlagIndex = args.indexOf('--duration');
    if (durationFlagIndex > -1 && args[durationFlagIndex + 1]) {
        const durationValue = parseInt(args[durationFlagIndex + 1], 10);
        if (!isNaN(durationValue) && durationValue >= 0) { // Allow 0 for continuous
            pollDurationMinutes = durationValue;
            logWithTimestamp(`Script will run for ${pollDurationMinutes} minutes before exiting.`);
        } else {
            pollDurationMinutes = config.polling.defaultDurationMinutes; // Reset to default from config if invalid
            logWithTimestamp(`Invalid --duration value: ${args[durationFlagIndex + 1]}. Using default of ${pollDurationMinutes} minutes.`);
        }
    } else {
        logWithTimestamp(`Using default polling duration of ${pollDurationMinutes} minutes.`);
        // pollDurationMinutes is already set to config.polling.defaultDurationMinutes at the top
        if (pollDurationMinutes === 0) {
            logWithTimestamp('Script will poll continuously.');
        }
    }

    logWithTimestamp(`Starting Gmail API email poller for ${gmailUser}...`);

    // Handle --clean flag or automatic clean due to email change
    const cleanFlag = args.includes('--clean');
    if (cleanFlag || forceCleanDueToEmailChange) {
        logWithTimestamp('Detected clean operation. Deleting token and history files...');
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
            // Only exit if --clean was explicit and not just an email change
            if (cleanFlag && !forceCleanDueToEmailChange) {
                logWithTimestamp('Please re-run the script to re-authorize and start fresh.');
                return;
            }
        } catch (err) {
            logWithTimestamp('Error during clean operation:', err);
            process.exit(1);
        }
    }

    try {
        const authClient = await authorize();
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
            setTimeout(() => {
                logWithTimestamp(`\nPolling duration of ${pollDurationMinutes} minutes reached. Exiting script.`);
                clearInterval(intervalId); // Stop polling
                process.exit(0); // Exit the process
            }, pollDurationMinutes * 60 * 1000);
        }

    } catch (err) {
        logWithTimestamp('Failed to start poller:', err);
        process.exit(1); // Exit if initial authorization fails
    }
}

main();
