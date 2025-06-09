import originalConfig from '../src/loadConfig';
import { authorizeGmail } from '../src/utils/authorizeGmail';

const testUser = originalConfig.app.defaultPollGmailUser;

// This test runs authorizeGmail with the real configuration. It will fail if
// credentials.json is missing or invalid.

test('authorizeGmail throws when credentials file is missing', async () => {
    await expect(authorizeGmail(testUser, originalConfig)).rejects.toThrow();
});
