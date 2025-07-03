#!/bin/bash

# Complete teardown script for Chatterbox infrastructure
# This script removes all Chatterbox resources including orphaned resources and legacy parameters

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"development"}
AWS_REGION=${AWS_REGION:-"us-east-1"}
AWS_PROFILE=${AWS_PROFILE:-"cliadmin"}

echo -e "${RED}🗑️  COMPLETE CHATTERBOX INFRASTRUCTURE TEARDOWN${NC}"
echo -e "${RED}Environment: ${ENVIRONMENT}${NC}"
echo -e "${RED}Region: ${AWS_REGION}${NC}"
echo -e "${RED}Profile: ${AWS_PROFILE}${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will delete ALL Chatterbox resources!${NC}"
echo -e "${YELLOW}⚠️  Only chatteradmin IAM resources will be preserved.${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${BLUE}Teardown cancelled.${NC}"
    exit 0
fi

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check AWS credentials
print_info "Checking AWS credentials..."
if ! aws sts get-caller-identity --profile $AWS_PROFILE > /dev/null 2>&1; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi
print_status "AWS credentials verified"

# Step 1: Destroy Terraform infrastructure
print_info "Destroying Terraform infrastructure..."
cd "$(dirname "$0")"

# Check if terraform state exists
if [ -f ".terraform/terraform.tfstate" ] || [ -f "terraform.tfstate" ]; then
    print_info "Running terraform destroy..."
    terraform destroy -auto-approve
    print_status "Terraform infrastructure destroyed"
else
    print_warning "No Terraform state found, skipping terraform destroy"
fi

# Step 2: Remove Lambda functions manually (in case terraform didn't catch them)
print_info "Removing Lambda functions..."
LAMBDA_FUNCTIONS=(
    "${ENVIRONMENT}-poll-gmail"
    "${ENVIRONMENT}-pull-latest-chatterbox-email"
)

for func in "${LAMBDA_FUNCTIONS[@]}"; do
    if aws lambda get-function --function-name "$func" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing Lambda function: $func"
        aws lambda delete-function --function-name "$func" --profile $AWS_PROFILE
        print_status "Removed Lambda function: $func"
    else
        print_warning "Lambda function $func not found"
    fi
done

# Step 3: Remove API Gateway
print_info "Removing API Gateway..."
API_GATEWAYS=$(aws apigateway get-rest-apis --profile $AWS_PROFILE --query 'items[?contains(name, `chatterbox`) || contains(name, `'${ENVIRONMENT}'`)].id' --output text)

if [ -n "$API_GATEWAYS" ]; then
    for api_id in $API_GATEWAYS; do
        print_info "Removing API Gateway: $api_id"
        aws apigateway delete-rest-api --rest-api-id "$api_id" --profile $AWS_PROFILE
        print_status "Removed API Gateway: $api_id"
    done
else
    print_warning "No API Gateway found"
fi

# Step 4: Remove S3 buckets
print_info "Removing S3 buckets..."
S3_BUCKETS=(
    "${ENVIRONMENT}-chatterbox-data-bucket"
    "${ENVIRONMENT}-chatterbox-backup-bucket"
    "${ENVIRONMENT}-chatterbox-email-archive"
    "chatterbox-email-archive"
)

for bucket in "${S3_BUCKETS[@]}"; do
    if aws s3 ls "s3://$bucket" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing S3 bucket: $bucket"
        
        # Check if bucket has versioning enabled or suspended
        VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket "$bucket" --profile $AWS_PROFILE --query 'Status' --output text 2>/dev/null || echo "NotVersioned")
        
        if [ "$VERSIONING_STATUS" = "Enabled" ] || [ "$VERSIONING_STATUS" = "Suspended" ]; then
            print_info "  Bucket has versioning: $VERSIONING_STATUS - enabling versioning and deleting all versions"
            
            # Ensure versioning is enabled (in case it was suspended)
            aws s3api put-bucket-versioning --bucket "$bucket" --versioning-configuration Status=Enabled --profile $AWS_PROFILE
            
            # Get all object versions and delete markers
            aws s3api list-object-versions --bucket "$bucket" --profile $AWS_PROFILE --output json > "s3_versions_${bucket}.json"
            
            # Delete all versions
            jq -c '.Versions[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r version; do
                if [ -n "$version" ]; then
                    KEY=$(echo "$version" | jq -r '.Key')
                    VERSION_ID=$(echo "$version" | jq -r '.VersionId')
                    print_info "    Deleting version: $KEY ($VERSION_ID)"
                    aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1
                fi
            done
            
            # Delete all delete markers
            jq -c '.DeleteMarkers[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r marker; do
                if [ -n "$marker" ]; then
                    KEY=$(echo "$marker" | jq -r '.Key')
                    VERSION_ID=$(echo "$marker" | jq -r '.VersionId')
                    print_info "    Deleting delete marker: $KEY ($VERSION_ID)"
                    aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1
                fi
            done
            
            # Clean up temporary file
            rm -f "s3_versions_${bucket}.json"
        else
            print_info "  Bucket has no versioning - deleting objects normally"
            # Empty the bucket first
            aws s3 rm "s3://$bucket" --recursive --profile $AWS_PROFILE
        fi
        
        # Delete the bucket
        aws s3 rb "s3://$bucket" --profile $AWS_PROFILE
        print_status "Removed S3 bucket: $bucket"
    else
        print_warning "S3 bucket $bucket not found - skipping deletion"
    fi
done

# Wait a moment for S3 deletions to complete
print_info "Waiting for S3 deletions to complete..."
sleep 5

# Note about Terraform state bucket
print_info "Checking Terraform state bucket..."
TERRAFORM_STATE_BUCKET="chatterbox-terraform-state-855581761117"
if aws s3 ls "s3://$TERRAFORM_STATE_BUCKET" --profile $AWS_PROFILE > /dev/null 2>&1; then
    print_warning "⚠️  Terraform state bucket $TERRAFORM_STATE_BUCKET exists and is PRESERVED"
    print_warning "⚠️  DO NOT DELETE - This bucket contains Terraform state files"
    print_warning "⚠️  Only remove when permanently decommissioning the entire project"
    print_warning "⚠️  Deleting this bucket will break future Terraform operations"
else
    print_error "❌ CRITICAL: Terraform state bucket $TERRAFORM_STATE_BUCKET is missing!"
    print_error "❌ This will prevent Terraform from managing infrastructure"
    print_error "❌ Check if the bucket was accidentally deleted"
fi

# Step 5: Remove DynamoDB tables
print_info "Removing DynamoDB tables..."
DYNAMODB_TABLES=(
    "${ENVIRONMENT}-chatterbox-state-table"
)

for table in "${DYNAMODB_TABLES[@]}"; do
    if aws dynamodb describe-table --table-name "$table" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing DynamoDB table: $table"
        aws dynamodb delete-table --table-name "$table" --profile $AWS_PROFILE
        print_status "Removed DynamoDB table: $table"
    else
        print_warning "DynamoDB table $table not found"
    fi
done

# Step 6: Remove Secrets Manager secrets
print_info "Removing Secrets Manager secrets..."
SECRETS=(
    "${ENVIRONMENT}-chatterbox-google-credentials"
    "${ENVIRONMENT}-chatterbox-gmail-tokens"
    "chatterbox/google-credentials"
    "chatterbox/gmail-tokens"
    "chatterbox/openai-api-key"
    "chatterbox-dev/google-credentials"
    "chatterbox-dev/gmail-tokens"
    "chatterbox-dev/openai-api-key"
    "${ENVIRONMENT}-chatterbox-openai-api-key"
)

for secret in "${SECRETS[@]}"; do
    if aws secretsmanager describe-secret --secret-id "$secret" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing secret: $secret"
        aws secretsmanager delete-secret --secret-id "$secret" --force-delete-without-recovery --profile $AWS_PROFILE
        print_status "Removed secret: $secret"
    else
        print_warning "Secret $secret not found"
    fi
done

# Step 7: Remove Parameter Store parameters
print_info "Removing Parameter Store parameters..."
# Remove all chatterbox parameters under different paths
CHATTERBOX_PATHS=(
    "/chatterbox/${ENVIRONMENT}"
    "/chatterbox/development"
    "/chatterbox/polling"
    "/chatterbox/google-config"
    "/chatterbox/openai-config"
)

for path_prefix in "${CHATTERBOX_PATHS[@]}"; do
    PARAMETERS=$(aws ssm get-parameters-by-path --path "$path_prefix" --profile $AWS_PROFILE --query 'Parameters[*].Name' --output text 2>/dev/null || echo "")
    
    if [ -n "$PARAMETERS" ]; then
        for param in $PARAMETERS; do
            print_info "Removing parameter: $param"
            aws ssm delete-parameter --name "$param" --profile $AWS_PROFILE
            print_status "Removed parameter: $param"
        done
    else
        print_warning "No parameters found under path: $path_prefix"
    fi
done

# Step 8: Remove CloudWatch log groups
print_info "Removing CloudWatch log groups..."
LOG_GROUPS=(
    "/aws/lambda/${ENVIRONMENT}-poll-gmail"
    "/aws/lambda/${ENVIRONMENT}-pull-latest-chatterbox-email"
    "/aws/chatterbox"
)

for log_group in "${LOG_GROUPS[@]}"; do
    if aws logs describe-log-groups --log-group-name-prefix "$log_group" --profile $AWS_PROFILE --query 'logGroups[0].logGroupName' --output text | grep -q "$log_group"; then
        print_info "Removing log group: $log_group"
        aws logs delete-log-group --log-group-name "$log_group" --profile $AWS_PROFILE
        print_status "Removed log group: $log_group"
    else
        print_warning "Log group $log_group not found"
    fi
done

# Step 9: Remove IAM roles and policies (except chatteradmin)
print_info "Removing IAM roles and policies..."
IAM_ROLES=(
    "${ENVIRONMENT}-chatterbox-lambda-role"
    "${ENVIRONMENT}-chatterbox-role"
)

for role in "${IAM_ROLES[@]}"; do
    if aws iam get-role --role-name "$role" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing IAM role: $role"
        # Detach policies first
        ATTACHED_POLICIES=$(aws iam list-attached-role-policies --role-name "$role" --profile $AWS_PROFILE --query 'AttachedPolicies[*].PolicyArn' --output text)
        for policy_arn in $ATTACHED_POLICIES; do
            if [ -n "$policy_arn" ]; then
                aws iam detach-role-policy --role-name "$role" --policy-arn "$policy_arn" --profile $AWS_PROFILE
                print_info "  Detached policy: $policy_arn"
            fi
        done
        # Delete inline policies
        INLINE_POLICIES=$(aws iam list-role-policies --role-name "$role" --profile $AWS_PROFILE --query 'PolicyNames[*]' --output text)
        for policy_name in $INLINE_POLICIES; do
            if [ -n "$policy_name" ]; then
                aws iam delete-role-policy --role-name "$role" --policy-name "$policy_name" --profile $AWS_PROFILE
                print_info "  Deleted inline policy: $policy_name"
            fi
        done
        # Delete the role
        aws iam delete-role --role-name "$role" --profile $AWS_PROFILE
        print_status "Removed IAM role: $role"
    else
        print_warning "IAM role $role not found"
    fi
done

IAM_POLICIES=(
    "${ENVIRONMENT}-chatterbox-lambda-policy"
    "${ENVIRONMENT}-chatterbox-policy"
)

for policy in "${IAM_POLICIES[@]}"; do
    if aws iam get-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text):policy/$policy" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing IAM policy: $policy"
        # List and delete policy versions (except default)
        POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text):policy/$policy"
        POLICY_VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)
        for version in $POLICY_VERSIONS; do
            if [ -n "$version" ]; then
                aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$version" --profile $AWS_PROFILE
                print_info "  Deleted policy version: $version"
            fi
        done
        # Delete the policy
        aws iam delete-policy --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE
        print_status "Removed IAM policy: $policy"
    else
        print_warning "IAM policy $policy not found"
    fi
done

# Step 10: Remove resource group manually (in case terraform didn't catch it)
print_info "Removing resource group..."
RESOURCE_GROUP="${ENVIRONMENT}-chatterbox-resources"

if aws resource-groups get-group --group-name "$RESOURCE_GROUP" --profile $AWS_PROFILE > /dev/null 2>&1; then
    print_info "Removing resource group: $RESOURCE_GROUP"
    aws resource-groups delete-group --group-name "$RESOURCE_GROUP" --profile $AWS_PROFILE
    print_status "Removed resource group: $RESOURCE_GROUP"
else
    print_warning "Resource group $RESOURCE_GROUP not found"
fi

# Step 11: Clean up local files
print_info "Cleaning up local files..."
rm -f lambda.zip
rm -f tfplan
rm -f response.json
rm -f out.json
print_status "Local files cleaned up"

# Step 12: Run legacy parameter cleanup script
print_info "Running legacy parameter cleanup..."
# Go to project root from current directory
cd /Users/n091733/Projects/Chatterbox
if [ -f "scripts/cleanup-legacy-parameters.js" ]; then
    node scripts/cleanup-legacy-parameters.js
    print_status "Legacy parameters cleaned up"
else
    print_warning "Legacy parameter cleanup script not found"
fi

echo ""
echo -e "${GREEN}🎉 Complete Chatterbox infrastructure teardown finished!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Run the deployment script: npm run aws:deploy:init -- <init-folder>"
echo "2. Populate secrets and parameters"
echo "3. Test the new architecture" 