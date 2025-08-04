#!/usr/bin/env node

/**
 * Migrate Configuration File to AWS
 * 
 * This script migrates only the config.json file to AWS Parameter Store
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
        printInfo('Migrating configuration file to AWS Parameter Store...');
        
        // Run the populate script with config.json focus
        // Pass the flag as the second argument to avoid it being interpreted as folder name
        execSync('node Cloud/AWS/scripts/populate-secrets-from-init.js "" --config-only', { 
            stdio: 'inherit' 
        });
        
        printSuccess('Configuration file migrated successfully!');
    } catch (error) {
        printError(`Failed to migrate configuration: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main }; 