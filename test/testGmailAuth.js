// test/testGmailAuth.js
// const { google } = require('googleapis'); // Removed: 'google' is assigned a value but never used
const fs = require('fs').promises;
const readline = require('readline'); // Use the actual readline
const path = require('path');
require('dotenv').config(); // For loading .env during testing

// Import the actual authorizeGmail module
// Removed writeTokenData from destructuring as it's not directly used in this test file
const { authorizeGmail, readTokenData } = require('../src/utils/authorizeGmail');

// Load the actual configuration
const originalConfig = require('../src/loadConfig');

// --- Test Configuration and Paths ---
const TEST_DATA_DIR = path.join(__dirname, 'test_data');
const TEST_CREDENTIALS_PATH = path.join(TEST_DATA_DIR, 'credentials.json');
const TEST_TOKEN_PATH = path.join(TEST_DATA_DIR, 'token.json');

// Override config values for testing purposes
const testConfig = { ...originalConfig }; // Copy existing config
testConfig.google = { ...originalConfig.google }; // Deep copy google section
testConfig.google.credentialsPath = TEST_CREDENTIALS_PATH;
testConfig.google.pollTokenPath = TEST_TOKEN_PATH;

// Increase Jest timeout for interactive authorization
jest.setTimeout(60 * 1000 * 5); // 5 minutes

describe('authorizeGmail (Integration Test)', () => {
    const testUserEmail = 'testuser@example.com'; // Use a dummy email for demonstration, or a real one if needed for specific tests

    let consoleLogSpy;
    let readlineQuestionSpy;

    // Before all tests, set up the test data directory and copy credentials
    beforeAll(async () => {
        // Ensure test data directory exists
        await fs.mkdir(TEST_DATA_DIR, { recursive: true });

        // Copy credentials.json from src/ to the test_data directory
        try {
            await fs.copyFile(originalConfig.google.credentialsPath, TEST_CREDENTIALS_PATH);
            console.log(
                `Copied credentials from ${originalConfig.google.credentialsPath} to ${TEST_CREDENTIALS_PATH}`
            );
        } catch (error) {
            console.error(
                `ERROR: Could not copy credentials.json for integration test. Make sure ${originalConfig.google.credentialsPath} exists and is accessible.`,
                error
            );
            // Exit the process if credentials are not available for integration test
            process.exit(1);
        }

        // Clear existing token.json in test_data to ensure a fresh start for some tests
        try {
            await fs.unlink(TEST_TOKEN_PATH);
            console.log(`Cleaned up existing ${TEST_TOKEN_PATH}`);
        } catch (error) {
            // Ignore if file doesn't exist
            if (error.code !== 'ENOENT') {
                console.warn(
                    `Warning: Could not remove existing ${TEST_TOKEN_PATH}:`,
                    error.message
                );
            }
        }
    });

    // After all tests, clean up the test data directory
    afterAll(async () => {
        try {
            await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
            console.log(`Cleaned up test data directory: ${TEST_DATA_DIR}`);
        } catch (error) {
            console.error('Error cleaning up test data directory:', error);
        }
    });

    // Before each test, setup spies to monitor console and readline
    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // Suppress most console.log
        // Ignored 'callback' parameter using '_' prefix to avoid 'defined but never used' warning.
        readlineQuestionSpy = jest
            .spyOn(readline.Interface.prototype, 'question')
            .mockImplementation((query, _callback) => {
                // Added '_' to _callback
                // For automated tests, we'd provide a code here.
                // For this integration test, we're simulating the interactive prompt.
                // If no interactive input, this test will hang.
                // For the first time, it expects user input. For subsequent runs with a valid token, it won't prompt.
                consoleLogSpy.mockRestore(); // Restore console.log temporarily to show prompt
                console.log(`\nINTEGRATION TEST PROMPT: ${query}`);
                // THIS WILL PAUSE THE TEST AND WAIT FOR MANUAL INPUT.
                // Enter 'mock_auth_code' if you want it to fail token exchange or a real code to succeed.
                // For testing new token generation, you'll need to manually paste the code.
                // For automated testing, you'd provide the code programmatically here.
            });
    });

    // After each test, restore spies
    afterEach(() => {
        consoleLogSpy.mockRestore();
        readlineQuestionSpy.mockRestore();
    });

    test('should authorize and save tokens if no existing tokens', async () => {
        // Ensure no token exists for this test user at the start of this specific test
        try {
            await fs.unlink(TEST_TOKEN_PATH);
        } catch (e) {
            if (e.code !== 'ENOENT') throw e; // Ignore if file doesn't exist
        }

        // The first time this test runs, it will prompt for an auth code.
        // Copy the URL from the console, authorize in browser, paste the code back.
        console.log(`\n--- MANUAL INTERACTION REQUIRED FOR FIRST AUTHORIZATION TEST ---`);
        console.log(`If prompted, please paste the authorization code from your browser.`);
        console.log(`------------------------------------------------------------------`);

        const authClient = await authorizeGmail(testUserEmail, testConfig);

        expect(authClient).toBeDefined();
        expect(authClient.credentials).toHaveProperty('access_token');
        expect(authClient.credentials).toHaveProperty('refresh_token');

        // Verify token was written to file
        const tokenData = await readTokenData(TEST_TOKEN_PATH);
        expect(tokenData).toHaveProperty(testUserEmail);
        expect(tokenData[testUserEmail].access_token).toBe(authClient.credentials.access_token);
        expect(tokenData[testUserEmail].refresh_token).toBe(authClient.credentials.refresh_token);

        // readline.question should have been called
        expect(readlineQuestionSpy).toHaveBeenCalled();
    });

    test('should use existing tokens if already authorized', async () => {
        // This test assumes the previous test (or a manual run) has already created a valid token.json
        // for testUserEmail.

        // No prompt expected if token exists
        const authClient = await authorizeGmail(testUserEmail, testConfig);

        expect(authClient).toBeDefined();
        expect(authClient.credentials).toHaveProperty('access_token');
        expect(authClient.credentials).toHaveProperty('refresh_token');

        // readline.question should NOT have been called, meaning no new authorization was needed
        expect(readlineQuestionSpy).not.toHaveBeenCalled();

        // Verify tokens loaded match what's in the file
        const tokenData = await readTokenData(TEST_TOKEN_PATH);
        expect(tokenData).toHaveProperty(testUserEmail);
        expect(tokenData[testUserEmail].access_token).toBe(authClient.credentials.access_token);
    });

    test('should handle invalid credentials.json gracefully', async () => {
        // Temporarily overwrite the test credentials path to point to a non-existent file
        const originalTestCredentialsPath = testConfig.google.credentialsPath;
        testConfig.google.credentialsPath = path.join(
            TEST_DATA_DIR,
            'non_existent_credentials.json'
        );

        await expect(authorizeGmail(testUserEmail, testConfig)).rejects.toThrow();
        // Verify specific error message related to file not found if needed, e.g., expect.toThrow(/ENOENT/)

        // Restore original path for subsequent tests
        testConfig.google.credentialsPath = originalTestCredentialsPath;
    });

    // Add more tests for refresh token scenarios (if applicable, which are handled by googleapis internally)
    // or other edge cases like token file corruption.
});
