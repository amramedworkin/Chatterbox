#!/usr/bin/env node

/**
 * Test polling script for both local and AWS environments
 * Usage:
 *   node scripts/test-polling.js [--local|--aws]
 *   npm run mail:poll:test [--local|--aws]
 *
 * Default behavior: Test AWS Lambda polling
 */

const { execSync } = require('child_process');
const path = require('path');

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

function printStep(step, message) {
    console.log(`\n${colors.magenta}${step}${colors.reset} ${message}`);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        local: false,
        aws: false,
        help: false,
    };

    for (const arg of args) {
        switch (arg) {
            case '--local':
            case '-l':
                options.local = true;
                break;
            case '--aws':
            case '-a':
                options.aws = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                printWarning(`Unknown argument: ${arg}`);
        }
    }

    // If neither local nor aws specified, default to AWS
    if (!options.local && !options.aws) {
        options.aws = true;
    }

    return options;
}

/**
 * Show help information
 */
function showHelp() {
    console.log(`
${colors.bright}${colors.cyan}Polling Test Script${colors.reset}
${'='.repeat(50)}

This script tests Gmail polling functionality in either local or AWS environments.

${colors.bright}Usage:${colors.reset}
  node scripts/test-polling.js [options]
  npm run mail:poll:test [options]

${colors.bright}Options:${colors.reset}
  --local, -l    Test local polling (runs mail:poll:single)
  --aws, -a      Test AWS Lambda polling (default)
  --help, -h     Show this help message

${colors.bright}Examples:${colors.reset}
  npm run mail:poll:test              # Test AWS Lambda polling
  npm run mail:poll:test --local      # Test local polling
  npm run mail:poll:test --aws        # Test AWS Lambda polling (explicit)
  node scripts/test-polling.js -l     # Test local polling (direct)

${colors.bright}Environment Variables:${colors.reset}
  AWS_PROFILE    AWS profile to use (default: cliadmin)
  ENVIRONMENT    Environment name (default: development)

${colors.bright}What it does:${colors.reset}
  • Determines which environment to test based on CLI arguments
  • Executes the appropriate polling command
  • Provides detailed logging of the process
  • Shows clear success/failure status
`);
}

/**
 * Test local polling
 */
function testLocalPolling() {
    printStep('STEP 1', 'Preparing local polling test...');
    printInfo('Environment: Local (Node.js)');
    printInfo('Command: npm run mail:poll:single');
    printInfo('This will execute the local polling script directly');

    try {
        // Check if build exists
        const buildPath = path.join(process.cwd(), 'dist', 'src', 'mail', 'pollGmail.js');
        if (!require('fs').existsSync(buildPath)) {
            printWarning('Build not found. Running build first...');
            printInfo('Executing: npm run build');
            execSync('npm run build', { stdio: 'inherit' });
            printSuccess('Build completed successfully');
        }

        printStep('STEP 2', 'Executing local polling...');
        printInfo('Running: npm run mail:poll:single');

        const result = execSync('npm run mail:poll:single', {
            encoding: 'utf8',
            stdio: 'pipe',
        });

        printSuccess('Local polling executed successfully');
        printInfo('Output:');
        console.log(result);

        return true;
    } catch (error) {
        printError(`Local polling failed: ${error.message}`);
        if (error.stdout) {
            printInfo('Command output:');
            console.log(error.stdout);
        }
        if (error.stderr) {
            printError('Error output:');
            console.log(error.stderr);
        }
        return false;
    }
}

/**
 * Test AWS Lambda polling
 */
function testAwsPolling() {
    printStep('STEP 1', 'Preparing AWS Lambda polling test...');
    printInfo('Environment: AWS Lambda');
    printInfo('Profile: ' + (process.env.AWS_PROFILE || 'cliadmin'));
    printInfo('Environment: ' + (process.env.ENVIRONMENT || 'development'));

    try {
        // Get default Gmail user from infrastructure
        printStep('STEP 2', 'Getting default Gmail user from AWS infrastructure...');
        printInfo(
            'Executing: cd Cloud/AWS/terraform-simple && terraform output -raw default_gmail_user'
        );

        const defaultUser = execSync(
            'cd Cloud/AWS/terraform-simple && terraform output -raw default_gmail_user',
            {
                encoding: 'utf8',
                stdio: 'pipe',
            }
        ).trim();

        printSuccess(`Default Gmail user: ${defaultUser}`);

        // Test the Lambda function
        printStep('STEP 3', 'Invoking AWS Lambda function...');
        const functionName = `${process.env.ENVIRONMENT || 'development'}-poll-gmail`;
        const payload = JSON.stringify({
            queryStringParameters: {
                userEmail: defaultUser,
            },
        });

        printInfo(`Function: ${functionName}`);
        printInfo(`Payload: ${payload}`);
        printInfo('Executing: aws lambda invoke...');

        const result = execSync(
            `aws lambda invoke \
            --function-name ${functionName} \
            --payload '${payload}' \
            response.json \
            --cli-binary-format raw-in-base64-out \
            --profile ${process.env.AWS_PROFILE || 'cliadmin'}`,
            {
                encoding: 'utf8',
                stdio: 'pipe',
            }
        );

        printSuccess('AWS Lambda function invoked successfully');
        printInfo('Invocation result:');
        console.log(result);

        // Read and display the response
        printStep('STEP 4', 'Reading Lambda response...');
        if (require('fs').existsSync('response.json')) {
            const response = require('fs').readFileSync('response.json', 'utf8');
            printInfo('Lambda response:');
            console.log(response);

            // Clean up response file
            require('fs').unlinkSync('response.json');
            printInfo('Cleaned up response.json file');
        } else {
            printWarning('No response.json file found');
        }

        return true;
    } catch (error) {
        printError(`AWS Lambda polling failed: ${error.message}`);
        if (error.stdout) {
            printInfo('Command output:');
            console.log(error.stdout);
        }
        if (error.stderr) {
            printError('Error output:');
            console.log(error.stderr);
        }
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    printHeader('Gmail Polling Test');
    printInfo(`Testing ${options.local ? 'LOCAL' : 'AWS'} polling environment`);
    printInfo(`Working directory: ${process.cwd()}`);
    printInfo(`Node version: ${process.version}`);
    printInfo(`Platform: ${process.platform}`);

    let success = false;

    if (options.local) {
        success = testLocalPolling();
    } else {
        success = testAwsPolling();
    }

    // Summary
    printHeader('Test Summary');
    if (success) {
        printSuccess(`✅ ${options.local ? 'Local' : 'AWS'} polling test completed successfully`);
        printInfo('\nNext steps:');
        if (options.local) {
            printInfo('• Check data/ directory for updated polling state files');
            printInfo('• Run: npm run mail:poll:reset:local to reset state');
        } else {
            printInfo('• Check CloudWatch logs for detailed Lambda execution');
            printInfo('• Run: npm run aws:logs to view Lambda logs');
            printInfo('• Run: npm run mail:poll:reset:aws to reset state');
        }
    } else {
        printError(`❌ ${options.local ? 'Local' : 'AWS'} polling test failed`);
        printInfo('\nTroubleshooting:');
        if (options.local) {
            printInfo('• Ensure config.json is properly configured');
            printInfo('• Run: npm run build to rebuild the project');
            printInfo('• Check Gmail authentication: npm run mail:validate');
        } else {
            printInfo('• Ensure AWS credentials are configured');
            printInfo('• Check Lambda function exists: npm run aws:validate');
            printInfo('• Verify secrets are populated: npm run aws:deploy:secrets');
        }
    }

    process.exit(success ? 0 : 1);
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        printError(`Unhandled error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { testLocalPolling, testAwsPolling, parseArgs };
