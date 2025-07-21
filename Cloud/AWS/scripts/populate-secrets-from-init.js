#!/usr/bin/env node

/**
 * Script to populate AWS Secrets Manager and Parameter Store
 * for the Chatterbox system using data from init folder
 */

const { SecretsManagerClient, CreateSecretCommand, UpdateSecretCommand, DescribeSecretCommand, TagResourceCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configure AWS
const config = { region: 'us-east-1' };
const secretsManager = new SecretsManagerClient(config);
const ssm = new SSMClient(config);

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
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

let PROJECT_ROOT;
try {
  PROJECT_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch (e) {
  PROJECT_ROOT = process.cwd();
}

function findInitFolder(folderName = null) {
    const initPath = path.join(PROJECT_ROOT, 'data', 'init');
    
    if (!fs.existsSync(initPath)) {
        throw new Error('Init folder not found. Please run aws:init:prepare first.');
    }
    
    const folders = fs.readdirSync(initPath)
        .filter(item => {
            const itemPath = path.join(initPath, item);
            return fs.statSync(itemPath).isDirectory();
        })
        .sort();
    
    if (folders.length === 0) {
        throw new Error('No folders found in init directory. Please run aws:init:prepare first.');
    }
    
    let targetFolder;
    
    if (folderName) {
        // Use specified folder
        if (!folders.includes(folderName)) {
            throw new Error(`Init folder '${folderName}' not found. Available folders: ${folders.join(', ')}`);
        }
        targetFolder = folderName;
        printInfo(`Using specified init folder: ${folderName}`);
    } else {
        // Use most recent folder
        targetFolder = folders[folders.length - 1];
        printInfo(`Using most recent init folder: ${targetFolder}`);
    }
    
    const folderPath = path.join(initPath, targetFolder);
    
    // Read and display description if available
    const descriptionPath = path.join(folderPath, 'description.txt');
    if (fs.existsSync(descriptionPath)) {
        const description = fs.readFileSync(descriptionPath, 'utf8');
        printInfo(`Description: ${description}`);
    }
    
    return folderPath;
}

function loadFileFromInit(initPath, fileName) {
    const filePath = path.join(initPath, fileName);
    
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        printStatus(`Loaded ${fileName} from init folder`);
        return content;
    } else {
        printWarning(`File not found in init folder: ${fileName}`);
        return null;
    }
}

function loadEnvFromInit(initPath, envVarName) {
    const envFileName = `${envVarName.toLowerCase()}.env`;
    const envFilePath = path.join(initPath, envFileName);
    
    if (fs.existsSync(envFilePath)) {
        const content = fs.readFileSync(envFilePath, 'utf8');
        const match = content.match(new RegExp(`^${envVarName}=(.+)$`, 'm'));
        if (match) {
            printStatus(`Loaded ${envVarName} from init folder`);
            return match[1];
        }
    }
    
    printWarning(`Environment variable not found in init folder: ${envVarName}`);
    return null;
}

function loadEnvFileFromInit(initPath, fileName) {
    const filePath = path.join(initPath, fileName);
    
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        printStatus(`Loaded ${fileName} from init folder`);
        return content;
    } else {
        printWarning(`File not found in init folder: ${fileName}`);
        return null;
    }
}

function extractEnvVarFromContent(content, envVarName) {
    const match = content.match(new RegExp(`^${envVarName}=(.+)$`, 'm'));
    if (match) {
        return match[1].trim();
    }
    return null;
}

async function populateSecrets(initPath) {
    console.log('🔐 Populating AWS Secrets Manager...');
  
    try {
        // 1. Google OAuth Credentials
        const googleCredentialsContent = loadFileFromInit(initPath, 'google_credentials.json');
        if (googleCredentialsContent) {
            const googleCredentials = JSON.parse(googleCredentialsContent);
            
            await createOrUpdateSecret(
                `${ENVIRONMENT}-chatterbox-google-credentials`,
                'Google OAuth credentials for Chatterbox Gmail integration',
                JSON.stringify(googleCredentials),
                [
                    { Key: 'Product', Value: 'Chatterbox' },
                    { Key: 'Subsystem', Value: 'mail' },
                    { Key: 'Environment', Value: ENVIRONMENT },
                    { Key: 'ManagedBy', Value: 'Terraform' }
                ]
            );
            
            printStatus('Google credentials stored in Secrets Manager');
        } else {
            printWarning('Google credentials not found in init folder');
        }
        
        // 2. Gmail Tokens
        const gmailTokensContent = loadFileFromInit(initPath, 'google_tokens.json');
        if (gmailTokensContent) {
            const gmailTokens = JSON.parse(gmailTokensContent);
            
            await createOrUpdateSecret(
                `${ENVIRONMENT}-chatterbox-gmail-tokens`,
                'Gmail OAuth tokens for Chatterbox',
                JSON.stringify(gmailTokens),
                [
                    { Key: 'Product', Value: 'Chatterbox' },
                    { Key: 'Subsystem', Value: 'mail' },
                    { Key: 'Environment', Value: ENVIRONMENT },
                    { Key: 'ManagedBy', Value: 'Terraform' }
                ]
            );
            
            printStatus('Gmail tokens stored in Secrets Manager');
        } else {
            // Create empty tokens if not found
            const initialTokens = {
                access_token: '',
                refresh_token: '',
                scope: 'https://www.googleapis.com/auth/gmail.readonly',
                token_type: 'Bearer',
                expiry_date: null
            };
            
            await createOrUpdateSecret(
                `${ENVIRONMENT}-chatterbox-gmail-tokens`,
                'Gmail OAuth tokens for Chatterbox',
                JSON.stringify(initialTokens),
                [
                    { Key: 'Product', Value: 'Chatterbox' },
                    { Key: 'Subsystem', Value: 'mail' },
                    { Key: 'Environment', Value: ENVIRONMENT },
                    { Key: 'ManagedBy', Value: 'Terraform' }
                ]
            );
            
            printStatus('Gmail tokens secret created (empty, will be populated by OAuth)');
        }
        
        // 3. OpenAI API Key
        const envContent = loadEnvFileFromInit(initPath, '.env');
        if (envContent) {
            const openaiApiKey = extractEnvVarFromContent(envContent, 'OPENAI_API_KEY');
            if (openaiApiKey) {
                await createOrUpdateSecret(
                    'chatterbox/openai-api-key',
                    'OpenAI API key for Chatterbox application',
                    openaiApiKey,
                    [
                        { Key: 'Product', Value: 'Chatterbox' },
                        { Key: 'Subsystem', Value: 'ai' },
                        { Key: 'Provider', Value: 'openai' },
                        { Key: 'Environment', Value: ENVIRONMENT },
                        { Key: 'ManagedBy', Value: 'Terraform' }
                    ]
                );
                
                printStatus('OpenAI API key stored in Secrets Manager');
            } else {
                printWarning('OpenAI API key not found in .env file');
            }
        } else {
            printWarning('.env file not found in init folder');
        }
        
    } catch (error) {
        printError(`Error creating secrets: ${error.message}`);
        throw error;
    }
}

async function createOrUpdateSecret(secretName, description, secretString, tags) {
    try {
        // Try to describe the secret to see if it exists
        try {
            await secretsManager.send(new DescribeSecretCommand({ SecretId: secretName }));
            
            // Secret exists, update it
            printInfo(`Updating existing secret: ${secretName}`);
            
            const updateResponse = await secretsManager.send(new UpdateSecretCommand({
                SecretId: secretName,
                Description: description,
                SecretString: secretString
            }));
            
            // Update tags
            await secretsManager.send(new TagResourceCommand({
                SecretId: secretName,
                Tags: tags
            }));
            
            printStatus(`Secret ${secretName} updated successfully`);
            
        } catch (describeError) {
            if (describeError.name === 'ResourceNotFoundException') {
                // Secret doesn't exist, create it
                printInfo(`Creating new secret: ${secretName}`);
                
                const createResponse = await secretsManager.send(new CreateSecretCommand({
                    Name: secretName,
                    Description: description,
                    SecretString: secretString,
                    Tags: tags
                }));
                
                printStatus(`Secret ${secretName} created successfully`);
            } else {
                throw describeError;
            }
        }
        
    } catch (error) {
        printError(`Error managing secret ${secretName}: ${error.message}`);
        throw error;
    }
}

async function populateParameters(initPath) {
    console.log('📝 Populating AWS Parameter Store...');
  
    try {
        // Load configuration from init folder
        const configContent = loadFileFromInit(initPath, 'config.json');
        let config = {};
        
        if (configContent) {
            try {
                config = JSON.parse(configContent);
                printStatus('Loaded configuration from init folder');
            } catch (error) {
                printWarning('Failed to parse config.json, using defaults');
            }
        }
        
        // Load OpenAI API key from .env file
        let openaiApiKey = '';
        const envContent = loadEnvFileFromInit(initPath, '.env');
        if (envContent) {
            openaiApiKey = extractEnvVarFromContent(envContent, 'OPENAI_API_KEY') || '';
        }
        
        const parameters = [
            {
                Name: `/chatterbox/${ENVIRONMENT}/gmail-tokens-secret-name`,
                Value: `${ENVIRONMENT}-chatterbox-gmail-tokens`,
                Type: 'String',
                Description: 'Name of the Secrets Manager secret containing Gmail tokens'
            },
            {
                Name: `/chatterbox/${ENVIRONMENT}/google-credentials-secret-name`,
                Value: `${ENVIRONMENT}-chatterbox-google-credentials`,
                Type: 'String',
                Description: 'Name of the Secrets Manager secret containing Google credentials'
            },
            {
                Name: `/chatterbox/${ENVIRONMENT}/default-gmail-user`,
                Value: config.app?.defaultPollGmailUser || 'awsamram@gmail.com',
                Type: 'String',
                Description: 'Default Gmail user for the system'
            },
            {
                Name: `/chatterbox/${ENVIRONMENT}/email-storage-bucket`,
                Value: `${ENVIRONMENT}-chatterbox-email-archive`,
                Type: 'String',
                Description: 'S3 bucket name for email storage'
            },
            {
                Name: `/chatterbox/${ENVIRONMENT}/polling-interval-minutes`,
                Value: (config.polling?.defaultIntervalMinutes || 5).toString(),
                Type: 'String',
                Description: 'Gmail polling interval in minutes'
            },
            {
                Name: `/chatterbox/${ENVIRONMENT}/max-emails-per-poll`,
                Value: '100',
                Type: 'String',
                Description: 'Maximum number of emails to process per polling cycle'
            },
            {
                Name: `/chatterbox/${ENVIRONMENT}/openai-api-key`,
                Value: openaiApiKey || '',
                Type: 'SecureString',
                Description: 'OpenAI API key for LLM interactions'
            },
            {
                Name: `/chatterbox/${ENVIRONMENT}/openai-model`,
                Value: config.openai?.llmModel || 'gpt-4o',
                Type: 'String',
                Description: 'OpenAI model to use for LLM interactions'
            },
            // New parameters for email processing and response generation
            {
                Name: '/chatterbox/llm/default-model',
                Value: config.openai?.llmModel || 'gpt-4o',
                Type: 'String',
                Description: 'Default LLM model for email processing and response generation'
            },
            {
                Name: '/chatterbox/billing/free-tier-limit',
                Value: '10',
                Type: 'String',
                Description: 'Free tier limit for daily queries'
            },
            {
                Name: '/chatterbox/billing/infrastructure-cost',
                Value: '0.01',
                Type: 'String',
                Description: 'Infrastructure cost per query in USD'
            },
            {
                Name: '/chatterbox/billing/licensing-cost',
                Value: '0.005',
                Type: 'String',
                Description: 'Licensing cost per query in USD'
            },
            {
                Name: '/chatterbox/email/rejection-rate-limit',
                Value: '300',
                Type: 'String',
                Description: 'Rate limit for email rejections per hour'
            }
        ];
        
        for (const param of parameters) {
            try {
                // Determine tags based on parameter type
                let tags = [
                    { Key: 'Product', Value: 'Chatterbox' },
                    { Key: 'Environment', Value: ENVIRONMENT },
                    { Key: 'ManagedBy', Value: 'Terraform' }
                ];
                
                // Add subsystem tags based on parameter content
                if (param.Name.includes('gmail') || param.Name.includes('email')) {
                    tags.push({ Key: 'Subsystem', Value: 'mail' });
                }
                
                if (param.Name.includes('openai') || param.Name.includes('llm')) {
                    tags.push({ Key: 'Subsystem', Value: 'ai' });
                    tags.push({ Key: 'Provider', Value: 'openai' });
                }
                
                if (param.Name.includes('billing')) {
                    tags.push({ Key: 'Subsystem', Value: 'billing' });
                }
                
                await ssm.send(new PutParameterCommand({
                    Name: param.Name,
                    Value: param.Value,
                    Type: param.Type,
                    Description: param.Description,
                    Overwrite: true
                }));
                
                printStatus(`Parameter created: ${param.Name}`);
            } catch (error) {
                if (error.name === 'ParameterAlreadyExists') {
                    printInfo(`Parameter already exists: ${param.Name}`);
                } else {
                    printError(`Error creating parameter ${param.Name}: ${error.message}`);
                }
            }
        }
        
    } catch (error) {
        printError(`Error populating parameters: ${error.message}`);
        throw error;
    }
}

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const folderName = args[0] || null; // First argument is the folder name
    
    console.log(`🚀 Populating AWS resources for environment: ${ENVIRONMENT}`);
    if (folderName) {
        console.log(`📁 Using init folder: ${folderName}`);
    } else {
        console.log(`📁 Using most recent init folder`);
    }
    console.log('='.repeat(60));
    
    try {
        // Find the specified or latest init folder
        const initPath = findInitFolder(folderName);
        
        // Load and display migration manifest
        const manifestPath = path.join(initPath, 'migration-manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            console.log('\n📋 Migration Manifest:');
            console.log(`Timestamp: ${manifest.timestamp}`);
            console.log(`Total items: ${manifest.summary.total}`);
            console.log(`Successful: ${manifest.summary.successful}`);
            console.log(`Failed: ${manifest.summary.failed}`);
        }
        
        await populateSecrets(initPath);
        console.log('');
        await populateParameters(initPath);
        
        console.log('');
        printStatus('Successfully populated AWS Secrets Manager and Parameter Store!');
        console.log('');
        console.log('📋 Next steps:');
        console.log('1. Run the OAuth flow to populate Gmail tokens (if needed)');
        console.log('2. Deploy the Lambda functions');
        console.log('3. Test the Gmail polling functionality');
        
    } catch (error) {
        printError(`Failed to populate AWS resources: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { populateSecrets, populateParameters }; 