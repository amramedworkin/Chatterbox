#!/usr/bin/env node

require('dotenv/config');
const chalk = require('chalk');
const config = require('../dist/src/loadConfig.js').default;

// ASCII art banner
const BANNER = `
${chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗')}
${chalk.cyan.bold('║')}  ${chalk.white.bold('🔧 CHATTERBOX CONFIGURATION DUMP')}  ${chalk.cyan.bold('║')}
${chalk.cyan.bold('║')}  ${chalk.gray('All configuration variables and settings')}  ${chalk.cyan.bold('║')}
${chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝')}
`;

// Helper function to mask sensitive data
function maskSensitiveData(value, type = 'default') {
    if (!value || typeof value !== 'string') return value;
    
    switch (type) {
        case 'api_key':
            return value.length > 8 ? `${value.substring(0, 8)}${'*'.repeat(Math.min(value.length - 8, 20))}` : '***';
        case 'token':
            return value.length > 6 ? `${value.substring(0, 6)}${'*'.repeat(Math.min(value.length - 6, 15))}` : '***';
        case 'email':
            const [local, domain] = value.split('@');
            if (domain) {
                return `${local.substring(0, 2)}***@${domain}`;
            }
            return value;
        default:
            return value;
    }
}

// Helper function to format value with appropriate color
function formatValue(value, type = 'default') {
    if (value === null || value === undefined) {
        return chalk.gray('(not set)');
    }
    
    if (typeof value === 'boolean') {
        return value ? chalk.green('true') : chalk.red('false');
    }
    
    if (typeof value === 'number') {
        return chalk.yellow(value.toString());
    }
    
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return chalk.gray('(empty array)');
        }
        return chalk.cyan(`[${value.length} items]`) + ' ' + value.map(v => formatValue(v, type)).join(', ');
    }
    
    if (typeof value === 'object') {
        return chalk.cyan('(object)');
    }
    
    // String values
    const maskedValue = maskSensitiveData(value, type);
    switch (type) {
        case 'api_key':
            return chalk.red(maskedValue);
        case 'token':
            return chalk.magenta(maskedValue);
        case 'email':
            return chalk.blue(maskedValue);
        case 'url':
            return chalk.cyan(maskedValue);
        case 'path':
            return chalk.green(maskedValue);
        case 'aws':
            return chalk.blue(maskedValue);
        case 'google':
            return chalk.green(maskedValue);
        default:
            return chalk.white(maskedValue);
    }
}

// Helper function to print a section
function printSection(title, data, keyTypeMap = {}) {
    console.log(`\n${chalk.yellow.bold('📋 ' + title.toUpperCase())}`);
    console.log(chalk.gray('─'.repeat(80)));
    
    const maxKeyLength = Math.max(...Object.keys(data).map(key => key.length));
    
    Object.entries(data).forEach(([key, value]) => {
        const paddedKey = key.padEnd(maxKeyLength + 2);
        const type = keyTypeMap[key] || 'default';
        const formattedValue = formatValue(value, type);
        
        console.log(`${chalk.white.bold(paddedKey)} ${chalk.gray('=')} ${formattedValue}`);
    });
}

// Main function
function dumpConfig() {
    console.log(BANNER);
    
    // Environment info
    console.log(`\n${chalk.cyan.bold('🌍 ENVIRONMENT INFO')}`);
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`${chalk.white.bold('Node Version:')} ${chalk.yellow(process.version)}`);
    console.log(`${chalk.white.bold('Platform:')} ${chalk.yellow(process.platform)}`);
    console.log(`${chalk.white.bold('Architecture:')} ${chalk.yellow(process.arch)}`);
    console.log(`${chalk.white.bold('Working Directory:')} ${chalk.green(process.cwd())}`);
    
    // OpenAI Configuration
    printSection('OpenAI Configuration', config.openai, {
        apiKey: 'api_key',
        organizationId: 'api_key'
    });
    
    // Google Configuration
    printSection('Google Configuration', config.google, {
        credentialsPath: 'path',
        pollTokenPath: 'path',
        lastHistoryIdPath: 'path',
        lastPolledEmailPath: 'path',
        totalPollCyclesPath: 'path',
        redirectUri: 'url'
    });
    
    // App Configuration
    printSection('Application Configuration', config.app, {
        defaultPollGmailUser: 'email',
        defaultSendGmailUser: 'email',
        defaultGetGmailUser: 'email',
        interactionsBaseFolder: 'path'
    });
    
    // Polling Configuration
    printSection('Polling Configuration', config.polling);
    
    // Flags Configuration
    printSection('Flags Configuration', config.flags);
    
    // Send Test Configuration
    printSection('Send Test Configuration', config.sendTest, {
        defaultRecipient: 'email',
        testAttachmentsFolder: 'path',
        tokenPath: 'path',
        lastSentEmailNumberPath: 'path',
        senderEmailPath: 'path',
        recipientEmailPath: 'path',
        sendCountPath: 'path'
    });
    
    // Test OpenAI Configuration
    printSection('Test OpenAI Configuration', config.testOpenAi);
    
    // AWS Configuration
    const awsConfig = {
        region: config.aws.region,
        profile: config.aws.profile,
        environment: config.aws.environment,
        'vpc.id': config.aws.vpc.id,
        'vpc.cidrBlock': config.aws.vpc.cidrBlock,
        'vpc.availabilityZones': config.aws.vpc.availabilityZones,
        'dynamodb.stateTableName': config.aws.dynamodb.stateTableName,
        'dynamodb.endpoint': config.aws.dynamodb.endpoint,
        's3.bucketName': config.aws.s3.bucketName,
        's3.backupBucketName': config.aws.s3.backupBucketName,
        's3.endpoint': config.aws.s3.endpoint,
        'secretsManager.gmailTokensSecretName': config.aws.secretsManager.gmailTokensSecretName,
        'secretsManager.endpoint': config.aws.secretsManager.endpoint,
        'parameterStore.prefix': config.aws.parameterStore.prefix,
        'parameterStore.endpoint': config.aws.parameterStore.endpoint,
        'iam.roleArn': config.aws.iam.roleArn,
        'iam.instanceProfileArn': config.aws.iam.instanceProfileArn,
        'cloudwatch.logGroupName': config.aws.cloudwatch.logGroupName,
        'cloudwatch.endpoint': config.aws.cloudwatch.endpoint
    };
    
    printSection('AWS Configuration', awsConfig, {
        region: 'aws',
        profile: 'aws',
        environment: 'aws',
        'vpc.id': 'aws',
        'vpc.cidrBlock': 'aws',
        'vpc.availabilityZones': 'aws',
        'dynamodb.stateTableName': 'aws',
        'dynamodb.endpoint': 'aws',
        's3.bucketName': 'aws',
        's3.backupBucketName': 'aws',
        's3.endpoint': 'aws',
        'secretsManager.gmailTokensSecretName': 'aws',
        'secretsManager.endpoint': 'aws',
        'parameterStore.prefix': 'aws',
        'parameterStore.endpoint': 'aws',
        'iam.roleArn': 'aws',
        'iam.instanceProfileArn': 'aws',
        'cloudwatch.logGroupName': 'aws',
        'cloudwatch.endpoint': 'aws'
    });
    
    // Environment Variables Check
    console.log(`\n${chalk.cyan.bold('🔍 ENVIRONMENT VARIABLES CHECK')}`);
    console.log(chalk.gray('─'.repeat(80)));
    
    const envVars = [
        'OPENAI_API_KEY',
        'OPENAI_LLM_MODEL',
        'OPENAI_ORGANIZATION_ID',
        'OPENAI_MAX_RESPONSE_TOKENS',
        'AWS_PROFILE',
        'AWS_REGION',
        'GOOGLE_CREDENTIALS_PATH',
        'DEFAULT_POLL_GMAIL_USER',
        'DEFAULT_SEND_GMAIL_USER'
    ];
    
    envVars.forEach(envVar => {
        const value = process.env[envVar];
        const status = value ? chalk.green('✓') : chalk.red('✗');
        const displayValue = value ? maskSensitiveData(value, envVar.includes('API_KEY') ? 'api_key' : 'default') : chalk.gray('(not set)');
        console.log(`${status} ${chalk.white.bold(envVar.padEnd(30))} ${displayValue}`);
    });
    
    // Summary
    console.log(`\n${chalk.cyan.bold('📊 CONFIGURATION SUMMARY')}`);
    console.log(chalk.gray('─'.repeat(80)));
    
    const hasOpenAIKey = config.openai.apiKey && config.openai.apiKey !== 'your_openai_api_key_here';
    const hasAWSProfile = config.aws.profile;
    const hasGoogleCredentials = config.google.credentialsPath;
    
    console.log(`${hasOpenAIKey ? chalk.green('✓') : chalk.red('✗')} ${chalk.white('OpenAI API Key:')} ${hasOpenAIKey ? chalk.green('Configured') : chalk.red('Not configured')}`);
    console.log(`${hasAWSProfile ? chalk.green('✓') : chalk.red('✗')} ${chalk.white('AWS Profile:')} ${hasAWSProfile ? chalk.green('Configured') : chalk.red('Not configured')}`);
    console.log(`${hasGoogleCredentials ? chalk.green('✓') : chalk.red('✗')} ${chalk.white('Google Credentials:')} ${hasGoogleCredentials ? chalk.green('Configured') : chalk.red('Not configured')}`);
    
    console.log(`\n${chalk.gray('Configuration dump completed successfully!')}`);
}

// Run if called directly
if (require.main === module) {
    try {
        dumpConfig();
    } catch (error) {
        console.error(chalk.red('Error dumping configuration:'), error.message);
        process.exit(1);
    }
}

module.exports = { dumpConfig }; 