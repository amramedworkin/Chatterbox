import { listGmails } from '../src/mail/listGmails';
import { authorizeGmail } from '../src/mail/authorizeGmail';
import config from '../src/loadConfig';
import { OAuth2Client } from 'googleapis-common';

// Simple assertion helper
function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

// Simple test runner
async function runTest(name: string, testFn: () => Promise<void>) {
    try {
        console.log(`Running test: ${name}`);
        await testFn();
        console.log(`✅ ${name} passed`);
    } catch (error) {
        console.error(`❌ ${name} failed:`, error);
    }
}

let oAuth2Client: OAuth2Client;

async function setupAuth() {
    console.log('Setting up authorization...');
    const email = config.app.defaultPollGmailUser;
    oAuth2Client = await authorizeGmail(email, config, true);
    console.log('Authorization setup complete');
}

async function testDefaultParameter() {
    console.log('Starting default parameter test...');
    const response = await listGmails(7, undefined, oAuth2Client);
    console.log(`Received ${response.length} messages`);
    assert(Array.isArray(response), 'Response should be an array');
    assert(response.every((id: string) => /^[a-zA-Z0-9_-]+$/.test(id)), 'All IDs should match expected pattern');
    console.log('Default parameter test completed successfully');
}

async function testCustomDaysParameter() {
    const days = 20;
    const response = await listGmails(days, undefined, oAuth2Client);
    assert(Array.isArray(response), 'Response should be an array');
    assert(response.every((id: string) => /^[a-zA-Z0-9_-]+$/.test(id)), 'All IDs should match expected pattern');
}

async function testZeroDaysParameter() {
    const response = await listGmails(0, undefined, oAuth2Client);
    assert(Array.isArray(response), 'Response should be an array');
    assert(response.every((id: string) => /^[a-zA-Z0-9_-]+$/.test(id)), 'All IDs should match expected pattern');
}

async function testNegativeDaysParameter() {
    const response = await listGmails(-5, undefined, oAuth2Client);
    assert(Array.isArray(response), 'Response should be an array');
    assert(response.every((id: string) => /^[a-zA-Z0-9_-]+$/.test(id)), 'All IDs should match expected pattern');
}

async function testCustomEmailParameter() {
    const customEmail = 'test@example.com';
    const response = await listGmails(7, customEmail, oAuth2Client);
    assert(Array.isArray(response), 'Response should be an array');
    assert(response.every((id: string) => /^[a-zA-Z0-9_-]+$/.test(id)), 'All IDs should match expected pattern');
}

async function runTests() {
    try {
        await setupAuth();
        await runTest('should list Gmail messages with default parameter', testDefaultParameter);
        await runTest('should list Gmail messages with custom days parameter', testCustomDaysParameter);
        await runTest('should handle zero days parameter', testZeroDaysParameter);
        await runTest('should handle negative days parameter', testNegativeDaysParameter);
        await runTest('should handle custom email parameter', testCustomEmailParameter);
    } catch (error) {
        console.error('Test suite failed:', error);
    }
}

runTests(); 