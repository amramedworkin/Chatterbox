# Chatterbox Installation Guide

This guide explains how to create new Chatterbox installations and initialize them with all required components.

## Overview

The Chatterbox installation system provides two main scripts:

1. **`install:create`** - Creates a fresh installation at a new location
2. **`install:init`** - Initializes the system with all required components

## Quick Start

### Step 1: Create a New Installation

From your current Chatterbox repository:

```bash
npm run install:create
```

This will:
- Prompt you for a new installation directory
- Verify the directory doesn't exist
- Offer to clone from git or copy from current repository
- Generate unique AWS resource names
- Create installation configuration

### Step 2: Navigate to New Installation

```bash
cd /path/to/your/new/installation
```

### Step 3: Initialize the System

```bash
npm run install:init
```

This will guide you through:
- GCP OAuth credentials setup
- OpenAI API key configuration
- Email address configuration
- AWS infrastructure setup (optional)
- Test data creation (optional)

## Detailed Installation Process

### Creating a New Installation

The `install:create` script provides two installation methods:

#### Method 1: Git Clone (Recommended)
- Clones the repository from the git URL
- Creates a clean installation
- Requires internet connection
- Best for production deployments

#### Method 2: Copy Current Repository
- Copies files from your current installation
- Excludes `node_modules`, `.git`, and sensitive files
- Works offline
- Good for local development copies

#### Unique Resource Generation

The script automatically generates unique names for AWS resources:
- S3 buckets: `chatterbox-data-{timestamp}-{random}`
- DynamoDB tables: `chatterbox-state-{timestamp}-{random}`
- Terraform state buckets: `chatterbox-terraform-state-{timestamp}-{random}`
- VPC CIDR blocks: `10.{random}.0.0/16`

### System Initialization

The `install:init` script guides you through all requirements from `SYSTEM_REQUIREMENTS_CONSOLIDATION.md`:

#### 1. GCP OAuth Credentials
- **What you need**: GCP project with Gmail API enabled and OAuth credentials
- **Instructions provided**: Step-by-step GCP setup guide
- **File handling**: Copies credentials to `tokens/google_credentials.json`

#### 2. OpenAI API Key
- **What you need**: OpenAI account with API key
- **Instructions provided**: OpenAI account creation and API key generation
- **Configuration**: Saves API key to `.env` file

#### 3. Email Addresses
- **Polling Email**: For reading incoming messages
- **Sending Email**: For sending responses
- **Get Email**: For retrieving specific messages
- **Test Recipient**: For testing email functionality
- **Configuration**: Updates `config.json` with your email addresses

#### 4. AWS Infrastructure (Optional)
- **Environments**: Choose development, staging, production
- **Region**: Select AWS region
- **Instructions provided**: Complete AWS setup guide
- **Configuration**: Updates Terraform files with unique resource names

#### 5. Test Data (Optional)
- **Test files**: Sample attachments and configurations
- **State data**: Initial application state
- **Impact**: Enables test functionality

## Prerequisites

Before running the installation scripts, ensure you have:

### Required Software
- **Node.js**: Version 16 or higher
- **npm**: Latest version
- **Git**: For git clone method (optional)

### Required Accounts
- **GCP Account**: For Gmail API access
- **OpenAI Account**: For AI functionality
- **AWS Account**: For cloud infrastructure (optional)

### Required Information
- **GCP OAuth Credentials**: Downloaded JSON file
- **OpenAI API Key**: Generated from OpenAI dashboard
- **Email Addresses**: Gmail accounts with appropriate permissions
- **AWS Access Keys**: If using AWS infrastructure

## Installation Scripts Reference

### `npm run install:create`

Creates a new Chatterbox installation.

**Options:**
- Interactive prompts for installation path
- Choice between git clone and copy methods
- Automatic unique resource name generation
- Installation configuration file creation

**Output:**
- New installation directory
- Updated Terraform configuration
- Installation metadata file

### `npm run install:init`

Initializes the system with all required components.

**Features:**
- Guided setup for all requirements
- Detailed instructions for each component
- File validation and copying
- Configuration file updates
- Test data creation (optional)

**Interactive Prompts:**
- GCP credentials file path
- OpenAI API key
- Email addresses
- AWS environment selection
- Test data inclusion

## Environment-Specific Configuration

### Development Environment
- Single environment setup
- Basic AWS resources
- Test data included
- Local development focus

### Staging Environment
- Multiple environments (dev, staging)
- Full AWS infrastructure
- Production-like configuration
- Testing and validation

### Production Environment
- All environments (dev, staging, prod)
- Complete AWS infrastructure
- Security-focused configuration
- Monitoring and alerting

## Post-Installation Steps

After running `install:init`, complete these steps:

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Application
```bash
npm run build
```

### 3. Authorize Gmail Accounts
```bash
npm run mail:authorize
```

### 4. Test Basic Functionality
```bash
npm run test:openai
npm run mail:poll
npm run mail:send:test
```

### 5. Deploy AWS Infrastructure (if configured)
```bash
npm run aws:setup
npm run aws:migrate:secrets
```

## Troubleshooting

### Common Issues

#### Installation Creation Fails
- **Problem**: Target directory already exists
- **Solution**: Choose a different directory or remove existing one

#### Git Clone Fails
- **Problem**: Network issues or invalid repository URL
- **Solution**: Use copy method or check network connection

#### Initialization Fails
- **Problem**: Missing prerequisites
- **Solution**: Complete required account setup first

#### Gmail Authorization Fails
- **Problem**: Invalid credentials or permissions
- **Solution**: Verify GCP setup and OAuth configuration

#### OpenAI API Fails
- **Problem**: Invalid API key or billing issues
- **Solution**: Check API key and billing status

#### AWS Setup Fails
- **Problem**: Invalid credentials or permissions
- **Solution**: Verify AWS CLI configuration and IAM permissions

### Getting Help

1. **Check Documentation**: Review `SYSTEM_REQUIREMENTS_CONSOLIDATION.md`
2. **Review Logs**: Check console output for error messages
3. **Verify Prerequisites**: Ensure all accounts and credentials are properly configured
4. **Test Components**: Run individual test scripts to isolate issues

## Security Considerations

### Credential Management
- Never commit credentials to version control
- Use environment variables for sensitive data
- Consider AWS Secrets Manager for production

### Access Control
- Use least privilege principle for AWS permissions
- Enable 2FA on all accounts
- Regularly rotate API keys and access tokens

### Network Security
- Use VPC isolation for AWS resources
- Enable encryption at rest and in transit
- Monitor access logs and alerts

## Cost Considerations

### Required Costs
- **Gmail API**: Free tier available
- **OpenAI API**: Pay-per-use pricing
- **Email Storage**: Standard Gmail limits

### Optional AWS Costs
- **DynamoDB**: ~$1.25 per million write requests
- **S3**: ~$0.023 per GB-month
- **Secrets Manager**: $0.40 per secret per month
- **CloudWatch**: $0.50 per GB of logs

## Support

For installation issues:

1. **Review Requirements**: Check `SYSTEM_REQUIREMENTS_CONSOLIDATION.md`
2. **Follow Instructions**: Complete all prerequisite setup steps
3. **Check Documentation**: Review component-specific documentation
4. **Test Incrementally**: Verify each component individually

## Next Steps

After successful installation:

1. **Explore Features**: Try different Chatterbox capabilities
2. **Customize Configuration**: Adjust settings for your needs
3. **Set Up Monitoring**: Configure alerts and logging
4. **Plan Scaling**: Consider production deployment options
5. **Join Community**: Connect with other Chatterbox users

---

**Note**: This installation system ensures that all subsequent work is performed against the new installation, not the original repository. Each installation is completely independent with its own unique resource names and configurations.
