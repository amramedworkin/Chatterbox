#!/usr/bin/env node

const chalk = require('chalk');
/**
 * Run Response Generator Lambda Function
 * Invokes the chatterbox-response-generator Lambda function
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// AWS Client
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin',
});

// Configuration
const FUNCTION_NAME = 'chatterbox-response-generator';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function printInfo(message) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}❌${colors.reset} ${message}`);
}

// eslint-disable-next-line no-unused-vars
function printWarning(message) {
    console.log(chalk.yellow(`⚠️  ${message}`));
}

async function runResponseGenerator() {
    console.log(`${colors.cyan}🤖 Running Response Generator Lambda Function${colors.reset}`);
    console.log(`Function: ${FUNCTION_NAME}`);
    console.log('='.repeat(50));

    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const messageBody = args[0] || null;
        const conversationId = args[1] || null;

        // Create payload (SQS event format)
        const payload = {
            Records: [
                {
                    messageId: 'test-message-id',
                    receiptHandle: 'test-receipt-handle',
                    body:
                        messageBody ||
                        JSON.stringify({
                            conversationId: conversationId || 'test-conversation-123',
                            emailContent: 'This is a test email content for response generation.',
                            userEmail: 'test@example.com',
                            messageId: 'test-message-id',
                            timestamp: new Date().toISOString(),
                        }),
                    attributes: {
                        ApproximateReceiveCount: '1',
                        SentTimestamp: Date.now().toString(),
                        SenderId: 'AIDACKCEVSQ6C2EXAMPLE',
                        ApproximateFirstReceiveTimestamp: Date.now().toString(),
                    },
                    messageAttributes: {},
                    md5OfBody: 'test-md5',
                    eventSource: 'aws:sqs',
                    eventSourceARN:
                        'arn:aws:sqs:us-east-1:123456789012:chatterbox-response-generation',
                    awsRegion: process.env.AWS_REGION || 'us-east-1',
                },
            ],
        };

        if (messageBody) {
            printInfo(`Using custom message body: ${messageBody.substring(0, 50)}...`);
        } else {
            printInfo('Using default test message');
        }

        if (conversationId) {
            printInfo(`Using conversation ID: ${conversationId}`);
        }

        printInfo('Invoking Lambda function...');

        const command = new InvokeCommand({
            FunctionName: FUNCTION_NAME,
            Payload: JSON.stringify(payload),
            LogType: 'Tail',
        });

        const response = await lambdaClient.send(command);

        console.log('\n' + '='.repeat(50));
        printSuccess('Lambda function executed successfully!');
        console.log(`Status Code: ${response.StatusCode}`);

        // Display logs
        if (response.LogResult) {
            console.log('\n📋 CloudWatch Logs:');
            console.log('-'.repeat(30));
            const logs = Buffer.from(response.LogResult, 'base64').toString();
            console.log(logs);
        }

        // Display response
        if (response.Payload) {
            console.log('\n📄 Response:');
            console.log('-'.repeat(30));
            const result = JSON.parse(Buffer.from(response.Payload).toString());
            console.log(JSON.stringify(result, null, 2));
        }

        console.log('\n' + '='.repeat(50));
        printSuccess('Response Generator Lambda execution completed!');
    } catch (error) {
        printError(`Failed to run Lambda function: ${error.message}`);
        if (error.name === 'ResourceNotFoundException') {
            printError(`Lambda function ${FUNCTION_NAME} not found. Make sure it's deployed.`);
        }
        process.exit(1);
    }
}

// Run the function
runResponseGenerator();
