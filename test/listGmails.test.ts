import { listGmails } from '../src/mail/listGmails';

describe('listGmails', () => {
    it('should list Gmail messages with default 7 days', async () => {
        try {
            const messageIds = await listGmails();
            expect(Array.isArray(messageIds)).toBe(true);
            // Since we're testing actual Gmail API, we can't make assumptions about the content
            // but we can verify the structure of the response
            messageIds.forEach((id) => {
                expect(typeof id).toBe('string');
                expect(id.length).toBeGreaterThan(0);
            });
        } catch (error) {
            console.error('Test failed with error:', error);
            throw error;
        }
    });

    it('should list Gmail messages with custom days parameter', async () => {
        try {
            const customDays = 20;
            const messageIds = await listGmails(customDays);
            expect(Array.isArray(messageIds)).toBe(true);
            messageIds.forEach((id) => {
                expect(typeof id).toBe('string');
                expect(id.length).toBeGreaterThan(0);
            });
        } catch (error) {
            console.error('Test failed with error:', error);
            throw error;
        }
    });

    it('should handle zero days parameter', async () => {
        try {
            const messageIds = await listGmails(0);
            expect(Array.isArray(messageIds)).toBe(true);
            messageIds.forEach((id) => {
                expect(typeof id).toBe('string');
                expect(id.length).toBeGreaterThan(0);
            });
        } catch (error) {
            console.error('Test failed with error:', error);
            throw error;
        }
    });

    it('should handle negative days parameter', async () => {
        try {
            const messageIds = await listGmails(-5);
            expect(Array.isArray(messageIds)).toBe(true);
            messageIds.forEach((id) => {
                expect(typeof id).toBe('string');
                expect(id.length).toBeGreaterThan(0);
            });
        } catch (error) {
            console.error('Test failed with error:', error);
            throw error;
        }
    });

    it('should handle custom email parameter', async () => {
        try {
            const customEmail = 'test@example.com';
            const messageIds = await listGmails(7, customEmail);
            expect(Array.isArray(messageIds)).toBe(true);
            messageIds.forEach((id) => {
                expect(typeof id).toBe('string');
                expect(id.length).toBeGreaterThan(0);
            });
        } catch (error) {
            console.error('Test failed with error:', error);
            throw error;
        }
    });
});
