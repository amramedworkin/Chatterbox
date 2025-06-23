#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log(chalk.blue('🧠 Smart Migration to AWS Secrets Manager...\n'));

// Define the secrets to migrate
const secretsToMigrate = [
  {
    name: 'chatterbox/gmail-tokens',
    description: 'Gmail OAuth tokens for Chatterbox application',
    localPath: 'tokens/gmail_tokens.json',
    required: true,
    validate: (content) => {
      try {
        const tokens = JSON.parse(content);
        // Handle nested format with email addresses as keys
        if (typeof tokens === 'object' && tokens !== null) {
          const emailKeys = Object.keys(tokens);
          if (emailKeys.length > 0) {
            const firstEmail = emailKeys[0];
            const firstToken = tokens[firstEmail];
            return firstToken && firstToken.access_token && firstToken.refresh_token;
          }
        }
        // Also handle flat format for backward compatibility
        return tokens.access_token && tokens.refresh_token;
      } catch {
        return false;
      }
    }
  },
  {
    name: 'chatterbox/openai-api-key',
    description: 'OpenAI API key for Chatterbox application',
    localPath: '.env',
    required: true,
    extract: (content) => {
      const match = content.match(/OPENAI_API_KEY\s*=\s*['"]?([^'"\n]+)['"]?/);
      return match ? match[1] : null;
    },
    validate: (content) => {
      return content && content.startsWith('sk-') && content.length > 20;
    }
  },
  {
    name: 'chatterbox/google-credentials',
    description: 'Google service account credentials',
    localPath: 'tokens/google_credentials.json',
    required: false,
    validate: (content) => {
      try {
        const creds = JSON.parse(content);
        // Handle service account format
        if (creds.type === 'service_account' && creds.project_id) {
          return true;
        }
        // Handle web client format
        if (creds.web && creds.web.client_id && creds.web.project_id) {
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  }
];

async function checkSecretExists(secretName) {
  try {
    execSync(`aws secretsmanager describe-secret --secret-id "${secretName}" --profile cliadmin`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function getSecretValue(secretName) {
  try {
    const result = execSync(`aws secretsmanager get-secret-value --secret-id "${secretName}" --profile cliadmin`, { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
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
    execSync(`aws secretsmanager put-secret-value --secret-id "${secretName}" --secret-string '${secretValue}' --profile cliadmin`, { stdio: 'inherit' });
  } else if (exists && force) {
    console.log(chalk.yellow(`   Force updating existing secret: ${secretName}`));
    execSync(`aws secretsmanager put-secret-value --secret-id "${secretName}" --secret-string '${secretValue}' --profile cliadmin`, { stdio: 'inherit' });
  } else {
    console.log(chalk.yellow(`   Creating new secret: ${secretName}`));
    execSync(`aws secretsmanager create-secret --name "${secretName}" --secret-string '${secretValue}' --description "${description}" --profile cliadmin`, { stdio: 'inherit' });
  }
}

async function smartMigrateSecrets(options = {}) {
  const { force = false, dryRun = false, updateOnly = false } = options;
  
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  console.log(chalk.blue(`\n🔍 Analyzing secrets (${dryRun ? 'DRY RUN' : 'LIVE'})...`));

  for (const secret of secretsToMigrate) {
    console.log(chalk.blue(`\n📋 Processing: ${secret.name}`));
    
    const localFilePath = path.join(process.cwd(), secret.localPath);
    
    // Check if local file exists
    if (!fs.existsSync(localFilePath)) {
      if (secret.required) {
        console.log(chalk.red(`   ❌ Required file not found: ${secret.localPath}`));
        console.log(chalk.yellow(`   Please create this file before migrating secrets.`));
        errorCount++;
        continue;
      } else {
        console.log(chalk.yellow(`   ⚠️  Optional file not found: ${secret.localPath}`));
        console.log(chalk.gray(`   Skipping optional secret: ${secret.name}`));
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
          console.log(chalk.red(`   ❌ Could not extract secret from: ${secret.localPath}`));
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
      const exists = await checkSecretExists(secret.name);
      
      if (!exists) {
        if (updateOnly) {
          console.log(chalk.yellow(`   ⚠️  Secret does not exist: ${secret.name}`));
          console.log(chalk.gray(`   Skipping (update-only mode)`));
          skippedCount++;
          continue;
        }
        
        console.log(chalk.green(`   ➕ Secret missing in AWS, will create`));
        if (!dryRun) {
          await createOrUpdateSecret(secret.name, localSecretValue, secret.description);
          createdCount++;
        }
        continue;
      }

      // Secret exists, compare values
      const awsSecretValue = await getSecretValue(secret.name);
      const comparison = compareValues(localSecretValue, awsSecretValue);
      
      switch (comparison) {
        case 'same':
          console.log(chalk.green(`   ✅ Secret unchanged, skipping`));
          skippedCount++;
          break;
          
        case 'different':
          console.log(chalk.yellow(`   🔄 Secret changed, will update`));
          if (!dryRun) {
            await createOrUpdateSecret(secret.name, localSecretValue, secret.description, force);
            updatedCount++;
          }
          break;
          
        case 'missing':
          console.log(chalk.red(`   ❌ AWS secret is empty, will update`));
          if (!dryRun) {
            await createOrUpdateSecret(secret.name, localSecretValue, secret.description, force);
            updatedCount++;
          }
          break;
          
        case 'local_missing':
          console.log(chalk.red(`   ❌ Local file is empty, skipping`));
          skippedCount++;
          break;
      }

    } catch (error) {
      console.log(chalk.red(`   ❌ Error processing ${secret.name}: ${error.message}`));
      errorCount++;
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Smart Migration Summary:'));
  console.log(chalk.green(`   ➕ Created: ${createdCount}`));
  console.log(chalk.yellow(`   🔄 Updated: ${updatedCount}`));
  console.log(chalk.gray(`   ⏭️  Skipped: ${skippedCount}`));
  console.log(chalk.red(`   ❌ Errors: ${errorCount}`));

  if (dryRun) {
    console.log(chalk.blue('\n🔍 This was a dry run. No changes were made.'));
    console.log(chalk.blue('Run without --dry-run to apply changes.'));
  } else if (errorCount === 0) {
    console.log(chalk.green('\n🎉 Smart migration completed successfully!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray('• Test the secrets with: npm run aws:test:secrets'));
    console.log(chalk.gray('• Consider removing local token files for security'));
  } else {
    console.log(chalk.red('\n❌ Some secrets failed to migrate. Please check the errors above.'));
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force'),
  dryRun: args.includes('--dry-run'),
  updateOnly: args.includes('--update-only')
};

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(chalk.blue('Smart Migration to AWS Secrets Manager'));
  console.log(chalk.gray('\nUsage:'));
  console.log(chalk.gray('  npm run aws:smart-migrate [options]'));
  console.log(chalk.gray('  node scripts/aws/smart-migrate-secrets.js [options]'));
  console.log(chalk.gray('\nOptions:'));
  console.log(chalk.gray('  --dry-run     Show what would be done without making changes'));
  console.log(chalk.gray('  --force       Force update even if values are the same'));
  console.log(chalk.gray('  --update-only Only update existing secrets, don\'t create new ones'));
  console.log(chalk.gray('  --help        Show this help message'));
  console.log(chalk.gray('\nExamples:'));
  console.log(chalk.gray('  npm run aws:smart-migrate --dry-run'));
  console.log(chalk.gray('  npm run aws:smart-migrate --update-only'));
  console.log(chalk.gray('  npm run aws:smart-migrate --force'));
  process.exit(0);
}

// Run smart migration
smartMigrateSecrets(options).catch((error) => {
  console.error(chalk.red('❌ Smart migration failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
}); 