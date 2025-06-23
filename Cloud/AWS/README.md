# Chatterbox AWS Infrastructure Setup Guide

This guide provides comprehensive instructions for setting up the AWS infrastructure for the Chatterbox project using Terraform. The infrastructure includes VPC, S3, DynamoDB, Secrets Manager, Parameter Store, CloudWatch, and IAM resources.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Software Installation](#software-installation)
3. [AWS Account Setup](#aws-account-setup)
4. [Local Environment Configuration](#local-environment-configuration)
5. [Terraform Infrastructure Setup](#terraform-infrastructure-setup)
6. [Secrets Migration](#secrets-migration)
7. [Validation and Testing](#validation-and-testing)
8. [Troubleshooting](#troubleshooting)
9. [Cleanup](#cleanup)

## Prerequisites

- macOS, Linux, or Windows operating system
- Internet connection
- AWS account with administrative access
- Basic familiarity with command line interfaces
- Understanding of AWS services (VPC, S3, DynamoDB, etc.)

## Software Installation

### 1. Install AWS CLI

#### macOS (using Homebrew)
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install AWS CLI
brew install awscli

# Verify installation
aws --version
```

#### macOS (using official installer)
```bash
# Download the official installer
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"

# Install the package
sudo installer -pkg AWSCLIV2.pkg -target /

# Verify installation
aws --version
```

#### Linux (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install AWS CLI
sudo apt install awscli

# Verify installation
aws --version
```

#### Linux (CentOS/RHEL/Amazon Linux)
```bash
# Install AWS CLI
sudo yum install awscli

# Verify installation
aws --version
```

#### Windows
1. Download the AWS CLI MSI installer from: https://awscli.amazonaws.com/AWSCLIV2.msi
2. Run the installer and follow the prompts
3. Open Command Prompt and verify installation:
   ```cmd
   aws --version
   ```

### 2. Install Terraform

#### macOS (using Homebrew)
```bash
# Install Terraform
brew install terraform

# Verify installation
terraform --version
```

#### macOS (using official installer)
```bash
# Download Terraform
curl -O https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_darwin_amd64.zip

# Unzip and move to PATH
unzip terraform_1.5.0_darwin_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installation
terraform --version
```

#### Linux (Ubuntu/Debian)
```bash
# Add HashiCorp GPG key
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# Add HashiCorp repository
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list

# Update and install Terraform
sudo apt update
sudo apt install terraform

# Verify installation
terraform --version
```

#### Linux (CentOS/RHEL/Amazon Linux)
```bash
# Install Terraform
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
sudo yum -y install terraform

# Verify installation
terraform --version
```

#### Windows
1. Download Terraform from: https://www.terraform.io/downloads.html
2. Extract the zip file to a directory (e.g., `C:\terraform`)
3. Add the directory to your PATH environment variable
4. Open Command Prompt and verify installation:
   ```cmd
   terraform --version
   ```

### 3. Install Node.js and npm (for project scripts)

#### macOS (using Homebrew)
```bash
# Install Node.js
brew install node

# Verify installation
node --version
npm --version
```

#### Linux (Ubuntu/Debian)
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Windows
1. Download Node.js from: https://nodejs.org/
2. Run the installer and follow the prompts
3. Open Command Prompt and verify installation:
   ```cmd
   node --version
   npm --version
   ```

## AWS Account Setup

### 1. Create IAM User (cliadmin)

1. **Sign in to AWS Console**
   - Go to https://console.aws.amazon.com/
   - Sign in with your AWS account credentials

2. **Navigate to IAM**
   - Search for "IAM" in the services search bar
   - Click on "IAM" to open the Identity and Access Management console

3. **Create User**
   - Click "Users" in the left sidebar
   - Click "Create user"
   - Enter user name: `cliadmin`
   - Check "Provide user access to the AWS Management Console" (optional)
   - Click "Next"

4. **Set Permissions**
   - Select "Attach policies directly"
   - Search for and select the following policies:
     - `AdministratorAccess` (for full access during setup)
     - `AmazonS3FullAccess`
     - `AmazonDynamoDBFullAccess`
     - `SecretsManagerReadWrite`
     - `SystemsManagerFullAccess`
     - `CloudWatchFullAccess`
     - `IAMFullAccess`
   - Click "Next"

5. **Review and Create**
   - Review the user details and permissions
   - Click "Create user"

### 2. Create Access Keys

1. **Select the User**
   - Click on the `cliadmin` user in the users list

2. **Create Access Keys**
   - Click the "Security credentials" tab
   - Scroll down to "Access keys"
   - Click "Create access key"
   - Select "Command Line Interface (CLI)"
   - Check the confirmation box
   - Click "Next"

3. **Download Credentials**
   - Click "Download .csv file" to save your credentials
   - **IMPORTANT**: Keep this file secure and never commit it to version control
   - Note the Access Key ID and Secret Access Key

### 3. Optional: Create Custom IAM Policy (More Secure)

For production environments, create a more restrictive custom policy:

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
                "iam:PassRole"
            ],
            "Resource": "*"
        }
    ]
}
```

## Local Environment Configuration

### 1. Configure AWS CLI

```bash
# Configure AWS CLI with cliadmin credentials
aws configure --profile cliadmin

# Enter the following information when prompted:
# AWS Access Key ID: [Your Access Key ID]
# AWS Secret Access Key: [Your Secret Access Key]
# Default region name: us-east-1
# Default output format: json
```

### 2. Verify AWS CLI Configuration

```bash
# Test the configuration
aws sts get-caller-identity --profile cliadmin

# Expected output:
# {
#     "UserId": "AIDA...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/cliadmin"
# }
```

### 3. Set Environment Variables

#### macOS/Linux
Add to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`):

```bash
# AWS Configuration
export AWS_PROFILE=cliadmin
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

# Terraform Configuration
export TF_VAR_environment=development
export TF_VAR_aws_region=us-east-1
```

#### Windows
Set environment variables in System Properties or use Command Prompt:

```cmd
set AWS_PROFILE=cliadmin
set AWS_REGION=us-east-1
set AWS_DEFAULT_REGION=us-east-1
set TF_VAR_environment=development
set TF_VAR_aws_region=us-east-1
```

### 4. Reload Shell Configuration

```bash
# macOS/Linux
source ~/.zshrc  # or ~/.bashrc or ~/.bash_profile

# Verify environment variables
echo $AWS_PROFILE
echo $AWS_REGION
```

## Terraform Infrastructure Setup

### 1. Check Prerequisites

```bash
# Check if all required software is installed
npm run aws:check-prerequisites
```

### 2. Setup S3 Backend

```bash
# Create S3 bucket for Terraform state
npm run aws:setup-backend
```

### 3. Initialize and Deploy Infrastructure

```bash
# Complete setup and deployment
npm run aws:deploy:auto
```

This will:
- Initialize Terraform
- Validate configuration
- Format code
- Plan deployment
- Apply infrastructure automatically

### 4. Manual Deployment (if preferred)

```bash
# Initialize Terraform
npm run aws:init

# Validate configuration
npm run aws:validate

# Format code
npm run aws:format

# Plan deployment
npm run aws:plan

# Apply deployment
npm run aws:apply
```

## Secrets Migration

### 1. Prepare Local Token Files

Ensure you have the following files:
- `tokens/gmail_tokens.json` - Gmail OAuth tokens
- `tokens/google_credentials.json` - Google service account credentials
- `.env` - Contains your OpenAI API key

### 2. Migrate Secrets to AWS

```bash
# Migrate all secrets at once
npm run aws:migrate:secrets

# Or migrate individual secrets
npm run aws:update:secret gmail-tokens
npm run aws:update:secret openai-api-key
npm run aws:update:secret google-credentials
```

### 3. Verify Secrets Migration

```bash
# Test all secrets
npm run aws:test:secrets

# Check rotation status
npm run aws:secrets:status
```

## Validation and Testing

### 1. Validate Infrastructure

```bash
# Test all AWS resources
npm run aws:test:all

# Test individual services
npm run aws:test:vpc
npm run aws:test:dynamodb
npm run aws:test:s3
npm run aws:test:secrets
npm run aws:test:parameters
npm run aws:test:iam
npm run aws:test:cloudwatch
```

### 2. View Infrastructure Outputs

```bash
# Show all outputs
npm run aws:output

# Show outputs as JSON
npm run aws:output:json

# Show current state
npm run aws:state:show
```

### 3. Monitor Infrastructure

```bash
# Enable debug logging
npm run aws:logs:enable

# View logs
npm run aws:logs:show

# Disable debug logging
npm run aws:logs:disable
```

## Available NPM Scripts

### Infrastructure Management
```bash
npm run aws:setup              # Complete setup
npm run aws:deploy             # Plan and show summary
npm run aws:deploy:auto        # Deploy automatically
npm run aws:validate           # Validate configuration
npm run aws:format             # Format Terraform code
npm run aws:plan               # Create deployment plan
npm run aws:apply              # Apply infrastructure
npm run aws:destroy            # Destroy infrastructure
```

### Testing and Validation
```bash
npm run aws:test:all           # Test all resources
npm run aws:test:vpc           # Test VPC
npm run aws:test:dynamodb      # Test DynamoDB
npm run aws:test:s3            # Test S3
npm run aws:test:secrets       # Test Secrets Manager
npm run aws:test:parameters    # Test Parameter Store
npm run aws:test:iam           # Test IAM
npm run aws:test:cloudwatch    # Test CloudWatch
```

### Secrets Management
```bash
npm run aws:migrate:secrets    # Migrate all secrets
npm run aws:update:secret      # Update individual secret
npm run aws:rotate:secrets     # Interactive rotation menu
npm run aws:secrets:status     # Check rotation status
```

### State Management
```bash
npm run aws:state:list         # List all resources
npm run aws:state:show         # Show current state
npm run aws:output             # Show outputs
npm run aws:output:json        # Show outputs as JSON
```

### Environment-Specific
```bash
npm run aws:dev:setup          # Development setup
npm run aws:dev:deploy         # Development deployment
npm run aws:dev:test           # Development testing
npm run aws:prod:setup         # Production setup
npm run aws:prod:deploy        # Production deployment
npm run aws:prod:validate      # Production validation
```

## Troubleshooting

### Common Issues

#### 1. AWS CLI Configuration Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity --profile cliadmin

# If you get an error, reconfigure:
aws configure --profile cliadmin
```

#### 2. Terraform State Issues
```bash
# If you get state lock errors:
npm run aws:force-unlock [LOCK_ID]

# If you need to reinitialize:
npm run aws:init
```

#### 3. S3 Bucket Already Exists
```bash
# If you get bucket already exists error, use a unique name:
# Update variables.tf with your account ID
```

#### 4. Permission Issues
```bash
# Verify IAM permissions
aws iam get-user --profile cliadmin

# Check if user has required policies
aws iam list-attached-user-policies --user-name cliadmin --profile cliadmin
```

#### 5. Region Issues
```bash
# Verify region configuration
aws configure list --profile cliadmin

# Set region explicitly
export AWS_REGION=us-east-1
```

### Debug Commands

```bash
# Enable Terraform debug logging
npm run aws:logs:enable

# Run terraform with debug output
npm run aws:debug:plan

# Check Terraform logs
npm run aws:logs:show
```

## Cleanup

### Destroy Infrastructure

```bash
# Destroy all resources
npm run aws:cleanup
```

### Remove IAM User

1. **Delete Access Keys**
   - Go to IAM Console
   - Select `cliadmin` user
   - Go to Security credentials tab
   - Delete access keys

2. **Delete User**
   - Go to IAM Console
   - Select `cliadmin` user
   - Click "Delete user"
   - Confirm deletion

### Remove S3 Bucket

```bash
# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile cliadmin --query Account --output text)

# Remove S3 bucket (must be empty)
aws s3 rb s3://chatterbox-terraform-state-$ACCOUNT_ID --profile cliadmin --force
```

## Security Best Practices

1. **Use Least Privilege**: Create custom IAM policies with minimal required permissions
2. **Rotate Access Keys**: Regularly rotate AWS access keys
3. **Enable MFA**: Enable multi-factor authentication for IAM users
4. **Monitor Access**: Use CloudTrail to monitor AWS API calls
5. **Secure State**: Use S3 backend with encryption for Terraform state
6. **Version Control**: Never commit AWS credentials to version control

## Cost Optimization

1. **Monitor Costs**: Set up AWS Cost Explorer and billing alerts
2. **Use Spot Instances**: For non-critical workloads
3. **Right-size Resources**: Monitor and adjust resource sizes
4. **Clean Up**: Regularly remove unused resources
5. **Use Reserved Instances**: For predictable workloads

## Support

For issues related to:
- **AWS Services**: Contact AWS Support
- **Terraform**: Check Terraform documentation and community forums
- **This Project**: Check the project repository issues

## Additional Resources

- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Secrets Migration Guide](SECRETS_MIGRATION.md)
- [Final Product Specification](FINAL_PRODUCT_SPEC.md) 