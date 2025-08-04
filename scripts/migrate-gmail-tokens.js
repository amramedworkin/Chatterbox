#!/usr/bin/env node

/**
 * Migrate Gmail OAuth Tokens to AWS
 * 
 * This script migrates only the Gmail OAuth tokens to AWS Secrets Manager
 */

const { execSync } = require('child_process');
const chalk = require('chalk');

function printInfo(message) {
    console.log(chalk.blue(`ℹ️  ${message}`));
}

function printSuccess(message) {
    console.log(chalk.green(`✅ ${message}`));
}

function printError(message) {
    console.log(chalk.red(`❌ ${message}`));
}

async function main() {
    try {
        printInfo('Migrating Gmail OAuth tokens to AWS Secrets Manager...');
        
        // Run the populate script with Gmail tokens focus
        // Pass the flag as the second argument to avoid it being interpreted as folder name
        execSync('node Cloud/AWS/scripts/populate-secrets-from-init.js "" --gmail-tokens-only', { 
            stdio: 'inherit' 
        });
        
        printSuccess('Gmail OAuth tokens migrated successfully!');
    } catch (error) {
        printError(`Failed to migrate Gmail tokens: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main }; 