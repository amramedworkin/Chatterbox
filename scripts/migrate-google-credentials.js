#!/usr/bin/env node

/**
 * Migrate Google OAuth Credentials to AWS
 * 
 * This script migrates only the Google OAuth credentials to AWS Secrets Manager
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
        printInfo('Migrating Google OAuth credentials to AWS Secrets Manager...');
        
        // Run the populate script with Google credentials focus
        execSync('node Cloud/AWS/scripts/populate-secrets-from-init.js --google-credentials-only', { 
            stdio: 'inherit' 
        });
        
        printSuccess('Google OAuth credentials migrated successfully!');
    } catch (error) {
        printError(`Failed to migrate Google credentials: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main }; 