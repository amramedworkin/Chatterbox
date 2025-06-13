import { promises as fs } from 'fs';
import * as path from 'path';
import config from '../src/loadConfig';

// Import the function to test
import { getUniqueAttachments } from '../src/mail/listAttachments';

describe('listAttachments', () => {
    it('should list unique attachments for a conversation', async () => {
        // Create a test conversation ID
        const testConversationId = 'test-conversation-' + Date.now();
        const conversationFolder = path.join(config.app.interactionsBaseFolder, testConversationId);
        const attachmentFolder = path.join(conversationFolder, 'attachments');

        try {
            // Create test directory structure
            await fs.mkdir(attachmentFolder, { recursive: true });

            // Create some test files
            const testFiles = [
                { name: 'test1.txt', content: 'test content 1' },
                { name: 'test2.txt', content: 'test content 2' },
                { name: 'test3.txt', content: 'test content 1' }, // Duplicate content
            ];

            for (const file of testFiles) {
                const filePath = path.join(attachmentFolder, file.name);
                await fs.writeFile(filePath, file.content);
            }

            // Test the function
            const attachments = await getUniqueAttachments(testConversationId);

            // Verify the results
            expect(Array.isArray(attachments)).toBe(true);
            expect(attachments.length).toBe(2); // Should only have 2 unique files due to duplicate content

            attachments.forEach((attachment) => {
                expect(attachment).toHaveProperty('uniqueName');
                expect(attachment).toHaveProperty('originalPath');
                expect(attachment).toHaveProperty('filename');
                expect(attachment).toHaveProperty('sequenceFolder');
                expect(attachment).toHaveProperty('hash');

                // Additional type safety checks
                expect(typeof attachment.uniqueName).toBe('string');
                expect(typeof attachment.originalPath).toBe('string');
                expect(typeof attachment.filename).toBe('string');
                expect(typeof attachment.sequenceFolder).toBe('string');
                expect(typeof attachment.hash).toBe('string');
            });
        } catch (error) {
            // Log the error and rethrow to fail the test
            console.error('Test failed with error:', error);
            throw error;
        } finally {
            // Clean up test files
            try {
                await fs.rm(conversationFolder, { recursive: true, force: true });
            } catch (error) {
                console.error('Error cleaning up test files:', error);
            }
        }
    });

    it('should handle non-existent conversation folder', async () => {
        const nonExistentId = 'non-existent-' + Date.now();
        const attachments = await getUniqueAttachments(nonExistentId);
        expect(Array.isArray(attachments)).toBe(true);
        expect(attachments.length).toBe(0);
    });

    it('should handle empty attachments folder', async () => {
        const testConversationId = 'test-conversation-empty-' + Date.now();
        const conversationFolder = path.join(config.app.interactionsBaseFolder, testConversationId);
        const attachmentFolder = path.join(conversationFolder, 'attachments');

        try {
            // Create empty directory structure
            await fs.mkdir(attachmentFolder, { recursive: true });

            const attachments = await getUniqueAttachments(testConversationId);
            expect(Array.isArray(attachments)).toBe(true);
            expect(attachments.length).toBe(0);
        } finally {
            // Clean up test files
            try {
                await fs.rm(conversationFolder, { recursive: true, force: true });
            } catch (error) {
                console.error('Error cleaning up test files:', error);
            }
        }
    });
});
