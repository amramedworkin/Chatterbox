// Import necessary libraries.
// If you haven't installed them yet, run:
// npm install fs crypto path
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto'); // For generating file hashes

// --- Configuration ---
// Base folder where interactions (including attachments) are saved by pollGmail.js
const INTERACTIONS_BASE_FOLDER = path.join(__dirname, '..', 'interactions');

// --- Helper Functions ---

/**
 * Calculates the MD5 hash of a file's content.
 * Used to determine if two files are exactly identical.
 * @param {string} filePath The full path to the file.
 * @returns {Promise<string>} The MD5 hash of the file content.
 */
async function calculateFileHash(filePath) {
    try {
        const fileBuffer = await fs.readFile(filePath);
        const hash = crypto.createHash('md5');
        hash.update(fileBuffer);
        return hash.digest('hex');
    } catch (error) {
        console.error(`Error calculating hash for ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Walks an interactions/<conversationId> folder structure,
 * identifying and listing unique attachments based on content and filename.
 * @param {string} conversationId The ID of the conversation to process.
 * @returns {Promise<Array<object>>} A list of unique files:
 * { uniqueName: string, originalPath: string, filename: string, sequenceFolder: string, hash: string }
 */
async function getUniqueAttachments(conversationId) {
    const uniqueFilesByHash = new Map(); // Map: hash -> { uniqueName, originalPath, filename, sequenceFolder }
    const results = []; // Final list of unique files to return

    const conversationBaseDir = path.join(INTERACTIONS_BASE_FOLDER, conversationId);

    console.log(`Scanning for unique attachments in: ${conversationBaseDir}`);

    try {
        const topLevelEntries = await fs.readdir(conversationBaseDir, { withFileTypes: true });

        // Filter for sequential numbered subfolders (e.g., '001', '002') and sort them numerically
        const sequenceFolders = topLevelEntries
            .filter(dirent => dirent.isDirectory() && /^\d{3}$/.test(dirent.name))
            .map(dirent => dirent.name)
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10)); // Sort numerically

        if (sequenceFolders.length === 0) {
            console.log(`No sequential message folders (e.g., 001, 002) found in ${conversationBaseDir}.`);
            return results;
        }

        for (const sequenceFolder of sequenceFolders) {
            const currentSequenceFolderPath = path.join(conversationBaseDir, sequenceFolder);
            console.log(`  Processing folder: ${sequenceFolder}`);

            try {
                const filesInFolder = await fs.readdir(currentSequenceFolderPath, { withFileTypes: true });

                for (const dirent of filesInFolder) {
                    if (dirent.isFile()) {
                        const filename = dirent.name;
                        const fullFilePath = path.join(currentSequenceFolderPath, filename);

                        // Skip 'body_text.txt' as it's the email body, not a user attachment
                        if (filename === 'body_text.txt') {
                            // console.log(`    - Skipping body_text.txt`);
                            continue;
                        }

                        const fileHash = await calculateFileHash(fullFilePath);

                        if (fileHash === null) {
                            console.warn(`    - Could not calculate hash for ${filename}. Skipping.`);
                            continue;
                        }

                        if (!uniqueFilesByHash.has(fileHash)) {
                            // This is a unique file content-wise
                            const uniqueName = `${sequenceFolder}_${filename}`;
                            const fileDetails = {
                                uniqueName: uniqueName,
                                originalPath: fullFilePath,
                                filename: filename,
                                sequenceFolder: sequenceFolder,
                                hash: fileHash
                            };
                            uniqueFilesByHash.set(fileHash, fileDetails);
                            results.push(fileDetails);
                            console.log(`    - Added unique: ${uniqueName} (from ${sequenceFolder}/${filename})`);
                        } else {
                            // This file content is a duplicate of one already found
                            const existingFileDetails = uniqueFilesByHash.get(fileHash);
                            console.log(`    - Skipping duplicate: ${filename} in ${sequenceFolder} (same content as ${existingFileDetails.sequenceFolder}/${existingFileDetails.filename})`);
                        }
                    }
                }
            } catch (readFolderErr) {
                console.error(`Error reading folder ${currentSequenceFolderPath}:`, readFolderErr.message);
            }
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Error: Conversation folder not found at ${conversationBaseDir}.`);
        } else {
            console.error(`Error scanning interactions folder: ${err.message}`);
        }
    }

    return results;
}


// --- Main Execution Block (for standalone testing) ---
async function main() {
    const args = process.argv.slice(2);
    const scriptName = path.basename(process.argv[1]);

    const conversationIdIndex = args.indexOf('--conversationId');
    let conversationId = null;

    if (conversationIdIndex > -1 && args[conversationIdIndex + 1]) {
        conversationId = args[conversationIdIndex + 1];
    } else {
        console.error(`\nUsage: node ${scriptName} --conversationId <GUID>`);
        console.error('Error: --conversationId parameter is required.');
        process.exit(1);
    }

    console.log(`\nProcessing unique attachments for conversation ID: ${conversationId}`);
    const uniqueAttachments = await getUniqueAttachments(conversationId);

    console.log('\n--- Unique Attachments List ---');
    if (uniqueAttachments.length === 0) {
        console.log('No unique attachments found for this conversation.');
    } else {
        uniqueAttachments.forEach(file => {
            console.log(`${file.uniqueName} => ${path.relative(INTERACTIONS_BASE_FOLDER, file.originalPath)}`);
        });
    }
    console.log('-------------------------------\n');
}

// Run the main function when the script is executed directly
if (require.main === module) {
    main();
}

// Export the core function for other scripts (e.g., LLM interaction) to use
module.exports = { getUniqueAttachments };
s