import { listGmails } from '../src/mail/listGmails';

describe('listGmails', () => {
    // Set a longer timeout since we're making real API calls
    jest.setTimeout(60000);

    it('should list Gmail messages with default parameter', async () => {
        console.log('Starting default parameter test...');
        try {
            const response = await listGmails();
            console.log(`Received ${response.length} messages`);
            expect(Array.isArray(response)).toBe(true);
            expect(response.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
            console.log('Default parameter test completed successfully');
        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        }
    });

    it('should list Gmail messages with custom days parameter', async () => {
        try {
            const days = 20;
            const response = await listGmails(days);
            expect(Array.isArray(response)).toBe(true);
            expect(response.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        }
    });

    it('should handle zero days parameter', async () => {
        try {
            const response = await listGmails(0);
            expect(Array.isArray(response)).toBe(true);
            expect(response.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        }
    });

    it('should handle negative days parameter', async () => {
        try {
            const response = await listGmails(-5);
            expect(Array.isArray(response)).toBe(true);
            expect(response.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        }
    });

    it('should handle custom email parameter', async () => {
        try {
            const customEmail = 'test@example.com';
            const response = await listGmails(7, customEmail);
            expect(Array.isArray(response)).toBe(true);
            expect(response.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        }
    });
});
