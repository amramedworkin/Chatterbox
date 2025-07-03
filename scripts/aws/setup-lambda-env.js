#!/usr/bin/env node

const { SSMClient, PutParameterCommand, GetParameterCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');
const path = require('path');

const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function setupLambdaEnvironment() {
    try {
        console.log('🔧 Setting up Lambda environment variables...');

        // Read Gmail credentials from local config
        const configPath = path.join(__dirname, '../../config.json');
        if (!fs.existsSync(configPath)) {
            console.error('❌ config.json not found. Please run the setup first.');
            process.exit(1);
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const environment = process.env.ENVIRONMENT || 'development';
        const prefix = `/chatterbox/${environment}`;

        // Check for Gmail credentials
        const credentialsPath = path.join(__dirname, '../../google_credentials.json');
        let gmailCredentials = null;

        if (fs.existsSync(credentialsPath)) {
            try {
                const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
                gmailCredentials = {
                    clientId: credentials.installed?.client_id || credentials.web?.client_id,
                    clientSecret: credentials.installed?.client_secret || credentials.web?.client_secret,
                    redirectUri: config.google?.redirectUri || 'http://localhost:3000'
                };
            } catch (error) {
                console.error('❌ Error reading google_credentials.json:', error.message);
            }
        }

        if (!gmailCredentials?.clientId || !gmailCredentials?.clientSecret) {
            console.error('❌ Gmail OAuth2 credentials not found!');
            console.log('');
            console.log('To set up Gmail credentials:');
            console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/');
            console.log('2. Create a project or select existing one');
            console.log('3. Enable Gmail API');
            console.log('4. Create OAuth2 credentials (Desktop app or Web app)');
            console.log('5. Download credentials as google_credentials.json');
            console.log('6. Place google_credentials.json in the project root');
            console.log('');
            console.log('Or run the Gmail authorization first:');
            console.log('  npm run mail:authorize');
            console.log('');
            console.log('For now, using placeholder values. Update them later in Parameter Store.');
            
            // Use placeholder values for now
            gmailCredentials = {
                clientId: 'YOUR_GMAIL_CLIENT_ID',
                clientSecret: 'YOUR_GMAIL_CLIENT_SECRET',
                redirectUri: config.google?.redirectUri || 'http://localhost:3000'
            };
        }

        // Store credentials in Parameter Store
        const parameters = [
            {
                name: `${prefix}/gmail/client-id`,
                value: gmailCredentials.clientId,
                type: 'SecureString',
                description: 'Gmail OAuth2 Client ID for Lambda function'
            },
            {
                name: `${prefix}/gmail/client-secret`,
                value: gmailCredentials.clientSecret,
                type: 'SecureString',
                description: 'Gmail OAuth2 Client Secret for Lambda function'
            },
            {
                name: `${prefix}/gmail/redirect-uri`,
                value: gmailCredentials.redirectUri,
                type: 'String',
                description: 'Gmail OAuth2 Redirect URI for Lambda function'
            }
        ];

        console.log('📝 Storing parameters in Parameter Store...');
        
        for (const param of parameters) {
            try {
                const command = new PutParameterCommand({
                    Name: param.name,
                    Value: param.value,
                    Type: param.type,
                    Description: param.description,
                    Overwrite: true
                });

                await ssm.send(command);
                console.log(`✅ Stored: ${param.name}`);
            } catch (error) {
                if (error.name === 'ParameterAlreadyExists') {
                    console.log(`⚠️  Parameter already exists: ${param.name}`);
                } else {
                    console.error(`❌ Error storing ${param.name}:`, error.message);
                }
            }
        }

        if (gmailCredentials.clientId === 'YOUR_GMAIL_CLIENT_ID') {
            console.log('\n⚠️  WARNING: Using placeholder Gmail credentials!');
            console.log('Please update the parameters in AWS Parameter Store with real values:');
            console.log(`  aws ssm put-parameter --name "${prefix}/gmail/client-id" --value "YOUR_REAL_CLIENT_ID" --type "SecureString" --overwrite`);
            console.log(`  aws ssm put-parameter --name "${prefix}/gmail/client-secret" --value "YOUR_REAL_CLIENT_SECRET" --type "SecureString" --overwrite`);
        }

        console.log('\n🎉 Lambda environment setup completed!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Update Lambda function to read from Parameter Store');
        console.log('2. Deploy the updated Lambda function');
        console.log('3. Test with: npm run aws:test:lambda <gmail-id>');

    } catch (error) {
        console.error('❌ Error setting up Lambda environment:', error);
        process.exit(1);
    }
}

// Check if running with proper AWS credentials
async function checkAWSCredentials() {
    try {
        const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
        const sts = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' });
        
        const command = new GetCallerIdentityCommand({});
        const response = await sts.send(command);
        
        console.log(`🔐 Using AWS Account: ${response.Account}`);
        console.log(`👤 User: ${response.Arn}`);
        
        return true;
    } catch (error) {
        console.error('❌ AWS credentials not configured or invalid');
        console.error('Please run: aws configure --profile cliadmin');
        return false;
    }
}

async function main() {
    const hasCredentials = await checkAWSCredentials();
    if (!hasCredentials) {
        process.exit(1);
    }

    await setupLambdaEnvironment();
}

main(); 