#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log(chalk.blue('🔐 AWS Secrets Manager - Smart Update Secret\n'));

// Available secrets
const availableSecrets = {
  'gmail-tokens': {
    name: 'chatterbox/gmail-tokens',
    description: 'Gmail OAuth tokens for Chatterbox application',
    localPath: 'tokens/gmail_tokens.json',
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
  'openai-api-key': {
    name: 'chatterbox/openai-api-key',
    description: 'OpenAI API key for Chatterbox application',
    localPath: '.env',
    extract: (content) => {
      const match = content.match(/OPENAI_API_KEY\s*=\s*['"]?([^'"\n]+)['"]?/);
      return match ? match[1] : null;
    },
    validate: (content) => {
      return content && content.startsWith('sk-') && content.length > 20;
    }
  },
  'google-credentials': {
    name: 'chatterbox/google-credentials',
    description: 'Google service account credentials',
    localPath: 'tokens/google_credentials.json',
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
};

function showUsage() {
  console.log(chalk.blue('Usage:'));
  console.log(chalk.gray('  node scripts/aws/update-secret.js <secret-type> [options]'));
  console.log(chalk.gray('  npm run aws:update:secret <secret-type> [options]'));
  console.log('');
  console.log(chalk.blue('Available secret types:'));
  Object.keys(availableSecrets).forEach(key => {
    const secret = availableSecrets[key];
    console.log(chalk.gray(`  ${key} - ${secret.description}`));
  });
  console.log('');
  console.log(chalk.blue('Options:'));
  console.log(chalk.gray('  --file <path>     Use specific file path instead of default'));
  console.log(chalk.gray('  --value <value>   Use direct value instead of file'));
  console.log(chalk.gray('  --force          Force update even if values are the same'));
  console.log(chalk.gray('  --dry-run        Show what would be done without making changes'));
  console.log(chalk.gray('  --compare        Show comparison between local and AWS values'));
  console.log(chalk.gray('  --help           Show this help message'));
  console.log('');
  console.log(chalk.blue('Examples:'));
  console.log(chalk.gray('  npm run aws:update:secret gmail-tokens'));
  console.log(chalk.gray('  npm run aws:update:secret openai-api-key --file .env'));
  console.log(chalk.gray('  npm run aws:update:secret openai-api-key --value "sk-your-api-key"'));
  console.log(chalk.gray('  npm run aws:update:secret gmail-tokens --compare'));
  console.log(chalk.gray('  npm run aws:update:secret gmail-tokens --dry-run'));
}

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

function showComparison(localValue, awsValue, secretName) {
  console.log(chalk.blue(`\n📊 Comparison for ${secretName}:`));
  
  if (!awsValue) {
    console.log(chalk.yellow('   AWS: Not found or empty'));
  } else {
    console.log(chalk.gray('   AWS: [Value exists]'));
  }
  
  if (!localValue) {
    console.log(chalk.yellow('   Local: Not found or empty'));
  } else {
    console.log(chalk.gray('   Local: [Value exists]'));
  }
  
  const comparison = compareValues(localValue, awsValue);
  switch (comparison) {
    case 'same':
      console.log(chalk.green('   Status: ✅ Values are identical'));
      break;
    case 'different':
      console.log(chalk.yellow('   Status: 🔄 Values are different'));
      break;
    case 'missing':
      console.log(chalk.red('   Status: ❌ AWS value is missing'));
      break;
    case 'local_missing':
      console.log(chalk.red('   Status: ❌ Local value is missing'));
      break;
  }
}

async function updateSecret(secretType, options = {}) {
  if (!availableSecrets[secretType]) {
    console.log(chalk.red(`❌ Unknown secret type: ${secretType}`));
    showUsage();
    process.exit(1);
  }

  const secret = availableSecrets[secretType];
  const { force = false, dryRun = false, compare = false } = options;
  
  console.log(chalk.blue(`🔍 Processing secret: ${secret.name}`));

  let localSecretValue;

  // Get local secret value from different sources
  if (options.value) {
    // Direct value provided
    localSecretValue = options.value;
    console.log(chalk.yellow('   Using provided value'));
  } else if (options.file) {
    // File path provided
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`❌ File not found: ${filePath}`));
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    if (secret.extract) {
      localSecretValue = secret.extract(fileContent);
      if (!localSecretValue) {
        console.log(chalk.red(`❌ Could not extract secret from: ${filePath}`));
        process.exit(1);
      }
    } else {
      localSecretValue = fileContent;
    }
    console.log(chalk.yellow(`   Using file: ${filePath}`));
  } else {
    // Use default local path
    const localFilePath = path.join(process.cwd(), secret.localPath);
    if (!fs.existsSync(localFilePath)) {
      console.log(chalk.red(`❌ Default file not found: ${secret.localPath}`));
      console.log(chalk.yellow('   Use --file <path> or --value <value> to specify source'));
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(localFilePath, 'utf8');
    if (secret.extract) {
      localSecretValue = secret.extract(fileContent);
      if (!localSecretValue) {
        console.log(chalk.red(`❌ Could not extract secret from: ${secret.localPath}`));
        process.exit(1);
      }
    } else {
      localSecretValue = fileContent;
    }
    console.log(chalk.yellow(`   Using default file: ${secret.localPath}`));
  }

  // Validate secret value
  if (secret.validate && !secret.validate(localSecretValue)) {
    console.log(chalk.red(`❌ Invalid secret format`));
    process.exit(1);
  }

  // Check if secret exists in AWS
  const exists = await checkSecretExists(secret.name);
  
  if (!exists) {
    console.log(chalk.yellow('   Secret does not exist in AWS, will create'));
    if (!dryRun) {
      try {
        execSync(`aws secretsmanager create-secret --name "${secret.name}" --secret-string '${localSecretValue}' --description "${secret.description}" --profile cliadmin`, { stdio: 'inherit' });
        console.log(chalk.green(`✅ Successfully created: ${secret.name}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to create secret: ${error.message}`));
        process.exit(1);
      }
    } else {
      console.log(chalk.blue('   [DRY RUN] Would create new secret'));
    }
    return;
  }

  // Get current AWS value for comparison
  const awsSecretValue = await getSecretValue(secret.name);
  const comparison = compareValues(localSecretValue, awsSecretValue);
  
  // Show comparison if requested
  if (compare) {
    showComparison(localSecretValue, awsSecretValue, secret.name);
  }
  
  // Handle different comparison results
  switch (comparison) {
    case 'same':
      if (force) {
        console.log(chalk.yellow('   Values are identical, but forcing update'));
        if (!dryRun) {
          try {
            execSync(`aws secretsmanager put-secret-value --secret-id "${secret.name}" --secret-string '${localSecretValue}' --profile cliadmin`, { stdio: 'inherit' });
            console.log(chalk.green(`✅ Successfully force-updated: ${secret.name}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to update secret: ${error.message}`));
            process.exit(1);
          }
        } else {
          console.log(chalk.blue('   [DRY RUN] Would force-update secret'));
        }
      } else {
        console.log(chalk.green('   ✅ Values are identical, no update needed'));
      }
      break;
      
    case 'different':
      console.log(chalk.yellow('   Values are different, will update'));
      if (!dryRun) {
        try {
          execSync(`aws secretsmanager put-secret-value --secret-id "${secret.name}" --secret-string '${localSecretValue}' --profile cliadmin`, { stdio: 'inherit' });
          console.log(chalk.green(`✅ Successfully updated: ${secret.name}`));
        } catch (error) {
          console.log(chalk.red(`❌ Failed to update secret: ${error.message}`));
          process.exit(1);
        }
      } else {
        console.log(chalk.blue('   [DRY RUN] Would update secret'));
      }
      break;
      
    case 'missing':
      console.log(chalk.red('   AWS secret is empty, will update'));
      if (!dryRun) {
        try {
          execSync(`aws secretsmanager put-secret-value --secret-id "${secret.name}" --secret-string '${localSecretValue}' --profile cliadmin`, { stdio: 'inherit' });
          console.log(chalk.green(`✅ Successfully updated: ${secret.name}`));
        } catch (error) {
          console.log(chalk.red(`❌ Failed to update secret: ${error.message}`));
          process.exit(1);
        }
      } else {
        console.log(chalk.blue('   [DRY RUN] Would update empty secret'));
      }
      break;
      
    case 'local_missing':
      console.log(chalk.red('   Local value is empty, cannot update'));
      process.exit(1);
      break;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const secretType = args[0];

if (!secretType || secretType === '--help' || secretType === '-h') {
  showUsage();
  process.exit(0);
}

const options = {};
for (let i = 1; i < args.length; i += 2) {
  if (args[i] === '--file' && args[i + 1]) {
    options.file = args[i + 1];
  } else if (args[i] === '--value' && args[i + 1]) {
    options.value = args[i + 1];
  }
}

// Parse boolean flags
options.force = args.includes('--force');
options.dryRun = args.includes('--dry-run');
options.compare = args.includes('--compare');

// Update the secret
updateSecret(secretType, options).catch((error) => {
  console.error(chalk.red('❌ Update failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
}); 