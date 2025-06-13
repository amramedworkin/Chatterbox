// src/listAttachments.ts

// Import necessary libraries.
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// Import configuration from loadConfig.ts
import config from '../loadConfig';

// Define the shape of a unique attachment object
export interface AttachmentDetails {
    uniqueName: string;
    originalPath: string;
    filename: string;
    sequenceFolder: string;
    hash: string;
}

// --- Configuration ---
// Base folder where interactions (including attachments) are saved by pollGmail.js
const INTERACTIONS_BASE_FOLDER = config.app.interactionsBaseFolder;

// --- Helper Functions ---

/**
 * Calculates the MD5 hash of a file's content.
 * Used to determine if two files are exactly identical.
 * @param {string} filePath The full path to the file.
 * @returns {Promise<string | null>} The MD5 hash of the file content, or null if an error occurs.
 */
async function calculateFileHash(filePath: string): Promise<string | null> {
    try {
        const fileBuffer = await fs.readFile(filePath);
        const hash = crypto.createHash('md5');
        hash.update(fileBuffer);
        return hash.digest('hex');
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(`Error calculating hash for ${filePath}: ${error.message}`);
        } else {
            console.error(`Error calculating hash for ${filePath}:`, error);
        }
        return null;
    }
}

/**
 * Recursively finds all files within a directory and its subdirectories.
 * @param {string} dir The directory to search.
 * @returns {Promise<string[]>} A promise that resolves to an array of full file paths.
 */
async function getAllFiles(dir: string): Promise<string[]> {
    let files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(await getAllFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Scans the interactions folder for unique attachments based on their content hash.
 * @param {string} conversationId The conversation ID to filter attachments for.
 * @returns {Promise<AttachmentDetails[]>} A promise that resolves to an array of unique attachment details.
 */
export async function getUniqueAttachments(conversationId: string): Promise<AttachmentDetails[]> {
    const uniqueAttachments: AttachmentDetails[] = [];
    const hashes = new Set<string>();

    const conversationFolder = path.join(INTERACTIONS_BASE_FOLDER, conversationId);
    const attachmentFolder = path.join(conversationFolder, 'attachments');

    try {
        const attachmentFiles = await getAllFiles(attachmentFolder);

        for (const filePath of attachmentFiles) {
            const hash = await calculateFileHash(filePath);
            if (hash && !hashes.has(hash)) {
                hashes.add(hash);

                const filename = path.basename(filePath);
                // Extract sequence folder (e.g., '0', '1', '2' etc. from path like 'interactions/convId/attachments/0/file.txt')
                const relativeToAttachmentFolder = path.relative(attachmentFolder, filePath);
                const sequenceFolder = relativeToAttachmentFolder.split(path.sep)[0];

                uniqueAttachments.push({
                    uniqueName: `${sequenceFolder}-${filename}`,
                    originalPath: filePath,
                    filename: filename,
                    sequenceFolder: sequenceFolder,
                    hash: hash,
                });
            }
        }
    } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            console.log(`No attachments folder found for conversation ID: ${conversationId}`);
        } else {
            console.error(`Error scanning attachments for ${conversationId}:`, error);
        }
    }

    return uniqueAttachments;
}

/**
 * Main function to list unique attachments for a given conversation ID.
 * @param {string} conversationId The conversation ID.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const scriptName = path.basename(process.argv[1]);

    const conversationIdIndex = args.indexOf('--conversationId');
    let conversationId: string | null = null;

    if (conversationIdIndex > -1 && args[conversationIdIndex + 1]) {
        conversationId = args[conversationIdIndex + 1];
    } else {
        console.error(`\nUsage: ts-node ${scriptName} --conversationId <GUID>`);
        console.error('Error: --conversationId parameter is required.');
        process.exit(1);
    }

    console.log(`\nProcessing unique attachments for conversation ID: ${conversationId}`);
    const uniqueAttachments = await getUniqueAttachments(conversationId);

    console.log('\n--- Unique Attachments List ---');
    if (uniqueAttachments.length === 0) {
        console.log('No unique attachments found for this conversation.');
    } else {
        uniqueAttachments.forEach((file) => {
            console.log(
                `${file.uniqueName} => ${path.relative(INTERACTIONS_BASE_FOLDER, file.originalPath)}`
            );
        });
    }
    console.log('-------------------------------\n');
}

// Run the main function when the script is executed directly
// This uses 'require.main === module' which works reliably in Node.js environments
if (require.main === module) {
    main();
}
