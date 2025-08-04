#!/usr/bin/env node

/**
 * Selective Migration Script for Chatterbox AWS Setup
 * 
 * This script allows users to selectively migrate specific components to AWS
 * instead of migrating everything at once. It provides an interactive menu
 * to choose which migration points to execute.
 */

const { execSync } = require('child_process');
const chalk = require('chalk');
const readline = require('readline');

// Migration points configuration
const MIGRATION_POINTS = {
    'config': {
        name: 'Configuration File (config.json)',
        description: 'Migrate main application configuration to AWS Parameter Store',
        script: 'aws:init:migrate:config',
        required: true
    },
    'oauth': {
        name: 'Google OAuth Credentials',
        description: 'Migrate Google API credentials to AWS Secrets Manager',
        script: 'aws:init:migrate:google-credentials',
        required: true
    },
    'gmail': {
        name: 'Gmail OAuth Tokens',
        description: 'Migrate Gmail authentication tokens to AWS Secrets Manager',
        script: 'aws:init:migrate:gmail-tokens',
        required: true
    },
    'openai': {
        name: 'OpenAI API Key',
        description: 'Migrate OpenAI API key from .env to AWS Secrets Manager',
        script: 'aws:init:migrate:openai-key',
        required: true
    },
    'all': {
        name: 'All Components (Complete Migration)',
        description: 'Migrate all components as currently configured',
        script: 'aws:init:migrate',
        required: false
    },
    'none': {
        name: 'None (Return to Previous Menu)',
        description: 'Return to the previous menu without performing any migration',
        script: null,
        required: false
    }
};

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function printHeader(message) {
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan.bold(message));
    console.log(chalk.cyan('='.repeat(60)));
    console.log('');
}

function printInfo(message) {
    console.log(chalk.blue(`ℹ️  ${message}`));
}

function printSuccess(message) {
    console.log(chalk.green(`✅ ${message}`));
}

function printWarning(message) {
    console.log(chalk.yellow(`⚠️  ${message}`));
}

function printError(message) {
    console.log(chalk.red(`❌ ${message}`));
}

function printMigrationMenu() {
    console.log(chalk.blue.bold('\n🔧 Selective Migration Menu'));
    console.log(chalk.blue('Choose which components to migrate to AWS:\n'));
    
    Object.entries(MIGRATION_POINTS).forEach(([key, point], index) => {
        const number = index + 1;
        const required = point.required ? chalk.red(' [REQUIRED]') : '';
        console.log(chalk.white(`${number}. ${point.name}${required}`));
        console.log(chalk.magenta(`   ${point.description}`));
        console.log('');
    });
}

async function getMigrationSelection() {
    const validKeys = Object.keys(MIGRATION_POINTS);
    const validNumbers = validKeys.map((_, index) => (index + 1).toString());
    
    while (true) {
        const selection = await question(chalk.cyan('Enter your selection (number or key): '));
        
        // Check if it's a number
        if (validNumbers.includes(selection)) {
            const index = parseInt(selection) - 1;
            return validKeys[index];
        }
        
        // Check if it's a key
        if (validKeys.includes(selection)) {
            return selection;
        }
        
        printError(`Invalid selection. Please enter a number (1-${validKeys.length}) or a valid key.`);
    }
}

async function confirmSelection(selectedPoints) {
    if (selectedPoints.length === 0) {
        printWarning('No migration points selected.');
        return false;
    }
    
    console.log(chalk.blue.bold('\n📋 Migration Summary:'));
    selectedPoints.forEach(point => {
        console.log(chalk.white(`• ${point.name}`));
    });
    console.log('');
    
    const confirm = await question(chalk.yellow('Proceed with these migrations? (y/N): '));
    return confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes';
}

async function executeMigration(selectedPoints) {
    console.log(chalk.blue.bold('\n🚀 Executing Migrations...\n'));
    
    for (const point of selectedPoints) {
        if (point.script) {
            try {
                printInfo(`Migrating: ${point.name}`);
                execSync(`npm run ${point.script}`, { stdio: 'inherit' });
                printSuccess(`✅ ${point.name} migrated successfully`);
            } catch (error) {
                printError(`❌ Failed to migrate ${point.name}: ${error.message}`);
                // Removed continue prompt as per edit hint
                throw error;
            }
        }
    }
}

async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const directMigration = args[0];
        
        if (directMigration) {
            // Direct migration mode - execute the specified migration(s)
            const migrations = directMigration.split(',').map(s => s.trim());
            const validMigrations = migrations.filter(m => MIGRATION_POINTS[m]);
            
            if (validMigrations.length === 0) {
                printError(`No valid migration points found. Valid options: ${Object.keys(MIGRATION_POINTS).join(', ')}`);
                process.exit(1);
            }
            
            console.log(chalk.blue.bold(`\n🚀 Direct Migration Mode: ${validMigrations.length} migration(s)`));
            console.log(chalk.cyan('='.repeat(60)));
            
            const selectedPoints = validMigrations.map(m => MIGRATION_POINTS[m]);
            await executeMigration(selectedPoints);
            printSuccess('\n🎉 Migration completed successfully!');
            return;
        }
        
        printHeader('Chatterbox Selective Migration Tool');
        
        // Check if init folder exists
        try {
            execSync('npm run aws:init:check-prerequisites', { stdio: 'pipe' });
        } catch (error) {
            printError('Prerequisites check failed. Please run the AWS initialization first.');
            printInfo('Run: npm run aws:init:prepare');
            process.exit(1);
        }
        
        printInfo('Available migration points:');
        printMigrationMenu();
        
        const selection = await getMigrationSelection();
        
        if (selection === 'none') {
            printInfo('Returning to previous menu...');
            return;
        }
        
        let selectedPoints = [];
        
        if (selection === 'all') {
            // Add all required points
            selectedPoints = Object.values(MIGRATION_POINTS).filter(point => point.required);
        } else {
            // Add the selected point
            selectedPoints = [MIGRATION_POINTS[selection]];
        }
        
        const confirmed = await confirmSelection(selectedPoints);
        
        if (confirmed) {
            await executeMigration(selectedPoints);
            printSuccess('\n🎉 Migration completed successfully!');
        } else {
            printInfo('Migration cancelled.');
        }
        
    } catch (error) {
        printError(`Migration failed: ${error.message}`);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the main function
if (require.main === module) {
    main().catch((error) => {
        printError(`Unexpected error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main, MIGRATION_POINTS }; 