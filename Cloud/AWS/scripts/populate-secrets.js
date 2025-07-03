#!/usr/bin/env node

/**
 * Script to populate AWS Secrets Manager and Parameter Store
 * for the Chatterbox system without VPC
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const secretsManager = new AWS.SecretsManager();
const ssm = new AWS.SSM();

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

async function populateSecrets() {
  console.log('🔐 Populating AWS Secrets Manager...');
  
  try {
    // 1. Google OAuth Credentials
    const googleCredentialsPath = path.join(__dirname, '../../config/google_credentials.json');
    if (fs.existsSync(googleCredentialsPath)) {
      const googleCredentials = JSON.parse(fs.readFileSync(googleCredentialsPath, 'utf8'));
      
      await secretsManager.createSecret({
        Name: `${ENVIRONMENT}-chatterbox-google-credentials`,
        Description: 'Google OAuth credentials for Chatterbox Gmail integration',
        SecretString: JSON.stringify(googleCredentials),
        Tags: [
          { Key: 'Environment', Value: ENVIRONMENT },
          { Key: 'Project', Value: 'Chatterbox' }
        ]
      }).promise();
      
      console.log('✅ Google credentials stored in Secrets Manager');
    } else {
      console.log('⚠️  Google credentials file not found. Please create config/google_credentials.json');
    }
    
    // 2. Gmail Tokens (initially empty, will be populated by OAuth flow)
    const initialTokens = {
      access_token: '',
      refresh_token: '',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      token_type: 'Bearer',
      expiry_date: null
    };
    
    await secretsManager.createSecret({
      Name: `${ENVIRONMENT}-chatterbox-gmail-tokens`,
      Description: 'Gmail OAuth tokens for Chatterbox',
      SecretString: JSON.stringify(initialTokens),
      Tags: [
        { Key: 'Environment', Value: ENVIRONMENT },
        { Key: 'Project', Value: 'Chatterbox' }
      ]
    }).promise();
    
    console.log('✅ Gmail tokens secret created (empty, will be populated by OAuth)');
    
  } catch (error) {
    if (error.code === 'ResourceExistsException') {
      console.log('ℹ️  Secrets already exist, skipping creation');
    } else {
      console.error('❌ Error creating secrets:', error.message);
      throw error;
    }
  }
}

async function populateParameters() {
  console.log('📝 Populating AWS Parameter Store...');
  
  try {
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
        Value: 'awsamram@gmail.com',
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
        Value: '5',
        Type: 'String',
        Description: 'Gmail polling interval in minutes'
      },
      {
        Name: `/chatterbox/${ENVIRONMENT}/max-emails-per-poll`,
        Value: '100',
        Type: 'String',
        Description: 'Maximum number of emails to process per polling cycle'
      }
    ];
    
    for (const param of parameters) {
      try {
        await ssm.putParameter({
          Name: param.Name,
          Value: param.Value,
          Type: param.Type,
          Description: param.Description,
          Overwrite: true
        }).promise();
        
        console.log(`✅ Parameter created: ${param.Name}`);
      } catch (error) {
        if (error.code === 'ParameterAlreadyExists') {
          console.log(`ℹ️  Parameter already exists: ${param.Name}`);
        } else {
          console.error(`❌ Error creating parameter ${param.Name}:`, error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error populating parameters:', error.message);
    throw error;
  }
}

async function main() {
  console.log(`🚀 Populating AWS resources for environment: ${ENVIRONMENT}`);
  console.log('=' .repeat(60));
  
  try {
    await populateSecrets();
    console.log('');
    await populateParameters();
    
    console.log('');
    console.log('🎉 Successfully populated AWS Secrets Manager and Parameter Store!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Run the OAuth flow to populate Gmail tokens');
    console.log('2. Deploy the Lambda functions');
    console.log('3. Test the Gmail polling functionality');
    
  } catch (error) {
    console.error('💥 Failed to populate AWS resources:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { populateSecrets, populateParameters }; 