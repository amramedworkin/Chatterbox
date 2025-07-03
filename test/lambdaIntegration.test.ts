#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import config from '../src/loadConfig';
import { sendTestEmail } from '../src/mail/sendGmail';
import { authorizeGmail } from '../src/mail/authorizeGmail';
import { getEmailSentDateString, getEmailReceivedDateString } from '../src/mail/dateUtils';
import { getLatestChatterboxGmail, getGmailById } from '../src/mail/getGmail';
import { execSync } from 'child_process';

// Global variables for persistence
const gmailUser: string = config.app.defaultSendGmailUser;
const currentRecipientEmail: string = config.sendTest.defaultRecipient;
let sendCount: number = 0;

/**
 * Reads the persistent send count from a file.
 * @returns {Promise<number>} The send count, or 0 if not found.
 */
async function readSendCount(): Promise<number> {
    try {
        const sendCountPath = config.sendTest.sendCountPath;
        if (
            await fs
                .access(sendCountPath)
                .then(() => true)
                .catch(() => false)
        ) {
            return parseInt(await fs.readFile(sendCountPath, 'utf8'), 10);
        }
    } catch (err) {
        console.error(`Error reading send count file (${config.sendTest.sendCountPath}):`, err);
    }
    return 0;
}

/**
 * Writes the send count to a file.
 * @param {number} count The count to write.
 */
async function writeSendCount(count: number): Promise<void> {
    try {
        await fs.mkdir(path.dirname(config.sendTest.sendCountPath), { recursive: true });
        await fs.writeFile(config.sendTest.sendCountPath, count.toString(), 'utf8');
        console.log(`Send count persisted to: ${config.sendTest.sendCountPath}`);
    } catch (err) {
        console.error(`Error writing send count file (${config.sendTest.sendCountPath}):`, err);
    }
}

/**
 * Gets the most recent chatterbox email ID
 */
async function getMostRecentChatterboxIdLocal(authClient: any): Promise<string | null> {
    try {
        console.log('🔍 Getting most recent chatterbox email ID...');

        // Get the most recent chatterbox email
        const latestEmail = await getLatestChatterboxGmail(
            config.app.defaultGetGmailUser,
            authClient
        );

        if (!latestEmail) {
            console.log('   ⚠️  No chatterbox emails found');
            return null;
        }

        // Get full email details to access date information
        const fullEmail = await getGmailById(
            latestEmail.id,
            config.app.defaultGetGmailUser,
            authClient
        );

        console.log(`   ✅ Found most recent chatterbox email ID: ${latestEmail.id}`);
        console.log(`   📅 Sent Date: ${getEmailSentDateString(fullEmail)}`);
        console.log(`   📅 Received Date: ${getEmailReceivedDateString(fullEmail)}`);
        console.log(`   📧 Subject: ${latestEmail.subject || 'No subject'}`);
        console.log(`   👤 From: ${latestEmail.sender || 'No sender'}`);
        console.log(`   📝 Snippet: ${latestEmail.snippet || 'No snippet'}`);

        return latestEmail.id;
    } catch (error) {
        console.error('   ❌ Error getting most recent chatterbox ID:', error);
        return null;
    }
}

/**
 * Tests the Lambda function with a Gmail ID
 */
async function testLambdaFunction(gmailId: string): Promise<boolean> {
    try {
        console.log('🚀 Testing Lambda function with Gmail ID...');

        // Run the Lambda test script
        const result = execSync(`node scripts/aws/test-lambda.js ${gmailId}`, {
            encoding: 'utf8',
            stdio: 'pipe',
        });

        console.log('   📋 Lambda Test Output:');
        console.log(result);

        // Check if the test was successful
        if (result.includes('✅ Lambda function executed successfully!')) {
            console.log('   ✅ Lambda test completed successfully!');
            return true;
        } else {
            console.log('   ❌ Lambda test failed');
            return false;
        }
    } catch (error) {
        console.error('   ❌ Error testing Lambda function:', error);
        return false;
    }
}

/**
 * Main integration test function
 */
async function main(): Promise<void> {
    console.log(chalk.blue.bold('\n🧪 Lambda Integration Test'));
    console.log(chalk.cyan('═'.repeat(60)));

    try {
        // Step 1: Send a test email to seed with a new ID
        console.log(chalk.yellow.bold('\n📤 Step 1: Sending test email...'));

        // Read current send count
        sendCount = await readSendCount();
        console.log(`FROM: ${gmailUser}`);
        console.log(`TO: ${currentRecipientEmail}`);
        console.log(`Send Count: ${sendCount}`);

        // Authorize Gmail
        console.log('🔐 Getting authorization for:', gmailUser);
        const authClient = await authorizeGmail(gmailUser, config);
        console.log('✅ Authorization successful for:', gmailUser);

        // Send test email
        const result = await sendTestEmail(
            gmailUser,
            currentRecipientEmail,
            undefined, // conversationId
            0, // attachCount
            authClient
        );

        if (!result.success) {
            throw new Error(`Failed to send email: ${result.error}`);
        }

        console.log('✅ Test email sent successfully!');
        console.log(`📨 Message ID: ${result.messageId}`);

        // Update send count
        sendCount++;
        await writeSendCount(sendCount);

        // Step 2: Get the most recent chatterbox email ID
        console.log(chalk.yellow.bold('\n🔍 Step 2: Getting most recent chatterbox email ID...'));

        // Get authorization for the recipient email to access their emails
        console.log('🔐 Getting authorization for recipient:', config.app.defaultGetGmailUser);
        const recipientAuthClient = await authorizeGmail(config.app.defaultGetGmailUser, config);
        console.log('✅ Authorization successful for recipient');

        const mostRecentId = await getMostRecentChatterboxIdLocal(recipientAuthClient);

        if (!mostRecentId) {
            throw new Error('No chatterbox emails found to test with');
        }

        // Step 3: Test the Lambda function
        console.log(chalk.yellow.bold('\n🚀 Step 3: Testing Lambda function...'));

        const lambdaSuccess = await testLambdaFunction(mostRecentId);

        if (lambdaSuccess) {
            console.log(chalk.green.bold('\n🎉 Integration test completed successfully!'));
            console.log(chalk.cyan('═'.repeat(60)));
            console.log(chalk.green('✅ All three steps completed:'));
            console.log('   1. ✅ Test email sent');
            console.log('   2. ✅ Most recent chatterbox ID retrieved');
            console.log('   3. ✅ Lambda function tested successfully');
        } else {
            throw new Error('Lambda function test failed');
        }
    } catch (error) {
        console.error(chalk.red.bold('\n❌ Integration test failed:'), error);
        process.exit(1);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}
