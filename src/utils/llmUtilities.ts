// utils/llmUtilities.ts
// This module provides utility functions and shared resources for interacting with OpenAI,
// to be reused by both single-turn completions and multi-turn dialogs.

import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

// Import the configuration object (assumed to be typed elsewhere)
import config from '../src/loadConfig'; // Adjust path if needed

// --- OpenAI Client Initialization ---
const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    organization: config.openai.organizationId, // Optional
});

// --- Types ---

export interface AttachmentInfo {
    filename: string;
    size: number;
}

export type OpenAIContentPart =
    | { type: 'image_url'; image_url: { url: string; detail: 'auto' | 'low' | 'high' } }
    | { type: 'text'; text: string };

// --- Helper Functions ---

/**
 * Loads an attachment file, returning its base64 encoded content.
 * @param filePath The full path to the attachment file.
 * @returns Base64 encoded file content, or null on failure.
 */
export async function loadAttachmentBase64(filePath: string): Promise<string | null> {
    try {
        const fileBuffer = await fs.readFile(filePath);
        return fileBuffer.toString('base64');
    } catch (error: unknown) {
        console.error(`Error loading attachment ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Prepares attachments for inclusion in an OpenAI multimodal message.
 * It reads the actual files from the given path.
 * @param attachmentsInfo An array of attachment objects ({ filename: string, size: number }).
 * @param attachmentsFolderPath The folder containing the attachments.
 * @returns An array of OpenAI-compatible content parts.
 */
export async function prepareAttachmentsForOpenAI(
    attachmentsInfo: AttachmentInfo[],
    attachmentsFolderPath: string
): Promise<OpenAIContentPart[]> {
    const contentParts: OpenAIContentPart[] = [];

    if (!attachmentsInfo || attachmentsInfo.length === 0) {
        return contentParts;
    }

    console.log(`Preparing ${attachmentsInfo.length} attachments from: ${attachmentsFolderPath}`);

    for (const attach of attachmentsInfo) {
        const filePath = path.join(attachmentsFolderPath, attach.filename);
        const fileExtension = path.extname(attach.filename).toLowerCase();
        let mimeType = 'application/octet-stream';

        if (fileExtension === '.txt') {
            mimeType = 'text/plain';
        } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
            mimeType = 'image/jpeg';
        } else if (fileExtension === '.png') {
            mimeType = 'image/png';
        } else if (fileExtension === '.pdf') {
            mimeType = 'application/pdf';
        }

        try {
            if (mimeType.startsWith('image/')) {
                const base64Image = await loadAttachmentBase64(filePath);
                if (base64Image) {
                    contentParts.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`,
                            detail: 'auto',
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
                    `    - Skipping unsupported attachment type: ${attach.filename} (${mimeType}).`
                );
            }
        } catch (error: unknown) {
            console.error(`Error processing attachment ${attach.filename}:`, error.message);
        }
    }

    return contentParts;
}

// --- Exports ---

export { openai };
