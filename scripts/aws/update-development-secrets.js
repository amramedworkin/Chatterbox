#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue('🔄 Updating Development Secrets in AWS...\n'));

// Development secret names (matching what Lambda expects)
const DEVELOPMENT_SECRETS = {
    'development-chatterbox-gmail-tokens': {
        localPath: 'tokens/gmail_tokens.json',
        description: 'Gmail OAuth tokens for development environment',
    },
    'development-chatterbox-google-credentials': {
        localPath: 'tokens/google_credentials.json',
        description: 'Google OAuth credentials for development environment',
    },
};

async function updateSecret(secretName, secretConfig) {
    try {
        const localFilePath = path.join(process.cwd(), secretConfig.localPath);

        if (!fs.existsSync(localFilePath)) {
            console.log(chalk.red(`   ❌ Local file not found: ${secretConfig.localPath}`));
            return false;
        }

        console.log(chalk.yellow(`   📝 Updating ${secretName}...`));

        // Read the local file
        const secretValue = fs.readFileSync(localFilePath, 'utf8');

        // Update the secret in AWS
        execSync(
            `aws secretsmanager put-secret-value --secret-id "${secretName}" --secret-string '${secretValue}'`,
            {
                stdio: 'inherit',
            }
        );

        console.log(chalk.green(`   ✅ Successfully updated: ${secretName}`));
        return true;
    } catch (error) {
        console.log(chalk.red(`   ❌ Error updating ${secretName}: ${error.message}`));
        return false;
    }
}

async function main() {
    console.log(chalk.cyan('📋 Updating the following secrets:'));
    Object.keys(DEVELOPMENT_SECRETS).forEach((secretName) => {
        console.log(chalk.gray(`   • ${secretName}`));
    });
    console.log('');

    let successCount = 0;
    let errorCount = 0;

    for (const [secretName, secretConfig] of Object.entries(DEVELOPMENT_SECRETS)) {
        const success = await updateSecret(secretName, secretConfig);
        if (success) {
            successCount++;
        } else {
            errorCount++;
        }
    }

    console.log('\n📊 Update Summary:');
    console.log(chalk.green(`   ✅ Successfully updated: ${successCount}`));
    console.log(chalk.red(`   ❌ Errors: ${errorCount}`));

    if (errorCount === 0) {
        console.log(chalk.green('\n🎉 All development secrets updated successfully!'));
        console.log(chalk.cyan('\n💡 Next steps:'));
        console.log(chalk.gray('   1. Test the Lambda function: npm run aws:lambda:test'));
        console.log(chalk.gray('   2. If tokens are expired, reauthorize Gmail locally first'));
    } else {
        console.log(
            chalk.yellow('\n⚠️  Some secrets failed to update. Please check the errors above.')
        );
    }
}

main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
});
