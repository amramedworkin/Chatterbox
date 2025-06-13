// runAuthTest.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import * as assert from 'assert'; // Using Node.js built-in assert module
import 'dotenv/config'; // To load environment variables if needed

import { authorizeGmail, readTokenData } from '../src/mail/authorizeGmail';
import { OAuth2Client } from 'googleapis-common';
import originalConfig from '../src/loadConfig'; // Assuming loadConfig.ts exists and exports default
import { AppConfig } from '../src/types/config'; // Import AppConfig

// --- Test Configuration and Paths ---
const TEST_DATA_DIR = path.join(__dirname, 'test_data');
const TEST_CREDENTIALS_PATH = path.join(TEST_DATA_DIR, 'credentials.json');
const TEST_TOKEN_PATH = path.join(TEST_DATA_DIR, 'token.json');

// Override config values for testing purposes
const testConfig: AppConfig = { ...originalConfig }; // Copy existing config
testConfig.google = { ...originalConfig.google }; // Deep copy google section
testConfig.google.credentialsPath = TEST_CREDENTIALS_PATH;
testConfig.google.pollTokenPath = TEST_TOKEN_PATH;

const testUserEmail = 'testuser@example.com';

async function setupTestData() {
    console.log('Setting up test data directory...');
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
}

async function cleanupTestData() {
    console.log('Cleaning up test data directory...');
    try {
        await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
        console.log(`Cleaned up test data directory: ${TEST_DATA_DIR}`);
    } catch (error) {
        console.error('Error cleaning up test data directory:', error);
    }
}

async function runTest(name: string, testFunction: () => Promise<void>) {
    console.log(`\n--- Running Test: ${name} ---`);
    try {
        await testFunction();
        console.log(`--- Test PASSED: ${name} ---`);
    } catch (error) {
        console.error(`--- Test FAILED: ${name} ---`);
        console.error(error);
        process.exit(1); // Exit with error code if any test fails
    }
}

async function test_authorize_and_save_tokens_if_no_existing_tokens() {
    // Ensure no token file exists before this test
    try {
        await fs.unlink(TEST_TOKEN_PATH);
        console.log(`Cleaned up existing ${TEST_TOKEN_PATH}`);
    } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') throw err; // Only rethrow if it's not a 'file not found' error
    }

    console.log(`\n--- MANUAL INTERACTION REQUIRED FOR FIRST AUTHORIZATION TEST ---`);
    console.log(
        `1. Please complete the authorization process in your browser and paste the code back here.`
    );
    console.log(`------------------------------------------------------------------`);

    const authClient: OAuth2Client = await authorizeGmail(testUserEmail, testConfig);

    assert.ok(authClient, 'authClient should be defined');
    assert.ok(authClient.credentials.access_token, 'authClient should have an access_token');
    assert.ok(authClient.credentials.refresh_token, 'authClient should have a refresh_token');

    const tokenData = await readTokenData(TEST_TOKEN_PATH);
    assert.ok(tokenData[testUserEmail], `tokenData should contain an entry for ${testUserEmail}`);
    assert.strictEqual(
        tokenData[testUserEmail].access_token,
        authClient.credentials.access_token,
        'Stored access token should match client access token'
    );
    assert.strictEqual(
        tokenData[testUserEmail].refresh_token,
        authClient.credentials.refresh_token,
        'Stored refresh token should match client refresh token'
    );
}

async function test_should_use_existing_tokens_if_already_authorized() {
    // This test assumes the previous test successfully created a token.json
    // If running independently, you'd need to pre-create a valid token.json

    console.log(
        `\n--- This test uses existing tokens. No manual browser interaction or prompt expected. ---`
    );

    const authClient: OAuth2Client = await authorizeGmail(testUserEmail, testConfig);

    assert.ok(authClient, 'authClient should be defined');
    assert.ok(authClient.credentials.access_token, 'authClient should have an access_token');
    assert.ok(authClient.credentials.refresh_token, 'authClient should have a refresh_token');

    // To verify no new prompt, you would typically mock readline.question in a test framework.
    // In a direct test, you observe console output. If a URL is printed and a prompt appears,
    // this test scenario has failed its intent.
    console.log(
        'Observe the console: no authorization URL or prompt for code should appear above this line.'
    );

    const tokenData = await readTokenData(TEST_TOKEN_PATH);
    assert.ok(tokenData[testUserEmail], `tokenData should contain an entry for ${testUserEmail}`);
    assert.strictEqual(
        tokenData[testUserEmail].access_token,
        authClient.credentials.access_token,
        'Stored access token should match client access token'
    );
}

async function test_should_handle_invalid_credentials_json_gracefully() {
    const originalTestCredentialsPath = testConfig.google.credentialsPath;
    testConfig.google.credentialsPath = path.join(TEST_DATA_DIR, 'non_existent_credentials.json');

    let errorThrown = false;
    try {
        await authorizeGmail(testUserEmail, testConfig);
    } catch (error: unknown) {
        errorThrown = true;
        const err = error as Error;
        assert.ok(
            err.message.includes('Error loading client secret file'),
            'Error message should indicate credentials file issue'
        );
    } finally {
        testConfig.google.credentialsPath = originalTestCredentialsPath; // Restore for subsequent tests
    }
    assert.ok(errorThrown, 'An error should have been thrown for invalid credentials path');
}

async function main() {
    await setupTestData();

    // Run tests sequentially
    await runTest(
        'authorize and save tokens if no existing tokens',
        test_authorize_and_save_tokens_if_no_existing_tokens
    );
    await runTest(
        'use existing tokens if already authorized',
        test_should_use_existing_tokens_if_already_authorized
    );
    await runTest(
        'handle invalid credentials.json gracefully',
        test_should_handle_invalid_credentials_json_gracefully
    );

    await cleanupTestData();
    console.log('\nAll direct tests completed successfully!');
    process.exit(0); // Exit successfully
}

// Execute the main function
main().catch((error) => {
    console.error('\nAn unhandled error occurred during tests:', error);
    process.exit(1);
});
