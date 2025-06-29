#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  credentials: new AWS.SharedIniFileCredentials({ profile: 'cliadmin' })
});

const secretsManager = new AWS.SecretsManager();

const secretsToMigrate = [
  {
    oldName: 'chatterbox/gmail-tokens',
    newName: 'development-chatterbox-gmail-tokens',
    description: 'Gmail OAuth tokens for Chatterbox application'
  },
  {
    oldName: 'chatterbox/openai-api-key',
    newName: 'development-chatterbox-openai-api-key',
    description: 'OpenAI API key for Chatterbox application'
  },
  {
    oldName: 'chatterbox/google-credentials',
    newName: 'development-chatterbox-google-credentials',
    description: 'Google OAuth credentials for Chatterbox application'
  }
];

async function migrateSecret(oldName, newName, description) {
  try {
    console.log(`🔍 Migrating ${oldName} to ${newName}...`);
    
    // Get the secret value from the old secret
    const oldSecret = await secretsManager.getSecretValue({ SecretId: oldName }).promise();
    const secretValue = oldSecret.SecretString;
    
    // Create the new secret
    await secretsManager.createSecret({
      Name: newName,
      Description: description,
      SecretString: secretValue,
      Tags: [
        { Key: 'Environment', Value: 'development' },
        { Key: 'Project', Value: 'Chatterbox' },
        { Key: 'ManagedBy', Value: 'Terraform' }
      ]
    }).promise();
    
    console.log(`   ✅ Created new secret: ${newName}`);
    
    // Delete the old secret
    await secretsManager.deleteSecret({ SecretId: oldName }).promise();
    console.log(`   ✅ Deleted old secret: ${oldName}`);
    
    return true;
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      console.log(`   ⚠️  Old secret ${oldName} not found, skipping...`);
      return true;
    }
    console.error(`   ❌ Error migrating ${oldName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔐 Migrating secrets to development environment naming...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const secret of secretsToMigrate) {
    const success = await migrateSecret(secret.oldName, secret.newName, secret.description);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Successfully migrated: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  if (errorCount === 0) {
    console.log('\n🎉 Secret migration to development environment completed successfully!');
  } else {
    console.log('\n⚠️  Some secrets failed to migrate. Please check the errors above.');
  }
}

main().catch(console.error);
