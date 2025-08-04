#!/usr/bin/env node

/**
 * Migrate OpenAI API Key to AWS
 * 
 * This script migrates only the OpenAI API key to AWS Secrets Manager
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
        printInfo('Migrating OpenAI API key to AWS Secrets Manager...');
        
        // Run the populate script with OpenAI key focus
        execSync('node Cloud/AWS/scripts/populate-secrets-from-init.js --openai-key-only', { 
            stdio: 'inherit' 
        });
        
        printSuccess('OpenAI API key migrated successfully!');
    } catch (error) {
        printError(`Failed to migrate OpenAI key: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main }; 