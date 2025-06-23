#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue('🔐 Migrating secrets to AWS Secrets Manager...\n'));

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

async function createOrUpdateSecret(secretName, secretValue, description) {
  const exists = await checkSecretExists(secretName);
  
  if (exists) {
    console.log(chalk.yellow(`   Updating existing secret: ${secretName}`));
    execSync(`aws secretsmanager update-secret --secret-id "${secretName}" --secret-string '${secretValue}' --description "${description}" --profile cliadmin`, { stdio: 'inherit' });
  } else {
    console.log(chalk.yellow(`   Creating new secret: ${secretName}`));
    execSync(`aws secretsmanager create-secret --name "${secretName}" --secret-string '${secretValue}' --description "${description}" --profile cliadmin`, { stdio: 'inherit' });
  }
}

async function migrateSecrets() {
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const secret of secretsToMigrate) {
    console.log(chalk.blue(`\n🔍 Processing: ${secret.name}`));
    
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
      let secretValue;
      if (secret.extract) {
        secretValue = secret.extract(fileContent);
        if (!secretValue) {
          console.log(chalk.red(`   ❌ Could not extract secret from: ${secret.localPath}`));
          errorCount++;
          continue;
        }
      } else {
        secretValue = fileContent;
      }

      // Validate secret value
      if (secret.validate && !secret.validate(secretValue)) {
        console.log(chalk.red(`   ❌ Invalid secret format in: ${secret.localPath}`));
        errorCount++;
        continue;
      }

      // Check if secret already exists in AWS
      const exists = await checkSecretExists(secret.name);
      if (exists) {
        console.log(chalk.yellow(`   ⚠️  Secret already exists: ${secret.name}`));
        
        // Ask user if they want to update
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise((resolve) => {
          rl.question(chalk.yellow('   Do you want to update the existing secret? (y/N): '), (ans) => {
            rl.close();
            resolve(ans.toLowerCase());
          });
        });

        if (answer !== 'y' && answer !== 'yes') {
          console.log(chalk.gray('   Skipping existing secret'));
          skippedCount++;
          continue;
        }
      }

      // Create or update secret in AWS
      await createOrUpdateSecret(secret.name, secretValue, secret.description);
      console.log(chalk.green(`   ✅ Successfully migrated: ${secret.name}`));
      migratedCount++;

    } catch (error) {
      console.log(chalk.red(`   ❌ Error migrating ${secret.name}: ${error.message}`));
      errorCount++;
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Migration Summary:'));
  console.log(chalk.green(`   ✅ Successfully migrated: ${migratedCount}`));
  console.log(chalk.yellow(`   ⚠️  Skipped: ${skippedCount}`));
  console.log(chalk.red(`   ❌ Errors: ${errorCount}`));

  if (errorCount === 0) {
    console.log(chalk.green('\n🎉 Secret migration completed successfully!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray('• Update your application to use AWS Secrets Manager'));
    console.log(chalk.gray('• Test the secrets with: npm run aws:test:secrets'));
    console.log(chalk.gray('• Consider removing local token files for security'));
  } else {
    console.log(chalk.red('\n❌ Some secrets failed to migrate. Please check the errors above.'));
    process.exit(1);
  }
}

// Run migration
migrateSecrets().catch((error) => {
  console.error(chalk.red('❌ Migration failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
}); 