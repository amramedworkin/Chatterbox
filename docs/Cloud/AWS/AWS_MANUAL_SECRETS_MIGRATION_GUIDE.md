# AWS Manual Secrets Migration Guide

This guide provides troubleshooting and security best practices for migrating secrets to AWS Secrets Manager in the simplified Chatterbox infrastructure.

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