# AWS Teardown Guide

## Overview

This guide provides step-by-step instructions to completely remove all AWS components related to the Chatterbox project using the simplified infrastructure (no VPC).

## ⚠️ WARNING: DESTRUCTIVE OPERATIONS

**This process will permanently delete:**
- All AWS infrastructure (Lambda, DynamoDB, S3, etc.)
- All secrets and parameters
- All data stored in S3 and DynamoDB
- All backups and logs

**This action cannot be undone!**

## Prerequisites

1. **AWS CLI** configured with `cliadmin` profile
2. **Terraform** installed
3. **Backup** any important data before proceeding

## Step-by-Step Teardown Process

### Step 1: Create Final Backup (Optional but Recommended)

```bash
# Backup current system state
npm run aws:backup
```

### Step 2: Teardown Infrastructure

```bash
# Complete teardown using the automated script
npm run aws:teardown
```

This script will:
- Destroy all Terraform infrastructure
- Delete Lambda functions
- Delete S3 buckets
- Delete DynamoDB tables
- Delete Secrets Manager secrets
- Delete Parameter Store parameters
- Delete CloudWatch log groups
- Delete IAM roles and policies
- Delete resource groups

### Step 3: Remove Terraform State Backend

```bash
# Navigate to terraform directory
cd Cloud/AWS/terraform

# Remove S3 backend bucket (if it exists)
aws s3 rb s3://chatterbox-terraform-state-$(aws sts get-caller-identity --profile cliadmin --query Account --output text) --force --profile cliadmin

# Remove any remaining Terraform state files
rm -rf .terraform*
rm -f terraform.tfstate*
rm -f tfplan
```

### Step 4: Clean Up AWS Users and Groups

```bash
# Remove cliadmin user from chatterbox group
aws iam remove-user-from-group --user-name cliadmin --group-name chatterbox --profile cliadmin

# Delete chatterbox group
aws iam delete-group --group-name chatterbox --profile cliadmin

# Delete cliadmin user (if you want to remove it completely)
aws iam delete-access-key --access-key-id YOUR_ACCESS_KEY_ID --user-name cliadmin --profile cliadmin
aws iam delete-user --user-name cliadmin --profile cliadmin
```

### Step 5: Remove Any Remaining Resources

```bash
# List and remove any remaining S3 buckets
aws s3 ls --profile cliadmin | grep chatterbox
aws s3 rb s3://chatterbox-data --force --profile cliadmin
aws s3 rb s3://chatterbox-backups --force --profile cliadmin

# List and remove any remaining secrets
aws secretsmanager list-secrets --profile cliadmin | grep chatterbox
aws secretsmanager delete-secret --secret-id chatterbox/gmail-tokens --force-delete-without-recovery --profile cliadmin
aws secretsmanager delete-secret --secret-id chatterbox/google-credentials --force-delete-without-recovery --profile cliadmin
aws secretsmanager delete-secret --secret-id chatterbox/openai-api-key --force-delete-without-recovery --profile cliadmin

# List and remove any remaining parameters
aws ssm describe-parameters --profile cliadmin | grep chatterbox
aws ssm delete-parameter --name "/chatterbox/app-config" --profile cliadmin
aws ssm delete-parameter --name "/chatterbox/google-config" --profile cliadmin
aws ssm delete-parameter --name "/chatterbox/openai-config" --profile cliadmin
aws ssm delete-parameter --name "/chatterbox/polling-config" --profile cliadmin

# List and remove any remaining DynamoDB tables
aws dynamodb list-tables --profile cliadmin | grep chatterbox
aws dynamodb delete-table --table-name chatterbox-state --profile cliadmin

# List and remove any remaining Lambda functions
aws lambda list-functions --profile cliadmin | grep chatterbox
aws lambda delete-function --function-name development-chatterbox-email-reader --profile cliadmin
aws lambda delete-function --function-name staging-chatterbox-email-reader --profile cliadmin
aws lambda delete-function --function-name production-chatterbox-email-reader --profile cliadmin

# List and remove any remaining API Gateways
aws apigatewayv2 get-apis --profile cliadmin | grep chatterbox
aws apigatewayv2 delete-api --api-id YOUR_API_ID --profile cliadmin
```

### Step 6: Clean Up Local Files

```bash
# Remove local backups
rm -rf Cloud/AWS/backups/*

# Remove Terraform files
rm -rf Cloud/AWS/terraform/.terraform
rm -f Cloud/AWS/terraform/terraform.tfstate*
rm -f Cloud/AWS/terraform/tfplan

# Remove any local AWS configuration
rm -f ~/.aws/credentials-chatterbox
rm -f ~/.aws/config-chatterbox
```

### Step 7: Verify Complete Removal

```bash
# Check for any remaining chatterbox resources
aws s3 ls --profile cliadmin | grep chatterbox
aws secretsmanager list-secrets --profile cliadmin | grep chatterbox
aws ssm describe-parameters --profile cliadmin | grep chatterbox
aws dynamodb list-tables --profile cliadmin | grep chatterbox
aws lambda list-functions --profile cliadmin | grep chatterbox
aws iam list-groups --profile cliadmin | grep chatterbox
aws iam list-users --profile cliadmin | grep chatterbox
```

## Automated Teardown Script

You can also use the automated teardown script:

```bash
# Run complete teardown
npm run aws:teardown

# Then manually clean up users/groups as shown above
```

## Recovery Options

If you need to recover after teardown:

1. **From Backup**: Use `npm run aws:restore` if you created backups
2. **Rebuild**: Use `npm run aws:deploy` to rebuild from scratch
3. **Manual Recovery**: Follow the setup guides to recreate resources

## Troubleshooting

### Common Issues

1. **Resources Still Exist**: Some resources may have dependencies that prevent deletion
   ```bash
   # Check for dependencies
   aws lambda list-event-source-mappings --profile cliadmin
   aws lambda list-layer-versions --profile cliadmin
   ```

2. **IAM User/Group Issues**: Users must be removed from groups before deletion
   ```bash
   # Check user memberships
   aws iam list-groups-for-user --user-name cliadmin --profile cliadmin
   ```

3. **S3 Bucket Not Empty**: Buckets must be empty before deletion
   ```bash
   # Empty bucket first
   aws s3 rm s3://bucket-name --recursive --profile cliadmin
   ```

### Force Deletion

If resources won't delete normally:

```bash
# Force delete secrets
aws secretsmanager delete-secret --secret-id SECRET_NAME --force-delete-without-recovery --profile cliadmin

# Force delete S3 bucket
aws s3 rb s3://bucket-name --force --profile cliadmin
```

## Manual Cleanup Commands

If the automated teardown doesn't work, you can run these commands manually:

```bash
# Delete Lambda functions
aws lambda delete-function --function-name development-chatterbox-email-reader --profile cliadmin

# Delete S3 buckets
aws s3 rb s3://chatterbox-data --force --profile cliadmin
aws s3 rb s3://chatterbox-backups --force --profile cliadmin

# Delete DynamoDB table
aws dynamodb delete-table --table-name chatterbox-state --profile cliadmin

# Delete secrets
aws secretsmanager delete-secret --secret-id chatterbox/gmail-tokens --force-delete-without-recovery --profile cliadmin
aws secretsmanager delete-secret --secret-id chatterbox/openai-api-key --force-delete-without-recovery --profile cliadmin
aws secretsmanager delete-secret --secret-id chatterbox/google-credentials --force-delete-without-recovery --profile cliadmin

# Delete parameters
aws ssm delete-parameter --name "/chatterbox/app-config" --profile cliadmin
aws ssm delete-parameter --name "/chatterbox/google-config" --profile cliadmin
aws ssm delete-parameter --name "/chatterbox/openai-config" --profile cliadmin
aws ssm delete-parameter --name "/chatterbox/polling-config" --profile cliadmin

# Delete CloudWatch log groups
aws logs delete-log-group --log-group-name "/aws/chatterbox" --profile cliadmin
```

## Support

For issues with:
- **Teardown Scripts**: Check the script output and error messages
- **AWS Resources**: Review AWS documentation for specific services
- **Manual Cleanup**: Use the AWS CLI commands provided above 