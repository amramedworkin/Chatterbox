#!/usr/bin/env node

import chalk from 'chalk';
import config from '../src/loadConfig';
import { authorizeGmail } from '../src/mail/authorizeGmail';
import { getLatestChatterboxGmail, getGmailById } from '../src/mail/getGmail';
import { getEmailSentDateString, getEmailReceivedDateString } from '../src/mail/dateUtils';

async function main(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 Test: Get Latest Chatterbox Gmail ID'));
    console.log(chalk.cyan('═'.repeat(50)));

    try {
        // Get authorization
        const gmailUser = config.app.defaultGetGmailUser;
        console.log(`🔐 Getting authorization for: ${gmailUser}`);
        const authClient = await authorizeGmail(gmailUser, config);
        console.log('✅ Authorization successful');

        // Get the latest chatterbox email
        console.log('\n📧 Getting latest chatterbox email...');
        const latestEmail = await getLatestChatterboxGmail(gmailUser, authClient);

        if (latestEmail) {
            // Get full email details to access date information
            const fullEmail = await getGmailById(latestEmail.id, gmailUser, authClient);

            console.log(chalk.green.bold('\n✅ Latest Chatterbox Email Found:'));
            console.log(chalk.yellow('📧 ID:'), chalk.white(latestEmail.id));
            console.log(chalk.yellow('🧵 Thread ID:'), chalk.white(latestEmail.threadId));
            console.log(
                chalk.yellow('📅 Sent Date:'),
                chalk.white(getEmailSentDateString(fullEmail))
            );
            console.log(
                chalk.yellow('📅 Received Date:'),
                chalk.white(getEmailReceivedDateString(fullEmail))
            );
            console.log(
                chalk.yellow('📝 Subject:'),
                chalk.white(latestEmail.subject || 'No subject')
            );
            console.log(chalk.yellow('👤 From:'), chalk.white(latestEmail.sender || 'No sender'));
            console.log(
                chalk.yellow('💬 Snippet:'),
                chalk.white(latestEmail.snippet || 'No snippet')
            );
        } else {
            console.log(chalk.yellow('\n⚠️  No chatterbox emails found'));
        }
    } catch (error) {
        console.error(chalk.red.bold('\n❌ Test failed:'), error);
        process.exit(1);
    }
}

// Run the test
main().catch(console.error);
