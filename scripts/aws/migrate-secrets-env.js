#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log(chalk.blue('🔐 Environment-Specific Secret Migration\n'));

// Environment configurations
const ENVIRONMENTS = {
    development: {
        name: 'Development',
        secretsPrefix: 'chatterbox-dev',
        description: 'Development environment secrets',
    },
    staging: {
        name: 'Staging',
        secretsPrefix: 'chatterbox-staging',
        description: 'Staging environment secrets',
    },
    production: {
        name: 'Production',
        secretsPrefix: 'chatterbox-prod',
        description: 'Production environment secrets',
    },
};

// Secret definitions
const SECRETS_TO_MIGRATE = [
    {
        key: 'gmail-tokens',
        description: 'Gmail OAuth tokens',
        localPath: 'tokens/gmail_tokens.json',
        required: true,
        validate: (content) => {
            try {
                const tokens = JSON.parse(content);
                if (typeof tokens === 'object' && tokens !== null) {
                    const emailKeys = Object.keys(tokens);
                    if (emailKeys.length > 0) {
                        const firstEmail = emailKeys[0];
                        const firstToken = tokens[firstEmail];
                        return firstToken && firstToken.access_token && firstToken.refresh_token;
                    }
                }
                return tokens.access_token && tokens.refresh_token;
            } catch {
                return false;
            }
        },
    },
    {
        key: 'openai-api-key',
        description: 'OpenAI API key',
        localPath: '.env',
        required: true,
        extract: (content) => {
            const match = content.match(/OPENAI_API_KEY\s*=\s*['"]?([^'"\n]+)['"]?/);
            return match ? match[1] : null;
        },
        validate: (content) => {
            return content && content.startsWith('sk-') && content.length > 20;
        },
    },
    {
        key: 'google-credentials',
        description: 'Google service account credentials',
        localPath: 'tokens/google_credentials.json',
        required: false,
        validate: (content) => {
            try {
                const creds = JSON.parse(content);
                if (creds.type === 'service_account' && creds.project_id) {
                    return true;
                }
                if (creds.web && creds.web.client_id && creds.web.project_id) {
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        },
    },
];

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

async function getSecretValue(secretName) {
    try {
        const result = execSync(
            `aws secretsmanager get-secret-value --secret-id "${secretName}" --profile cliadmin`,
            {
                stdio: 'pipe',
                encoding: 'utf8',
            }
        );
        const data = JSON.parse(result);
        return data.SecretString;
    } catch {
        return null;
    }
}

function calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function compareValues(localValue, awsValue) {
    if (!awsValue) return 'missing';
    if (!localValue) return 'local_missing';

    const localHash = calculateHash(localValue);
    const awsHash = calculateHash(awsValue);

    return localHash === awsHash ? 'same' : 'different';
}

async function createOrUpdateSecret(secretName, secretValue, description, force = false) {
    const exists = await checkSecretExists(secretName);

    if (exists && !force) {
        console.log(chalk.yellow(`   Updating existing secret: ${secretName}`));
        execSync(
            `aws secretsmanager put-secret-value --secret-id "${secretName}" --secret-string '${secretValue}' --profile cliadmin`,
            { stdio: 'inherit' }
        );
    } else if (exists && force) {
        console.log(chalk.yellow(`   Force updating existing secret: ${secretName}`));
        execSync(
            `aws secretsmanager put-secret-value --secret-id "${secretName}" --secret-string '${secretValue}' --profile cliadmin`,
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

async function migrateSecretsForEnvironment(environment, options = {}) {
    const { force = false, dryRun = false, updateOnly = false } = options;
    const env = ENVIRONMENTS[environment];

    if (!env) {
        console.log(chalk.red(`❌ Unknown environment: ${environment}`));
        return false;
    }

    console.log(chalk.blue(`\n🔐 Migrating secrets for ${env.name} environment...`));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const secret of SECRETS_TO_MIGRATE) {
        const secretName = `${env.secretsPrefix}/${secret.key}`;
        console.log(chalk.blue(`\n📋 Processing: ${secretName}`));

        const localFilePath = path.join(process.cwd(), secret.localPath);

        // Check if local file exists
        if (!fs.existsSync(localFilePath)) {
            if (secret.required) {
                console.log(chalk.red(`   ❌ Required file not found: ${secret.localPath}`));
                errorCount++;
                continue;
            } else {
                console.log(chalk.yellow(`   ⚠️  Optional file not found: ${secret.localPath}`));
                console.log(chalk.gray(`   Skipping optional secret: ${secretName}`));
                skippedCount++;
                continue;
            }
        }

        try {
            // Read local file content
            const fileContent = fs.readFileSync(localFilePath, 'utf8');

            // Extract secret value
            let localSecretValue;
            if (secret.extract) {
                localSecretValue = secret.extract(fileContent);
                if (!localSecretValue) {
                    console.log(
                        chalk.red(`   ❌ Could not extract secret from: ${secret.localPath}`)
                    );
                    errorCount++;
                    continue;
                }
            } else {
                localSecretValue = fileContent;
            }

            // Validate secret value
            if (secret.validate && !secret.validate(localSecretValue)) {
                console.log(chalk.red(`   ❌ Invalid secret format in: ${secret.localPath}`));
                errorCount++;
                continue;
            }

            // Check if secret exists in AWS
            const exists = await checkSecretExists(secretName);

            if (!exists) {
                if (updateOnly) {
                    console.log(chalk.yellow(`   ⚠️  Secret does not exist: ${secretName}`));
                    console.log(chalk.gray(`   Skipping (update-only mode)`));
                    skippedCount++;
                    continue;
                }

                console.log(chalk.green(`   ➕ Secret missing in AWS, will create`));
                if (!dryRun) {
                    await createOrUpdateSecret(
                        secretName,
                        localSecretValue,
                        `${secret.description} for ${env.name} environment`
                    );
                    createdCount++;
                }
                continue;
            }

            // Secret exists, compare values
            const awsSecretValue = await getSecretValue(secretName);
            const comparison = compareValues(localSecretValue, awsSecretValue);

            switch (comparison) {
                case 'same':
                    console.log(chalk.green(`   ✅ Secret unchanged, skipping`));
                    skippedCount++;
                    break;

                case 'different':
                    console.log(chalk.yellow(`   🔄 Secret changed, will update`));
                    if (!dryRun) {
                        await createOrUpdateSecret(
                            secretName,
                            localSecretValue,
                            `${secret.description} for ${env.name} environment`,
                            force
                        );
                        updatedCount++;
                    }
                    break;

                case 'missing':
                    console.log(chalk.red(`   ❌ AWS secret is empty, will update`));
                    if (!dryRun) {
                        await createOrUpdateSecret(
                            secretName,
                            localSecretValue,
                            `${secret.description} for ${env.name} environment`,
                            force
                        );
                        updatedCount++;
                    }
                    break;

                case 'local_missing':
                    console.log(chalk.red(`   ❌ Local file is empty, skipping`));
                    skippedCount++;
                    break;
            }
        } catch (error) {
            console.log(chalk.red(`   ❌ Error processing ${secretName}: ${error.message}`));
            errorCount++;
        }
    }

    // Summary
    console.log(chalk.blue(`\n📊 Migration Summary for ${env.name}:`));
    console.log(chalk.green(`   ➕ Created: ${createdCount}`));
    console.log(chalk.yellow(`   🔄 Updated: ${updatedCount}`));
    console.log(chalk.gray(`   ⏭️  Skipped: ${skippedCount}`));
    console.log(chalk.red(`   ❌ Errors: ${errorCount}`));

    return errorCount === 0;
}

function showUsage() {
    console.log(chalk.blue('Environment-Specific Secret Migration'));
    console.log(chalk.gray('\nUsage:'));
    console.log(chalk.gray('  npm run aws:migrate:secrets:env <environment> [options]'));
    console.log(chalk.gray('  node scripts/aws/migrate-secrets-env.js <environment> [options]'));
    console.log('');
    console.log(chalk.blue('Available environments:'));
    Object.entries(ENVIRONMENTS).forEach(([key, env]) => {
        console.log(chalk.gray(`  ${key} - ${env.name}: ${env.description}`));
    });
    console.log('');
    console.log(chalk.blue('Options:'));
    console.log(chalk.gray('  --dry-run     Show what would be done without making changes'));
    console.log(chalk.gray('  --force       Force update even if values are the same'));
    console.log(chalk.gray("  --update-only Only update existing secrets, don't create new ones"));
    console.log(chalk.gray('  --help        Show this help message'));
    console.log('');
    console.log(chalk.blue('Examples:'));
    console.log(chalk.gray('  npm run aws:migrate:secrets:env development --dry-run'));
    console.log(chalk.gray('  npm run aws:migrate:secrets:env staging --update-only'));
    console.log(chalk.gray('  npm run aws:migrate:secrets:env production --force'));
}

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args[0];

// Parse options
const options = {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
    updateOnly: args.includes('--update-only'),
};

// Show help if requested
if (args.includes('--help') || args.includes('-h') || !environment) {
    showUsage();
    process.exit(0);
}

// Validate environment
if (!ENVIRONMENTS[environment]) {
    console.log(chalk.red(`❌ Unknown environment: ${environment}`));
    showUsage();
    process.exit(1);
}

// Run migration
migrateSecretsForEnvironment(environment, options)
    .then((success) => {
        if (success) {
            console.log(
                chalk.green(`\n🎉 Secret migration for ${environment} completed successfully!`)
            );
        } else {
            console.log(chalk.red(`\n❌ Some secrets failed to migrate for ${environment}.`));
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error(chalk.red('❌ Migration failed:'));
        console.error(chalk.red(error.message));
        process.exit(1);
    });
