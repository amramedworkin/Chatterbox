#!/usr/bin/env node

/**
 * Chatterbox Prerequisites Check Script
 * 
 * This script validates that all necessary prerequisites are in place for local development:
 * 1. Gmail users defined in config.json
 * 2. OpenAI correctly set up in config.json and .env
 * 3. AWS correctly set up in config.json and .env
 * 4. ./google_credentials.json populated
 * 5. ./data/google_tokens.json exists and populated with tokens for the three default users
 */

const fs = require('fs');
const path = require('path');

// Colors for output
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

function printStatus(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printInfo(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log('='.repeat(message.length));
}

function printSubHeader(message) {
    console.log(`\n${colors.bright}${colors.magenta}${message}${colors.reset}`);
    console.log('-'.repeat(message.length));
}

// Check results tracking
const checkResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: []
};

function addError(check, message, solution) {
    checkResults.failed++;
    checkResults.errors.push({
        check,
        message,
        solution
    });
    printError(`${check}: ${message}`);
    if (solution) {
        printInfo(`   Solution: ${solution}`);
    }
}

function addWarning(check, message) {
    checkResults.warnings++;
    printWarning(`${check}: ${message}`);
}

function addPass(check, message) {
    checkResults.passed++;
    printStatus(`${check}: ${message}`);
}

// Load and validate config.json
function checkConfigJson() {
    printSubHeader('Checking config.json');
    
    let config;
    try {
        const configPath = path.join(process.cwd(), 'config.json');
        if (!fs.existsSync(configPath)) {
            addError('config.json', 'File does not exist', 'Create config.json in the project root with proper configuration');
            return null;
        }
        
        const configContent = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configContent);
        addPass('config.json', 'File exists and is valid JSON');
    } catch (error) {
        addError('config.json', `Invalid JSON: ${error.message}`, 'Fix the JSON syntax in config.json');
        return null;
    }
    
    return config;
}

// Check Gmail users in config.json
function checkGmailUsers(config) {
    printSubHeader('Checking Gmail Users Configuration');
    
    if (!config.app) {
        addError('Gmail Users', 'config.json missing "app" section', 'Add an "app" section to config.json with Gmail user configurations');
        return false;
    }
    
    const requiredUsers = [
        'defaultPollGmailUser',
        'defaultSendGmailUser', 
        'defaultGetGmailUser'
    ];
    
    let allUsersPresent = true;
    
    for (const userKey of requiredUsers) {
        const userEmail = config.app[userKey];
        if (!userEmail || userEmail.trim() === '') {
            addError(`Gmail Users - ${userKey}`, `Missing or empty: ${userKey}`, `Add a valid email address for ${userKey} in config.json app section`);
            allUsersPresent = false;
        } else if (!userEmail.includes('@')) {
            addError(`Gmail Users - ${userKey}`, `Invalid email format: ${userEmail}`, `Provide a valid email address for ${userKey} in config.json`);
            allUsersPresent = false;
        } else {
            addPass(`Gmail Users - ${userKey}`, `Configured: ${userEmail}`);
        }
    }
    
    return allUsersPresent;
}

// Check OpenAI configuration
function checkOpenAI(config) {
    printSubHeader('Checking OpenAI Configuration');
    
    // Check config.json OpenAI settings
    if (!config.openai) {
        addError('OpenAI Config', 'config.json missing "openai" section', 'Add an "openai" section to config.json with llmModel configuration');
        return false;
    }
    
    if (!config.openai.llmModel || config.openai.llmModel.trim() === '') {
        addError('OpenAI Config', 'Missing llmModel in config.json', 'Add llmModel (e.g., "gpt-4o") to the openai section in config.json');
        return false;
    }
    
    addPass('OpenAI Config', `LLM Model configured: ${config.openai.llmModel}`);
    
    // Check .env file for API key
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        addError('OpenAI .env', '.env file does not exist', 'Create a .env file in the project root and add: OPENAI_API_KEY=your_api_key_here');
        return false;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const openaiApiKeyMatch = envContent.match(/OPENAI_API_KEY\s*=\s*(.+)/);
    
    if (!openaiApiKeyMatch) {
        addError('OpenAI .env', 'OPENAI_API_KEY not found in .env file', 'Add OPENAI_API_KEY=your_api_key_here to the .env file');
        return false;
    }
    
    const apiKey = openaiApiKeyMatch[1].trim();
    if (!apiKey || apiKey === '' || apiKey === 'your_api_key_here') {
        addError('OpenAI .env', 'OPENAI_API_KEY is empty or placeholder', 'Replace "your_api_key_here" with your actual OpenAI API key in .env file');
        return false;
    }
    
    addPass('OpenAI .env', 'OPENAI_API_KEY is configured');
    return true;
}

// Check AWS configuration
function checkAWS(config) {
    printSubHeader('Checking AWS Configuration');
    
    // Check config.json AWS settings
    if (!config.aws) {
        addError('AWS Config', 'config.json missing "aws" section', 'Add an "aws" section to config.json with AWS configuration');
        return false;
    }
    
    if (!config.aws.region || config.aws.region.trim() === '') {
        addError('AWS Config', 'Missing AWS region in config.json', 'Add region (e.g., "us-east-1") to the aws section in config.json');
        return false;
    }
    
    addPass('AWS Config', `AWS Region configured: ${config.aws.region}`);
    
    // Check .env file for AWS profile
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        addError('AWS .env', '.env file does not exist', 'Create a .env file in the project root and add: AWS_PROFILE=your_profile_name');
        return false;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const awsProfileMatch = envContent.match(/AWS_PROFILE\s*=\s*(.+)/);
    
    if (!awsProfileMatch) {
        addError('AWS .env', 'AWS_PROFILE not found in .env file', 'Add AWS_PROFILE=your_profile_name to the .env file');
        return false;
    }
    
    const profile = awsProfileMatch[1].trim();
    if (!profile || profile === '' || profile === 'your_profile_name') {
        addError('AWS .env', 'AWS_PROFILE is empty or placeholder', 'Replace "your_profile_name" with your actual AWS profile name in .env file');
        return false;
    }
    
    addPass('AWS .env', `AWS Profile configured: ${profile}`);
    return true;
}

// Check Google credentials file
function checkGoogleCredentials() {
    printSubHeader('Checking Google Credentials');
    
    const credentialsPath = path.join(process.cwd(), 'google_credentials.json');
    
    if (!fs.existsSync(credentialsPath)) {
        addError('Google Credentials', 'google_credentials.json does not exist', 'Download Google OAuth credentials from Google Cloud Console and save as google_credentials.json in project root');
        return false;
    }
    
    try {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);
        
        // Basic validation of credentials structure
        if (!credentials.installed && !credentials.web) {
            addError('Google Credentials', 'Invalid credentials format - missing installed or web section', 'Ensure you downloaded OAuth 2.0 credentials (not service account) from Google Cloud Console');
            return false;
        }
        
        if (credentials.installed) {
            if (!credentials.installed.client_id || !credentials.installed.client_secret) {
                addError('Google Credentials', 'Missing client_id or client_secret in credentials', 'Ensure your OAuth credentials contain both client_id and client_secret');
                return false;
            }
        } else if (credentials.web) {
            if (!credentials.web.client_id || !credentials.web.client_secret) {
                addError('Google Credentials', 'Missing client_id or client_secret in credentials', 'Ensure your OAuth credentials contain both client_id and client_secret');
                return false;
            }
        }
        
        addPass('Google Credentials', 'File exists and appears to be valid OAuth credentials');
        return true;
        
    } catch (error) {
        addError('Google Credentials', `Invalid JSON in google_credentials.json: ${error.message}`, 'Fix the JSON syntax in google_credentials.json');
        return false;
    }
}

// Check Google OAuth tokens
function checkGoogleTokens(config) {
    printSubHeader('Checking Google OAuth Tokens');
    
    const tokensPath = path.join(process.cwd(), 'data', 'google_tokens.json');
    
    if (!fs.existsSync(tokensPath)) {
        addError('Google Tokens', 'data/google_tokens.json does not exist', 'Run: npm run mail:authorize to authenticate Gmail users and generate tokens');
        return false;
    }
    
    try {
        const tokensContent = fs.readFileSync(tokensPath, 'utf8');
        const tokens = JSON.parse(tokensContent);
        
        if (!tokens || typeof tokens !== 'object') {
            addError('Google Tokens', 'Invalid tokens format - not an object', 'Run: npm run mail:authorize to regenerate valid tokens');
            return false;
        }
        
        // Get required users from config
        const requiredUsers = [
            config.app.defaultPollGmailUser,
            config.app.defaultSendGmailUser,
            config.app.defaultGetGmailUser
        ].filter((user, index, arr) => arr.indexOf(user) === index); // Remove duplicates
        
        let allUsersHaveTokens = true;
        
        for (const userEmail of requiredUsers) {
            if (!tokens[userEmail]) {
                addError('Google Tokens', `Missing tokens for user: ${userEmail}`, `Run: npm run mail:authorize to authenticate user ${userEmail}`);
                allUsersHaveTokens = false;
            } else {
                const userTokens = tokens[userEmail];
                if (!userTokens.access_token || !userTokens.refresh_token) {
                    addError('Google Tokens', `Incomplete tokens for user: ${userEmail}`, `Run: npm run mail:authorize to re-authenticate user ${userEmail}`);
                    allUsersHaveTokens = false;
                } else {
                    addPass('Google Tokens', `Valid tokens found for: ${userEmail}`);
                }
            }
        }
        
        return allUsersHaveTokens;
        
    } catch (error) {
        addError('Google Tokens', `Invalid JSON in google_tokens.json: ${error.message}`, 'Run: npm run mail:authorize to regenerate valid tokens');
        return false;
    }
}

// Main function
function main() {
    printHeader('Chatterbox Prerequisites Check');
    
    console.log('This script validates that all necessary prerequisites are in place for local development.\n');
    
    // Check config.json first
    const config = checkConfigJson();
    if (!config) {
        printHeader('Prerequisites Check Failed');
        console.log(`\n${colors.red}❌ ${checkResults.failed} checks failed${colors.reset}`);
        console.log(`${colors.yellow}⚠️  ${checkResults.warnings} warnings${colors.reset}`);
        console.log(`${colors.green}✅ ${checkResults.passed} checks passed${colors.reset}\n`);
        
        console.log('Please fix the errors above before proceeding with prepare.\n');
        process.exit(1);
    }
    
    // Run all checks
    const gmailUsersOk = checkGmailUsers(config);
    const openaiOk = checkOpenAI(config);
    const awsOk = checkAWS(config);
    const credentialsOk = checkGoogleCredentials();
    const tokensOk = checkGoogleTokens(config);
    
    // Summary
    printHeader('Prerequisites Check Summary');
    
    console.log(`\n${colors.green}✅ ${checkResults.passed} checks passed${colors.reset}`);
    console.log(`${colors.yellow}⚠️  ${checkResults.warnings} warnings${colors.reset}`);
    console.log(`${colors.red}❌ ${checkResults.failed} checks failed${colors.reset}\n`);
    
    if (checkResults.failed > 0) {
        console.log(`${colors.red}❌ Prerequisites check failed. Please fix the errors above before proceeding.${colors.reset}\n`);
        
        console.log('Common solutions:');
        console.log('1. For missing Gmail users: Update config.json app section with valid email addresses');
        console.log('2. For missing OpenAI setup: Create .env file with OPENAI_API_KEY=your_key');
        console.log('3. For missing AWS setup: Create .env file with AWS_PROFILE=your_profile');
        console.log('4. For missing Google credentials: Download OAuth credentials from Google Cloud Console');
        console.log('5. For missing tokens: Run: npm run mail:authorize\n');
        
        process.exit(1);
    } else {
        console.log(`${colors.green}✅ All prerequisites are satisfied! You can now run: npm run aws:init:prepare${colors.reset}\n`);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    checkConfigJson,
    checkGmailUsers,
    checkOpenAI,
    checkAWS,
    checkGoogleCredentials,
    checkGoogleTokens,
    main
}; 