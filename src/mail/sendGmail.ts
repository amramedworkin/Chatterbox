import { google } from 'googleapis';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { OAuth2Client } from 'googleapis-common';

import config from '../loadConfig';

// Interface for email options
export interface SendEmailOptions {
    to: string;
    subject: string;
    body: string;
    conversationId?: string;
    attachments?: string[];
    replyTo?: string;
}

// Interface for email result
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    subject?: string;
    body?: string;
    attachments?: Array<{
        name: string;
        size: number;
        path: string;
    }>;
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
            return parseInt(await fs.readFile(config.sendTest.lastSentEmailNumberPath, 'utf8'), 10);
        }
    } catch (err) {
        console.error(
            `Error reading last sent email number file (${config.sendTest.lastSentEmailNumberPath}):`,
            err
        );
    }
    return 0;
}

/**
 * Writes the last sent email number to a file.
 * @param {number} number The number to write.
 */
async function writeLastSentEmailNumber(number: number): Promise<void> {
    try {
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
 * Sends an email using Gmail API with optional attachments.
 * @param {string} senderEmail The sender email address.
 * @param {SendEmailOptions} options The email options.
 * @param {OAuth2Client} authClient Optional OAuth2Client for authentication.
 * @returns {Promise<SendEmailResult>} The result of the send operation.
 */
export async function sendEmail(
    senderEmail: string,
    options: SendEmailOptions,
    authClient?: OAuth2Client
): Promise<SendEmailResult> {
    try {
        // Note: Authorization should be handled centrally via authorizeAll.ts
        // This function assumes the user is already authorized

        if (!authClient) {
            throw new Error(
                'OAuth2Client is required. Please ensure Gmail user is authorized via npm run mail:authorize'
            );
        }

        const gmail = google.gmail({ version: 'v1', auth: authClient });

        // Increment and persist the sequential email number
        let sequentialEmailNumber = await readLastSentEmailNumber();
        sequentialEmailNumber++;
        await writeLastSentEmailNumber(sequentialEmailNumber);

        const formattedSequentialNumber = sequentialEmailNumber.toString().padStart(4, '0');

        // Construct subject line with conversation ID if provided
        let subject = options.subject;
        if (options.conversationId) {
            subject += `:${options.conversationId}`;
        }
        subject += ` ${formattedSequentialNumber}`;

        // Prepare body text
        let bodyText = options.body + '\r\n\r\n';
        bodyText += `Conversation ID: ${options.conversationId || 'null'}\r\n`;
        bodyText += `Sequential Number: ${formattedSequentialNumber}\r\n`;

        const actualAttachments: string[] = [];

        // Process attachments if provided
        if (options.attachments && options.attachments.length > 0) {
            for (const attachmentPath of options.attachments) {
                try {
                    if (await fileExists(attachmentPath)) {
                        const filename = path.basename(attachmentPath);
                        actualAttachments.push(filename);
                    } else {
                        console.warn(`Warning: Attachment file not found: ${attachmentPath}`);
                    }
                } catch (err) {
                    console.warn(
                        `Warning: Error checking attachment file "${attachmentPath}":`,
                        err
                    );
                }
            }
        }

        bodyText += `Attachments: ${actualAttachments.length > 0 ? actualAttachments.join(', ') : '<none>'}\r\n`;

        // Prepare email headers
        const emailHeaders: string[] = [
            `To: ${options.to}`,
            `From: ${senderEmail}`,
            `Subject: ${subject}`,
            `Reply-To: ${options.replyTo || senderEmail}`,
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
            for (let i = 0; i < actualAttachments.length; i++) {
                const filename = actualAttachments[i];
                const attachmentPath = options.attachments![i];

                try {
                    const attachmentData = fsSync.readFileSync(attachmentPath);
                    const attachmentBase64 = attachmentData.toString('base64');

                    rawEmailContent.push(`--${boundary}`);
                    rawEmailContent.push(
                        `Content-Type: application/octet-stream; name="${filename}"`
                    );
                    rawEmailContent.push(`Content-Disposition: attachment; filename="${filename}"`);
                    rawEmailContent.push('Content-Transfer-Encoding: base64');
                    rawEmailContent.push('');
                    rawEmailContent.push(attachmentBase64);
                    rawEmailContent.push('');
                    console.log(`Attached file: ${filename}`);
                } catch (err) {
                    console.error(`Error reading or attaching file "${filename}":`, err);
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

        const response = await gmail.users.messages.send({
            userId: senderEmail,
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log(`Email sent successfully! Message ID: ${response.data.id}`);
        console.log(`Subject: "${subject}"`);
        console.log(`To: ${options.to}`);
        if (actualAttachments.length > 0) {
            console.log(`Attached ${actualAttachments.length} files.`);
        }

        return {
            success: true,
            messageId: response.data.id || undefined,
            subject,
            body: bodyText,
            attachments:
                actualAttachments.length > 0
                    ? actualAttachments.map((filename) => ({
                          name: filename,
                          size: 0,
                          path: filename,
                      }))
                    : undefined,
        };
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException & { code?: number };
        console.error('Error sending email:', error.message);

        if (error.code === 401) {
            console.error('❌ Authentication failed. Gmail user is not properly authorized.');
            console.error('💡 To fix this issue:');
            console.error('   1. Run: npm run mail:authorize');
            console.error('   2. Follow the authorization prompts for each Gmail user');
            console.error('   3. Make sure your google_credentials.json file is valid');
            console.error('   4. If problems persist, run: npm run mail:authorize --force');
        }

        return {
            success: false,
            error: error.message,
            subject: '',
            body: '',
            attachments: undefined,
        };
    }
}

/**
 * Sends a test email with the same functionality as the original test file.
 * @param {string} senderEmail The sender email address.
 * @param {string} recipientEmail The recipient email address.
 * @param {string} conversationId Optional conversation ID.
 * @param {number} attachCount Number of attachments to include.
 * @param {OAuth2Client} authClient Optional OAuth2Client for authentication.
 * @returns {Promise<SendEmailResult>} The result of the send operation.
 */
export async function sendTestEmail(
    senderEmail: string,
    recipientEmail: string,
    conversationId?: string,
    attachCount: number = 0,
    authClient?: OAuth2Client
): Promise<SendEmailResult> {
    // Ensure attachment folder exists
    if (attachCount > 0) {
        try {
            await fs.mkdir(config.sendTest.testAttachmentsFolder, { recursive: true });
        } catch (err) {
            console.error(
                `Error creating attachment folder: ${config.sendTest.testAttachmentsFolder}`,
                err
            );
            attachCount = 0;
        }
    }

    // Generate attachment paths
    const attachments: string[] = [];
    for (let i = 1; i <= attachCount; i++) {
        const attachmentFilename = `attachment_${i}.txt`;
        const attachmentFilePath = path.join(
            config.sendTest.testAttachmentsFolder,
            attachmentFilename
        );
        if (await fileExists(attachmentFilePath)) {
            attachments.push(attachmentFilePath);
        } else {
            console.warn(`Warning: Test attachment file "${attachmentFilename}" not found.`);
        }
    }

    const subject = `chatterbox test title`;
    const body = `What is the definition of quantum froth?  Does it exist?  How did we find it or are we still looking to verify its existence?\r\n\r\nConversation ID: ${conversationId || 'null'}\r\nAttachment count: ${attachCount}`;

    return sendEmail(
        senderEmail,
        {
            to: recipientEmail,
            subject,
            body,
            conversationId,
            attachments: attachments.length > 0 ? attachments : undefined,
        },
        authClient
    );
}
