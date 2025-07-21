#!/usr/bin/env node

/**
 * Run Poll Gmail Lambda Function
 * Invokes the development-poll-gmail Lambda function
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// AWS Client
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin',
});

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const FUNCTION_NAME = `${ENVIRONMENT}-poll-gmail`;

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

async function runPollGmail() {
    console.log(`${colors.cyan}🔍 Running Poll Gmail Lambda Function${colors.reset}`);
    console.log(`Function: ${FUNCTION_NAME}`);
    console.log('='.repeat(50));

    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const userEmail = args[0] || null;

        // Create payload
        const payload = {
            queryStringParameters: {},
        };

        if (userEmail) {
            payload.queryStringParameters.userEmail = userEmail;
            printInfo(`Using Gmail user: ${userEmail}`);
        } else {
            printInfo('Using default Gmail user from environment');
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
        printSuccess('Poll Gmail Lambda execution completed!');
    } catch (error) {
        printError(`Failed to run Lambda function: ${error.message}`);
        if (error.name === 'ResourceNotFoundException') {
            printError(`Lambda function ${FUNCTION_NAME} not found. Make sure it's deployed.`);
        }
        process.exit(1);
    }
}

// Run the function
runPollGmail();
