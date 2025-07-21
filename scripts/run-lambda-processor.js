#!/usr/bin/env node

/**
 * Run Email Processor Lambda Function
 * Invokes the chatterbox-email-processor Lambda function
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// AWS Client
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin',
});

// Configuration
const FUNCTION_NAME = 'chatterbox-email-processor';

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

async function runEmailProcessor() {
    console.log(`${colors.cyan}📨 Running Email Processor Lambda Function${colors.reset}`);
    console.log(`Function: ${FUNCTION_NAME}`);
    console.log('='.repeat(50));

    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const s3Bucket = args[0] || null;
        const s3Key = args[1] || null;

        // Create payload (S3 event format)
        const payload = {
            Records: [
                {
                    eventVersion: '2.1',
                    eventSource: 'aws:s3',
                    awsRegion: process.env.AWS_REGION || 'us-east-1',
                    eventTime: new Date().toISOString(),
                    eventName: 'ObjectCreated:Put',
                    userIdentity: {
                        principalId: 'AWS:AIDACKCEVSQ6C2EXAMPLE',
                    },
                    requestParameters: {
                        sourceIPAddress: '127.0.0.1',
                    },
                    responseElements: {
                        'x-amz-request-id': 'EXAMPLE123456789',
                        'x-amz-id-2':
                            'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
                    },
                    s3: {
                        s3SchemaVersion: '1.0',
                        configurationId: 'testConfigRule',
                        bucket: {
                            name: s3Bucket || 'chatterbox-email-content-dev-9asadjm4',
                            ownerIdentity: {
                                principalId: 'EXAMPLE',
                            },
                            arn: `arn:aws:s3:::${
                                s3Bucket || 'chatterbox-email-content-dev-9asadjm4'
                            }`,
                        },
                        object: {
                            key: s3Key || 'emails/test-email-metadata.json',
                            size: 1024,
                            eTag: '0123456789abcdef0123456789abcdef',
                            sequencer: '0A1B2C3D4E5F678901',
                        },
                    },
                },
            ],
        };

        if (s3Bucket && s3Key) {
            printInfo(`Processing S3 object: s3://${s3Bucket}/${s3Key}`);
        } else {
            printInfo('Using default S3 event (test mode)');
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
        printSuccess('Email Processor Lambda execution completed!');
    } catch (error) {
        printError(`Failed to run Lambda function: ${error.message}`);
        if (error.name === 'ResourceNotFoundException') {
            printError(`Lambda function ${FUNCTION_NAME} not found. Make sure it's deployed.`);
        }
        process.exit(1);
    }
}

// Run the function
runEmailProcessor();
