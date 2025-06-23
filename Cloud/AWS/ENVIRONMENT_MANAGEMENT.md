# AWS Environment Management System

This document describes the multi-environment AWS infrastructure management system for Chatterbox, supporting development, staging, and production environments.

## Overview

The environment management system allows you to:
- Deploy separate AWS infrastructure for each environment
- Manage environment-specific configurations
- Migrate secrets to environment-specific locations
- Maintain isolated state files for each environment
- Deploy single or multiple environments from the command line

## Available Environments

| Environment | Purpose | Description |
|-------------|---------|-------------|
| `development` | Development | Environment for testing and development |
| `staging` | Pre-production | Environment for pre-production testing |
| `production` | Live | Production environment for live applications |

## Environment Configurations

Each environment has its own configuration file in `Cloud/AWS/terraform/environments/`:

### Development (`development.tfvars`)
- **VPC CIDR**: `10.0.0.0/16`
- **Availability Zones**: `us-east-1a`, `us-east-1b`
- **Resource Prefix**: `chatterbox-dev-*`
- **Backup Retention**: 30 days
- **Log Retention**: 30 days
- **Debug Logging**: Enabled
- **Cost Alerts**: Disabled

### Staging (`staging.tfvars`)
- **VPC CIDR**: `10.1.0.0/16`
- **Availability Zones**: `us-east-1a`, `us-east-1b`, `us-east-1c`
- **Resource Prefix**: `chatterbox-staging-*`
- **Backup Retention**: 60 days
- **Log Retention**: 90 days
- **Debug Logging**: Enabled
- **Cost Alerts**: Enabled

### Production (`production.tfvars`)
- **VPC CIDR**: `10.2.0.0/16`
- **Availability Zones**: `us-east-1a`, `us-east-1b`, `us-east-1c`
- **Resource Prefix**: `chatterbox-prod-*`
- **Backup Retention**: 90 days
- **Log Retention**: 365 days
- **Debug Logging**: Disabled
- **Cost Alerts**: Enabled

## Quick Start

### 1. List Available Environments
```bash
npm run aws:env:list
```

### 2. Deploy a Single Environment
```bash
# Deploy development environment
npm run aws:env:deploy development

# Deploy staging environment
npm run aws:env:deploy staging

# Deploy production environment
npm run aws:env:deploy production
```

### 3. Deploy Multiple Environments
```bash
# Interactive selection
npm run aws:env:deploy

# Deploy all environments
npm run aws:env:deploy --all
```

### 4. Check Environment Status
```bash
npm run aws:env:status development
```

### 5. Destroy an Environment
```bash
npm run aws:env:destroy development
```

## Command Reference

### Environment Management Commands

#### Deploy Infrastructure
```bash
# Interactive deployment
npm run aws:env:deploy

# Deploy specific environment
npm run aws:env:deploy <environment>

# Deploy with options
npm run aws:env:deploy <environment> --dry-run
npm run aws:env:deploy <environment> --force
```

#### Destroy Infrastructure
```bash
# Destroy specific environment
npm run aws:env:destroy <environment>

# Destroy with options
npm run aws:env:destroy <environment> --dry-run
npm run aws:env:destroy <environment> --force
```

#### List and Status
```bash
# List all environments
npm run aws:env:list

# Check environment status
npm run aws:env:status <environment>
```

### Convenience Commands

#### Quick Deploy Commands
```bash
npm run aws:env:deploy:dev      # Deploy development
npm run aws:env:deploy:staging  # Deploy staging
npm run aws:env:deploy:prod     # Deploy production
```

#### Quick Destroy Commands
```bash
npm run aws:env:destroy:dev     # Destroy development
npm run aws:env:destroy:staging # Destroy staging
npm run aws:env:destroy:prod    # Destroy production
```

## Secret Management

### Environment-Specific Secret Migration

Each environment has its own secret namespace in AWS Secrets Manager:

- **Development**: `chatterbox-dev/*`
- **Staging**: `chatterbox-staging/*`
- **Production**: `chatterbox-prod/*`

#### Migrate Secrets to Environment
```bash
# Migrate secrets for specific environment
npm run aws:migrate:secrets:env development
npm run aws:migrate:secrets:env staging
npm run aws:migrate:secrets:env production

# Quick commands
npm run aws:migrate:secrets:env:dev
npm run aws:migrate:secrets:env:staging
npm run aws:migrate:secrets:env:prod
```

#### Secret Migration Options
```bash
# Dry run (show what would be done)
npm run aws:migrate:secrets:env development --dry-run

# Force update (even if values are the same)
npm run aws:migrate:secrets:env development --force

# Update only (don't create new secrets)
npm run aws:migrate:secrets:env development --update-only
```

### Secrets Managed

1. **Gmail Tokens** (`gmail-tokens`)
   - Source: `tokens/gmail_tokens.json`
   - Required: Yes
   - Format: JSON with email-to-token mapping

2. **OpenAI API Key** (`openai-api-key`)
   - Source: `.env` file
   - Required: Yes
   - Format: API key starting with `sk-`

3. **Google Credentials** (`google-credentials`)
   - Source: `tokens/google_credentials.json`
   - Required: No
   - Format: Service account or web client JSON

## Infrastructure Components

Each environment deploys the following AWS resources:

### Core Infrastructure
- **VPC** with environment-specific CIDR blocks
- **Subnets** across multiple availability zones
- **Internet Gateway** and **Route Tables**
- **VPC Endpoints** for AWS services (optional)

### Data Storage
- **DynamoDB Table** for application state
- **S3 Bucket** for data storage
- **S3 Backup Bucket** for backups

### Security & Configuration
- **Secrets Manager** for sensitive data
- **Parameter Store** for configuration
- **IAM Roles** and **Policies**

### Monitoring
- **CloudWatch Log Groups** for application logs
- **CloudWatch Alarms** for monitoring (staging/production)

## State Management

Each environment maintains its own Terraform state:

- **Development**: `terraform.tfstate`
- **Staging**: `staging/terraform.tfstate`
- **Production**: `production/terraform.tfstate`

All states are stored in the same S3 backend bucket with different keys for isolation.

## Best Practices

### Development Workflow
1. **Development Environment**: Use for daily development and testing
2. **Staging Environment**: Use for integration testing and pre-production validation
3. **Production Environment**: Use for live applications only

### Deployment Strategy
1. Always test changes in development first
2. Promote working changes to staging
3. Only deploy to production after staging validation
4. Use `--dry-run` to preview changes before applying

### Security Considerations
- Each environment has isolated resources
- Production uses stricter security settings
- Secrets are environment-specific
- Cost alerts are enabled for staging and production

### Cost Management
- Development: Minimal resources, cost alerts disabled
- Staging: Moderate resources, cost alerts enabled
- Production: Full resources, comprehensive monitoring

## Troubleshooting

### Common Issues

#### Backend Configuration Errors
```bash
# Reconfigure backend for environment
cd Cloud/AWS/terraform
terraform init -reconfigure
```

#### State Lock Issues
```bash
# Force unlock if needed
npm run aws:force-unlock
```

#### Permission Errors
```bash
# Verify AWS credentials
aws sts get-caller-identity --profile cliadmin
```

#### Resource Naming Conflicts
- Each environment uses unique resource names
- Check environment configuration files
- Ensure proper environment variable is set

### Debug Mode
```bash
# Enable debug logging
npm run aws:logs:enable

# Run deployment with debug
npm run aws:env:deploy development

# Disable debug logging
npm run aws:logs:disable
```

## Advanced Usage

### Custom Environment Configuration

To add a new environment:

1. Create configuration file: `Cloud/AWS/terraform/environments/custom.tfvars`
2. Add environment to `ENVIRONMENTS` in `scripts/aws/manage-environments.js`
3. Add environment to `ENVIRONMENTS` in `scripts/aws/migrate-secrets-env.js`

### Environment-Specific Variables

You can override any Terraform variable per environment by adding it to the `.tfvars` file:

```hcl
# custom.tfvars
environment = "custom"
aws_region = "us-west-2"
vpc_cidr_block = "10.3.0.0/16"
enable_debug_logging = true
```

### CI/CD Integration

The environment management system is designed to work with CI/CD pipelines:

```bash
# CI setup
npm run aws:ci:setup

# CI validation
npm run aws:ci:validate

# CI deployment
npm run aws:ci:apply

# CI testing
npm run aws:ci:test

# CI cleanup
npm run aws:ci:cleanup
```

## Support

For issues or questions about the environment management system:

1. Check the troubleshooting section above
2. Review the environment configuration files
3. Use debug mode for detailed logging
4. Consult the main AWS documentation in `Cloud/AWS/README.md` 