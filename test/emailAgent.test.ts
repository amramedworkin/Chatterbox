import 'dotenv/config';
import { runEmailAgent } from '../src/openai/emailAgent';

describe('runEmailAgent integration', () => {
    const messageId = process.env.EMAIL_AGENT_TEST_MESSAGE_ID;
    const gmailUser = process.env.EMAIL_AGENT_TEST_USER;

    jest.setTimeout(1000 * 60 * 5);

    if (!messageId) {
        // eslint-disable-next-line jest/no-disabled-tests, jest/expect-expect
        test.skip('skip when no message id provided', () => {
            console.warn('EMAIL_AGENT_TEST_MESSAGE_ID not set. Skipping test.');
        });
        return;
    }

    test('should return a non-empty response', async () => {
        const result = await runEmailAgent(messageId, gmailUser);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});
