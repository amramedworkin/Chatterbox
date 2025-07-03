#!/usr/bin/env node

/**
 * Script to clean up legacy Parameter Store parameters
 * that weren't being removed by the teardown script
 */

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const ssm = new AWS.SSM();

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
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

function printInfo(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
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
    '/chatterbox/polling/awsamram_gmail_com/total_poll_cycles'
];

async function cleanupLegacyParameters() {
    console.log('🧹 Cleaning up legacy Parameter Store parameters...');
    console.log('='.repeat(60));
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const paramName of LEGACY_PARAMETERS) {
        try {
            // Check if parameter exists
            await ssm.getParameter({ Name: paramName }).promise();
            
            // Delete the parameter
            await ssm.deleteParameter({ Name: paramName }).promise();
            printStatus(`Deleted: ${paramName}`);
            deletedCount++;
            
        } catch (error) {
            if (error.code === 'ParameterNotFound') {
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
    cleanupLegacyParameters().catch(error => {
        printError(`Cleanup failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { cleanupLegacyParameters }; 