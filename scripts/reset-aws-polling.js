#!/usr/bin/env node

/**
 * Reset AWS Polling State Script
 * 
 * This script resets the AWS polling state back to its initial (never polled) state
 * by clearing all Parameter Store parameters related to polling.
 */

const { SSMClient, DeleteParameterCommand, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// AWS Clients
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const PARAMETER_STORE_PREFIX = process.env.PARAMETER_STORE_PREFIX || '/chatterbox';
const GMAIL_TOKENS_SECRET_NAME = process.env.GMAIL_TOKENS_SECRET_NAME || 'development-chatterbox-gmail-tokens';

/**
 * Gets all Gmail users from the tokens secret
 */
async function getGmailUsers() {
    try {
        const command = new GetSecretValueCommand({ SecretId: GMAIL_TOKENS_SECRET_NAME });
        const response = await secretsClient.send(command);
        const tokens = JSON.parse(response.SecretString || '{}');
        return Object.keys(tokens);
    } catch (error) {
        console.error('Error getting Gmail users from secrets:', error);
        return [];
    }
}

/**
 * Deletes a parameter from Parameter Store
 */
async function deleteParameter(parameterName) {
    try {
        const command = new DeleteParameterCommand({ Name: parameterName });
        await ssmClient.send(command);
        console.log(`✅ Deleted parameter: ${parameterName}`);
        return true;
    } catch (error) {
        if (error.name === 'ParameterNotFound') {
            console.log(`ℹ️  Parameter not found (already deleted): ${parameterName}`);
            return true;
        }
        console.error(`❌ Error deleting parameter ${parameterName}:`, error.message);
        return false;
    }
}

/**
 * Gets all parameters under a specific path
 */
async function getParametersByPath(path) {
    try {
        const command = new GetParametersByPathCommand({ 
            Path: path,
            Recursive: true,
            WithDecryption: false
        });
        const response = await ssmClient.send(command);
        return response.Parameters || [];
    } catch (error) {
        console.error(`Error getting parameters for path ${path}:`, error.message);
        return [];
    }
}

/**
 * Resets polling state for a specific Gmail user
 */
async function resetUserPollingState(userEmail) {
    console.log(`\n🔄 Resetting polling state for user: ${userEmail}`);
    
    const userPrefix = `${PARAMETER_STORE_PREFIX}/polling/${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Only delete polling counters and history ID, not tokens or other state
    const parametersToDelete = [
        `${userPrefix}/last_history_id`,
        `${userPrefix}/total_poll_cycles`
    ];
    
    let successCount = 0;
    let totalCount = parametersToDelete.length;
    
    for (const parameterName of parametersToDelete) {
        const success = await deleteParameter(parameterName);
        if (success) successCount++;
    }
    
    console.log(`📊 User ${userEmail}: ${successCount}/${totalCount} parameters reset`);
    return successCount === totalCount;
}

/**
 * Main function to reset all polling state
 */
async function resetAllPollingState() {
    console.log('🚀 Starting AWS Polling State Reset...\n');
    
    // Get all Gmail users
    const gmailUsers = await getGmailUsers();
    
    if (gmailUsers.length === 0) {
        console.log('⚠️  No Gmail users found in secrets. Checking for existing polling parameters...');
        
        // Check if there are any existing polling parameters
        const existingParameters = await getParametersByPath(`${PARAMETER_STORE_PREFIX}/polling`);
        
        if (existingParameters.length === 0) {
            console.log('✅ No polling parameters found. State is already reset.');
            return;
        }
        
        console.log(`Found ${existingParameters.length} existing polling parameters. Attempting to delete them...`);
        
        let successCount = 0;
        for (const param of existingParameters) {
            const success = await deleteParameter(param.Name);
            if (success) successCount++;
        }
        
        console.log(`\n📊 Reset complete: ${successCount}/${existingParameters.length} parameters deleted`);
        return;
    }
    
    console.log(`Found ${gmailUsers.length} Gmail users: ${gmailUsers.join(', ')}`);
    
    // Reset polling state for each user
    let allUsersSuccess = true;
    for (const userEmail of gmailUsers) {
        const success = await resetUserPollingState(userEmail);
        if (!success) allUsersSuccess = false;
    }
    
    console.log('\n🎉 AWS Polling State Reset Complete!');
    console.log('\n📝 Summary:');
    console.log(`   • Processed ${gmailUsers.length} Gmail users`);
    console.log(`   • Only polling counters and last history ID have been reset`);
    console.log(`   • Next Lambda poll will start fresh with no history ID`);
    
    if (!allUsersSuccess) {
        console.log('\n⚠️  Some operations failed. Check the logs above for details.');
        process.exit(1);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || command === '-h') {
    console.log(`
AWS Polling State Reset Script

Usage:
  node scripts/reset-aws-polling.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be deleted without actually deleting
  --user <email> Reset state for a specific user only

Examples:
  node scripts/reset-aws-polling.js                    # Reset all users
  node scripts/reset-aws-polling.js --user test@example.com  # Reset specific user
  node scripts/reset-aws-polling.js --dry-run          # Show what would be reset

Environment Variables:
  AWS_REGION                    AWS region (default: us-east-1)
  PARAMETER_STORE_PREFIX        Parameter store prefix (default: /chatterbox)
  GMAIL_TOKENS_SECRET_NAME      Gmail tokens secret name (default: development-chatterbox-gmail-tokens)
`);
    process.exit(0);
}

if (command === '--dry-run') {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
    // TODO: Implement dry run functionality
    console.log('Dry run mode not yet implemented. Use --help for available options.');
    process.exit(0);
}

if (command === '--user') {
    const userEmail = args[1];
    if (!userEmail) {
        console.error('❌ Error: --user requires an email address');
        process.exit(1);
    }
    
    console.log(`🔄 Resetting polling state for user: ${userEmail}`);
    resetUserPollingState(userEmail)
        .then(success => {
            if (success) {
                console.log('\n✅ User polling state reset complete!');
            } else {
                console.log('\n❌ Some operations failed. Check the logs above.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Error resetting user polling state:', error);
            process.exit(1);
        });
} else {
    // Reset all polling state
    resetAllPollingState()
        .catch(error => {
            console.error('❌ Error resetting polling state:', error);
            process.exit(1);
        });
} 