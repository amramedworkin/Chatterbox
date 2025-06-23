#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const readline = require('readline');

console.log(chalk.blue('🔄 AWS Secrets Manager - Secret Rotation\n'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Available secrets for rotation
const rotatableSecrets = {
  'gmail-tokens': {
    name: 'chatterbox/gmail-tokens',
    description: 'Gmail OAuth tokens',
    rotationDays: 30,
    instructions: [
      '1. Go to Google Cloud Console',
      '2. Navigate to APIs & Services > Credentials',
      '3. Find your OAuth 2.0 Client ID',
      '4. Download new credentials or regenerate tokens',
      '5. Update the tokens/gmail_tokens.json file',
      '6. Run: npm run aws:update:secret gmail-tokens'
    ]
  },
  'openai-api-key': {
    name: 'chatterbox/openai-api-key',
    description: 'OpenAI API key',
    rotationDays: 90,
    instructions: [
      '1. Go to OpenAI Platform (https://platform.openai.com/api-keys)',
      '2. Create a new API key',
      '3. Update your .env file with the new key',
      '4. Run: npm run aws:update:secret openai-api-key',
      '5. Delete the old API key after confirming the new one works'
    ]
  },
  'google-credentials': {
    name: 'chatterbox/google-credentials',
    description: 'Google service account credentials',
    rotationDays: 365,
    instructions: [
      '1. Go to Google Cloud Console',
      '2. Navigate to IAM & Admin > Service Accounts',
      '3. Find your service account',
      '4. Create a new key (JSON format)',
      '5. Update the tokens/google_credentials.json file',
      '6. Run: npm run aws:update:secret google-credentials',
      '7. Delete the old key after confirming the new one works'
    ]
  }
};

async function getSecretMetadata(secretName) {
  try {
    const metadata = execSync(`aws secretsmanager describe-secret --secret-id "${secretName}" --profile cliadmin`, { encoding: 'utf8' });
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

async function showRotationStatus() {
  console.log(chalk.blue('📊 Secret Rotation Status:\n'));

  for (const [key, secret] of Object.entries(rotatableSecrets)) {
    console.log(chalk.yellow(`${secret.description} (${key}):`));
    
    const metadata = await getSecretMetadata(secret.name);
    if (metadata) {
      const lastModified = new Date(metadata.LastModifiedDate);
      const daysSinceModified = Math.floor((Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(chalk.gray(`   Last Modified: ${lastModified.toLocaleDateString()}`));
      console.log(chalk.gray(`   Days Since Modified: ${daysSinceModified}`));
      
      if (daysSinceModified > secret.rotationDays) {
        console.log(chalk.red(`   ⚠️  OVERDUE for rotation (${secret.rotationDays} days recommended)`));
      } else if (daysSinceModified > secret.rotationDays * 0.8) {
        console.log(chalk.yellow(`   ⚠️  Due for rotation soon (${secret.rotationDays - daysSinceModified} days remaining)`));
      } else {
        console.log(chalk.green(`   ✅ Up to date (${secret.rotationDays - daysSinceModified} days remaining)`));
      }
    } else {
      console.log(chalk.red(`   ❌ Secret not found in AWS`));
    }
    console.log('');
  }
}

async function rotateSecret(secretType) {
  if (!rotatableSecrets[secretType]) {
    console.log(chalk.red(`❌ Unknown secret type: ${secretType}`));
    console.log(chalk.blue('Available types:'));
    Object.keys(rotatableSecrets).forEach(key => {
      console.log(chalk.gray(`  ${key} - ${rotatableSecrets[key].description}`));
    });
    return;
  }

  const secret = rotatableSecrets[secretType];
  console.log(chalk.blue(`🔄 Rotating: ${secret.description}\n`));

  // Show current status
  const metadata = await getSecretMetadata(secret.name);
  if (metadata) {
    const lastModified = new Date(metadata.LastModifiedDate);
    console.log(chalk.gray(`Current secret was last modified: ${lastModified.toLocaleDateString()}`));
  }

  // Show rotation instructions
  console.log(chalk.yellow('\n📋 Rotation Instructions:'));
  secret.instructions.forEach(instruction => {
    console.log(chalk.gray(`   ${instruction}`));
  });

  // Ask for confirmation
  const answer = await new Promise((resolve) => {
    rl.question(chalk.yellow('\nHave you completed the rotation steps above? (y/N): '), (ans) => {
      resolve(ans.toLowerCase());
    });
  });

  if (answer !== 'y' && answer !== 'yes') {
    console.log(chalk.yellow('❌ Rotation cancelled'));
    return;
  }

  // Update the secret
  console.log(chalk.yellow('\n🔄 Updating secret in AWS...'));
  try {
    execSync(`npm run aws:update:secret ${secretType}`, { stdio: 'inherit' });
    console.log(chalk.green(`✅ Successfully rotated: ${secret.description}`));
  } catch (error) {
    console.log(chalk.red(`❌ Failed to update secret: ${error.message}`));
  }
}

async function showMenu() {
  console.log(chalk.blue('🔄 Secret Rotation Menu:\n'));
  console.log(chalk.gray('1. Show rotation status'));
  console.log(chalk.gray('2. Rotate Gmail tokens'));
  console.log(chalk.gray('3. Rotate OpenAI API key'));
  console.log(chalk.gray('4. Rotate Google credentials'));
  console.log(chalk.gray('5. Exit'));
  console.log('');

  const choice = await new Promise((resolve) => {
    rl.question(chalk.yellow('Select an option (1-5): '), (ans) => {
      resolve(ans.trim());
    });
  });

  switch (choice) {
    case '1':
      await showRotationStatus();
      break;
    case '2':
      await rotateSecret('gmail-tokens');
      break;
    case '3':
      await rotateSecret('openai-api-key');
      break;
    case '4':
      await rotateSecret('google-credentials');
      break;
    case '5':
      console.log(chalk.blue('👋 Goodbye!'));
      rl.close();
      return;
    default:
      console.log(chalk.red('❌ Invalid option'));
  }

  console.log('');
  await showMenu();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    await showMenu();
  } else if (args[0] === 'status') {
    // Show status only
    await showRotationStatus();
    rl.close();
  } else if (args[0] === 'rotate' && args[1]) {
    // Rotate specific secret
    await rotateSecret(args[1]);
    rl.close();
  } else {
    console.log(chalk.blue('Usage:'));
    console.log(chalk.gray('  npm run aws:rotate:secrets                    # Interactive menu'));
    console.log(chalk.gray('  npm run aws:rotate:secrets status             # Show status'));
    console.log(chalk.gray('  npm run aws:rotate:secrets rotate <type>      # Rotate specific secret'));
    console.log('');
    console.log(chalk.blue('Available secret types:'));
    Object.keys(rotatableSecrets).forEach(key => {
      console.log(chalk.gray(`  ${key} - ${rotatableSecrets[key].description}`));
    });
    rl.close();
  }
}

main().catch((error) => {
  console.error(chalk.red('❌ Rotation failed:'));
  console.error(chalk.red(error.message));
  rl.close();
  process.exit(1);
}); 