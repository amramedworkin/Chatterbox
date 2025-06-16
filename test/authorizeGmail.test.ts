import { promises as fs } from 'fs';
import * as path from 'path';
import { OAuth2Client } from 'googleapis-common';
import { authorizeGmail, readTokenData, writeTokenData } from '../src/mail/authorizeGmail';
import { AppConfig } from '../src/types/config';
import * as readline from 'readline';

// Mock configuration
const mockConfig: AppConfig = {
    google: {
        credentialsPath: path.join(__dirname, 'test-credentials.json'),
        pollTokenPath: path.join(__dirname, 'test-token.json'),
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
};

// Test email
const testEmail = 'test@example.com';

// Helper function to clean up test files
async function cleanupTestFiles() {
    try {
        await fs.unlink(mockConfig.google.pollTokenPath);
    } catch (error) {
        // Ignore errors if file doesn't exist
    }
}

// Simple test runner
async function runTest(name: string, testFn: () => Promise<void>) {
    try {
        console.log(`Running test: ${name}`);
        await testFn();
        console.log(`✅ ${name} passed`);
    } catch (error) {
        console.error(`❌ ${name} failed:`, error);
        throw error;
    }
}

// Interactive test runner
async function runInteractiveTest(name: string, testFn: () => Promise<void>) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise<void>((resolve) => {
        rl.question(`Run interactive test "${name}"? (y/n): `, async (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y') {
                try {
                    console.log(`Running interactive test: ${name}`);
                    await testFn();
                    console.log(`✅ ${name} passed`);
                } catch (error) {
                    console.error(`❌ ${name} failed:`, error);
                }
            } else {
                console.log(`Skipping interactive test: ${name}`);
            }
            resolve();
        });
    });
}

// Test suite
async function runTests() {
    console.log('Starting Gmail authorization tests...\n');

    // Unit Tests
    console.log('=== Running Unit Tests ===\n');

    // Test 1: Token data reading and writing
    await runTest('Token data operations', async () => {
        const testData = {
            [testEmail]: {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                scope: 'test-scope',
                token_type: 'Bearer',
                expiry_date: Date.now() + 3600000,
            },
        };

        // Test writing token data
        await writeTokenData(mockConfig.google.pollTokenPath, testData);

        // Test reading token data
        const readData = await readTokenData(mockConfig.google.pollTokenPath);

        if (JSON.stringify(readData) !== JSON.stringify(testData)) {
            throw new Error('Token data mismatch after write/read operations');
        }
    });

    // Test 2: Token data migration
    await runTest('Token data migration', async () => {
        const oldFormatData = {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            scope: 'test-scope',
            token_type: 'Bearer',
            expiry_date: Date.now() + 3600000,
        };

        // Write old format data
        await fs.writeFile(mockConfig.google.pollTokenPath, JSON.stringify(oldFormatData));

        // Read should trigger migration
        const migratedData = await readTokenData(mockConfig.google.pollTokenPath);

        if (!migratedData['default'] || !migratedData['default'].access_token) {
            throw new Error('Token data migration failed');
        }
    });

    // Test 3: Invalid token file handling
    await runTest('Invalid token file handling', async () => {
        // Write invalid JSON
        await fs.writeFile(mockConfig.google.pollTokenPath, 'invalid-json');

        try {
            await readTokenData(mockConfig.google.pollTokenPath);
            throw new Error('Should have thrown an error for invalid JSON');
        } catch (error) {
            // Expected error
        }
    });

    // Interactive Tests
    console.log('\n=== Running Interactive Tests ===\n');
    console.log('Note: Interactive tests require valid Google OAuth2 credentials.');
    console.log('Make sure you have a valid credentials.json file in the test directory.\n');

    // Test 4: Full OAuth2 authorization flow
    await runInteractiveTest('Full OAuth2 authorization flow', async () => {
        try {
            const oAuth2Client = await authorizeGmail(testEmail, mockConfig, true);

            // Verify the client has credentials
            const credentials = oAuth2Client.credentials;
            if (!credentials.access_token) {
                throw new Error('No access token obtained');
            }

            // Verify token was saved
            const savedToken = await readTokenData(mockConfig.google.pollTokenPath);
            if (!savedToken[testEmail]?.access_token) {
                throw new Error('Token was not saved properly');
            }

            console.log('Successfully obtained and saved OAuth2 credentials');
        } catch (error) {
            console.error('OAuth2 authorization failed:', error);
            throw error;
        }
    });

    // Test 5: Token refresh flow
    await runInteractiveTest('Token refresh flow', async () => {
        try {
            // First ensure we have a token
            const savedToken = await readTokenData(mockConfig.google.pollTokenPath);
            if (!savedToken[testEmail]?.access_token) {
                console.log('No existing token found. Running full authorization first...');
                await authorizeGmail(testEmail, mockConfig, true);
            }

            // Now try to refresh
            const oAuth2Client = await authorizeGmail(testEmail, mockConfig, true);
            const credentials = oAuth2Client.credentials;

            if (!credentials.access_token) {
                throw new Error('No access token obtained after refresh');
            }

            console.log('Successfully refreshed OAuth2 credentials');
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    });

    // Cleanup
    await cleanupTestFiles();
    console.log('\nAll tests completed!');
}

// Run the tests
runTests().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
