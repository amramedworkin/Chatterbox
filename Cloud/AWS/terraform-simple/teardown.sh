#!/bin/bash

# Complete teardown script for Chatterbox infrastructure
# This script removes all Chatterbox resources including orphaned resources and legacy parameters

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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
echo -e "${CYAN}Starting automatic teardown...${NC}"
echo ""

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
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Check AWS credentials
print_info "Checking AWS credentials..."
if ! aws sts get-caller-identity --profile $AWS_PROFILE > /dev/null 2>&1; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi
print_status "AWS credentials verified"

# Step 0: Pre-clean S3 buckets (enable versioning if suspended, delete all objects/versions)
print_info "Pre-cleaning S3 buckets (enable versioning if suspended, delete all objects/versions)..."
S3_BUCKETS_PRE=(
    "${ENVIRONMENT}-chatterbox-data-bucket"
    "${ENVIRONMENT}-chatterbox-backup-bucket"
    "${ENVIRONMENT}-chatterbox-email-archive"
    "chatterbox-email-archive"
)
EMAIL_PROCESSING_BUCKETS_PRE=$(aws s3api list-buckets --profile $AWS_PROFILE --query 'Buckets[?contains(Name, `chatterbox-attachments`) || contains(Name, `chatterbox-email-content`)].Name' --output text 2>/dev/null || echo "")
if [ -n "$EMAIL_PROCESSING_BUCKETS_PRE" ]; then
    for bucket in $EMAIL_PROCESSING_BUCKETS_PRE; do
        S3_BUCKETS_PRE+=("$bucket")
    done
fi
for bucket in "${S3_BUCKETS_PRE[@]}"; do
    if aws s3 ls "s3://$bucket" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Pre-cleaning S3 bucket: $bucket"
        VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket "$bucket" --profile $AWS_PROFILE --query 'Status' --output text 2>/dev/null || echo "NotVersioned")
        if [ "$VERSIONING_STATUS" = "Suspended" ]; then
            print_info "  Bucket versioning is SUSPENDED - enabling versioning before deletion"
            aws s3api put-bucket-versioning --bucket "$bucket" --versioning-configuration Status=Enabled --profile $AWS_PROFILE || true
        fi
        # Now delete all versions and delete markers
        aws s3api list-object-versions --bucket "$bucket" --profile $AWS_PROFILE --output json > "s3_versions_${bucket}.json" || true
        jq -c '.Versions[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r version; do
            if [ -n "$version" ]; then
                KEY=$(echo "$version" | jq -r '.Key')
                VERSION_ID=$(echo "$version" | jq -r '.VersionId')
                print_info "    Deleting version: $KEY ($VERSION_ID)"
                aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1 || true
            fi
        done
        jq -c '.DeleteMarkers[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r marker; do
            if [ -n "$marker" ]; then
                KEY=$(echo "$marker" | jq -r '.Key')
                VERSION_ID=$(echo "$marker" | jq -r '.VersionId')
                print_info "    Deleting delete marker: $KEY ($VERSION_ID)"
                aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1 || true
            fi
        done
        rm -f "s3_versions_${bucket}.json" || true
    else
        print_warning "S3 bucket $bucket not found - skipping pre-clean"
    fi
done

# Step 0.5: Pre-clean DynamoDB tables (delete all items)
print_info "Pre-cleaning DynamoDB tables (delete all items)..."
DYNAMODB_TABLES_PRE=(
    "${ENVIRONMENT}-chatterbox-state-table"
    "chatterbox-email-queries"
    "chatterbox-conversations"
    "chatterbox-generated-responses"
    "chatterbox-query-records"
    "chatterbox-user-profiles"
)
for table in "${DYNAMODB_TABLES_PRE[@]}"; do
    if aws dynamodb describe-table --table-name "$table" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Pre-cleaning DynamoDB table: $table"
        aws dynamodb scan --table-name "$table" --attributes-to-get "pk" "sk" --profile $AWS_PROFILE --output json > "dynamodb_items_${table}.json" || true
        jq -c '.Items[]?' "dynamodb_items_${table}.json" 2>/dev/null | while read -r item; do
            if [ -n "$item" ]; then
                PK=$(echo "$item" | jq -r '.pk.S // .pk.N // empty')
                SK=$(echo "$item" | jq -r '.sk.S // .sk.N // empty')
                if [ -n "$PK" ]; then
                    if [ -n "$SK" ]; then
                        aws dynamodb delete-item --table-name "$table" --key "{\"pk\":{\"S\":\"$PK\"},\"sk\":{\"S\":\"$SK\"}}" --profile $AWS_PROFILE > /dev/null 2>&1 || true
                    else
                        aws dynamodb delete-item --table-name "$table" --key "{\"pk\":{\"S\":\"$PK\"}}" --profile $AWS_PROFILE > /dev/null 2>&1 || true
                    fi
                fi
            fi
        done
        rm -f "dynamodb_items_${table}.json" || true
    else
        print_warning "DynamoDB table $table not found - skipping pre-clean"
    fi
done

# Step 0.6: Pre-clean Secrets Manager secrets (delete all versions)
print_info "Pre-cleaning Secrets Manager secrets (delete all versions)..."
SECRETS_PRE=(
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
for secret in "${SECRETS_PRE[@]}"; do
    if aws secretsmanager describe-secret --secret-id "$secret" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Pre-cleaning secret: $secret"
        SECRET_VERSIONS=$(aws secretsmanager list-secret-version-ids --secret-id "$secret" --profile $AWS_PROFILE --query 'VersionsToStages' --output json 2>/dev/null || echo "{}")
        if [ "$SECRET_VERSIONS" != "{}" ] && [ "$SECRET_VERSIONS" != "null" ]; then
            echo "$SECRET_VERSIONS" | jq -r 'to_entries[] | select(.value[] != "AWSCURRENT") | .key' 2>/dev/null | while read -r version_id; do
                if [ -n "$version_id" ] && [ "$version_id" != "null" ]; then
                    print_info "    Deleting version: $version_id"
                    aws secretsmanager delete-secret --secret-id "$secret" --version-id "$version_id" --profile $AWS_PROFILE > /dev/null 2>&1 || true
                fi
            done
        else
            print_info "    No old versions found for secret: $secret"
        fi
    else
        print_warning "Secret $secret not found - skipping pre-clean"
    fi
done

# Step 0.7: Pre-clean SSM parameters (delete all versions)
print_info "Pre-cleaning SSM parameters (delete all versions)..."
CHATTERBOX_PATHS_PRE=(
    "/chatterbox/${ENVIRONMENT}"
    "/chatterbox/development"
    "/chatterbox/polling"
    "/chatterbox/google-config"
    "/chatterbox/openai-config"
    "/chatterbox/llm"
    "/chatterbox/billing"
    "/chatterbox/email"
)
for path_prefix in "${CHATTERBOX_PATHS_PRE[@]}"; do
    PARAMETERS_PRE=$(aws ssm get-parameters-by-path --path "$path_prefix" --profile $AWS_PROFILE --query 'Parameters[*].Name' --output text 2>/dev/null || echo "")
    if [ -n "$PARAMETERS_PRE" ]; then
        for param in $PARAMETERS_PRE; do
            print_info "Pre-cleaning parameter: $param"
            PARAM_HISTORY=$(aws ssm get-parameter-history --name "$param" --profile $AWS_PROFILE --query 'Parameters[?Version != `1`].Version' --output text 2>/dev/null || echo "")
            if [ -n "$PARAM_HISTORY" ]; then
                for version in $PARAM_HISTORY; do
                    if [ -n "$version" ] && [ "$version" != "null" ]; then
                        print_info "    Deleting version: $version"
                        aws ssm delete-parameter --name "$param" --profile $AWS_PROFILE > /dev/null 2>&1 || true
                        LATEST_VALUE=$(aws ssm get-parameter --name "$param" --profile $AWS_PROFILE --query 'Parameter.Value' --output text 2>/dev/null || echo "")
                        if [ -n "$LATEST_VALUE" ] && [ "$LATEST_VALUE" != "null" ]; then
                            aws ssm put-parameter --name "$param" --value "$LATEST_VALUE" --type "String" --overwrite --profile $AWS_PROFILE > /dev/null 2>&1 || true
                        fi
                    fi
                done
            else
                print_info "    No old versions found for parameter: $param"
            fi
        done
    else
        print_warning "No parameters found under path: $path_prefix - skipping pre-clean"
    fi
done

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
    "chatterbox-email-processor"
    "chatterbox-response-generator"
)

for func in "${LAMBDA_FUNCTIONS[@]}"; do
    if aws lambda get-function --function-name "$func" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing Lambda function: $func"
        aws lambda delete-function --function-name "$func" --profile $AWS_PROFILE > /dev/null 2>&1
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
        aws apigateway delete-rest-api --rest-api-id "$api_id" --profile $AWS_PROFILE > /dev/null 2>&1
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

# Also remove email processing buckets with dynamic names
EMAIL_PROCESSING_BUCKETS=$(aws s3api list-buckets --profile $AWS_PROFILE --query 'Buckets[?contains(Name, `chatterbox-attachments`) || contains(Name, `chatterbox-email-content`)].Name' --output text 2>/dev/null || echo "")

if [ -n "$EMAIL_PROCESSING_BUCKETS" ]; then
    for bucket in $EMAIL_PROCESSING_BUCKETS; do
        S3_BUCKETS+=("$bucket")
    done
fi

for bucket in "${S3_BUCKETS[@]}"; do
    if aws s3 ls "s3://$bucket" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing S3 bucket: $bucket"
        
        # Check if bucket has versioning enabled or suspended
        VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket "$bucket" --profile $AWS_PROFILE --query 'Status' --output text 2>/dev/null || echo "NotVersioned")
        
        if [ "$VERSIONING_STATUS" = "Enabled" ] || [ "$VERSIONING_STATUS" = "Suspended" ]; then
            print_info "  Bucket has versioning: $VERSIONING_STATUS - enabling versioning and deleting all versions"
            
            # Ensure versioning is enabled (in case it was suspended)
            aws s3api put-bucket-versioning --bucket "$bucket" --versioning-configuration Status=Enabled --profile $AWS_PROFILE || true
            
            # Get all object versions and delete markers
            aws s3api list-object-versions --bucket "$bucket" --profile $AWS_PROFILE --output json > "s3_versions_${bucket}.json" || true
            
            # Delete all versions
            jq -c '.Versions[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r version; do
                if [ -n "$version" ]; then
                    KEY=$(echo "$version" | jq -r '.Key')
                    VERSION_ID=$(echo "$version" | jq -r '.VersionId')
                    print_info "    Deleting version: $KEY ($VERSION_ID)"
                    aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1 || true
                fi
            done
            
            # Delete all delete markers
            jq -c '.DeleteMarkers[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r marker; do
                if [ -n "$marker" ]; then
                    KEY=$(echo "$marker" | jq -r '.Key')
                    VERSION_ID=$(echo "$marker" | jq -r '.VersionId')
                    print_info "    Deleting delete marker: $KEY ($VERSION_ID)"
                    aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1 || true
                fi
            done
            
            # Clean up temporary file
            rm -f "s3_versions_${bucket}.json" || true
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
    "chatterbox-email-queries"
    "chatterbox-conversations"
    "chatterbox-generated-responses"
    "chatterbox-query-records"
    "chatterbox-user-profiles"
)

for table in "${DYNAMODB_TABLES[@]}"; do
    if aws dynamodb describe-table --table-name "$table" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing DynamoDB table: $table"
        aws dynamodb delete-table --table-name "$table" --profile $AWS_PROFILE > /dev/null 2>&1
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
        aws secretsmanager delete-secret --secret-id "$secret" --force-delete-without-recovery --profile $AWS_PROFILE > /dev/null 2>&1
        print_status "Removed secret: $secret"
    else
        print_warning "Secret $secret not found"
    fi
done

# Step 7: Remove SQS queues
print_info "Removing SQS queues..."
SQS_QUEUES=(
    "chatterbox-response-generation"
    "chatterbox-response-generation-dlq"
)

for queue in "${SQS_QUEUES[@]}"; do
    if aws sqs get-queue-url --queue-name "$queue" --profile $AWS_PROFILE > /dev/null 2>&1; then
        QUEUE_URL=$(aws sqs get-queue-url --queue-name "$queue" --profile $AWS_PROFILE --query 'QueueUrl' --output text)
        print_info "Removing SQS queue: $queue"
        aws sqs delete-queue --queue-url "$QUEUE_URL" --profile $AWS_PROFILE > /dev/null 2>&1
        print_status "Removed SQS queue: $queue"
    else
        print_warning "SQS queue $queue not found"
    fi
done

# Step 8: Remove Parameter Store parameters
print_info "Removing Parameter Store parameters..."
# Remove all chatterbox parameters under different paths
CHATTERBOX_PATHS=(
    "/chatterbox/${ENVIRONMENT}"
    "/chatterbox/development"
    "/chatterbox/polling"
    "/chatterbox/google-config"
    "/chatterbox/openai-config"
    "/chatterbox/llm"
    "/chatterbox/billing"
    "/chatterbox/email"
)

for path_prefix in "${CHATTERBOX_PATHS[@]}"; do
    PARAMETERS=$(aws ssm get-parameters-by-path --path "$path_prefix" --profile $AWS_PROFILE --query 'Parameters[*].Name' --output text 2>/dev/null || echo "")
    
    if [ -n "$PARAMETERS" ]; then
        for param in $PARAMETERS; do
            print_info "Removing parameter: $param"
            aws ssm delete-parameter --name "$param" --profile $AWS_PROFILE > /dev/null 2>&1
            print_status "Removed parameter: $param"
        done
    else
        print_warning "No parameters found under path: $path_prefix"
    fi
done

# Step 9: Remove CloudWatch log groups
print_info "Removing CloudWatch log groups..."
LOG_GROUPS=(
    "/aws/lambda/${ENVIRONMENT}-poll-gmail"
    "/aws/lambda/${ENVIRONMENT}-pull-latest-chatterbox-email"
    "/aws/lambda/chatterbox-email-processor"
    "/aws/lambda/chatterbox-response-generator"
    "/aws/chatterbox"
)

for log_group in "${LOG_GROUPS[@]}"; do
    if aws logs describe-log-groups --log-group-name-prefix "$log_group" --profile $AWS_PROFILE --query 'logGroups[0].logGroupName' --output text | grep -q "$log_group"; then
        print_info "Removing log group: $log_group"
        aws logs delete-log-group --log-group-name "$log_group" --profile $AWS_PROFILE > /dev/null 2>&1
        print_status "Removed log group: $log_group"
    else
        print_warning "Log group $log_group not found"
    fi
done

# Step 10: Remove IAM roles and policies (except chatteradmin)
print_info "Removing IAM roles and policies..."
IAM_ROLES=(
    "${ENVIRONMENT}-chatterbox-lambda-role"
    "${ENVIRONMENT}-chatterbox-role"
    "chatterbox-email-processor-lambda-role"
    "chatterbox-response-generator-lambda-role"
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
        aws iam delete-role --role-name "$role" --profile $AWS_PROFILE > /dev/null 2>&1
        print_status "Removed IAM role: $role"
    else
        print_warning "IAM role $role not found"
    fi
done

IAM_POLICIES=(
    "${ENVIRONMENT}-chatterbox-lambda-policy"
    "${ENVIRONMENT}-chatterbox-policy"
    "chatterbox-email-processor-policy"
    "chatterbox-response-generator-policy"
    "${ENVIRONMENT}-chatterbox-lambda-gmail-policy"
    "${ENVIRONMENT}-chatterbox-s3-policy"
    "${ENVIRONMENT}-chatterbox-dynamodb-policy"
    "${ENVIRONMENT}-chatterbox-lambda-execution-policy"
    "${ENVIRONMENT}-chatterbox-secrets-policy"
    "cliadmin-chatterbox-policy"
    "${ENVIRONMENT}-chatterbox-cloudwatch-policy"
)

for policy in "${IAM_POLICIES[@]}"; do
    POLICY_ARN="arn:aws:iam::$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text):policy/$policy"
    if aws iam get-policy --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing IAM policy: $policy"
        # Detach from all users
        POLICY_USERS=$(aws iam list-entities-for-policy --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE --query 'PolicyUsers[*].UserName' --output text)
        for user in $POLICY_USERS; do
            if [ -n "$user" ]; then
                print_info "  Detaching policy from user: $user"
                aws iam detach-user-policy --user-name "$user" --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE
            fi
        done
        # List and delete policy versions (except default)
        POLICY_VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)
        for version in $POLICY_VERSIONS; do
            if [ -n "$version" ]; then
                aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$version" --profile $AWS_PROFILE
                print_info "  Deleted policy version: $version"
            fi
        done
        # Delete the policy
        aws iam delete-policy --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE > /dev/null 2>&1
        print_status "Removed IAM policy: $policy"
    else
        print_warning "IAM policy $policy not found"
    fi
 done

# Step 11: Remove API Gateway resources
print_info "Removing API Gateway resources..."
API_GATEWAY_APIS=(
    "${ENVIRONMENT}-chatterbox-api"
    "${ENVIRONMENT}-chatterbox-email-api"
)

for api_name in "${API_GATEWAY_APIS[@]}"; do
    API_ID=$(aws apigateway get-rest-apis --profile $AWS_PROFILE --query "items[?name=='$api_name'].id" --output text 2>/dev/null || echo "")
    if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
        print_info "Removing API Gateway API: $api_name (ID: $API_ID)"
        aws apigateway delete-rest-api --rest-api-id "$API_ID" --profile $AWS_PROFILE > /dev/null 2>&1
        print_status "Removed API Gateway API: $api_name"
    else
        print_warning "API Gateway API $api_name not found"
    fi
done

# Step 12: Remove resource group manually (in case terraform didn't catch it)
print_info "Removing resource groups..."
RESOURCE_GROUPS=(
    "${ENVIRONMENT}-chatterbox-resources"
    "${ENVIRONMENT}-chatterbox-email-processing"
)

for group in "${RESOURCE_GROUPS[@]}"; do
    if aws resource-groups get-group --group-name "$group" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing resource group: $group"
        aws resource-groups delete-group --group-name "$group" --profile $AWS_PROFILE > /dev/null 2>&1
        print_status "Removed resource group: $group"
    else
        print_warning "Resource group $group not found"
    fi
done

# Step 13: Clean up local files
print_info "Cleaning up local files..."
rm -f lambda.zip
rm -f tfplan
rm -f response.json
rm -f out.json
print_status "Local files cleaned up"

# Step 14: Remove SES verified email addresses
print_info "Removing SES verified email addresses..."
# Get email addresses from config.json if it exists
PROJECT_ROOT="/Users/n091733/Projects/Chatterbox"
if [ -f "$PROJECT_ROOT/config.json" ]; then
    # Extract email addresses from config.json
    DEFAULT_POLL_USER=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultPollGmailUser)")
    DEFAULT_SEND_USER=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultSendGmailUser)")
    DEFAULT_GET_USER=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultGetGmailUser)")
    DEFAULT_RECIPIENT=$(node -e "console.log(require('$PROJECT_ROOT/config.json').sendTest.defaultRecipient)")
    
    # Create unique list of email addresses
    SES_EMAILS=()
    for email in "$DEFAULT_POLL_USER" "$DEFAULT_SEND_USER" "$DEFAULT_GET_USER" "$DEFAULT_RECIPIENT"; do
        if [[ ! " ${SES_EMAILS[@]} " =~ " ${email} " ]]; then
            SES_EMAILS+=("$email")
        fi
    done
    
    # Remove each verified email address
    for email in "${SES_EMAILS[@]}"; do
        if aws ses get-identity-verification-attributes \
            --identities "$email" \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE" \
            --query "VerificationAttributes.$email.VerificationStatus" \
            --output text 2>/dev/null | grep -q "Success"; then
            print_info "Removing verified email address: $email"
            aws ses delete-identity \
                --identity "$email" \
                --region "$AWS_REGION" \
                --profile "$AWS_PROFILE" > /dev/null 2>&1
            print_status "Removed verified email address: $email"
        else
            print_warning "Email address $email not verified in SES - skipping removal"
        fi
    done
else
    print_warning "config.json not found - cannot determine email addresses to remove from SES"
fi

# Step 15: Disable SES account sending
print_info "Checking SES account status..."
SENDING_ENABLED=$(aws ses get-send-quota \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query "SendingEnabled" \
    --output text 2>/dev/null || echo "false")

if [ "$SENDING_ENABLED" = "true" ]; then
    print_info "SES account sending is currently enabled - disabling..."
    aws ses put-account-sending-enabled \
        --enabled false \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1
    print_status "SES account sending disabled"
    print_info "SES will return to 'Get Started' state in the AWS Console"
else
    print_status "SES account sending is already disabled"
    print_info "SES is already in 'Get Started' state in the AWS Console"
fi

# Step 16: Run legacy parameter cleanup script
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
echo -e "${CYAN}📋 Teardown Summary:${NC}"
echo "✅ Terraform infrastructure destroyed"
echo "✅ Lambda functions removed"
echo "✅ API Gateway resources removed"
echo "✅ S3 buckets removed (with versioning cleanup)"
echo "✅ DynamoDB tables removed"
echo "✅ Secrets Manager secrets removed"
echo "✅ SQS queues removed"
echo "✅ Parameter Store parameters removed"
echo "✅ CloudWatch log groups removed"
echo "✅ IAM roles and policies removed"
echo "✅ Resource groups removed"
echo "✅ SES verified email addresses removed"
echo "✅ Local files cleaned up"
echo "✅ Legacy parameters cleaned up"
echo ""
echo -e "${CYAN}📋 Next steps:${NC}"
echo "1. Run the deployment script: npm run aws:deploy:init -- <init-folder>"
echo "2. Populate secrets and parameters"
echo "3. Test the new architecture"

LOG_FILE="$(cd "$(dirname "$0")/../../../logs" && pwd)/teardown.log"
TEARDOWN_ID="teardown-$(date '+%Y-%m-%dT%H-%M-%S')-$$"
echo "========== [START $TEARDOWN_ID] $(date '+%Y-%m-%d %H:%M:%S') ==========" | tee -a "$LOG_FILE"

# Redefine print functions to also log
print_status() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

echo "" | tee -a "$LOG_FILE"
echo -e "${GREEN}🎉 Complete Chatterbox infrastructure teardown finished!${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo -e "${CYAN}📋 Teardown Summary:${NC}" | tee -a "$LOG_FILE"
echo "✅ Terraform infrastructure destroyed" | tee -a "$LOG_FILE"
echo "✅ Lambda functions removed" | tee -a "$LOG_FILE"
echo "✅ API Gateway resources removed" | tee -a "$LOG_FILE"
echo "✅ S3 buckets removed (with versioning cleanup)" | tee -a "$LOG_FILE"
echo "✅ DynamoDB tables removed" | tee -a "$LOG_FILE"
echo "✅ Secrets Manager secrets removed" | tee -a "$LOG_FILE"
echo "✅ SQS queues removed" | tee -a "$LOG_FILE"
echo "✅ Parameter Store parameters removed" | tee -a "$LOG_FILE"
echo "✅ CloudWatch log groups removed" | tee -a "$LOG_FILE"
echo "✅ IAM roles and policies removed" | tee -a "$LOG_FILE"
echo "✅ Resource groups removed" | tee -a "$LOG_FILE"
echo "✅ SES verified email addresses removed" | tee -a "$LOG_FILE"
echo "✅ Local files cleaned up" | tee -a "$LOG_FILE"
echo "✅ Legacy parameters cleaned up" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo -e "${CYAN}📋 Next steps:${NC}" | tee -a "$LOG_FILE"
echo "1. Run the deployment script: npm run aws:deploy:init -- <init-folder>" | tee -a "$LOG_FILE"
echo "2. Populate secrets and parameters" | tee -a "$LOG_FILE"
echo "3. Test the new architecture" | tee -a "$LOG_FILE"
echo "========== [END $TEARDOWN_ID] $(date '+%Y-%m-%d %H:%M:%S') ==========" | tee -a "$LOG_FILE" 