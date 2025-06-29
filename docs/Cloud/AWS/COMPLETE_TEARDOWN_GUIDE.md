# Complete AWS Teardown Guide

## Overview

This guide provides step-by-step instructions to completely remove all AWS components related to the Chatterbox project, including infrastructure, users, and groups.

## ⚠️ WARNING: DESTRUCTIVE OPERATIONS

**This process will permanently delete:**
- All AWS infrastructure (VPC, Lambda, DynamoDB, S3, etc.)
- All secrets and parameters
- All data stored in S3 and DynamoDB
- AWS users and groups
- All backups and logs

**This action cannot be undone!**

## Prerequisites

1. **AWS CLI** configured with `cliadmin` profile
2. **Terraform** installed
3. **Backup** any important data before proceeding

## Step-by-Step Teardown Process

### Step 1: Create Final Backup (Optional but Recommended)

```bash
# Backup all environments
npm run aws:backup:dev
npm run aws:backup:staging
npm run aws:backup:prod
```

### Step 2: Teardown Infrastructure by Environment

```bash
# Teardown development environment
npm run aws:teardown:dev

# Teardown staging environment  
npm run aws:teardown:staging

# Teardown production environment
npm run aws:teardown:prod
```

### Step 3: Remove Terraform State Backend

```bash
# Navigate to terraform directory
cd Cloud/AWS/terraform

# Remove S3 backend bucket (if it exists)
aws s3 rb s3://chatterbox-terraform-state-855581761117 --force --profile cliadmin

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

# List and remove any remaining VPCs
aws ec2 describe-vpcs --profile cliadmin | grep chatterbox
aws ec2 delete-vpc --vpc-id YOUR_VPC_ID --profile cliadmin
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
aws ec2 describe-vpcs --profile cliadmin | grep chatterbox
aws iam list-groups --profile cliadmin | grep chatterbox
aws iam list-users --profile cliadmin | grep chatterbox
```

## Automated Teardown Script

You can also use the automated teardown script:

```bash
# Run complete teardown for all environments
npm run aws:teardown:dev
npm run aws:teardown:staging  
npm run aws:teardown:prod

# Then manually clean up users/groups as shown above
```

## Recovery Options

If you need to recover after teardown:

1. **From Backup**: Use `npm run aws:restore:dev` if you created backups
2. **Rebuild**: Use `npm run aws:build:dev` to rebuild from scratch
3. **Manual Recovery**: Follow the setup guides to recreate resources

## Troubleshooting

### Common Issues

1. **Resources Still Exist**: Some resources may have dependencies that prevent deletion
   ```bash
   # Check for dependencies
   aws ec2 describe-vpc-peering-connections --profile cliadmin
   aws ec2 describe-internet-gateways --profile cliadmin
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

# Force delete VPC (after removing all dependencies)
aws ec2 delete-vpc --vpc-id VPC_ID --profile cliadmin
```

## Final Verification

After completing all steps, verify nothing remains:

```bash
# Comprehensive check
echo "Checking for remaining chatterbox resources..."
aws s3 ls --profile cliadmin | grep chatterbox || echo "No S3 buckets found"
aws secretsmanager list-secrets --profile cliadmin | grep chatterbox || echo "No secrets found"
aws ssm describe-parameters --profile cliadmin | grep chatterbox || echo "No parameters found"
aws dynamodb list-tables --profile cliadmin | grep chatterbox || echo "No DynamoDB tables found"
aws lambda list-functions --profile cliadmin | grep chatterbox || echo "No Lambda functions found"
aws ec2 describe-vpcs --profile cliadmin | grep chatterbox || echo "No VPCs found"
aws iam list-groups --profile cliadmin | grep chatterbox || echo "No groups found"
aws iam list-users --profile cliadmin | grep chatterbox || echo "No users found"

echo "Teardown complete!"
```

## Summary

This process will completely remove all AWS components related to the Chatterbox project. Make sure you have backups of any important data before proceeding, as this action cannot be undone. 