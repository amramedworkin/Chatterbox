# Chatterbox

A comprehensive email automation and AI interaction system that integrates Gmail, OpenAI, and AWS services for intelligent email processing and response generation.

## Overview

Chatterbox is a TypeScript-based application that combines Gmail API integration with OpenAI's language models to create intelligent email processing workflows. The system can run locally or be deployed with full AWS infrastructure for production use.

## Key Features

- **Gmail Integration**: Poll, read, and send emails with OAuth2 authentication
- **OpenAI Integration**: AI-powered email responses and conversations
- **AWS Infrastructure**: Optional cloud deployment with VPC, DynamoDB, S3, and more
- **Environment Management**: Support for development, staging, and production environments
- **Secrets Management**: Secure credential storage with AWS Secrets Manager
- **Monitoring & Logging**: Comprehensive logging and monitoring with CloudWatch
- **Local System Management**: Backup, clean, and restore capabilities

## Quick Start

### Prerequisites

Before setting up Chatterbox, review the complete system requirements:

📋 **[System Requirements Consolidation](docs/SYSTEM_REQUIREMENTS_CONSOLIDATION.md)** - Complete guide to all required and optional components

### Required Components

1. **GCP Account** with Gmail API enabled and OAuth credentials
2. **Email Addresses** with Gmail access and OAuth authorization
3. **OpenAI Account** with API key and billing enabled
4. **Node.js Environment** (v16+) with TypeScript support

### Optional Components

5. **AWS Account** with IAM user and required permissions
6. **Terraform** for infrastructure deployment

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Chatterbox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure credentials**
   - Copy `tokens/google_credentials.json` from GCP Console
   - Add OpenAI API key to `.env` file
   - Configure email addresses in `config.json`

4. **Authorize Gmail accounts**
   ```bash
   npm run mail:authorize
   ```

5. **Test basic functionality**
   ```bash
   npm run test:openai
   npm run mail:poll
   npm run mail:send:test
   ```

## Available Scripts

### Core Functionality
- `npm run mail:authorize` - Authorize Gmail accounts
- `npm run mail:poll` - Poll for new emails
- `npm run mail:send:test` - Test email sending
- `npm run test:openai` - Test OpenAI connection

### AWS Infrastructure (Optional)
- `npm run aws:setup` - Deploy AWS infrastructure
- `npm run aws:migrate:secrets` - Migrate secrets to AWS
- `npm run aws:test:all` - Test all AWS services
- `npm run aws:teardown` - Remove AWS infrastructure

### Local System Management
- `npm run backup` - Backup local configuration
- `npm run clean` - Clean sensitive data
- `npm run restore` - Restore from backup

### Development
- `npm run build` - Build TypeScript
- `npm run test` - Run test suite
- `npm run lint` - Lint code

## Documentation

### Core Documentation
- **[System Requirements](docs/SYSTEM_REQUIREMENTS_CONSOLIDATION.md)** - Complete setup requirements
- **[Scripts Reference](docs/SCRIPTS_README.md)** - All available npm scripts
- **[Environment Management](docs/ENVIRONMENT_SYSTEM_SUMMARY.md)** - Environment setup guide

### AWS Documentation
- **[AWS Setup Guide](Cloud/AWS/README.md)** - Complete AWS infrastructure setup
- **[Architecture Summary](Cloud/AWS/ARCHITECTURE_SUMMARY.md)** - System architecture overview
- **[Final Product Spec](Cloud/AWS/FINAL_PRODUCT_SPEC.md)** - Complete infrastructure specification

### Local System Management
- **[Local System Clean](docs/LOCAL_SYSTEM_CLEAN.md)** - Clean system documentation
- **[Local System Backup](docs/LOCAL_SYSTEM_BACKUP.md)** - Backup system documentation

## Architecture

Chatterbox is built with a modular architecture:

```
Chatterbox/
├── src/
│   ├── mail/           # Gmail integration
│   ├── openai/         # OpenAI integration
│   ├── utils/          # Utilities and helpers
│   └── types/          # TypeScript type definitions
├── Cloud/AWS/          # AWS infrastructure (Terraform)
├── scripts/            # Management scripts
├── tokens/             # OAuth credentials
└── data/               # Application data
```

## Security

- **OAuth2 Authentication**: Secure Gmail API access
- **Environment Variables**: Sensitive data in `.env` files
- **AWS Secrets Manager**: Optional secure credential storage
- **IAM Least Privilege**: Minimal required permissions
- **VPC Isolation**: Network-level security (AWS)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

[Add your license information here]


## Documentation Index

| ID | Document | Description |
|----|----------|-------------|
| 1 | [Environment System Summary](docs/ENVIRONMENT_SYSTEM_SUMMARY.md) | Overview of environment management and system architecture |
| 2 | [Installation Guide](docs/INSTALLATION_GUIDE.md) | Step-by-step installation and setup instructions |
| 3 | [Lambda Setup Summary](docs/LAMBDA_SETUP_SUMMARY.md) | AWS Lambda function setup and configuration guide |
| 4 | [Local System Backup Summary](docs/LOCAL_SYSTEM_BACKUP_SUMMARY.md) | Summary of local system backup procedures and capabilities |
| 5 | [Local System Backup](docs/LOCAL_SYSTEM_BACKUP.md) | Complete guide to backing up local system configuration and data |
| 6 | [Local System Clean Summary](docs/LOCAL_SYSTEM_CLEAN_SUMMARY.md) | Summary of local system cleaning procedures and capabilities |
| 7 | [Local System Clean](docs/LOCAL_SYSTEM_CLEAN.md) | Complete guide to cleaning sensitive data and resetting local system |
| 8 | [Scripts README](docs/SCRIPTS_README.md) | Comprehensive reference for all available npm scripts and commands |
| 9 | [System Orchestration Guide](docs/SYSTEM_ORCHESTRATION_GUIDE.md) | Guide to orchestrating and managing the complete system |
| 10 | [System Requirements Consolidation](docs/SYSTEM_REQUIREMENTS_CONSOLIDATION.md) | Complete guide to all required and optional system components |
| 11 | [Interactions README](docs/interactions/README.md) | Documentation for user interactions and interface components |
| 12 | [Azure Cloud Setup](docs/Cloud/Azure/README.md) | Microsoft Azure cloud infrastructure setup and configuration |
| 13 | [GCP Setup Guide](docs/Cloud/GCP/GCP_SETUP_README.md) | Google Cloud Platform setup and configuration guide |
| 14 | [AWS Lambda README](docs/Cloud/AWS/LAMBDA_README.md) | AWS Lambda function documentation and usage guide |
| 15 | [AWS Final Product Specification](docs/Cloud/AWS/FINAL_PRODUCT_SPEC.md) | Complete AWS infrastructure product specification |
| 16 | [AWS Buildout Improvements](docs/Cloud/AWS/AWS_BUILDOUT_IMPROVEMENTS.md) | Improvements and enhancements to AWS infrastructure buildout |
| 17 | [AWS Secrets Migration](docs/Cloud/AWS/SECRETS_MIGRATION.md) | Guide for migrating secrets to AWS Secrets Manager |
| 18 | [AWS Complete Teardown Guide](docs/Cloud/AWS/COMPLETE_TEARDOWN_GUIDE.md) | Comprehensive guide for completely removing AWS infrastructure |
| 19 | [AWS Teardown](docs/Cloud/AWS/AWS_TEARDOWN.md) | AWS infrastructure teardown procedures and scripts |
| 20 | [AWS Architecture Summary](docs/Cloud/AWS/ARCHITECTURE_SUMMARY.md) | Overview of AWS infrastructure architecture and components |
| 21 | [AWS README](docs/Cloud/AWS/README.md) | Main AWS infrastructure documentation and setup guide |
| 22 | [AWS Environment Management](docs/Cloud/AWS/ENVIRONMENT_MANAGEMENT.md) | Guide for managing multiple AWS environments (dev/staging/prod) |
| 23 | [AWS Consolidation Summary](docs/Cloud/AWS/CONSOLIDATION_SUMMARY.md) | Summary of AWS infrastructure consolidation efforts |
| 24 | [AWS Consolidated README](docs/Cloud/AWS/CONSOLIDATED_AWS_README.md) | Consolidated AWS documentation and management guide |
| 25 | [Scripts Dump Config](docs/scripts/dump-config.md) | Documentation for configuration dumping scripts and utilities |
| 26 | [Mail Module README](docs/src/mail/README.md) | Gmail integration module documentation and API reference |
| 27 | [OpenAI Dialog Console](docs/src/openai/dialogConsole.md) | Console-based dialog interface for OpenAI interactions |
| 28 | [OpenAI Dialog Agent](docs/src/openai/dialogAgent.md) | AI dialog agent implementation and configuration guide |
| 29 | [OpenAI Module README](docs/src/openai/README.md) | OpenAI integration module documentation and usage guide |
