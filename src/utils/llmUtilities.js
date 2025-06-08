// utils/llmUtilities.js
// This module provides utility functions and shared resources for interacting with OpenAI,
// to be reused by both single-turn completions and multi-turn dialogs.

const OpenAI = require('openai');
const fs = require('fs').promises; // Use promises version for async/await
const path = require('path');

// Import the configuration object
const config = require('../src/loadConfig'); // Assuming loadConfig.js is in src/

// --- OpenAI Client Initialization ---
// Initialize OpenAI client once and export it
const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    organization: config.openai.organizationId, // Optional, if you have an organization ID
});

// --- Helper Functions ---

/**
 * Loads an attachment file, returning its base64 encoded content.
 * @param {string} filePath The full path to the attachment file.
 * @returns {Promise<string>} Base64 encoded file content.
 */
async function loadAttachmentBase64(filePath) {
    try {
        const fileBuffer = await fs.readFile(filePath);
        return fileBuffer.toString('base64');
    } catch (error) {
        console.error(`Error loading attachment ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Prepares attachments for inclusion in an OpenAI multimodal message.
 * It reads the actual files from the given path.
 * @param {Array<object>} attachmentsInfo An array of attachment objects ({ filename: string, size: number }).
 * @param {string} attachmentsFolderPath The specific folder for this message's attachments.
 * @returns {Promise<Array<object>>} An array of OpenAI image_url content objects or text content objects for the attachments.
 */
async function prepareAttachmentsForOpenAI(attachmentsInfo, attachmentsFolderPath) {
    const contentParts = [];

    if (!attachmentsInfo || attachmentsInfo.length === 0) {
        return contentParts;
    }

    console.log(`Preparing ${attachmentsInfo.length} attachments from: ${attachmentsFolderPath}`);

    for (const attach of attachmentsInfo) {
        const filePath = path.join(attachmentsFolderPath, attach.filename);
        const fileExtension = path.extname(attach.filename).toLowerCase();
        let mimeType = 'application/octet-stream'; // Default MIME type

        // Determine MIME type based on extension
        if (fileExtension === '.txt') {
            mimeType = 'text/plain';
        } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
            mimeType = 'image/jpeg';
        } else if (fileExtension === '.png') {
            mimeType = 'image/png';
        } else if (fileExtension === '.pdf') {
            mimeType = 'application/pdf'; // GPT-4o can process PDFs for text
        }
        // Add more MIME types as needed for other file types OpenAI supports

        try {
            if (mimeType.startsWith('image/')) {
                const base64Image = await loadAttachmentBase64(filePath);
                if (base64Image) {
                    contentParts.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`,
                            detail: 'auto', // or 'low', 'high'
                        },
                    });
                    console.log(`    - Added image attachment: ${attach.filename}`);
                }
            } else if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
                const fileContent = await fs.readFile(filePath, 'utf8');
                contentParts.push({
                    type: 'text',
                    text: `--- Start of attached file: ${attach.filename} ---\n${fileContent}\n--- End of attached file: ${attach.filename} ---`,
                });
                console.log(`    - Added text attachment: ${attach.filename}`);
            } else {
                console.warn(
                    `    - Skipping unsupported attachment type for LLM: ${attach.filename} (${mimeType}).`
                );
                // For other file types, you might choose to embed as binary (if LLM supports)
                // or provide a placeholder indicating a file was present but not processed.
            }
        } catch (error) {
            console.error(`Error processing attachment ${attach.filename}:`, error.message);
        }
    }
    return contentParts;
}

// Export the OpenAI client and utility functions
module.exports = {
    openai,
    loadAttachmentBase64, // Although not directly used by llmCompletion after refactor, it's a helper for prepareAttachmentsForOpenAI
    prepareAttachmentsForOpenAI,
};
