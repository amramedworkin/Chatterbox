#!/usr/bin/env node

/**
 * AWS Build Orchestration Script
 * 
 * This script orchestrates the complete AWS deployment process:
 * 1. Prerequisite check
 * 2. Prepare (init migration)
 * 3. Deploy (infrastructure, secrets, lambda)
 * 4. Authorize (Gmail OAuth)
 * 5. Validate (AWS system validation)
 * 
 * Each step returns success/failure status and the script asks for user confirmation
 * before proceeding to the next step.
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Colors for output
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

function printStatus(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printInfo(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log('='.repeat(message.length));
}

function printStep(message) {
    console.log(`\n${colors.bright}${colors.magenta}🚀 ${message}${colors.reset}`);
    console.log('-'.repeat(message.length));
}

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

// Function to run a command and return success/failure
function runCommand(command, args = [], description) {
    return new Promise((resolve) => {
        printStep(description);
        console.log(`Running: ${command} ${args.join(' ')}`);
        console.log('');

        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            cwd: process.cwd(),
        });

        child.on('close', (code) => {
            console.log('');
            if (code === 0) {
                printStatus(`${description} completed successfully`);
                resolve({ success: true, code });
            } else {
                printError(`${description} failed with exit code ${code}`);
                resolve({ success: false, code, error: `Command failed with exit code ${code}` });
            }
        });

        child.on('error', (error) => {
            console.log('');
            printError(`${description} failed: ${error.message}`);
            resolve({ success: false, error: error.message });
        });
    });
}

// Function to ask user if they want to continue
async function askToContinue(stepName, previousStepSuccess) {
    if (!previousStepSuccess) {
        return false;
    }

    const stepDescriptions = {
        'prepare': {
            title: 'PREPARE DATA FOR MIGRATION',
            description: 'This step will create an init folder under data/ and prepare all your configuration files, secrets, and tokens for migration to AWS.',
            actions: [
                'Create data/init folder with timestamped subfolder',
                'Copy config.json, .env, google_credentials.json',
                'Copy Gmail OAuth tokens from data/google_tokens.json',
                'Initialize default values for counter files',
                'Create migration manifest with success/failure tracking'
            ],
            duration: '2-3 minutes',
            risk: 'Low - only reads and copies existing files'
        },
        'deploy': {
            title: 'DEPLOY AWS INFRASTRUCTURE',
            description: 'This step will deploy all AWS resources including S3 buckets, DynamoDB tables, IAM roles, Secrets Manager, Parameter Store, and Lambda functions.',
            actions: [
                'Deploy Terraform infrastructure (S3, DynamoDB, IAM, etc.)',
                'Populate AWS Secrets Manager with Gmail tokens and OpenAI API key',
                'Populate Parameter Store with configuration values',
                'Build and package email processing Lambda functions',
                'Deploy all Lambda functions to AWS'
            ],
            duration: '5-10 minutes',
            risk: 'Medium - creates AWS resources and may incur costs'
        },
        'authorize': {
            title: 'GMAIL OAUTH AUTHORIZATION',
            description: 'This step will authorize all Gmail users defined in your config through the OAuth flow.',
            actions: [
                'Open browser for OAuth authorization',
                'Authorize Gmail access for each configured user',
                'Save OAuth tokens to data/google_tokens.json',
                'Verify tokens are valid and accessible'
            ],
            duration: '2-5 minutes',
            risk: 'Low - requires browser interaction for OAuth'
        },
        'validate': {
            title: 'VALIDATE AWS DEPLOYMENT',
            description: 'This step will verify that all AWS resources were created successfully and are properly configured.',
            actions: [
                'Check all Lambda functions exist and are accessible',
                'Verify S3 buckets are created and accessible',
                'Validate DynamoDB tables are properly configured',
                'Confirm secrets and parameters are populated',
                'Check CloudWatch log groups and IAM roles',
                'Verify SQS queues and resource groups'
            ],
            duration: '1-2 minutes',
            risk: 'None - read-only validation'
        }
    };

    const stepInfo = stepDescriptions[stepName];
    if (!stepInfo) {
        const response = await question(`\n${colors.yellow}Do you want to continue to the next step? (y/n): ${colors.reset}`);
        return response.toLowerCase() === 'y' || response.toLowerCase() === 'yes';
    }

    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}NEXT STEP: ${stepInfo.title}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log('');
    console.log(`${colors.blue}${stepInfo.description}${colors.reset}`);
    console.log('');
    console.log(`${colors.yellow}This step will:${colors.reset}`);
    stepInfo.actions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
    });
    console.log('');
    console.log(`${colors.magenta}Estimated duration: ${stepInfo.duration}${colors.reset}`);
    console.log(`${colors.magenta}Risk level: ${stepInfo.risk}${colors.reset}`);
    console.log('');

    const response = await question(`${colors.yellow}Do you want to proceed with ${stepName}? (y/n): ${colors.reset}`);
    return response.toLowerCase() === 'y' || response.toLowerCase() === 'yes';
}

// Function to display detailed error information
function displayErrorDetails(stepName, error) {
    printError(`\n${stepName.toUpperCase()} STEP FAILED`);
    console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.red}Error Details:${colors.reset}`);
    console.log(`${colors.red}${error}${colors.reset}`);
    console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
    
    console.log(`\n${colors.yellow}To fix this issue:${colors.reset}`);
    
    switch (stepName) {
        case 'prerequisite':
            console.log('1. Check that all required files exist (config.json, .env, google_credentials.json)');
            console.log('2. Verify Gmail user configuration in config.json');
            console.log('3. Ensure OpenAI API key is set in .env file');
            console.log('4. Check AWS credentials and profile configuration');
            console.log('5. Run: npm run aws:init:check-prerequisites');
            break;
        case 'prepare':
            console.log('1. Fix any prerequisite issues first');
            console.log('2. Ensure all required files are in the correct locations');
            console.log('3. Run: npm run aws:init:prepare');
            break;
        case 'deploy':
            console.log('1. Check AWS credentials and permissions');
            console.log('2. Verify Terraform configuration');
            console.log('3. Check for any AWS service limits or quota issues');
            console.log('4. Run: npm run aws:deploy');
            break;
        case 'authorize':
            console.log('1. Ensure google_credentials.json is valid');
            console.log('2. Check that Gmail users are correctly configured');
            console.log('3. Verify internet connectivity for OAuth flow');
            console.log('4. Run: npm run mail:authorize');
            break;
        case 'validate':
            console.log('1. Check that all AWS resources were created successfully');
            console.log('2. Verify secrets and parameters were populated');
            console.log('3. Ensure Lambda functions are deployed and accessible');
            console.log('4. Run: npm run aws:validate');
            break;
    }
    
    console.log(`\n${colors.yellow}You can also run individual steps:${colors.reset}`);
    console.log('- npm run aws:init:check-prerequisites');
    console.log('- npm run aws:init:prepare');
    console.log('- npm run aws:deploy');
    console.log('- npm run mail:authorize');
    console.log('- npm run aws:validate');
}

// Main orchestration function
async function main() {
    printHeader('🎯 AWS BUILD ORCHESTRATION');
    console.log('This script will guide you through the complete AWS deployment process.');
    console.log('Each step will be executed and you will be asked to confirm before proceeding.');
    console.log('');
    console.log('Steps:');
    console.log('1. Prerequisite Check - Validate local environment and configuration');
    console.log('2. Deploy - Deploy infrastructure, secrets, and Lambda functions');
    console.log('3. Verify Emails - Verify email addresses in AWS SES');
    console.log('4. Authorize - Complete Gmail OAuth authorization');
    console.log('5. Validate - Verify all AWS resources are properly deployed');
    console.log('');

    const startResponse = await question(`${colors.yellow}Do you want to start the AWS build process? (y/n): ${colors.reset}`);
    if (startResponse.toLowerCase() !== 'y' && startResponse.toLowerCase() !== 'yes') {
        console.log('AWS build process cancelled.');
        rl.close();
        return;
    }

    let currentStep = 1;
    const totalSteps = 5;

    try {
        // Step 1: Prerequisite Check
        printHeader(`STEP ${currentStep}/${totalSteps}: PREREQUISITE CHECK`);
        const prereqResult = await runCommand('npm', ['run', 'aws:init:check-prerequisites'], 'Checking prerequisites');
        
        if (!prereqResult.success) {
            displayErrorDetails('prerequisite', prereqResult.error);
            rl.close();
            process.exit(1);
        }

        // Step 2: Deploy (includes migration)
        currentStep++;
        printHeader(`STEP ${currentStep}/${totalSteps}: DEPLOY`);
        console.log('This step will:');
        console.log('1. Deploy AWS infrastructure (S3, DynamoDB, IAM, etc.)');
        console.log('2. Migrate secrets and parameters from config');
        console.log('3. Build and deploy Lambda functions');
        console.log('');
        
        const deployResult = await runCommand('npm', ['run', 'aws:deploy'], 'Deploying AWS infrastructure and Lambda functions');
        
        if (!deployResult.success) {
            displayErrorDetails('deploy', deployResult.error);
            rl.close();
            process.exit(1);
        }

        const continueToAuthorizeStep = await askToContinue('authorize', deployResult.success);
        if (!continueToAuthorizeStep) {
            console.log('AWS build process stopped by user.');
            rl.close();
            return;
        }

        // Step 3: Verify Emails
        currentStep++;
        printHeader(`STEP ${currentStep}/${totalSteps}: SETUP AND VERIFY SES`);
        console.log('This step will:');
        console.log('1. Set up SES from scratch if needed');
        console.log('2. Check SES account status (sandbox vs production)');
        console.log('3. Verify email addresses from config.json');
        console.log('4. Send verification emails if needed');
        console.log('5. Wait for verification (up to 10 minutes)');
        console.log('');
        
        const verifyResult = await runCommand('npm', ['run', 'aws:setup:ses'], 'Setting up and verifying email addresses in AWS SES');
        
        if (!verifyResult.success) {
            printWarning('SES setup and verification had issues');
            printInfo('You can run "npm run aws:setup:ses" later to retry');
            printInfo('Or run "npm run aws:check:ses" to check verification status');
        }

        const continueToAuthorizeStep = await askToContinue('authorize', true);
        if (!continueToAuthorizeStep) {
            console.log('AWS build process stopped by user.');
            rl.close();
            return;
        }

        // Step 4: Authorize
        currentStep++;
        printHeader(`STEP ${currentStep}/${totalSteps}: AUTHORIZE`);
        const authorizeResult = await runCommand('npm', ['run', 'mail:authorize'], 'Authorizing Gmail users');
        
        if (!authorizeResult.success) {
            displayErrorDetails('authorize', authorizeResult.error);
            rl.close();
            process.exit(1);
        }

        const continueToValidate = await askToContinue('validate', authorizeResult.success);
        if (!continueToValidate) {
            console.log('AWS build process stopped by user.');
            rl.close();
            return;
        }

        // Step 5: Validate
        currentStep++;
        printHeader(`STEP ${currentStep}/${totalSteps}: VALIDATE`);
        const validateResult = await runCommand('npm', ['run', 'aws:validate'], 'Validating AWS deployment');
        
        if (!validateResult.success) {
            displayErrorDetails('validate', validateResult.error);
            rl.close();
            process.exit(1);
        }

        // Success!
        printHeader('🎉 AWS BUILD COMPLETED SUCCESSFULLY!');
        console.log(`${colors.green}✅ All steps completed successfully${colors.reset}`);
        console.log(`${colors.green}✅ AWS infrastructure is deployed and ready${colors.reset}`);
        console.log(`${colors.green}✅ Gmail users are authorized${colors.reset}`);
        console.log(`${colors.green}✅ System validation passed${colors.reset}`);
        console.log('');
        console.log(`${colors.blue}📋 Next steps:${colors.reset}`);
        console.log('1. Test Gmail polling:');
        console.log('   aws lambda invoke --function-name development-poll-gmail --payload \'{"queryStringParameters": {"userEmail": "awsamram@gmail.com"}}\' response.json');
        console.log('');
        console.log('2. Test email processing:');
        console.log('   aws lambda invoke --function-name chatterbox-email-processor --payload \'{"test": true}\' response.json');
        console.log('');
        console.log('3. Monitor CloudWatch logs:');
        console.log('   node scripts/aws/get-lambda-logs.js development-poll-gmail');
        console.log('');
        console.log(`${colors.green}🎯 Your Chatterbox AWS system is now ready for operation!${colors.reset}`);

    } catch (error) {
        printError(`Orchestration failed: ${error.message}`);
        rl.close();
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        printError(`Script failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main }; 