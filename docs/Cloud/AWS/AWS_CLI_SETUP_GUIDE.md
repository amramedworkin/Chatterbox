# Chatterbox AWS CLI Setup Guide

This guide provides instructions for setting up AWS CLI access for the Chatterbox project. The simplified infrastructure uses basic AWS services without complex VPC configurations.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Software Installation](#software-installation)
3. [AWS Account Setup](#aws-account-setup)
4. [Local Environment Configuration](#local-environment-configuration)
5. [Security Best Practices](#security-best-practices)
6. [Troubleshooting](#troubleshooting)
7. [Cleanup](#cleanup)

## Prerequisites

- macOS, Linux, or Windows operating system
- Internet connection
- AWS account with administrative access
- Basic familiarity with command line interfaces
- Understanding of AWS services (S3, DynamoDB, Lambda, etc.)

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

### 2. Install Node.js and npm (for project scripts)

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
     - `AWSLambda_FullAccess`
     - `IAMFullAccess`
   - Click "Next"

5. **Review and Create**
   - Review the user details
   - Click "Create user"

### 2. Create Access Keys

1. **Select the User**
   - Click on the `cliadmin` user you just created

2. **Create Access Key**
   - Go to the "Security credentials" tab
   - Click "Create access key"
   - Select "Command Line Interface (CLI)"
   - Check the confirmation box
   - Click "Next"

3. **Set Description Tag**
   - Add a description: `Chatterbox CLI Access`
   - Click "Create access key"

4. **Save Credentials**
   - **IMPORTANT**: Download the CSV file or copy the credentials
   - You will not be able to see the secret access key again
   - Save the credentials securely

## Local Environment Configuration

### 1. Configure AWS CLI

```bash
# Configure AWS CLI with your credentials
aws configure --profile cliadmin
```

You will be prompted for:
- **AWS Access Key ID**: Enter your access key
- **AWS Secret Access Key**: Enter your secret key
- **Default region name**: Enter `us-east-1` (or your preferred region)
- **Default output format**: Enter `json`

### 2. Verify Configuration

```bash
# Test your configuration
aws sts get-caller-identity --profile cliadmin

# Set the profile as default (optional)
export AWS_PROFILE=cliadmin

# Verify region
echo $AWS_REGION
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

#### 2. Permission Issues
```bash
# Verify IAM permissions
aws iam get-user --profile cliadmin

# Check if user has required policies
aws iam list-attached-user-policies --user-name cliadmin --profile cliadmin
```

#### 3. Region Issues
```bash
# Verify region configuration
aws configure list --profile cliadmin

# Set region explicitly
export AWS_REGION=us-east-1
```

## Cleanup

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
- **This Project**: Check the project repository issues

## Additional Resources

- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Security Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html) 