# Chatterbox System Setup and Teardown Guide

## Purpose of This Document

This document provides step-by-step instructions for setting up and tearing down the Chatterbox system, both locally and in AWS. It focuses on the **operational procedures** using package.json scripts rather than the underlying infrastructure details.

**What this document covers:**
- How to use package.json scripts to manage the system
- Step-by-step setup and teardown procedures
- System component relationships and dependencies
- Validation and verification steps

**What this document does NOT cover:**
- Creating AWS, GCP, or OpenAI accounts
- Acquiring credentials and API keys
- Detailed component architecture descriptions
- File system organization and structure

For those topics, see the separate documentation in the `/docs` folder.

## Critical Files Required

**⚠️ IMPORTANT: The following files MUST be in place before running any setup procedures:**

1. **`google_credentials.json`** (project root)
   - GCP OAuth credentials file
   - **Source**: [GCP Credentials Guide](Cloud/GCP/GCP_GET_CREDENTIALS.md)
   - **CRITICAL**: Must exist before any other processes

2. **`.env`** (project root)
   - Environment variables including OpenAI API key
   - **Source**: [OpenAI Setup Guide](openai/OPENAI_SETUP.md)

3. **`config.json`** (project root)
   - Main system configuration file
   - **Source**: [Config JSON Management Guide](CONFIG_JSON_MANAGEMENT.md)

4. **AWS User Setup**
   - AWS account with proper user configuration
   - **Source**: [AWS Setup Guide](Cloud/AWS/README.md)

**Failure to have these files in place will cause setup procedures to fail.**

## System Overview

### LOCAL vs AWS Systems

**LOCAL System:**
- Runs entirely on your local machine
- Uses local file storage for configuration and data
- Processes Gmail directly from your local environment
- Suitable for development, testing, and personal use
- No cloud infrastructure required

**AWS System:**
- Runs in AWS cloud infrastructure
- Uses AWS services (Lambda, S3, DynamoDB, etc.)
- Processes Gmail via AWS Lambda functions
- Suitable for production, automation, and scaling
- Requires AWS account and credentials

### System Dependencies

**AWS depends on LOCAL readiness:**
- AWS deployment requires local configuration files
- Local credentials and tokens must be prepared first
- Local validation ensures proper setup before AWS deployment
- AWS system uses local data for initial population

## LOCAL System

### 4.a. Setting Up the LOCAL System

#### Prerequisites
Before setting up the local system, ensure you have:

**Required Accounts and Credentials:**
- Node.js and npm installed
- GCP credentials (see [GCP Credentials Guide](Cloud/GCP/GCP_GET_CREDENTIALS.md)) - **MUST be completed first**
- OpenAI API key (see [OpenAI Setup Guide](openai/OPENAI_SETUP.md)) - **MUST be completed first**
- AWS account with proper user setup (see [AWS Setup Guide](Cloud/AWS/README.md)) - **MUST be completed first**

**Required Configuration Files:**
The following files must be in place before proceeding with system setup:

1. **`google_credentials.json`** - GCP OAuth credentials file
   - Location: Project root directory
   - Source: [GCP Credentials Guide](Cloud/GCP/GCP_GET_CREDENTIALS.md)
   - **CRITICAL**: Must exist before any other processes

2. **`.env`** - Environment variables file
   - Location: Project root directory
   - Contains: OpenAI API key and other environment variables
   - Source: [OpenAI Setup Guide](openai/OPENAI_SETUP.md)

3. **`config.json`** - Main configuration file
   - Location: Project root directory
   - Contains: System configuration parameters
   - Source: [Config JSON Management Guide](CONFIG_JSON_MANAGEMENT.md)

#### Step-by-Step Local Setup

**Step 1: Install Dependencies**
```bash
npm install
```

**Step 2: Authorize Gmail Access**
```bash
npm run mail:authorize
```
This will:
- Open Gmail authorization in your browser
- Generate and store authentication tokens
- Save tokens to `data/google_tokens.json`
- **CRITICAL**: This must complete successfully before Step 3

**Step 3: Prepare Configuration Data**
```bash
npm run aws:init:prepare
```
This interactive script will:
- Create an initialization folder with timestamp
- Prompt for configuration data locations
- Copy required files to the init folder
- Set up default values for counters and state
- **REQUIRES**: `data/google_tokens.json` from Step 2

**Step 4: Validate Local Setup**
```bash
npm run validate:local
```
This checks:
- All required files are present
- Gmail tokens are valid
- Configuration data is properly formatted
- Local system is ready for operation

**Step 5: Test Local System**
```bash
npm run mail:poll
```
This performs a test Gmail poll to verify:
- Gmail API connectivity
- Token authentication
- Email processing functionality

#### Local System Components

The local system consists of:
- **Configuration files** (see [Local Configuration Guide](local/LOCAL_CONFIGURATION.md))
- **Gmail tokens** (see [Gmail Authentication Guide](mail/GMAIL_AUTHENTICATION.md))
- **Data storage** (see [Local Data Management](local/LOCAL_DATA_MANAGEMENT.md))
- **Processing scripts** (see [Local Processing Guide](local/LOCAL_PROCESSING.md))

### 4.b. Tearing Down the LOCAL System

#### Step-by-Step Local Teardown

**Step 1: Stop Running Processes**
```bash
# If any polling processes are running, stop them
# (Ctrl+C or kill the process)
```

**Step 2: Backup Important Data (Optional)**
```bash
npm run backup:local
```
This creates a timestamped backup of:
- Configuration files
- Gmail tokens
- Local data files
- Processing state

**Step 3: Clean Local System**
```bash
npm run clean:local
```
This removes:
- Temporary files
- Log files
- Cached data
- Processing artifacts

**Step 4: Reset System State**
```bash
npm run reset:local
```
This resets:
- Polling counters
- History IDs
- State files
- Processing flags

**Step 5: Validate Clean State**
```bash
npm run validate:local
```
This verifies:
- All temporary files are removed
- System is in clean state
- Ready for fresh setup

#### Local Cleanup Components

The local teardown affects:
- **Temporary files** (see [Local File Management](local/LOCAL_FILE_MANAGEMENT.md))
- **Processing state** (see [Local State Management](local/LOCAL_STATE_MANAGEMENT.md))
- **Configuration data** (see [Local Configuration Guide](local/LOCAL_CONFIGURATION.md))

## AWS System

### 5.a. Setting Up the AWS System

#### Prerequisites
Before setting up the AWS system, ensure you have:

**Required Local Setup:**
- Local system properly configured (see Section 4.a) - **MUST be completed first**
- All required files in place:
  - `google_credentials.json` (project root)
  - `.env` (project root)
  - `config.json` (project root)
  - `data/google_tokens.json` (from Gmail authorization)

**Required AWS Setup:**
- AWS account with appropriate permissions
- AWS CLI configured with `cliadmin` profile
- Terraform installed (version >= 1.0)
- AWS user setup completed (see [AWS Setup Guide](Cloud/AWS/README.md))

**Verification:**
Run local validation to ensure readiness:
```bash
npm run validate:local
```
This ensures:
- All local configuration is complete
- Gmail tokens are valid
- Required files are present
- System is ready for AWS deployment

#### Step-by-Step AWS Setup

**Step 1: Deploy AWS Infrastructure**
```bash
npm run aws:deploy:simple
```
This creates:
- Lambda functions for Gmail polling
- S3 buckets for email storage
- DynamoDB tables for state management
- CloudWatch log groups
- IAM roles and policies
- API Gateway endpoints

**Step 2: Prepare and Migrate Configuration Data**
```bash
npm run aws:init:build
```
This performs:
- Creates initialization folder with timestamp
- Copies all configuration files to init folder
- Populates AWS Secrets Manager with Gmail credentials
- Populates AWS Parameter Store with configuration
- Prepares system for AWS deployment

**Alternative: Step-by-Step Init Process**
If you prefer to run the init process step by step:
```bash
# Step 2a: Prepare init folder
npm run aws:init:prepare

# Step 2b: Migrate data to AWS
npm run aws:init:migrate
```

**Step 3: Validate AWS Deployment**
```bash
npm run aws:validate
```
This verifies:
- All AWS resources are created
- Configuration data is populated
- System is ready for operation

**Step 4: Test AWS System**
```bash
npm run aws:test
```
This performs:
- Lambda function tests
- API Gateway endpoint tests
- Gmail polling tests
- End-to-end system validation

#### AWS System Components

The AWS system consists of:
- **Lambda Functions** (see [AWS Lambda Guide](Cloud/AWS/AWS_LAMBDA_GUIDE.md))
- **S3 Storage** (see [AWS S3 Guide](Cloud/AWS/AWS_S3_GUIDE.md))
- **DynamoDB Tables** (see [AWS DynamoDB Guide](Cloud/AWS/AWS_DYNAMODB_GUIDE.md))
- **CloudWatch Logging** (see [AWS CloudWatch Guide](Cloud/AWS/AWS_CLOUDWATCH_GUIDE.md))
- **IAM Security** (see [AWS IAM Guide](Cloud/AWS/AWS_IAM_GUIDE.md))
- **API Gateway** (see [AWS API Gateway Guide](Cloud/AWS/AWS_API_GATEWAY_GUIDE.md))

### 5.b. Tearing Down the AWS System

#### Step-by-Step AWS Teardown

**Step 1: Validate Current State**
```bash
npm run aws:validate
```
This shows:
- Current AWS resources
- Configuration data status
- System health

**Step 2: Backup AWS Data (Optional)**
```bash
npm run aws:backup
```
This creates backups of:
- S3 bucket contents
- DynamoDB table data
- Configuration parameters
- System state

**Step 3: Complete AWS Teardown**
```bash
npm run aws:teardown
```
This removes:
- Lambda functions
- S3 buckets (except Terraform state)
- DynamoDB tables
- CloudWatch log groups
- IAM roles and policies
- API Gateway resources
- Secrets Manager secrets
- Parameter Store parameters

**Step 4: Validate Clean State**
```bash
npm run aws:validate --clean
```
This verifies:
- All resources are removed
- Terraform state bucket is preserved
- System is ready for fresh deployment

**Step 5: Clean Legacy Parameters**
```bash
npm run aws:cleanup-legacy
```
This removes:
- Any remaining Parameter Store parameters
- Legacy configuration data
- Orphaned resources

#### AWS Cleanup Components

The AWS teardown affects:
- **Infrastructure Resources** (see [AWS Infrastructure Guide](Cloud/AWS/AWS_INFRASTRUCTURE_GUIDE.md))
- **Configuration Data** (see [AWS Configuration Guide](Cloud/AWS/AWS_CONFIGURATION_GUIDE.md))
- **Security Resources** (see [AWS Security Guide](Cloud/AWS/SECURITY_GUIDE.md))

## Validation and Verification

### Local System Validation
```bash
npm run validate:local
```
Checks local system readiness and configuration.

### AWS System Validation
```bash
npm run aws:validate
```
Checks AWS deployment status and resource health.

### Clean State Validation
```bash
npm run aws:validate --clean
```
Verifies all resources have been properly removed.

## Troubleshooting

### Common Issues

**Local Setup Issues:**
- See [Local Troubleshooting Guide](local/LOCAL_TROUBLESHOOTING.md)
- Check [Gmail Authentication Guide](mail/GMAIL_AUTHENTICATION.md)
- Review [Local Configuration Guide](local/LOCAL_CONFIGURATION.md)

**AWS Setup Issues:**
- See [AWS Troubleshooting Guide](Cloud/AWS/AWS_TROUBLESHOOTING.md)
- Check [AWS Credentials Guide](Cloud/AWS/AWS_CREDENTIALS.md)
- Review [AWS Infrastructure Guide](Cloud/AWS/INFRASTRUCTURE_GUIDE.md)

### Getting Help

1. Run the help command: `npm run help`
2. Check the troubleshooting guides above
3. Review the validation output for specific errors
4. Check AWS CloudWatch logs for Lambda function issues

## Next Steps

After successful setup:
1. **Local System**: Start polling with `npm run mail:poll`
2. **AWS System**: Monitor CloudWatch logs for Lambda execution
3. **Both Systems**: Review [Operation Guide](OPERATION_GUIDE.md) for ongoing management

For detailed component information, see the individual guides referenced throughout this document. 