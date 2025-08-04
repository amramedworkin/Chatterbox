#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Import the authorizeAllGmailUsers function
const { authorizeAllGmailUsers } = require('../dist/src/mail/authorizeAll');

console.log(chalk.blue('🔐 Gmail Authentication & AWS Token Migration\n'));
console.log(chalk.cyan('='.repeat(60)));

/**
 * Checks if a secret exists in AWS Secrets Manager
 */
async function checkSecretExists(secretName) {
    try {
        execSync(
            `aws secretsmanager describe-secret --secret-id "${secretName}" --profile cliadmin`,
            { stdio: 'pipe' }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Creates or updates a secret in AWS Secrets Manager
 */
async function createOrUpdateSecret(secretName, secretValue, description) {
    const exists = await checkSecretExists(secretName);

    if (exists) {
        console.log(chalk.yellow(`   Updating existing secret: ${secretName}`));
        execSync(
            `aws secretsmanager update-secret --secret-id "${secretName}" --secret-string '${secretValue}' --description "${description}" --profile cliadmin`,
            { stdio: 'inherit' }
        );
    } else {
        console.log(chalk.yellow(`   Creating new secret: ${secretName}`));
        execSync(
            `aws secretsmanager create-secret --name "${secretName}" --secret-string '${secretValue}' --description "${description}" --profile cliadmin`,
            { stdio: 'inherit' }
        );
    }
}

/**
 * Migrates Gmail tokens to AWS Secrets Manager
 */
async function migrateGmailTokensToAWS() {
    console.log(chalk.blue('\n📤 Migrating Gmail tokens to AWS Secrets Manager...'));
    
    const tokenPath = 'tokens/gmail_tokens.json';
    
    if (!fs.existsSync(tokenPath)) {
        console.log(chalk.red(`   ❌ Token file not found: ${tokenPath}`));
        return false;
    }
    
    try {
        const tokenContent = fs.readFileSync(tokenPath, 'utf8');
        const tokens = JSON.parse(tokenContent);
        
        // Validate tokens structure
        if (typeof tokens !== 'object' || tokens === null) {
            console.log(chalk.red('   ❌ Invalid token format'));
            return false;
        }
        
        const emailKeys = Object.keys(tokens);
        if (emailKeys.length === 0) {
            console.log(chalk.red('   ❌ No email tokens found'));
            return false;
        }
        
        console.log(chalk.green(`   ✅ Found ${emailKeys.length} email token(s)`));
        
        // Migrate to AWS
        await createOrUpdateSecret(
            'chatterbox/gmail-tokens',
            tokenContent,
            'Gmail OAuth tokens for Chatterbox application'
        );
        
        console.log(chalk.green('   ✅ Gmail tokens migrated successfully'));
        return true;
        
    } catch (error) {
        console.log(chalk.red(`   ❌ Failed to migrate tokens: ${error.message}`));
        return false;
    }
}

/**
 * Main function that orchestrates the authentication and migration process
 */
async function main() {
    const args = process.argv.slice(2);
    const forceReauthorize = args.includes('--force') || args.includes('-f');
    const skipMigration = args.includes('--no-migrate') || args.includes('--skip-migration');
    
    console.log(chalk.blue(`Force re-authorization: ${forceReauthorize ? 'Yes' : 'No'}`));
    console.log(chalk.blue(`Skip AWS migration: ${skipMigration ? 'Yes' : 'No'}`));
    console.log('');
    
    try {
        // Step 1: Authenticate all Gmail users
        console.log(chalk.blue('🔑 Step 1: Authenticating Gmail users...'));
        console.log(chalk.cyan('-'.repeat(40)));
        
        const authorizedClients = await authorizeAllGmailUsers(forceReauthorize);
        
        if (authorizedClients.size === 0) {
            console.log(chalk.yellow('   ⚠️  No Gmail users were authorized'));
            return;
        }
        
        console.log(chalk.green(`   ✅ Successfully authorized ${authorizedClients.size} Gmail user(s)`));
        
        // Step 2: Migrate tokens to AWS (unless skipped)
        if (!skipMigration) {
            console.log(chalk.blue('\n📤 Step 2: Migrating tokens to AWS...'));
            console.log(chalk.cyan('-'.repeat(40)));
            
            const migrationSuccess = await migrateGmailTokensToAWS();
            
            if (migrationSuccess) {
                console.log(chalk.green('\n🎉 Authentication and migration completed successfully!'));
                console.log(chalk.cyan('='.repeat(60)));
                console.log(chalk.blue('📋 Summary:'));
                console.log(chalk.white(`   • Authenticated ${authorizedClients.size} Gmail user(s)`));
                console.log(chalk.white('   • Tokens migrated to AWS Secrets Manager'));
                console.log(chalk.white('   • Ready for AWS Lambda functions'));
            } else {
                console.log(chalk.red('\n❌ Migration failed, but authentication was successful'));
                console.log(chalk.yellow('   You can run the migration separately later'));
            }
        } else {
            console.log(chalk.green('\n🎉 Authentication completed successfully!'));
            console.log(chalk.cyan('='.repeat(60)));
            console.log(chalk.blue('📋 Summary:'));
            console.log(chalk.white(`   • Authenticated ${authorizedClients.size} Gmail user(s)`));
            console.log(chalk.white('   • AWS migration skipped'));
            console.log(chalk.yellow('   • Run migration separately when ready'));
        }
        
    } catch (error) {
        console.log(chalk.red('\n❌ Authentication and migration failed'));
        console.log(chalk.red(`   Error: ${error.message}`));
        process.exit(1);
    }
}

// Run the main function
if (require.main === module) {
    main().catch((error) => {
        console.error(chalk.red(`\n❌ Unexpected error: ${error.message}`));
        process.exit(1);
    });
}

module.exports = { main, migrateGmailTokensToAWS }; 