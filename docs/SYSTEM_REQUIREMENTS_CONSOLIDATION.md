# Chatterbox System Requirements Consolidation

## Overview

This document consolidates all base-level information needed to run the Chatterbox system, clearly distinguishing between **REQUIRED** and **OPTIONAL** components. The system can run locally without AWS infrastructure, but AWS is recommended for production use.

## 1. GCP Account & OAuth Configuration (REQUIRED)

### 1.1 GCP Project Setup
- **GCP Account**: Active Google Cloud Platform account
- **Project Creation**: Create a new GCP project or use existing one
- **Billing**: Enable billing for the project (required for API usage)

### 1.2 Gmail API Configuration
- **Enable Gmail API**: In GCP Console → APIs & Services → Library → Search "Gmail API" → Enable
- **OAuth Consent Screen**: Configure OAuth consent screen
  - User Type: External (for personal use) or Internal (for organization)
  - App name: "Chatterbox"
  - User support email: Your email address
  - Developer contact information: Your email address
  - Scopes: Add Gmail API scopes

### 1.3 OAuth Credentials Creation
- **Credentials Type**: OAuth 2.0 Client ID
- **Application Type**: Desktop application (for local development)
- **Client Name**: "Chatterbox Desktop Client"
- **Authorized Redirect URIs**: `http://localhost:3000`

### 1.4 Required Gmail API Scopes
The system requires these OAuth scopes:
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail messages
- `https://www.googleapis.com/auth/gmail.send` - Send Gmail messages

### 1.5 Credentials File
- **File Location**: `tokens/google_credentials.json` (or `credentials.json`)
- **Format**: JSON file downloaded from GCP Console
- **Content**: OAuth 2.0 client credentials with client_id, client_secret, redirect_uris

## 2. Email Addresses & Access Rights (REQUIRED)

### 2.1 Primary Email Addresses Required

#### 2.1.1 Polling Email Address
- **Purpose**: Email account used to poll for incoming messages
- **Rights Required**: 
  - Full Gmail access (read/write)
  - Ability to authorize OAuth applications
  - 2FA enabled (recommended for security)
- **Configuration**: Set in `config.json` as `defaultPollGmailUser`
- **Usage**: Used by `pollGmail.ts`, `timedPollGmail.ts`, `getGmail.ts`

#### 2.1.2 Sending Email Address
- **Purpose**: Email account used to send responses
- **Rights Required**:
  - Full Gmail access (read/write)
  - Ability to authorize OAuth applications
  - 2FA enabled (recommended for security)
- **Configuration**: Set in `config.json` as `defaultSendGmailUser`
- **Usage**: Used by `sendGmail.ts`, email response generation

#### 2.1.3 Get Email Address
- **Purpose**: Email account used to retrieve specific messages
- **Rights Required**:
  - Full Gmail access (read/write)
  - Ability to authorize OAuth applications
- **Configuration**: Set in `config.json` as `defaultGetGmailUser`
- **Usage**: Used by `getGmail.ts`, `listGmails.ts`

### 2.2 Testing Email Addresses (Optional but Recommended)
- **Send Test Recipient**: Email address for testing email sending functionality
- **Configuration**: Set in `config.json` as `sendTest.defaultRecipient`
- **Usage**: Used by send test scripts

### 2.3 Email Authorization Process
Each email address must go through OAuth2 authorization:
1. Run `npm run mail:authorize`
2. Follow browser prompts for each email address
3. Grant requested permissions (Gmail read/send)
4. Tokens stored in `tokens/gmail_tokens.json`

## 3. OpenAI Account & API Access (REQUIRED)

### 3.1 OpenAI Account Setup
- **Account Creation**: Create account at https://platform.openai.com/
- **Billing**: Add payment method (required for API usage)
- **API Key Generation**: Generate API key in OpenAI dashboard

### 3.2 Required API Privileges
The user needs access to:
- **Chat Completions API**: For dialog and conversation functionality
- **Assistants API**: For advanced agent-based interactions
- **Models**: Access to GPT-4o, GPT-4o-mini, and other available models

### 3.3 API Key Configuration
- **Environment Variable**: Set `OPENAI_API_KEY` in `.env` file
- **Format**: `sk-` followed by alphanumeric string
- **Security**: Never commit API key to version control
- **Usage**: Used by `askAgent.ts`, `dialogAgent.ts`, `emailAgent.ts`

### 3.4 Optional OpenAI Configuration
- **Organization ID**: Set `OPENAI_ORGANIZATION_ID` for team accounts
- **Model Selection**: Configure preferred model in `config.json`
- **Token Limits**: Set `maxResponseTokens` for response length control

## 4. AWS Account & Infrastructure (OPTIONAL but RECOMMENDED)

### 4.1 AWS Account Requirements
- **AWS Account**: Active AWS account with billing enabled
- **Region**: Primary region (default: us-east-1)
- **Billing**: Payment method configured

### 4.2 Base Level AWS User Requirements

#### 4.2.1 IAM User Creation (cliadmin)
- **User Name**: `cliadmin`
- **Access Type**: Programmatic access (CLI)
- **Console Access**: Optional (for management)

#### 4.2.2 Required AWS Permissions
The cliadmin user needs these permissions to create the AWS subsystem:

**Core Infrastructure Permissions:**
- `ec2:*` - VPC, subnets, security groups, NAT gateways
- `s3:*` - S3 buckets, policies, lifecycle rules
- `dynamodb:*` - DynamoDB tables, indexes, auto-scaling
- `secretsmanager:*` - Secrets creation, management, rotation
- `ssm:*` - Parameter Store, Systems Manager
- `cloudwatch:*` - Log groups, metrics, alarms, dashboards
- `iam:*` - Roles, policies, instance profiles

**Specific Service Permissions:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:*",
                "s3:*",
                "dynamodb:*",
                "secretsmanager:*",
                "ssm:*",
                "cloudwatch:*",
                "iam:CreateRole",
                "iam:AttachRolePolicy",
                "iam:CreatePolicy",
                "iam:CreateInstanceProfile",
                "iam:PassRole",
                "logs:*"
            ],
            "Resource": "*"
        }
    ]
}
```

#### 4.2.3 Alternative: Use AdministratorAccess (Less Secure)
For initial setup, you can attach `AdministratorAccess` policy, then restrict later.

### 4.3 AWS CLI Configuration
- **Profile Setup**: Configure AWS CLI with cliadmin credentials
- **Region**: Set default region (us-east-1)
- **Output Format**: JSON

### 4.4 Terraform Requirements
- **Terraform Installation**: Version 1.0 or higher
- **AWS Provider**: HashiCorp AWS provider
- **Backend**: S3 backend for state management

## 5. Local Development Environment (REQUIRED)

### 5.1 Node.js Environment
- **Node.js**: Version 16 or higher
- **npm**: Latest version
- **TypeScript**: Version 4.5 or higher

### 5.2 Required Dependencies
Install via `npm install`:
- `googleapis` - Gmail API integration
- `openai` - OpenAI API integration
- `@aws-sdk/client-*` - AWS SDK packages
- `dotenv` - Environment variable management
- `chalk` - Terminal colorization
- `inquirer` - Interactive prompts

### 5.3 File Structure Requirements
```
Chatterbox/
├── tokens/
│   ├── google_credentials.json    # GCP OAuth credentials
│   └── gmail_tokens.json         # Gmail OAuth tokens
├── .env                          # Environment variables
├── config.json                   # Application configuration
└── src/                          # Source code
```

## 6. Optional Components

### 6.1 AWS Infrastructure (Recommended for Production)
- **VPC**: Network isolation and security
- **DynamoDB**: Persistent state storage
- **S3**: File storage and backups
- **Secrets Manager**: Secure credential storage
- **Parameter Store**: Configuration management
- **CloudWatch**: Monitoring and logging
- **IAM**: Access control and security

### 6.2 Advanced Features
- **Environment Management**: Development, staging, production
- **Secrets Migration**: Move credentials to AWS
- **Backup Systems**: Automated data backup
- **Monitoring**: Application performance monitoring

## 7. System Initialization Checklist

### 7.1 Required Setup (Must Complete)
- [ ] GCP project created and Gmail API enabled
- [ ] OAuth credentials downloaded to `tokens/google_credentials.json`
- [ ] Email addresses configured in `config.json`
- [ ] Email addresses authorized via OAuth (`npm run mail:authorize`)
- [ ] OpenAI account created and API key generated
- [ ] OpenAI API key added to `.env` file
- [ ] Node.js and npm installed
- [ ] Dependencies installed (`npm install`)

### 7.2 Optional Setup (Recommended)
- [ ] AWS account created and billing enabled
- [ ] cliadmin IAM user created with required permissions
- [ ] AWS CLI configured with cliadmin profile
- [ ] Terraform installed and configured
- [ ] AWS infrastructure deployed (`npm run aws:setup`)
- [ ] Secrets migrated to AWS (`npm run aws:migrate:secrets`)

### 7.3 Validation Steps
- [ ] Test Gmail authorization (`npm run mail:authorize`)
- [ ] Test OpenAI connection (`npm run test:openai`)
- [ ] Test email polling (`npm run mail:poll`)
- [ ] Test email sending (`npm run mail:send:test`)
- [ ] Test AWS infrastructure (`npm run aws:test:all`)

## 8. Security Considerations

### 8.1 Required Security Measures
- **OAuth Tokens**: Store securely, never commit to version control
- **API Keys**: Use environment variables, never hardcode
- **2FA**: Enable on all email accounts and cloud services
- **Access Control**: Use least privilege principle for AWS permissions

### 8.2 Optional Security Enhancements
- **AWS Secrets Manager**: Store credentials securely in AWS
- **VPC Isolation**: Network-level security for AWS resources
- **IAM Roles**: Role-based access control for AWS services
- **Encryption**: Enable encryption at rest and in transit

## 9. Cost Considerations

### 9.1 Required Costs
- **Gmail API**: Free tier available, minimal costs for personal use
- **OpenAI API**: Pay-per-use, varies by model and usage
- **Email Storage**: Standard Gmail storage limits apply

### 9.2 Optional AWS Costs
- **DynamoDB**: ~$1.25 per million write requests, $0.25 per million read requests
- **S3**: ~$0.023 per GB-month for standard storage
- **Secrets Manager**: $0.40 per secret per month
- **CloudWatch**: $0.50 per GB of logs ingested
- **VPC**: Minimal costs for NAT gateways and data transfer

## 10. Troubleshooting Common Issues

### 10.1 Gmail Authorization Issues
- **Problem**: "Invalid credentials" error
- **Solution**: Re-run `npm run mail:authorize --force`
- **Prevention**: Ensure 2FA is properly configured

### 10.2 OpenAI API Issues
- **Problem**: "API key not found" error
- **Solution**: Verify `OPENAI_API_KEY` in `.env` file
- **Prevention**: Check billing status in OpenAI dashboard

### 10.3 AWS Permission Issues
- **Problem**: "Access denied" errors
- **Solution**: Verify cliadmin user permissions
- **Prevention**: Use least privilege principle

## 11. Next Steps After Setup

1. **Test Basic Functionality**: Run all test scripts
2. **Configure Email Addresses**: Update `config.json` with your email addresses
3. **Authorize Gmail**: Run authorization for all email addresses
4. **Test OpenAI**: Verify API key and model access
5. **Deploy AWS** (Optional): Set up infrastructure for production use
6. **Migrate Secrets** (Optional): Move credentials to AWS Secrets Manager
7. **Begin Development**: Start building your Chatterbox applications

## 12. Support and Documentation

- **Project README**: `README.md` for general setup
- **AWS Documentation**: `Cloud/AWS/README.md` for AWS-specific setup
- **Scripts Documentation**: `SCRIPTS_README.md` for available commands
- **Architecture**: `Cloud/AWS/AWS_ARCHITECTURE_SUMMARY.md` for system design
- **Final Specification**: `Cloud/AWS/AWS_FINAL_PRODUCT_SPEC.md` for complete details

---

**Note**: This system is designed to work locally without AWS infrastructure, making AWS optional but recommended for production use. All core functionality (Gmail integration, OpenAI interactions) works without AWS, but AWS provides enhanced security, scalability, and monitoring capabilities.
