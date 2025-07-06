#!/usr/bin/env node

/**
 * Reset AWS Parameter Store polling state to mimic "first run" state
 * Clears last_history_id and last_polled_timestamp for all configured Gmail users
 */

const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { DynamoDBClient, ScanCommand, BatchWriteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

// AWS Clients
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const PARAMETER_STORE_PREFIX = `/chatterbox/${ENVIRONMENT}`;
const GMAIL_TOKENS_SECRET_NAME = `${ENVIRONMENT}-chatterbox-gmail-tokens`;
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'development-chatterbox-state-table';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function printInfo(message) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅${colors.reset} ${message}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}❌${colors.reset} ${message}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${'='.repeat(message.length)}`);
}

/**
 * Get Gmail users from AWS Secrets Manager
 */
async function getGmailUsers() {
    try {
        const response = await secretsClient.send(new GetSecretValueCommand({
            SecretId: GMAIL_TOKENS_SECRET_NAME
        }));
        
        const tokens = JSON.parse(response.SecretString || '{}');
        return Object.keys(tokens);
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            printWarning(`Gmail tokens secret not found: ${GMAIL_TOKENS_SECRET_NAME}`);
            return [];
        }
        throw error;
    }
}

/**
 * Clear pending email jobs from DynamoDB for a specific user
 */
async function clearPendingEmailJobs(userEmail) {
    const sk = `USER#${userEmail}`;
    let lastEvaluatedKey = undefined;
    let totalDeleted = 0;
    do {
        const scan = new ScanCommand({
            TableName: DYNAMODB_TABLE_NAME,
            FilterExpression: 'sk = :sk AND begins_with(pk, :pkPrefix)',
            ExpressionAttributeValues: marshall({
                ':sk': sk,
                ':pkPrefix': 'PENDING_EMAIL#'
            }),
            ProjectionExpression: 'pk, sk',
            ExclusiveStartKey: lastEvaluatedKey
        });
        const result = await dynamoClient.send(scan);
        const items = result.Items || [];
        if (items.length > 0) {
            // Batch delete (max 25 at a time)
            for (let i = 0; i < items.length; i += 25) {
                const batch = items.slice(i, i + 25);
                const deleteRequests = batch.map(item => ({
                    DeleteRequest: { Key: item }
                }));
                await dynamoClient.send(new BatchWriteItemCommand({
                    RequestItems: {
                        [DYNAMODB_TABLE_NAME]: deleteRequests
                    }
                }));
                totalDeleted += batch.length;
            }
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    if (totalDeleted > 0) {
        printSuccess(`  Cleared ${totalDeleted} pending Gmail ID jobs from DynamoDB for ${userEmail}`);
    } else {
        printInfo(`  No pending Gmail ID jobs to clear for ${userEmail}`);
    }
}

/**
 * Reset polling state for a specific user
 */
async function resetUserPollingState(userEmail) {
    const userPrefix = `${PARAMETER_STORE_PREFIX}/polling/${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    printInfo(`Resetting polling state for: ${userEmail}`);
    
    try {
        // Reset last_history_id to "none" (indicates first run)
        await ssmClient.send(new PutParameterCommand({
            Name: `${userPrefix}/last_history_id`,
            Value: 'none',
            Type: 'String',
            Overwrite: true
        }));
        printSuccess(`  Reset last_history_id to "none"`);
        
        // Reset last_polled_timestamp to current time
        const currentTimestamp = new Date().toISOString();
        await ssmClient.send(new PutParameterCommand({
            Name: `${userPrefix}/last_polled_timestamp`,
            Value: currentTimestamp,
            Type: 'String',
            Overwrite: true
        }));
        printSuccess(`  Reset last_polled_timestamp to: ${currentTimestamp}`);
        
        // Reset total_poll_cycles to 0
        await ssmClient.send(new PutParameterCommand({
            Name: `${userPrefix}/total_poll_cycles`,
            Value: '0',
            Type: 'String',
            Overwrite: true
        }));
        printSuccess(`  Reset total_poll_cycles to 0`);
        
        // Reset last_polled_user to current user
        await ssmClient.send(new PutParameterCommand({
            Name: `${userPrefix}/last_polled_user`,
            Value: userEmail,
            Type: 'String',
            Overwrite: true
        }));
        printSuccess(`  Reset last_polled_user to: ${userEmail}`);
        
        // After resetting SSM, clear DynamoDB jobs
        await clearPendingEmailJobs(userEmail);
        
        return true;
    } catch (error) {
        printError(`  Failed to reset polling state for ${userEmail}: ${error.message}`);
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    printHeader('AWS Polling State Reset');
    printInfo(`Environment: ${ENVIRONMENT}`);
    printInfo(`Parameter Store Prefix: ${PARAMETER_STORE_PREFIX}`);
    
    try {
        // Get Gmail users from secrets
        printInfo('Retrieving Gmail users from AWS Secrets Manager...');
        const gmailUsers = await getGmailUsers();
        
        if (gmailUsers.length === 0) {
            printWarning('No Gmail users found in secrets. Using default user.');
            gmailUsers.push('awsamram@gmail.com');
        }
        
        printSuccess(`Found ${gmailUsers.length} Gmail user(s): ${gmailUsers.join(', ')}`);
        
        // Reset polling state for each user
        let successCount = 0;
        let failureCount = 0;
        
        for (const userEmail of gmailUsers) {
            const success = await resetUserPollingState(userEmail);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
            console.log(''); // Add spacing between users
        }
        
        // Summary
        printHeader('Reset Summary');
        printSuccess(`Successfully reset ${successCount} user(s)`);
        if (failureCount > 0) {
            printError(`Failed to reset ${failureCount} user(s)`);
        }
        
        printInfo('\nNext steps:');
        printInfo('1. The polling Lambda will now start fresh on next invocation');
        printInfo('2. It will search for emails from the last 30 days');
        printInfo('3. Run: npm run aws:deploy:lambda to test the reset state');
        
    } catch (error) {
        printError(`Script failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        printError(`Unhandled error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { resetUserPollingState, getGmailUsers }; 