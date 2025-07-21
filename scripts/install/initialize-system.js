#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

// Configuration
const REQUIREMENTS_DOC = path.join(__dirname, '../../SYSTEM_REQUIREMENTS_CONSOLIDATION.md');
const CONFIG_PATH = path.join(__dirname, '../../config.json');
// eslint-disable-next-line no-unused-vars
const ENV_CLEAN_PATH = path.join(__dirname, '../../.env-clean');
const TOKENS_DIR = path.join(__dirname, '../../tokens');

/**
 * Reads and parses the requirements document
 */
function parseRequirementsDocument() {
    try {
        const content = fs.readFileSync(REQUIREMENTS_DOC, 'utf8');
        return content;
    } catch (error) {
        console.error(chalk.red('❌ Could not read requirements document:'), error.message);
        process.exit(1);
    }
}

/**
 * Displays detailed instructions for GCP setup
 */
function showGcpInstructions() {
    console.log(chalk.blue.bold('\n📋 GCP Account & OAuth Setup Instructions\n'));

    console.log(chalk.white('1. Create GCP Account:'));
    console.log(chalk.gray('   • Go to https://console.cloud.google.com/'));
    console.log(chalk.gray('   • Sign in with your Google account or create a new one'));
    console.log(chalk.gray('   • Accept the terms of service'));

    console.log(chalk.white('\n2. Create a New Project:'));
    console.log(chalk.gray('   • Click on the project dropdown at the top'));
    console.log(chalk.gray('   • Click "New Project"'));
    console.log(chalk.gray('   • Enter a project name (e.g., "Chatterbox")'));
    console.log(chalk.gray('   • Click "Create"'));

    console.log(chalk.white('\n3. Enable Gmail API:'));
    console.log(chalk.gray('   • Go to "APIs & Services" > "Library"'));
    console.log(chalk.gray('   • Search for "Gmail API"'));
    console.log(chalk.gray('   • Click on "Gmail API" and then "Enable"'));

    console.log(chalk.white('\n4. Configure OAuth Consent Screen:'));
    console.log(chalk.gray('   • Go to "APIs & Services" > "OAuth consent screen"'));
    console.log(chalk.gray('   • Choose "External" user type'));
    console.log(chalk.gray('   • Fill in required fields:'));
    console.log(chalk.gray('     - App name: Chatterbox'));
    console.log(chalk.gray('     - User support email: your email'));
    console.log(chalk.gray('     - Developer contact information: your email'));
    console.log(chalk.gray('   • Click "Save and Continue"'));
    console.log(chalk.gray('   • Add scopes: gmail.readonly, gmail.send'));
    console.log(chalk.gray('   • Add test users if needed'));
    console.log(chalk.gray('   • Click "Save and Continue"'));

    console.log(chalk.white('\n5. Create OAuth Credentials:'));
    console.log(chalk.gray('   • Go to "APIs & Services" > "Credentials"'));
    console.log(chalk.gray('   • Click "Create Credentials" > "OAuth client ID"'));
    console.log(chalk.gray('   • Choose "Desktop application"'));
    console.log(chalk.gray('   • Name: "Chatterbox Desktop Client"'));
    console.log(chalk.gray('   • Click "Create"'));
    console.log(chalk.gray('   • Download the JSON file'));

    console.log(chalk.white('\n6. Save Credentials:'));
    console.log(chalk.gray('   • Rename the downloaded file to "google_credentials.json"'));
    console.log(chalk.gray('   • Place it in the "tokens" directory'));

    console.log(chalk.yellow('\n⚠️  Important Notes:'));
    console.log(
        chalk.white('• Keep your credentials secure and never commit them to version control')
    );
    console.log(
        chalk.white('• The OAuth consent screen may need to be published for production use')
    );
    console.log(
        chalk.white('• You may need to verify your app if you plan to use it with many users')
    );
}

/**
 * Displays detailed instructions for OpenAI setup
 */
function showOpenAiInstructions() {
    console.log(chalk.blue.bold('\n📋 OpenAI Account & API Setup Instructions\n'));

    console.log(chalk.white('1. Create OpenAI Account:'));
    console.log(chalk.gray('   • Go to https://platform.openai.com/'));
    console.log(chalk.gray('   • Click "Sign up" and create an account'));
    console.log(chalk.gray('   • Verify your email address'));

    console.log(chalk.white('\n2. Add Payment Method:'));
    console.log(chalk.gray('   • Go to "Billing" in your account'));
    console.log(chalk.gray('   • Add a credit card or other payment method'));
    console.log(chalk.gray('   • This is required for API usage'));

    console.log(chalk.white('\n3. Generate API Key:'));
    console.log(chalk.gray('   • Go to "API Keys" in your account'));
    console.log(chalk.gray('   • Click "Create new secret key"'));
    console.log(chalk.gray('   • Give it a name (e.g., "Chatterbox")'));
    console.log(chalk.gray('   • Copy the key (it starts with "sk-")'));
    console.log(chalk.gray("   • Store it securely - you won't see it again"));

    console.log(chalk.white('\n4. Check API Access:'));
    console.log(chalk.gray('   • Go to "Models" to see available models'));
    console.log(chalk.gray('   • Ensure you have access to GPT-4o or GPT-4o-mini'));
    console.log(chalk.gray('   • Check your usage limits in "Usage"'));

    console.log(chalk.yellow('\n⚠️  Important Notes:'));
    console.log(
        chalk.white('• API keys are sensitive - never share them or commit to version control')
    );
    console.log(chalk.white('• Monitor your usage to avoid unexpected charges'));
    console.log(chalk.white('• Consider setting up usage alerts in your account'));
}

/**
 * Displays detailed instructions for AWS setup
 */
function showAwsInstructions() {
    console.log(chalk.blue.bold('\n📋 AWS Account & IAM Setup Instructions\n'));

    console.log(chalk.white('1. Create AWS Account:'));
    console.log(chalk.gray('   • Go to https://aws.amazon.com/'));
    console.log(chalk.gray('   • Click "Create an AWS Account"'));
    console.log(chalk.gray('   • Follow the registration process'));
    console.log(chalk.gray('   • Add a payment method'));
    console.log(chalk.gray('   • Complete identity verification'));

    console.log(chalk.white('\n2. Create IAM User (cliadmin):'));
    console.log(chalk.gray('   • Go to IAM Console: https://console.aws.amazon.com/iam/'));
    console.log(chalk.gray('   • Click "Users" > "Create user"'));
    console.log(chalk.gray('   • Username: cliadmin'));
    console.log(chalk.gray('   • Check "Programmatic access"'));
    console.log(chalk.gray('   • Click "Next: Permissions"'));

    console.log(chalk.white('\n3. Attach Permissions:'));
    console.log(chalk.gray('   • Choose "Attach policies directly"'));
    console.log(chalk.gray('   • Search for and select:'));
    console.log(chalk.gray('     - AdministratorAccess (for initial setup)'));
    console.log(chalk.gray('     - AmazonS3FullAccess'));
    console.log(chalk.gray('     - AmazonDynamoDBFullAccess'));
    console.log(chalk.gray('     - SecretsManagerReadWrite'));
    console.log(chalk.gray('     - SystemsManagerFullAccess'));
    console.log(chalk.gray('     - CloudWatchFullAccess'));
    console.log(chalk.gray('     - IAMFullAccess'));
    console.log(chalk.gray('   • Click "Next: Tags" (optional)'));
    console.log(chalk.gray('   • Click "Next: Review"'));
    console.log(chalk.gray('   • Click "Create user"'));

    console.log(chalk.white('\n4. Create Access Keys:'));
    console.log(chalk.gray('   • Click on the cliadmin user'));
    console.log(chalk.gray('   • Go to "Security credentials" tab'));
    console.log(chalk.gray('   • Scroll to "Access keys"'));
    console.log(chalk.gray('   • Click "Create access key"'));
    console.log(chalk.gray('   • Choose "Command Line Interface (CLI)"'));
    console.log(chalk.gray('   • Check the confirmation box'));
    console.log(chalk.gray('   • Click "Next"'));
    console.log(chalk.gray('   • Download the CSV file'));

    console.log(chalk.white('\n5. Configure AWS CLI:'));
    console.log(chalk.gray('   • Install AWS CLI if not already installed'));
    console.log(chalk.gray('   • Run: aws configure --profile cliadmin'));
    console.log(chalk.gray('   • Enter Access Key ID and Secret Access Key'));
    console.log(chalk.gray('   • Default region: us-east-1'));
    console.log(chalk.gray('   • Default output format: json'));

    console.log(chalk.yellow('\n⚠️  Important Notes:'));
    console.log(
        chalk.white('• Keep your access keys secure and never commit them to version control')
    );
    console.log(chalk.white('• Consider using more restrictive policies for production'));
    console.log(chalk.white('• Monitor your AWS usage to avoid unexpected charges'));
}

/**
 * Prompts for GCP credentials file
 */
async function promptForGcpCredentials() {
    console.log(chalk.blue('\n🔐 GCP OAuth Credentials'));

    const { hasCredentials } = await inquirer.default.prompt([
        {
            type: 'confirm',
            name: 'hasCredentials',
            message: 'Do you have your GCP OAuth credentials file ready?',
            default: false,
        },
    ]);

    if (!hasCredentials) {
        showGcpInstructions();

        const { ready } = await inquirer.default.prompt([
            {
                type: 'confirm',
                name: 'ready',
                message: 'Have you completed the GCP setup and downloaded your credentials?',
                default: false,
            },
        ]);

        if (!ready) {
            console.log(
                chalk.yellow(
                    '\n⏸️  Please complete the GCP setup and run the initialization again.'
                )
            );
            process.exit(0);
        }
    }

    const { credentialsPath } = await inquirer.default.prompt([
        {
            type: 'input',
            name: 'credentialsPath',
            message: 'Enter the path to your GCP credentials file:',
            validate: (input) => {
                if (!input.trim()) return 'Path is required';
                if (!fs.existsSync(input)) return 'File does not exist';
                return true;
            },
        },
    ]);

    // Copy credentials to tokens directory
    const targetPath = path.join(TOKENS_DIR, 'google_credentials.json');
    fs.mkdirSync(TOKENS_DIR, { recursive: true });
    fs.copyFileSync(credentialsPath, targetPath);

    console.log(chalk.green('✅ GCP credentials copied to tokens/google_credentials.json'));
    return targetPath;
}

/**
 * Prompts for OpenAI API key
 */
async function promptForOpenAiKey() {
    console.log(chalk.blue('\n🤖 OpenAI API Key'));

    const { hasApiKey } = await inquirer.default.prompt([
        {
            type: 'confirm',
            name: 'hasApiKey',
            message: 'Do you have your OpenAI API key ready?',
            default: false,
        },
    ]);

    if (!hasApiKey) {
        showOpenAiInstructions();

        const { ready } = await inquirer.default.prompt([
            {
                type: 'confirm',
                name: 'ready',
                message: 'Have you completed the OpenAI setup and generated your API key?',
                default: false,
            },
        ]);

        if (!ready) {
            console.log(
                chalk.yellow(
                    '\n⏸️  Please complete the OpenAI setup and run the initialization again.'
                )
            );
            process.exit(0);
        }
    }

    const { apiKey } = await inquirer.default.prompt([
        {
            type: 'password',
            name: 'apiKey',
            message: 'Enter your OpenAI API key:',
            validate: (input) => {
                if (!input.trim()) return 'API key is required';
                if (!input.startsWith('sk-')) return 'API key must start with "sk-"';
                if (input.length < 20) return 'API key seems too short';
                return true;
            },
        },
    ]);

    // Create .env file
    const envPath = path.join(__dirname, '../../.env');
    const envContent = `# OpenAI Configuration
OPENAI_API_KEY=${apiKey}

# Environment Variables for Chatterbox Configuration
# Copy from .env-clean and uncomment/set values as needed
`;

    fs.writeFileSync(envPath, envContent);
    console.log(chalk.green('✅ OpenAI API key saved to .env file'));
    return apiKey;
}

/**
 * Prompts for email addresses
 */
async function promptForEmailAddresses() {
    console.log(chalk.blue('\n📧 Email Addresses Configuration'));

    console.log(chalk.white('You need to provide email addresses for different purposes:'));
    console.log(chalk.gray('• Polling Email: Used to read incoming messages'));
    console.log(chalk.gray('• Sending Email: Used to send responses'));
    console.log(chalk.gray('• Get Email: Used to retrieve specific messages'));
    console.log(chalk.gray('• Test Recipient: Used for testing email sending'));

    const emails = await inquirer.default.prompt([
        {
            type: 'input',
            name: 'pollEmail',
            message: 'Enter polling email address:',
            validate: (input) => {
                if (!input.trim()) return 'Email is required';
                if (!input.includes('@')) return 'Invalid email format';
                return true;
            },
        },
        {
            type: 'input',
            name: 'sendEmail',
            message: 'Enter sending email address:',
            validate: (input) => {
                if (!input.trim()) return 'Email is required';
                if (!input.includes('@')) return 'Invalid email format';
                return true;
            },
        },
        {
            type: 'input',
            name: 'getEmail',
            message: 'Enter get email address:',
            default: function (answers) {
                return answers.pollEmail;
            },
            validate: (input) => {
                if (!input.trim()) return 'Email is required';
                if (!input.includes('@')) return 'Invalid email format';
                return true;
            },
        },
        {
            type: 'input',
            name: 'testRecipient',
            message: 'Enter test recipient email address:',
            default: function (answers) {
                return answers.pollEmail;
            },
            validate: (input) => {
                if (!input.trim()) return 'Email is required';
                if (!input.includes('@')) return 'Invalid email format';
                return true;
            },
        },
    ]);

    // Update config.json
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config.app.defaultPollGmailUser = emails.pollEmail;
    config.app.defaultSendGmailUser = emails.sendEmail;
    config.app.defaultGetGmailUser = emails.getEmail;
    config.sendTest.defaultRecipient = emails.testRecipient;

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(chalk.green('✅ Email addresses updated in config.json'));

    return emails;
}

/**
 * Prompts for AWS configuration
 */
async function promptForAwsConfig() {
    console.log(chalk.blue('\n☁️  AWS Configuration'));

    const { useAws } = await inquirer.default.prompt([
        {
            type: 'confirm',
            name: 'useAws',
            message: 'Do you want to configure AWS infrastructure? (Recommended for production)',
            default: true,
        },
    ]);

    if (!useAws) {
        console.log(chalk.yellow('⚠️  AWS configuration skipped. You can configure it later.'));
        return null;
    }

    const { hasAwsSetup } = await inquirer.default.prompt([
        {
            type: 'confirm',
            name: 'hasAwsSetup',
            message: 'Have you completed the AWS setup (account, cliadmin user, access keys)?',
            default: false,
        },
    ]);

    if (!hasAwsSetup) {
        showAwsInstructions();

        const { ready } = await inquirer.default.prompt([
            {
                type: 'confirm',
                name: 'ready',
                message: 'Have you completed the AWS setup and configured AWS CLI?',
                default: false,
            },
        ]);

        if (!ready) {
            console.log(
                chalk.yellow(
                    '\n⏸️  Please complete the AWS setup and run the initialization again.'
                )
            );
            process.exit(0);
        }
    }

    const { environments } = await inquirer.default.prompt([
        {
            type: 'checkbox',
            name: 'environments',
            message: 'Select AWS environments to create:',
            choices: [
                { name: 'Development', value: 'development', checked: true },
                { name: 'Staging', value: 'staging' },
                { name: 'Production', value: 'production' },
            ],
            validate: (input) => {
                if (input.length === 0) return 'At least one environment must be selected';
                return true;
            },
        },
    ]);

    const { awsRegion } = await inquirer.default.prompt([
        {
            type: 'list',
            name: 'awsRegion',
            message: 'Select AWS region:',
            choices: [
                { name: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
                { name: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
                { name: 'Europe (Ireland) - eu-west-1', value: 'eu-west-1' },
                { name: 'Asia Pacific (Tokyo) - ap-northeast-1', value: 'ap-northeast-1' },
            ],
            default: 'us-east-1',
        },
    ]);

    return { environments, awsRegion };
}

/**
 * Prompts for test data
 */
async function promptForTestData() {
    console.log(chalk.blue('\n🧪 Test Data Configuration'));

    const { includeTestData } = await inquirer.default.prompt([
        {
            type: 'confirm',
            name: 'includeTestData',
            message: 'Do you want to include test data and sample configurations?',
            default: true,
        },
    ]);

    if (!includeTestData) {
        console.log(chalk.yellow('⚠️  Test data skipped. Some test features may not work.'));
        return false;
    }

    return true;
}

/**
 * Creates test data and configurations
 */
function createTestData() {
    console.log(chalk.blue('\n📝 Creating test data...'));

    // Create test attachments directory
    const testAttachmentsDir = path.join(__dirname, '../../test/attachments');
    fs.mkdirSync(testAttachmentsDir, { recursive: true });

    // Create sample test files
    const testFiles = [
        { name: 'test1.txt', content: 'This is a test attachment for Chatterbox.' },
        { name: 'test2.txt', content: 'Another test file for email testing.' },
        {
            name: 'sample.json',
            content: JSON.stringify({ test: true, message: 'Sample JSON data' }, null, 2),
        },
    ];

    testFiles.forEach((file) => {
        const filePath = path.join(testAttachmentsDir, file.name);
        fs.writeFileSync(filePath, file.content);
    });

    // Create sample state data
    const dataDir = path.join(__dirname, '../../data');
    fs.mkdirSync(dataDir, { recursive: true });

    const sampleState = {
        last_history_id: '12345',
        last_polled_email: 'test@example.com',
        total_poll_cycles: 0,
        last_sent_email_number: 0,
        send_count: 0,
    };

    fs.writeFileSync(path.join(dataDir, 'state.json'), JSON.stringify(sampleState, null, 2));

    console.log(chalk.green('✅ Test data created'));
}

/**
 * Final setup instructions
 */
function showFinalInstructions(emails, awsConfig) {
    console.log(chalk.green.bold('\n🎉 System Initialization Complete!\n'));

    console.log(chalk.blue('📋 Next Steps:'));
    console.log(chalk.white('1. Authorize your Gmail accounts:'));
    console.log(chalk.gray('   npm run mail:authorize'));

    console.log(chalk.white('\n2. Test basic functionality:'));
    console.log(chalk.gray('   npm run test:openai'));
    console.log(chalk.gray('   npm run mail:poll'));
    console.log(chalk.gray('   npm run mail:send:test'));

    if (awsConfig) {
        console.log(chalk.white('\n3. Deploy AWS infrastructure:'));
        console.log(chalk.gray('   npm run aws:setup'));
        console.log(chalk.gray('   npm run aws:migrate:secrets'));
    }

    console.log(chalk.white('\n4. Start using Chatterbox!'));

    console.log(chalk.yellow('\n⚠️  Important Notes:'));
    console.log(chalk.white('• Keep your credentials secure'));
    console.log(chalk.white('• Monitor your API usage and costs'));
    console.log(chalk.white('• Check the documentation for advanced features'));

    console.log(chalk.blue('\n📚 Documentation:'));
    console.log(chalk.gray('• System Requirements: SYSTEM_REQUIREMENTS_CONSOLIDATION.md'));
    console.log(chalk.gray('• Scripts Reference: SCRIPTS_README.md'));
    if (awsConfig) {
        console.log(chalk.gray('• AWS Setup: Cloud/AWS/README.md'));
    }
}

/**
 * Main initialization function
 */
async function initializeSystem() {
    console.log(chalk.blue.bold('\n🚀 Chatterbox System Initialization\n'));

    try {
        // Check if we're in a valid installation
        if (!fs.existsSync(CONFIG_PATH)) {
            console.error(
                chalk.red(
                    '❌ Not a valid Chatterbox installation. Please run this from a Chatterbox directory.'
                )
            );
            process.exit(1);
        }

        // Parse requirements document
        // eslint-disable-next-line no-unused-vars
        const requirementsContent = parseRequirementsDocument();

        // GCP Setup
        // eslint-disable-next-line no-unused-vars
        const gcpCredentialsPath = await promptForGcpCredentials();

        // OpenAI Setup
        // eslint-disable-next-line no-unused-vars
        const openaiApiKey = await promptForOpenAiKey();

        // Email Addresses
        const emails = await promptForEmailAddresses();

        // AWS Configuration
        const awsConfig = await promptForAwsConfig();

        // Test Data
        const includeTestData = await promptForTestData();
        if (includeTestData) {
            createTestData();
        }

        // Final instructions
        showFinalInstructions(emails, awsConfig);
    } catch (error) {
        console.error(chalk.red('\n❌ Initialization failed:'), error.message);
        process.exit(1);
    }
}

// Run the initialization
if (require.main === module) {
    initializeSystem();
}

module.exports = { initializeSystem };
