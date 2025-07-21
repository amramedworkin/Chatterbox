#!/usr/bin/env node

const chalk = require('chalk');
const { SSMClient, GetParameterCommand, DeleteParameterCommand } = require('@aws-sdk/client-ssm');

/**
 * Script to clean up legacy Parameter Store parameters
 * that weren't being removed by the teardown script
 */

// Configure AWS
const ssm = new SSMClient({ region: 'us-east-1' });

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
};

function printStatus(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

// eslint-disable-next-line no-unused-vars
function printInfo(message) {
    console.log(chalk.blue(`ℹ️  ${message}`));
}

// Legacy parameters that need to be cleaned up
const LEGACY_PARAMETERS = [
    '/chatterbox/development/gmail/client-id',
    '/chatterbox/development/gmail/client-secret',
    '/chatterbox/development/gmail/redirect-uri',
    '/chatterbox/google-config',
    '/chatterbox/openai-config',
    '/chatterbox/polling/awsamram_gmail_com/last_history_id',
    '/chatterbox/polling/awsamram_gmail_com/last_polled_timestamp',
    '/chatterbox/polling/awsamram_gmail_com/last_polled_user',
    '/chatterbox/polling/awsamram_gmail_com/total_poll_cycles',
];

async function cleanupLegacyParameters() {
    console.log('🧹 Cleaning up legacy Parameter Store parameters...');
    console.log('='.repeat(60));

    let deletedCount = 0;
    let errorCount = 0;

    for (const paramName of LEGACY_PARAMETERS) {
        try {
            // Check if parameter exists
            await ssm.send(new GetParameterCommand({ Name: paramName }));

            // Delete the parameter
            await ssm.send(new DeleteParameterCommand({ Name: paramName }));
            printStatus(`Deleted: ${paramName}`);
            deletedCount++;
        } catch (error) {
            if (error.name === 'ParameterNotFound') {
                printWarning(`Already deleted: ${paramName}`);
            } else {
                printError(`Error deleting ${paramName}: ${error.message}`);
                errorCount++;
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 Cleanup Summary:');
    printStatus(`Successfully deleted: ${deletedCount} parameters`);
    if (errorCount > 0) {
        printError(`Errors encountered: ${errorCount}`);
    } else {
        printStatus('All legacy parameters cleaned up successfully!');
    }

    console.log('\n💡 Next steps:');
    console.log('1. Run: npm run aws:deploy:simple');
    console.log('2. Run: npm run aws:init:prepare');
    console.log('3. Run: npm run aws:init:migrate');
    console.log('4. Run: npm run aws:validate (to verify)');
}

if (require.main === module) {
    cleanupLegacyParameters().catch((error) => {
        printError(`Cleanup failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { cleanupLegacyParameters };
