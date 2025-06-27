# Chatterbox System Orchestration Guide

## Overview

This guide explains the consolidated system approach for managing the Chatterbox AWS infrastructure. The system follows a clear separation of concerns with two main user roles:

1. **Initial Admin User** (`cliadmin`) - Creates the Chatterbox system
2. **Chatterbox Admin User** (`chatteradmin`) - Manages the system operations

## System Architecture

### User Roles & Permissions

#### Initial Admin User (`cliadmin`)
- **Purpose**: Bootstrap the Chatterbox system
- **Permissions**: Full AWS admin access to create IAM users/groups
- **Usage**: Only used during initial setup and complete teardown
- **Profile**: `cliadmin`

#### Chatterbox Admin User (`chatteradmin`)
- **Purpose**: Manage all Chatterbox operations
- **Permissions**: Limited to Chatterbox-specific resources
- **Usage**: All day-to-day operations
- **Profile**: `chatteradmin` (created during setup)

### Prerequisites Checklist

Before running the system setup, ensure you have:

#### 1. AWS Admin User
- ✅ Existing AWS user with permissions to create IAM users and groups
- ✅ Configured as `cliadmin` profile: `aws configure --profile cliadmin`

#### 2. GCP Account
- ✅ Google Cloud Platform account
- ✅ Gmail API enabled
- ✅ OAuth2 credentials configured

#### 3. Gmail API Credentials
- ✅ OAuth2 client ID
- ✅ OAuth2 client secret
- ✅ Properly configured redirect URIs

#### 4. Email Addresses
- ✅ Email for polling (receiving emails)
- ✅ Email for sending (sending emails)
- ✅ Email for testing (testing functionality)

#### 5. OpenAI API Account
- ✅ OpenAI account with API access
- ✅ Valid API key with sufficient credits

#### 6. Development Tools
- ✅ Terraform CLI
- ✅ AWS CLI
- ✅ Node.js and npm

## Consolidated Scripts

### 1. System Setup (`aws:setup-system`)

**Command**: `npm run aws:setup-system`

**What it does**:
1. ✅ Checks all prerequisites
2. ✅ Validates existing Chatterbox system
3. ✅ Creates `chatteradmingrp` group (if needed)
4. ✅ Creates `chatteradmin` user (if needed)
5. ✅ Configures permissions
6. ✅ Optionally deploys infrastructure
7. ✅ Tests the complete system

**Usage**:
```bash
# Complete system setup
npm run aws:setup-system

# Or using the alias
npm run aws:system:setup
```

### 2. System Cleanup (`aws:cleanup-system`)

**Command**: `npm run aws:cleanup-system`

**What it does**:
1. ✅ Destroys all AWS infrastructure
2. ✅ Removes `chatteradmin` user
3. ✅ Removes `chatteradmingrp` group
4. ✅ Deletes all IAM policies
5. ✅ Cleans up S3 backend
6. ✅ Removes local Terraform files

**Usage**:
```bash
# Complete system teardown
npm run aws:cleanup-system

# Or using the alias
npm run aws:system:cleanup
```

## Workflow Examples

### Fresh Installation

```bash
# 1. Setup the complete system
npm run aws:setup-system

# 2. Test the system
npm run aws:admin:test-user

# 3. Deploy infrastructure (if not done during setup)
npm run aws:deploy
```

### Complete Reset

```bash
# 1. Clean up everything
npm run aws:cleanup-system

# 2. Start fresh
npm run aws:setup-system
```

### Day-to-Day Operations

```bash
# Test system health
npm run aws:admin:test-user

# Deploy changes
npm run aws:deploy

# Check infrastructure status
npm run aws:state:list
```

## Individual Scripts (For Testing & Tweaking)

While the consolidated scripts handle the main workflows, individual scripts are available for specific tasks:

### Admin Management
- `npm run aws:admin:create-group` - Create admin group only
- `npm run aws:admin:add-user` - Add admin user only
- `npm run aws:admin:test-user` - Test admin permissions

### Infrastructure Management
- `npm run aws:setup-backend` - Setup Terraform backend
- `npm run aws:deploy` - Deploy infrastructure
- `npm run aws:destroy` - Destroy infrastructure

### Testing
- `npm run aws:test:all` - Test all AWS resources
- `npm run aws:test:s3` - Test S3 access
- `npm run aws:test:dynamodb` - Test DynamoDB access
- `npm run aws:test:secrets` - Test Secrets Manager
- `npm run aws:test:parameters` - Test Parameter Store

### Secrets Management
- `npm run aws:migrate:secrets` - Migrate secrets to AWS
- `npm run aws:update:secret` - Update specific secret
- `npm run aws:rotate:secrets` - Rotate secrets

## Security Considerations

### User Separation
- `cliadmin` should only be used for system setup/teardown
- `chatteradmin` should be used for all operational tasks
- Never use `cliadmin` for day-to-day operations

### Credential Management
- Store sensitive credentials in AWS Secrets Manager
- Use Parameter Store for configuration
- Rotate credentials regularly

### Access Control
- `chatteradmin` has minimal required permissions
- All access is logged to CloudWatch
- Regular security audits recommended

## Troubleshooting

### Common Issues

#### "Resolved credential object is not valid"
```bash
# Set environment variables
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY

# Or use profile
export AWS_PROFILE=cliadmin
```

#### "User not found" errors
```bash
# Check if user exists
aws iam get-user --user-name chatteradmin --profile cliadmin

# Recreate if needed
npm run aws:admin:setup
```

#### Terraform state issues
```bash
# Reinitialize Terraform
cd Cloud/AWS/terraform
terraform init
terraform plan
```

### Getting Help

1. **Check logs**: `npm run aws:logs:show`
2. **Test individual components**: Use specific test scripts
3. **Validate infrastructure**: `npm run aws:validate:infrastructure`
4. **Check prerequisites**: `npm run aws:check-prerequisites`

## Migration from Local Storage

The system automatically migrates from local .txt files to AWS services:

- **State data** → DynamoDB
- **Credentials** → Secrets Manager  
- **Configuration** → Parameter Store
- **Backups** → S3
- **Logs** → CloudWatch

Migration is handled automatically during setup, but can be run manually:
```bash
npm run aws:migrate:secrets
npm run aws:smart-migrate
```

## Best Practices

1. **Always use the consolidated scripts** for main operations
2. **Test after any changes** using `npm run aws:admin:test-user`
3. **Keep credentials secure** and rotate regularly
4. **Monitor costs** using AWS Cost Explorer
5. **Backup regularly** using the backup scripts
6. **Use separate environments** for dev/staging/prod

## Next Steps

After successful setup:

1. Configure Gmail API credentials in Secrets Manager
2. Set up email polling configuration
3. Configure OpenAI API key
4. Test email sending/receiving
5. Set up monitoring and alerts
6. Configure backup schedules

For detailed configuration, see the individual service documentation in the `Cloud/AWS/` directory. 