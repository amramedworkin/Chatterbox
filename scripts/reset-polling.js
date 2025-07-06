#!/usr/bin/env node

/**
 * Reset both AWS and local polling state to mimic "first run" state
 * Clears last_history_id and last_polled_timestamp for all configured Gmail users
 */

const { resetUserPollingState: resetAwsPollingState, getGmailUsers: getAwsGmailUsers } = require('./reset-aws-polling.js');
const { resetLocalPollingState, getGmailUsers: getLocalGmailUsers } = require('./reset-local-polling.js');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function printInfo(message) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅${colors.reset} ${message}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}❌${colors.reset} ${message}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${'='.repeat(message.length)}`);
}

/**
 * Reset AWS polling state
 */
async function resetAwsState() {
    printHeader('AWS Polling State Reset');
    
    try {
        const gmailUsers = await getAwsGmailUsers();
        
        if (gmailUsers.length === 0) {
            printWarning('No Gmail users found in AWS secrets. Using default user.');
            gmailUsers.push('awsamram@gmail.com');
        }
        
        printSuccess(`Found ${gmailUsers.length} Gmail user(s) in AWS: ${gmailUsers.join(', ')}`);
        
        let successCount = 0;
        let failureCount = 0;
        
        for (const userEmail of gmailUsers) {
            const success = await resetAwsPollingState(userEmail);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
        }
        
        return { successCount, failureCount, totalUsers: gmailUsers.length };
        
    } catch (error) {
        printError(`AWS reset failed: ${error.message}`);
        return { successCount: 0, failureCount: 1, totalUsers: 0 };
    }
}

/**
 * Reset local polling state
 */
function resetLocalState() {
    printHeader('Local Polling State Reset');
    
    try {
        const gmailUsers = getLocalGmailUsers();
        printSuccess(`Found ${gmailUsers.length} Gmail user(s) in local config: ${gmailUsers.join(', ')}`);
        
        const { successCount, failureCount } = resetLocalPollingState();
        return { successCount, failureCount, totalFiles: successCount + failureCount };
        
    } catch (error) {
        printError(`Local reset failed: ${error.message}`);
        return { successCount: 0, failureCount: 1, totalFiles: 0 };
    }
}

/**
 * Main function
 */
async function main() {
    printHeader('Complete Polling State Reset');
    printInfo('This will reset both AWS Parameter Store and local file polling state');
    printInfo('to mimic a "first run" state for all configured Gmail users.');
    
    try {
        // Reset AWS state
        const awsResult = await resetAwsState();
        
        // Reset local state
        const localResult = resetLocalState();
        
        // Summary
        printHeader('Complete Reset Summary');
        
        printInfo('AWS Results:');
        printSuccess(`  Successfully reset ${awsResult.successCount}/${awsResult.totalUsers} user(s)`);
        if (awsResult.failureCount > 0) {
            printError(`  Failed to reset ${awsResult.failureCount} user(s)`);
        }
        
        printInfo('Local Results:');
        printSuccess(`  Successfully reset ${localResult.successCount}/${localResult.totalFiles} file(s)`);
        if (localResult.failureCount > 0) {
            printError(`  Failed to reset ${localResult.failureCount} file(s)`);
        }
        
        printInfo('\nNext steps:');
        printInfo('1. Both AWS Lambda and local polling will now start fresh');
        printInfo('2. They will search for emails from the last 30 days');
        printInfo('3. Test AWS: npm run aws:deploy:lambda');
        printInfo('4. Test Local: npm run mail:poll');
        
        // Overall success/failure
        const totalFailures = awsResult.failureCount + localResult.failureCount;
        if (totalFailures === 0) {
            printSuccess('\n🎉 All polling state reset successfully!');
        } else {
            printWarning(`\n⚠️  Reset completed with ${totalFailures} failure(s). Check logs above.`);
        }
        
    } catch (error) {
        printError(`Script failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        printError(`Unhandled error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { resetAwsState, resetLocalState }; 