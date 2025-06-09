// test/testGmailAuth.ts
import { promises as fs } from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import 'dotenv/config';

import { authorizeGmail, readTokenData } from '../src/utils/authorizeGmail';
import { OAuth2Client } from 'googleapis-common';
import originalConfig from '../src/loadConfig'; // Assuming loadConfig.ts now exports default
import { AppConfig } from '../src/types/config'; // Import AppConfig

// Define a simple type for the mock's 'options' parameter to bypass 'Abortable' type issues
// This is used for the second argument of readline.question when it's not the callback.
interface MockedQuestionOptions {
    signal?: unknown; // A generic signal property, as we're not using AbortSignal functionality in the mock
}

// --- Test Configuration and Paths ---
const TEST_DATA_DIR = path.join(__dirname, 'test_data');
const TEST_CREDENTIALS_PATH = path.join(TEST_DATA_DIR, 'credentials.json');
const TEST_TOKEN_PATH = path.join(TEST_DATA_DIR, 'token.json');

// Override config values for testing purposes
const testConfig: AppConfig = { ...originalConfig }; // Copy existing config
testConfig.google = { ...originalConfig.google }; // Deep copy google section
testConfig.google.credentialsPath = TEST_CREDENTIALS_PATH;
testConfig.google.pollTokenPath = TEST_TOKEN_PATH;

// Increase Jest timeout for interactive authorization
jest.setTimeout(60 * 1000 * 5); // 5 minutes

describe('authorizeGmail (Integration Test)', () => {
    const testUserEmail = 'testuser@example.com';

    let consoleLogSpy: jest.SpyInstance;
    let readlineQuestionSpy: jest.SpyInstance;

    beforeAll(async () => {
        await fs.mkdir(TEST_DATA_DIR, { recursive: true });

        try {
            await fs.copyFile(originalConfig.google.credentialsPath, TEST_CREDENTIALS_PATH);
            console.log(
                `Copied credentials from ${originalConfig.google.credentialsPath} to ${TEST_CREDENTIALS_PATH}`
            );
        } catch (error: unknown) {
            const err = error as NodeJS.ErrnoException;
            console.error(
                `ERROR: Could not copy credentials.json for integration test. Make sure ${originalConfig.google.credentialsPath} exists and is accessible.`,
                err
            );
            process.exit(1);
        }

        try {
            await fs.unlink(TEST_TOKEN_PATH);
            console.log(`Cleaned up existing ${TEST_TOKEN_PATH}`);
        } catch (error: unknown) {
            const err = error as NodeJS.ErrnoException;
            if (err.code !== 'ENOENT') {
                console.warn(`Warning: Could not remove existing ${TEST_TOKEN_PATH}:`, err.message);
            }
        }
    });

    afterAll(async () => {
        try {
            await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
            console.log(`Cleaned up test data directory: ${TEST_DATA_DIR}`);
        } catch (error) {
            console.error('Error cleaning up test data directory:', error);
        }
    });

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Corrected readline.Interface.prototype.question mock signature
        readlineQuestionSpy = jest
            .spyOn(readline.Interface.prototype, 'question')
            .mockImplementation(
                (
                    query: string,
                    // Can be the callback, or the options object (MockedQuestionOptions)
                    callbackOrOptions: ((answer: string) => void) | MockedQuestionOptions,
                    // If options are provided as the second argument, then this is the callback
                    callbackIfOptions?: (answer: string) => void
                ) => {
                    consoleLogSpy.mockRestore();
                    console.log(`\nINTEGRATION TEST PROMPT: ${query}`);

                    // Determine the actual callback function
                    let actualCallback: (answer: string) => void;
                    if (typeof callbackOrOptions === 'function') {
                        actualCallback = callbackOrOptions;
                    } else if (callbackIfOptions) {
                        actualCallback = callbackIfOptions;
                    } else {
                        // Provide a dummy callback to avoid errors if no callback is found
                        actualCallback = () => {};
                    }

                    // Simulate user input for automated tests
                    actualCallback('mock_auth_code_for_test');
                }
            );
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        readlineQuestionSpy.mockRestore();
    });

    test('should authorize and save tokens if no existing tokens', async () => {
        try {
            await fs.unlink(TEST_TOKEN_PATH);
        } catch (e: unknown) {
            const err = e as NodeJS.ErrnoException;
            if (err.code !== 'ENOENT') throw err;
        }

        console.log(`\n--- MANUAL INTERACTION REQUIRED FOR FIRST AUTHORIZATION TEST ---`);
        console.log(`If prompted, please paste the authorization code from your browser.`);
        console.log(`------------------------------------------------------------------`);

        const authClient: OAuth2Client = await authorizeGmail(testUserEmail, testConfig);

        expect(authClient).toBeDefined();
        expect(authClient.credentials).toHaveProperty('access_token');
        expect(authClient.credentials).toHaveProperty('refresh_token');

        const tokenData = await readTokenData(TEST_TOKEN_PATH);
        expect(tokenData).toHaveProperty(testUserEmail);
        expect(tokenData[testUserEmail].access_token).toBe(authClient.credentials.access_token);
        expect(tokenData[testUserEmail].refresh_token).toBe(authClient.credentials.refresh_token);

        expect(readlineQuestionSpy).toHaveBeenCalled();
    });

    test('should use existing tokens if already authorized', async () => {
        const authClient: OAuth2Client = await authorizeGmail(testUserEmail, testConfig);

        expect(authClient).toBeDefined();
        expect(authClient.credentials).toHaveProperty('access_token');
        expect(authClient.credentials).toHaveProperty('refresh_token');

        expect(readlineQuestionSpy).not.toHaveBeenCalled();

        const tokenData = await readTokenData(TEST_TOKEN_PATH);
        expect(tokenData).toHaveProperty(testUserEmail);
        expect(tokenData[testUserEmail].access_token).toBe(authClient.credentials.access_token);
    });

    test('should handle invalid credentials.json gracefully', async () => {
        const originalTestCredentialsPath = testConfig.google.credentialsPath;
        testConfig.google.credentialsPath = path.join(
            TEST_DATA_DIR,
            'non_existent_credentials.json'
        );

        await expect(authorizeGmail(testUserEmail, testConfig)).rejects.toThrow();

        testConfig.google.credentialsPath = originalTestCredentialsPath;
    });
});
