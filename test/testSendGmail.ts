// Import necessary libraries.
// If you haven't installed them, run:
// npm install googleapis fs readline dotenv @types/node
import { google, Auth } from 'googleapis';
import { promises as fs } from 'fs'; // For promise-based file operations (e.g., readFile, access, mkdir, unlink)
import * as fsSync from 'fs'; // For synchronous file operations (e.g., readFileSync)
import path from 'path';
import readline from 'readline';
// const crypto = require('crypto'); // Removed as it's not used for GUID generation here

// Load configuration from loadConfig.js.
// Since sendTestGmail.js is in 'test/' and loadConfig.js is in 'src/',
// we need to go up one level (..) to the project root, then down into 'src/'.
import config from '../src/loadConfig'; // Assuming loadConfig.js is now loadConfig.ts and exports default

// --- Global Variables (Managed by main function and persistence) ---
// Default sender email address from config. Overridden by persistence/param.
let gmailUser: string = config.sendTest.defaultSender;
// Default recipient email address from config. Overridden by persistence/param.
let currentRecipientEmail: string = config.sendTest.defaultRecipient;
// Persistent counter for emails sent.
let sendCount: number = 0;

// --- OAuth 2.0 Client Setup ---
let oAuth2Client: Auth.OAuth2Client;

/**
 * Reads credentials from a file, then authorizes the client.
 */
async function authorize(): Promise<Auth.OAuth2Client> {
    try {
        // Use config.google.credentialsPath (e.g., "./credentials.json" from project root)
        const credentialsContent = await fs.readFile(config.google.credentialsPath, 'utf8');
        // Destructure only client_secret and client_id, as redirect_uris is not used directly here
        const { client_secret, client_id /*, redirect_uris */ } =
            JSON.parse(credentialsContent).installed;

        oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            config.google.redirectUri // Use redirectUri from config
        );

        // Check if we have previously stored tokens
        // Use config.sendTest.tokenPath (e.g., "./data/sendtest_token.json" from project root)
        if (await fileExists(config.sendTest.tokenPath)) {
            // Check if token file exists
            const token = await fs.readFile(config.sendTest.tokenPath, 'utf8'); // Read token file
            oAuth2Client.setCredentials(JSON.parse(token));
            console.log(`Using existing tokens for sender: ${gmailUser}.`);
        } else {
            // If no tokens, get new ones (first-time authorization)
            await getNewToken(oAuth2Client);
        }
        return oAuth2Client;
    } catch (err: any) {
        console.error('Error loading client secret file or authorizing:', err);
        // Specific error message for missing credentials.json
        if (err.code === 'ENOENT' && err.path === config.google.credentialsPath) {
            console.error(
                `CRITICAL ERROR: 'credentials.json' not found at the expected path: ${config.google.credentialsPath}`
            );
            console.error(
                'Please ensure you have downloaded it from Google Cloud Console and placed it in the project root.'
            );
        }
        throw err;
    }
}

/**
 * Get and store new token after prompting for user authorization.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
async function getNewToken(oAuth2Client: Auth.OAuth2Client): Promise<Auth.OAuth2Client> {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Request a refresh token
        scope: config.sendTest.scopes, // Use sendTest specific scopes from config
    });
    console.log(`Authorize this app for sender "${gmailUser}" by visiting this URL:`);
    console.log(authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', async (code: string) => {
            rl.close();
            try {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                // Store the tokens for future use
                // Ensure parent directory exists before writing token file
                await fs.mkdir(path.dirname(config.sendTest.tokenPath), { recursive: true });
                await fs.writeFile(config.sendTest.tokenPath, JSON.stringify(tokens)); // Uses the resolved path from config
                console.log(`Tokens stored to ${config.sendTest.tokenPath}`);
                resolve(oAuth2Client);
            } catch (err) {
                console.error('Error retrieving access token', err);
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
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads the last sent email number from a file.
 * @returns {Promise<number>} The last sent email number, or 0 if not found.
 */
async function readLastSentEmailNumber(): Promise<number> {
    try {
        if (await fileExists(config.sendTest.lastSentEmailNumberPath)) {
            // Check if file exists
            return parseInt(await fs.readFile(config.sendTest.lastSentEmailNumberPath, 'utf8'), 10); // Read file
        }
    } catch (err) {
        console.error(
            `Error reading last sent email number file (${config.sendTest.lastSentEmailNumberPath}):`,
            err
        );
    }
    return 0; // Default to 0 if file doesn't exist or error
}

/**
 * Writes the last sent email number to a file.
 * @param {number} number The number to write.
 */
async function writeLastSentEmailNumber(number: number): Promise<void> {
    try {
        // Ensure parent directory exists before writing
        await fs.mkdir(path.dirname(config.sendTest.lastSentEmailNumberPath), { recursive: true });
        await fs.writeFile(config.sendTest.lastSentEmailNumberPath, number.toString(), 'utf8');
        console.log(
            `Updated last sent email number to: ${number} in ${config.sendTest.lastSentEmailNumberPath}`
        );
    } catch (err) {
        console.error(
            `Error writing last sent email number file (${config.sendTest.lastSentEmailNumberPath}):`,
            err
        );
    }
}

/**
 * Reads the persistently stored sender email address.
 * @returns {Promise<string|null>} The sender email, or null if not found.
 */
async function readSenderEmail(): Promise<string | null> {
    try {
        if (await fileExists(config.sendTest.senderEmailPath)) {
            // Check if file exists
            return (await fs.readFile(config.sendTest.senderEmailPath, 'utf8')).trim(); // Read file
        }
    } catch (err) {
        console.error(`Error reading sender email file (${config.sendTest.senderEmailPath}):`, err);
    }
    return null;
}

/**
 * Writes the sender email address to a file.
 * @param {string} email The email address to write.
 */
async function writeSenderEmail(email: string): Promise<void> {
    try {
        // Ensure parent directory exists before writing
        await fs.mkdir(path.dirname(config.sendTest.senderEmailPath), { recursive: true });
        await fs.writeFile(config.sendTest.senderEmailPath, email, 'utf8');
        console.log(`Sender email persisted to: ${config.sendTest.senderEmailPath}`);
    } catch (err) {
        console.error(`Error writing sender email file (${config.sendTest.senderEmailPath}):`, err);
    }
}

/**
 * Reads the persistently stored recipient email address.
 * @returns {Promise<string|null>} The recipient email, or null if not found.
 */
async function readRecipientEmail(): Promise<string | null> {
    try {
        if (await fileExists(config.sendTest.recipientEmailPath)) {
            // Check if file exists
            return (await fs.readFile(config.sendTest.recipientEmailPath, 'utf8')).trim(); // Read file
        }
    } catch (err) {
        console.error(
            `Error reading recipient email file (${config.sendTest.recipientEmailPath}):`,
            err
        );
    }
    return null;
}

/**
 * Writes the recipient email address to a file.
 * @param {string} email The email address to write.
 */
async function writeRecipientEmail(email: string): Promise<void> {
    try {
        // Ensure parent directory exists before writing
        await fs.mkdir(path.dirname(config.sendTest.recipientEmailPath), { recursive: true });
        await fs.writeFile(config.sendTest.recipientEmailPath, email, 'utf8');
        console.log(`Recipient email persisted to: ${config.sendTest.recipientEmailPath}`);
    } catch (err) {
        console.error(
            `Error writing recipient email file (${config.sendTest.recipientEmailPath}):`,
            err
        );
    }
}

/**
 * Reads the persistent send count.
 * @returns {Promise<number>} The persistent send count, or 0 if not found.
 */
async function readSendCount(): Promise<number> {
    try {
        if (await fileExists(config.sendTest.sendCountPath)) {
            // Check if file exists
            return parseInt(await fs.readFile(config.sendTest.sendCountPath, 'utf8'), 10); // Read file
        }
    } catch (err) {
        console.error(`Error reading send count file (${config.sendTest.sendCountPath}):`, err);
    }
    return 0; // Default to 0 if file doesn't exist or error
}

/**
 * Writes the persistent send count to a file.
 * @param {number} count The count to write.
 */
async function writeSendCount(count: number): Promise<void> {
    try {
        // Ensure parent directory exists before writing
        await fs.mkdir(path.dirname(config.sendTest.sendCountPath), { recursive: true });
        await fs.writeFile(config.sendTest.sendCountPath, count.toString(), 'utf8');
        console.log(`Send count persisted to: ${config.sendTest.sendCountPath}`);
    } catch (err) {
        console.error(`Error writing send count file (${config.sendTest.sendCountPath}):`, err);
    }
}

/**
 * Sends a test email using the Gmail API.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {string|null} conversationId The GUID to include in the subject, or null.
 * @param {number} attachCount The number of attachments to include.
 * @param {string} recipientEmail The email address to send the email to.
 */
async function sendTestEmail(
    auth: Auth.OAuth2Client,
    conversationId: string | null,
    attachCount: number,
    recipientEmail: string
): Promise<void> {
    const gmail = google.gmail({ version: 'v1', auth });

    let sequentialEmailNumber = await readLastSentEmailNumber();
    sequentialEmailNumber++; // Increment for the new email
    await writeLastSentEmailNumber(sequentialEmailNumber); // Persist the new number

    const formattedSequentialNumber = sequentialEmailNumber.toString().padStart(4, '0');

    // Construct subject line
    let subject = `chatterbox`;
    if (conversationId) {
        subject += `:${conversationId}`;
    }
    subject += ` test title ${formattedSequentialNumber}`;

    // Body text with requested details
    let bodyText = `Body text ${formattedSequentialNumber}\r\n\r\n`;
    bodyText += `Conversation ID: ${conversationId || 'null'}\r\n`;
    bodyText += `Attachment count: ${attachCount}\r\n`; // Initial requested attach count

    const actualAttachments: string[] = []; // To store names of successfully attached files for email body list

    if (attachCount > 0) {
        // Use config.app.testAttachmentsFolder (e.g., "./test/attachments" from project root)
        try {
            // Note: config.app.testAttachmentsFolder is the correct path from loadConfig.js
            await fs.mkdir(config.sendTest.testAttachmentsFolder, { recursive: true }); // Ensure attachment folder exists
        } catch (err) {
            console.error(
                `Error creating attachment folder: ${config.sendTest.testAttachmentsFolder}`,
                err
            );
            attachCount = 0; // Set to 0 to skip attachment processing if folder fails
        }

        for (let i = 1; i <= attachCount; i++) {
            const attachmentFilename = `attachment_${i}.txt`;
            // Path to attachment file (relative to project root)
            const attachmentFilePath = path.join(
                config.sendTest.testAttachmentsFolder, // Use config.sendTest.testAttachmentsFolder
                attachmentFilename
            );
            try {
                // Check if file exists before trying to read it
                if (await fileExists(attachmentFilePath)) {
                    actualAttachments.push(attachmentFilename);
                    // console.log(`Found attachment: ${attachmentFilename}`); // Removed for cleaner output
                } else {
                    console.warn(
                        `Warning: Attachment file "${attachmentFilename}" not found at "${attachmentFilePath}". Skipping.`
                    );
                }
            } catch (err: any) {
                console.warn(
                    `Warning: Error checking attachment file "${attachmentFilename}":`,
                    err.message
                );
            }
        }
    }

    bodyText += `Attachments: ${actualAttachments.length > 0 ? actualAttachments.join(', ') : '<none>'}\r\n`;

    const emailHeaders: string[] = [
        `To: ${recipientEmail}`, // Use the passed recipient email
        `From: ${gmailUser}`, // Use the global sender email
        `Subject: ${subject}`,
        `Reply-To: ${gmailUser}`,
        'MIME-Version: 1.0',
    ];

    const rawEmailContent: string[] = [];
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    if (actualAttachments.length > 0) {
        emailHeaders.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        rawEmailContent.push(...emailHeaders);
        rawEmailContent.push(''); // Empty line after headers for multipart

        // Add the plain text body part
        rawEmailContent.push(`--${boundary}`);
        rawEmailContent.push('Content-Type: text/plain; charset="UTF-8"');
        rawEmailContent.push('Content-Transfer-Encoding: base64');
        rawEmailContent.push('');
        rawEmailContent.push(Buffer.from(bodyText).toString('base64'));
        rawEmailContent.push('');

        // Add each attachment part
        for (const filename of actualAttachments) {
            // Path to attachment file (relative to project root)
            const attachmentFilePath = path.join(config.sendTest.testAttachmentsFolder, filename); // Use config.sendTest.testAttachmentsFolder
            try {
                // Read file synchronously here for simpler assembly of raw email.
                // For very large attachments, consider streaming or a more complex buffer management.
                const attachmentData = fsSync.readFileSync(attachmentFilePath); // Use synchronous read here for simpler assembly
                const attachmentBase64 = attachmentData.toString('base64');

                rawEmailContent.push(`--${boundary}`);
                rawEmailContent.push(`Content-Type: application/octet-stream; name="${filename}"`);
                rawEmailContent.push(`Content-Disposition: attachment; filename="${filename}"`);
                rawEmailContent.push('Content-Transfer-Encoding: base64');
                rawEmailContent.push('');
                rawEmailContent.push(attachmentBase64);
                rawEmailContent.push('');
                console.log(`Attached file: ${filename}`);
            } catch (err: any) {
                console.error(`Error reading or attaching file "${filename}":`, err.message);
            }
        }
        rawEmailContent.push(`--${boundary}--`); // Closing boundary
    } else {
        // No attachments, just a simple plain text email
        emailHeaders.push('Content-Type: text/plain; charset="UTF-8"');
        emailHeaders.push('Content-Transfer-Encoding: base64');
        rawEmailContent.push(...emailHeaders);
        rawEmailContent.push(''); // Empty line after headers
        rawEmailContent.push(Buffer.from(bodyText).toString('base64'));
    }

    const rawEmail = rawEmailContent.join('\n');
    const encodedMessage = Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        const response = await gmail.users.messages.send({
            userId: gmailUser, // Use the global sender email (gmailUser)
            requestBody: {
                raw: encodedMessage,
            },
        });
        console.log(`Test email sent successfully! Message ID: ${response.data.id}`);
        console.log(`Subject: "${subject}"`);
        console.log(`Body (summary): "${bodyText.split('\r\n')[0]}..."`); // Show first line of body
        if (actualAttachments.length > 0) {
            console.log(`Attached ${actualAttachments.length} files.`);
        } else {
            console.log('No attachments sent.');
        }
    } catch (sendErr: any) {
        console.error('Error sending test email:', sendErr.message);
        if (sendErr.code === 401) {
            console.error(
                'Authentication failed. Ensure your tokens are valid and have `gmail.send` scope.'
            );
            console.error(
                `Please verify that ${config.sendTest.tokenPath} exists and is valid. You might need to delete it and re-authorize.`
            );
        }
    }
}

// --- Main execution ---
async function main(): Promise<void> {
    // Parse command-line arguments
    const args: string[] = process.argv.slice(2);
    const scriptName = path.basename(process.argv[1]);

    // Function to display help message
    const showHelp = (): void => {
        console.log(`\nUsage: node ${scriptName} [options]`);
        console.log('\nOptions:');
        console.log('    --help, --?             Display this help message and exit.');
        console.log(
            '    --clean                 Reset sequential email numbering to 0000 and clear persisted sender/recipient. Deletes related files. Requires re-authorization.'
        );
        console.log(
            '    --listids               List existing conversation IDs and generate sample commands.'
        );
        console.log(
            '    --id <guid>             Specify a conversation ID (GUID) to include in the subject.'
        );
        console.log(
            '    --attach <int>          Number of attachments to include (e.g., 0, 1, 2, 3...).'
        );
        console.log(
            `    --sender <address>      Specify the sender email address. Default: ${config.sendTest.defaultSender}. Changes trigger automatic re-authorization.`
        );
        console.log(
            `    --to <address>          Specify the recipient email address. Default: ${config.sendTest.defaultRecipient}.`
        );
        console.log('\nExamples:');
        console.log(`    node ${scriptName}`);
        console.log(`    node ${scriptName} --id 123e4567-e89b-12d3-a456-426614174000`);
        console.log(`    node ${scriptName} --attach 2`);
        console.log(`    node ${scriptName} --clean`);
        console.log(`    node ${scriptName} --listids`);
        console.log(
            `    node ${scriptName} --sender test@example.com --to destination@example.com --attach 1`
        );
        process.exit(0);
    };

    // Check for help flag first
    if (args.includes('--help') || args.includes('--?')) {
        showHelp();
    }

    // Handle --listids flag (requires access to INTERACTIONS_BASE_FOLDER which is in config)
    if (args.includes('--listids')) {
        console.log(`\nListing conversation folders in: ${config.app.interactionsBaseFolder}`);
        try {
            const conversationDirs = await fs.readdir(config.app.interactionsBaseFolder, {
                withFileTypes: true,
            });
            let foundFolders = false;

            for (const dirent of conversationDirs) {
                if (dirent.isDirectory()) {
                    foundFolders = true;
                    const listedConversationId = dirent.name; // Declare with a new variable name
                    const conversationPath = path.join(
                        config.app.interactionsBaseFolder,
                        listedConversationId // Use the declared variable
                    );
                    let subfolderCount = 0;

                    try {
                        const subfolders = await fs.readdir(conversationPath, {
                            withFileTypes: true,
                        });
                        subfolderCount = subfolders.filter(
                            (subDirent) => subDirent.isDirectory() && /^\d{3}$/.test(subDirent.name)
                        ).length;
                    } catch (readSubDirErr: any) {
                        // Ignore error if subfolder cannot be read (e.g., permissions)
                        console.warn(
                            `    Warning: Could not read subfolders for ${listedConversationId}: ${readSubDirErr.message}`
                        );
                    }
                    console.log(
                        `conversationId: ${listedConversationId}, sub-folder count=[${subfolderCount}], command= node ${scriptName} --id ${listedConversationId} --attach 0`
                    );
                }
            }
            if (!foundFolders) {
                console.log('No conversation folders found.');
            }
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.log(
                    `Interactions folder (${config.app.interactionsBaseFolder}) not found. No conversation folders to list.`
                );
            } else {
                console.error('Error listing conversation folders:', err.message);
            }
        }
        process.exit(0); // Exit after listing
    }

    // Handle --clean flag
    if (args.includes('--clean')) {
        console.log('Detected --clean flag. Deleting persistence files...');
        try {
            if (await fileExists(config.sendTest.lastSentEmailNumberPath)) {
                await fs.unlink(config.sendTest.lastSentEmailNumberPath);
                console.log(
                    `Deleted ${config.sendTest.lastSentEmailNumberPath}. Sequential numbering will restart at 0001.`
                );
            }
            if (await fileExists(config.sendTest.tokenPath)) {
                await fs.unlink(config.sendTest.tokenPath);
                console.log(
                    `Deleted ${config.sendTest.tokenPath}. Re-authorization will be required.`
                );
            }
            if (await fileExists(config.sendTest.senderEmailPath)) {
                await fs.unlink(config.sendTest.senderEmailPath);
                console.log(
                    `Deleted ${config.sendTest.senderEmailPath}. Sender will revert to default or --sender value.`
                );
            }
            if (await fileExists(config.sendTest.recipientEmailPath)) {
                await fs.unlink(config.sendTest.recipientEmailPath);
                console.log(
                    `Deleted ${config.sendTest.recipientEmailPath}. Recipient will revert to default or --to value.`
                );
            }
            if (await fileExists(config.sendTest.sendCountPath)) {
                await fs.unlink(config.sendTest.sendCountPath);
                console.log(
                    `Deleted ${config.sendTest.sendCountPath}. Send count will restart at 0.`
                );
            }
        } catch (err) {
            console.error('Error during clean operation:', err);
            process.exit(1);
        }
        process.exit(0); // Exit after cleaning
    }

    // Initialize these based on defaults from config, they will be overridden by persistence/params
    // gmailUser and currentRecipientEmail are already global and initialized from config at top

    // --- Persistence and Parameter Handling for Sender, Recipient, and Send Count ---

    // Read persisted sender email first
    const persistedSender = await readSenderEmail();
    if (persistedSender) {
        gmailUser = persistedSender; // Update global gmailUser
    }

    // Parse --sender parameter
    let forceReauthorization = false;
    const senderFlagIndex = args.indexOf('--sender');
    if (senderFlagIndex > -1 && args[senderFlagIndex + 1]) {
        const newSender = args[senderFlagIndex + 1].toLowerCase();
        if (newSender !== gmailUser) {
            // Check if new sender is different from current/persisted
            console.log(
                `Sender email changed from "${gmailUser}" to "${newSender}". This requires re-authorization.`
            );
            gmailUser = newSender; // Update global gmailUser
            forceReauthorization = true;
        }
    }
    await writeSenderEmail(gmailUser); // Persist the final sender email

    // Read persisted recipient email
    const persistedRecipient = await readRecipientEmail();
    if (persistedRecipient) {
        currentRecipientEmail = persistedRecipient; // Update global currentRecipientEmail
    }

    // Parse --to parameter
    const toFlagIndex = args.indexOf('--to');
    if (toFlagIndex > -1 && args[toFlagIndex + 1]) {
        currentRecipientEmail = args[toFlagIndex + 1].toLowerCase(); // Update global currentRecipientEmail
    }
    await writeRecipientEmail(currentRecipientEmail); // Persist the final recipient email

    // Read persistent send count
    sendCount = await readSendCount();
    sendCount++; // Increment for this run
    await writeSendCount(sendCount); // Persist the new count

    // --- Logging initial parameters and counts ---
    console.log(`FROM: ${gmailUser}`);
    console.log(`TO: ${currentRecipientEmail}`);
    console.log(`Send Count: ${sendCount}`);

    // Declare conversationId and attachCount here, before they are used.
    let conversationId: string | null = null; // Initialize to null
    let attachCount: number = 0; // Initialize to 0

    // Parse --id
    const idFlagIndex = args.indexOf('--id');
    if (idFlagIndex > -1 && args[idFlagIndex + 1]) {
        conversationId = args[idFlagIndex + 1];
        // Basic validation for GUID format (optional but good practice)
        if (
            !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
                conversationId
            )
        ) {
            console.warn(
                `Warning: Provided --id "${conversationId}" does not appear to be a standard GUID format.`
            );
        }
    } else {
        conversationId = null; // Ensure it's explicitly null if no --id
    }

    // Parse --attach
    const attachFlagIndex = args.indexOf('--attach');
    if (attachFlagIndex > -1 && args[attachFlagIndex + 1]) {
        const value = parseInt(args[attachFlagIndex + 1], 10);
        if (!isNaN(value) && value >= 0) {
            // Allow 0 attachments
            attachCount = value;
        } else {
            console.warn(
                `Invalid --attach value: ${args[attachFlagIndex + 1]}. No attachments will be included.`
            );
        }
    }

    // If sender email changed, force re-authorization by deleting token
    if (forceReauthorization) {
        console.log(
            'Deleting sendtest_token.json due to sender email change. Re-authorization required.'
        );
        try {
            if (await fileExists(config.sendTest.tokenPath)) {
                // Use config path
                await fs.unlink(config.sendTest.tokenPath);
            }
        } catch (err) {
            console.error('Error deleting token.json:', err);
        }
    }

    try {
        const authClient = await authorize();
        await sendTestEmail(authClient, conversationId, attachCount, currentRecipientEmail);
    } catch (err) {
        console.error('Failed to send test email:', err);
        process.exit(1);
    }
}

main();
