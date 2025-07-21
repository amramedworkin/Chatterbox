#!/usr/bin/env node

/**
 * Lambda Function Runner Script
 * Provides a menu-driven interface to run Lambda functions
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const readline = require('readline');

// AWS Client
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin',
});

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

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
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
};

// Lambda function configurations
const LAMBDA_FUNCTIONS = [
    {
        id: 'poll-gmail',
        name: 'Poll Gmail',
        description: 'Poll Gmail for new emails and process them',
        functionName: `${ENVIRONMENT}-poll-gmail`,
        payload: {},
        category: 'Email Processing',
    },
    {
        id: 'pull-latest-email',
        name: 'Pull Latest Chatterbox Email',
        description: 'Retrieve and process the latest email from the archive',
        functionName: `${ENVIRONMENT}-pull-latest-chatterbox-email`,
        payload: {},
        category: 'Email Processing',
    },
    // Add more functions here as needed
];

function printInfo(message) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${'='.repeat(message.length)}`);
}

function clearScreen() {
    console.clear();
}

function printMenu(selectedIndex) {
    clearScreen();
    printHeader('Lambda Function Runner');
    printInfo(`Environment: ${ENVIRONMENT}`);
    printInfo(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
    printInfo(`Profile: ${process.env.AWS_PROFILE || 'cliadmin'}`);
    console.log();

    console.log('Use arrow keys to navigate, Enter to select, Ctrl+C to exit\n');

    LAMBDA_FUNCTIONS.forEach((func, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? `${colors.bgBlue}${colors.bright} > ` : '   ';
        const suffix = isSelected ? colors.reset : '';

        console.log(`${prefix}${func.name}${suffix}`);
        console.log(`    ${colors.magenta}${func.description}${colors.reset}`);
        console.log(`    ${colors.yellow}Function: ${func.functionName}${colors.reset}`);
        console.log(`    ${colors.cyan}Category: ${func.category}${colors.reset}`);
        console.log();
    });
}

function printFunctionDetails(func) {
    clearScreen();
    printHeader(`Function Details: ${func.name}`);

    console.log(`${colors.cyan}Function Name:${colors.reset} ${func.functionName}`);
    console.log(`${colors.cyan}Description:${colors.reset} ${func.description}`);
    console.log(`${colors.cyan}Category:${colors.reset} ${func.category}`);
    console.log(`${colors.cyan}Payload:${colors.reset} ${JSON.stringify(func.payload, null, 2)}`);
    console.log();

    console.log('Press Enter to run this function, or any other key to go back...');
}

async function runLambdaFunction(func) {
    clearScreen();
    printHeader(`Running: ${func.name}`);

    try {
        printInfo(`Invoking function: ${func.functionName}`);
        printInfo(`Payload: ${JSON.stringify(func.payload)}`);
        console.log();

        const command = new InvokeCommand({
            FunctionName: func.functionName,
            Payload: JSON.stringify(func.payload),
            InvocationType: 'RequestResponse',
        });

        const startTime = Date.now();
        const response = await lambdaClient.send(command);
        const endTime = Date.now();

        printSuccess(`Function executed successfully in ${endTime - startTime}ms`);
        console.log();

        if (response.StatusCode === 200) {
            printSuccess('Response:');
            if (response.Payload) {
                const payload = JSON.parse(Buffer.from(response.Payload).toString());
                console.log(JSON.stringify(payload, null, 2));
            } else {
                console.log('No response payload');
            }
        } else {
            printWarning(`Function returned status code: ${response.StatusCode}`);
        }

        if (response.LogResult) {
            console.log();
            printInfo('Logs:');
            const logs = Buffer.from(response.LogResult, 'base64').toString();
            console.log(logs);
        }
    } catch (error) {
        printError(`Failed to run function: ${error.message}`);

        if (error.name === 'ResourceNotFoundException') {
            printWarning('Function not found. Make sure it exists and is deployed.');
        } else if (error.name === 'AccessDeniedException') {
            printWarning('Access denied. Check your AWS credentials and permissions.');
        }
    }

    console.log('\nPress Enter to continue...');
}

function setupInputHandling() {
    // Disable canonical mode (line buffering) and echo
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Hide cursor
    process.stdout.write('\x1b[?25l');

    let selectedIndex = 0;

    function handleInput(data) {
        const key = data.toString();

        if (key === '\u0003') {
            // Ctrl+C
            cleanup();
            process.exit(0);
        } else if (key === '\u001b[A') {
            // Up arrow
            selectedIndex = Math.max(0, selectedIndex - 1);
            printMenu(selectedIndex);
        } else if (key === '\u001b[B') {
            // Down arrow
            selectedIndex = Math.min(LAMBDA_FUNCTIONS.length - 1, selectedIndex + 1);
            printMenu(selectedIndex);
        } else if (key === '\r' || key === '\n') {
            // Enter
            const selectedFunc = LAMBDA_FUNCTIONS[selectedIndex];
            handleFunctionSelection(selectedFunc);
        }
    }

    async function handleFunctionSelection(func) {
        // Restore normal input mode
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\x1b[?25h'); // Show cursor

        printFunctionDetails(func);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question('', async (answer) => {
            rl.close();

            if (answer === '') {
                await runLambdaFunction(func);

                // Wait for Enter to continue
                const rl2 = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                rl2.question('', () => {
                    rl2.close();
                    // Restart the menu
                    setupInputHandling();
                });
            } else {
                // Go back to menu
                setupInputHandling();
            }
        });
    }

    function cleanup() {
        process.stdout.write('\x1b[?25h'); // Show cursor
        process.stdin.setRawMode(false);
        process.stdin.pause();
    }

    process.stdin.on('data', handleInput);
    printMenu(selectedIndex);
}

async function main() {
    try {
        printInfo('Starting Lambda Function Runner...');
        await setupInputHandling();
    } catch (error) {
        printError(`Script failed: ${error.message}`);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.exit(0);
});

process.on('SIGTERM', () => {
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = {
    LAMBDA_FUNCTIONS,
    runLambdaFunction,
};
