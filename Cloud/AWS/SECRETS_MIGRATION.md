# AWS Secrets Manager Migration Guide

This guide explains how to migrate your existing tokens and credentials from local files to AWS Secrets Manager, making the process repeatable and secure.

## Overview

AWS Secrets Manager provides a secure way to store and manage your application's secrets, including:
- **Gmail OAuth tokens** - For Gmail API access
- **OpenAI API keys** - For OpenAI API access  
- **Google service account credentials** - For Google Cloud services

## Benefits of Using AWS Secrets Manager

- **Security**: Encrypted at rest and in transit
- **Access Control**: IAM-based permissions
- **Rotation**: Automated secret rotation
- **Audit Trail**: Complete access logging
- **Centralized Management**: Single source of truth
- **No Local Files**: Eliminates security risks of local credential files

## Prerequisites

1. **AWS Infrastructure Deployed**: Run `npm run aws:deploy` first
2. **AWS CLI Configured**: With `cliadmin` profile
3. **Local Tokens Available**: Your existing token files

## Migration Process

### Step 1: Check Current Secrets Status

```bash
# Check if secrets already exist in AWS
npm run aws:test:secrets

# Check rotation status
npm run aws:secrets:status
```

### Step 2: Migrate All Secrets at Once

```bash
# Migrate all secrets from local files to AWS
npm run aws:migrate:secrets
```

This script will:
- Read your local token files
- Validate the token formats
- Upload them to AWS Secrets Manager
- Handle existing secrets gracefully

### Step 3: Update Individual Secrets

If you need to update specific secrets:

```bash
# Update Gmail tokens from default location
npm run aws:update:secret gmail-tokens

# Update OpenAI API key from .env file
npm run aws:update:secret openai-api-key

# Update Google credentials from specific file
npm run aws:update:secret google-credentials --file /path/to/credentials.json

# Update OpenAI API key with direct value
npm run aws:update:secret openai-api-key --value "sk-your-new-api-key"
```

### Step 4: Verify Migration

```bash
# Test all secrets are accessible
npm run aws:test:secrets

# Test individual services
npm run aws:test:vpc
npm run aws:test:dynamodb
npm run aws:test:s3
```

## Secret Types and Locations

### 1. Gmail OAuth Tokens

**Local File**: `tokens/gmail_tokens.json`
**AWS Secret**: `chatterbox/gmail-tokens`

**Format**:
```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//04...",
  "scope": "https://www.googleapis.com/auth/gmail.readonly",
  "token_type": "Bearer",
  "expiry_date": 1234567890123
}
```

**Migration**:
```bash
npm run aws:update:secret gmail-tokens
```

### 2. OpenAI API Key

**Local File**: `.env`
**AWS Secret**: `chatterbox/openai-api-key`

**Format**: `sk-...` (starts with "sk-")

**Migration**:
```bash
npm run aws:update:secret openai-api-key
```

### 3. Google Service Account Credentials

**Local File**: `tokens/google_credentials.json`
**AWS Secret**: `chatterbox/google-credentials`

**Format**:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service-account@project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**Migration**:
```bash
npm run aws:update:secret google-credentials
```

## Using Secrets in Your Application

### 1. Install AWS SDK (if not already installed)

```bash
npm install @aws-sdk/client-secrets-manager
```

### 2. Update Your Code

Replace local file reading with AWS Secrets Manager:

**Before (local files)**:
```typescript
import fs from 'fs';
import dotenv from 'dotenv';

// Load from local files
dotenv.config();
const openaiApiKey = process.env.OPENAI_API_KEY;
const gmailTokens = JSON.parse(fs.readFileSync('tokens/gmail_tokens.json', 'utf8'));
```

**After (AWS Secrets Manager)**:
```typescript
import { awsSecrets, getGmailTokens, getOpenAIApiKey } from '../utils/awsSecrets';

// Load from AWS Secrets Manager
const openaiApiKey = await getOpenAIApiKey();
const gmailTokens = await getGmailTokens();
```

### 3. Example Usage

```typescript
import { awsSecrets } from '../utils/awsSecrets';

async function initializeServices() {
  try {
    // Get secrets from AWS
    const gmailTokens = await awsSecrets.getGmailTokens();
    const openaiApiKey = await awsSecrets.getOpenAIApiKey();
    const googleCredentials = await awsSecrets.getGoogleCredentials();

    // Use secrets in your application
    console.log('Gmail tokens loaded:', !!gmailTokens.access_token);
    console.log('OpenAI API key loaded:', !!openaiApiKey);
    console.log('Google credentials loaded:', !!googleCredentials.project_id);

  } catch (error) {
    console.error('Failed to load secrets:', error);
    process.exit(1);
  }
}
```

## Secret Rotation

### Automatic Rotation Status

```bash
# Check rotation status
npm run aws:secrets:status
```

### Manual Rotation

```bash
# Interactive rotation menu
npm run aws:rotate:secrets

# Rotate specific secret
npm run aws:secrets:rotate gmail-tokens
npm run aws:secrets:rotate openai-api-key
npm run aws:secrets:rotate google-credentials
```

### Rotation Schedule

- **Gmail Tokens**: Every 30 days
- **OpenAI API Keys**: Every 90 days  
- **Google Credentials**: Every 365 days

## Security Best Practices

### 1. Remove Local Token Files

After successful migration:

```bash
# Backup local files first
cp tokens/gmail_tokens.json tokens/gmail_tokens.json.backup
cp .env .env.backup
cp tokens/google_credentials.json tokens/google_credentials.json.backup

# Remove from version control
echo "tokens/gmail_tokens.json" >> .gitignore
echo ".env" >> .gitignore
echo "tokens/google_credentials.json" >> .gitignore

# Delete local files (after confirming AWS works)
rm tokens/gmail_tokens.json
rm .env
rm tokens/google_credentials.json
```

### 2. Environment Variables

Update your environment variables:

```bash
# Remove sensitive variables from .env
# Keep only non-sensitive configuration
AWS_REGION=us-east-1
AWS_PROFILE=cliadmin
TF_VAR_environment=development
```

### 3. IAM Permissions

Ensure your application has minimal required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:chatterbox/*"
      ]
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### 1. Secret Not Found
```bash
# Check if secret exists
aws secretsmanager describe-secret --secret-id "chatterbox/gmail-tokens" --profile cliadmin

# Create if missing
npm run aws:update:secret gmail-tokens
```

#### 2. Permission Denied
```bash
# Check AWS credentials
aws sts get-caller-identity --profile cliadmin

# Verify IAM permissions
aws iam list-attached-user-policies --user-name cliadmin --profile cliadmin
```

#### 3. Invalid Token Format
```bash
# Validate local file format
cat tokens/gmail_tokens.json | jq .

# Check .env file format
grep OPENAI_API_KEY .env
```

#### 4. Application Can't Access Secrets
```bash
# Test secret retrieval
node -e "
const { awsSecrets } = require('./dist/src/utils/awsSecrets');
awsSecrets.getGmailTokens().then(console.log).catch(console.error);
"
```

### Debug Commands

```bash
# Enable AWS debug logging
export AWS_SDK_JS_DEBUG=1

# Test secret retrieval with debug
npm run aws:test:secrets

# Check CloudWatch logs
npm run aws:logs:show
```

## Migration Checklist

- [ ] AWS infrastructure deployed
- [ ] Local token files available
- [ ] AWS CLI configured with cliadmin profile
- [ ] Secrets migrated to AWS
- [ ] Application updated to use AWS secrets
- [ ] Local token files removed
- [ ] Environment variables updated
- [ ] Application tested with AWS secrets
- [ ] Backup of local files created
- [ ] Rotation schedule configured

## Next Steps

After successful migration:

1. **Update Application Code**: Replace local file reading with AWS Secrets Manager
2. **Test Thoroughly**: Ensure all functionality works with AWS secrets
3. **Remove Local Files**: Delete local token files for security
4. **Set Up Monitoring**: Configure CloudWatch alarms for secret access
5. **Document Changes**: Update team documentation
6. **Train Team**: Ensure team knows how to rotate secrets

## Support

For issues with:
- **Migration Scripts**: Check the script output and error messages
- **AWS Secrets Manager**: Review AWS documentation
- **Application Integration**: Test with the provided utility functions
- **Security**: Follow the security best practices outlined above 