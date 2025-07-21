#!/bin/bash

# Complete teardown script for Chatterbox Email Processing infrastructure
# This script removes all email processing resources with proper pre-cleaning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"dev"}
AWS_REGION=${AWS_REGION:-"us-east-1"}
AWS_PROFILE=${AWS_PROFILE:-"cliadmin"}

echo -e "${RED}🗑️  CHATTERBOX EMAIL PROCESSING INFRASTRUCTURE TEARDOWN${NC}"
echo -e "${RED}Environment: ${ENVIRONMENT}${NC}"
echo -e "${RED}Region: ${AWS_REGION}${NC}"
echo -e "${RED}Profile: ${AWS_PROFILE}${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will delete ALL Email Processing resources!${NC}"
echo ""
echo -e "${CYAN}Starting automatic email processing teardown...${NC}"
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
EMAIL_PROCESSING_BUCKETS_PRE=$(aws s3api list-buckets --profile $AWS_PROFILE --query 'Buckets[?contains(Name, `chatterbox-attachments`) || contains(Name, `chatterbox-email-content`)].Name' --output text 2>/dev/null || echo "")
if [ -n "$EMAIL_PROCESSING_BUCKETS_PRE" ]; then
    for bucket in $EMAIL_PROCESSING_BUCKETS_PRE; do
        print_info "Pre-cleaning S3 bucket: $bucket"
        VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket "$bucket" --profile $AWS_PROFILE --query 'Status' --output text 2>/dev/null || echo "NotVersioned")
        if [ "$VERSIONING_STATUS" = "Suspended" ]; then
            print_info "  Bucket versioning is SUSPENDED - enabling versioning before deletion"
            aws s3api put-bucket-versioning --bucket "$bucket" --versioning-configuration Status=Enabled --profile $AWS_PROFILE
        fi
        # Now delete all versions and delete markers
        aws s3api list-object-versions --bucket "$bucket" --profile $AWS_PROFILE --output json > "s3_versions_${bucket}.json"
        jq -c '.Versions[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r version; do
            if [ -n "$version" ]; then
                KEY=$(echo "$version" | jq -r '.Key')
                VERSION_ID=$(echo "$version" | jq -r '.VersionId')
                print_info "    Deleting version: $KEY ($VERSION_ID)"
                aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1
            fi
        done
        jq -c '.DeleteMarkers[]?' "s3_versions_${bucket}.json" 2>/dev/null | while read -r marker; do
            if [ -n "$marker" ]; then
                KEY=$(echo "$marker" | jq -r '.Key')
                VERSION_ID=$(echo "$marker" | jq -r '.VersionId')
                print_info "    Deleting delete marker: $KEY ($VERSION_ID)"
                aws s3api delete-object --bucket "$bucket" --key "$KEY" --version-id "$VERSION_ID" --profile $AWS_PROFILE > /dev/null 2>&1
            fi
        done
        rm -f "s3_versions_${bucket}.json"
    done
else
    print_warning "No email processing S3 buckets found - skipping pre-clean"
fi

# Step 0.5: Pre-clean DynamoDB tables (delete all items)
print_info "Pre-cleaning DynamoDB tables (delete all items)..."
DYNAMODB_TABLES_PRE=(
    "chatterbox-email-queries"
    "chatterbox-conversations"
    "chatterbox-generated-responses"
    "chatterbox-query-records"
    "chatterbox-user-profiles"
)
for table in "${DYNAMODB_TABLES_PRE[@]}"; do
    if aws dynamodb describe-table --table-name "$table" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Pre-cleaning DynamoDB table: $table"
        # Scan and delete all items
        aws dynamodb scan --table-name "$table" --attributes-to-get "queryId" "conversationId" "responseId" "userEmail" --profile $AWS_PROFILE --output json > "dynamodb_items_${table}.json"
        jq -c '.Items[]?' "dynamodb_items_${table}.json" 2>/dev/null | while read -r item; do
            if [ -n "$item" ]; then
                # Handle different table structures
                if echo "$item" | jq -e '.queryId' > /dev/null 2>&1; then
                    KEY_NAME="queryId"
                    KEY_VALUE=$(echo "$item" | jq -r '.queryId.S // .queryId.N // empty')
                elif echo "$item" | jq -e '.conversationId' > /dev/null 2>&1; then
                    KEY_NAME="conversationId"
                    KEY_VALUE=$(echo "$item" | jq -r '.conversationId.S // .conversationId.N // empty')
                elif echo "$item" | jq -e '.responseId' > /dev/null 2>&1; then
                    KEY_NAME="responseId"
                    KEY_VALUE=$(echo "$item" | jq -r '.responseId.S // .responseId.N // empty')
                elif echo "$item" | jq -e '.userEmail' > /dev/null 2>&1; then
                    KEY_NAME="userEmail"
                    KEY_VALUE=$(echo "$item" | jq -r '.userEmail.S // .userEmail.N // empty')
                else
                    continue
                fi
                
                if [ -n "$KEY_VALUE" ]; then
                    # Handle composite keys for query_records table
                    if [ "$table" = "chatterbox-query-records" ] && echo "$item" | jq -e '.userEmail' > /dev/null 2>&1; then
                        USER_EMAIL=$(echo "$item" | jq -r '.userEmail.S // .userEmail.N // empty')
                        if [ -n "$USER_EMAIL" ]; then
                            aws dynamodb delete-item --table-name "$table" --key "{\"queryId\":{\"S\":\"$KEY_VALUE\"},\"userEmail\":{\"S\":\"$USER_EMAIL\"}}" --profile $AWS_PROFILE > /dev/null 2>&1
                        fi
                    else
                        aws dynamodb delete-item --table-name "$table" --key "{\"$KEY_NAME\":{\"S\":\"$KEY_VALUE\"}}" --profile $AWS_PROFILE > /dev/null 2>&1
                    fi
                fi
            fi
        done
        rm -f "dynamodb_items_${table}.json"
    else
        print_warning "DynamoDB table $table not found - skipping pre-clean"
    fi
done

# Step 0.6: Pre-clean Secrets Manager secrets (delete all versions)
print_info "Pre-cleaning Secrets Manager secrets (delete all versions)..."
SECRETS_PRE=(
    "chatterbox/openai-api-key"
)
for secret in "${SECRETS_PRE[@]}"; do
    if aws secretsmanager describe-secret --secret-id "$secret" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Pre-cleaning secret: $secret"
        # Delete all versions except the latest
        SECRET_VERSIONS=$(aws secretsmanager list-secret-version-ids --secret-id "$secret" --profile $AWS_PROFILE --query 'VersionsToStages' --output json)
        echo "$SECRET_VERSIONS" | jq -r 'to_entries[] | select(.value[] != "AWSCURRENT") | .key' | while read -r version_id; do
            if [ -n "$version_id" ]; then
                print_info "    Deleting version: $version_id"
                aws secretsmanager delete-secret --secret-id "$secret" --version-id "$version_id" --profile $AWS_PROFILE > /dev/null 2>&1
            fi
        done
    else
        print_warning "Secret $secret not found - skipping pre-clean"
    fi
done

# Step 0.7: Pre-clean SSM parameters (delete all versions)
print_info "Pre-cleaning SSM parameters (delete all versions)..."
CHATTERBOX_PATHS_PRE=(
    "/chatterbox/llm"
    "/chatterbox/billing"
    "/chatterbox/email"
)
for path_prefix in "${CHATTERBOX_PATHS_PRE[@]}"; do
    PARAMETERS_PRE=$(aws ssm get-parameters-by-path --path "$path_prefix" --profile $AWS_PROFILE --query 'Parameters[*].Name' --output text 2>/dev/null || echo "")
    if [ -n "$PARAMETERS_PRE" ]; then
        for param in $PARAMETERS_PRE; do
            print_info "Pre-cleaning parameter: $param"
            # Get parameter history and delete old versions
            PARAM_HISTORY=$(aws ssm get-parameter-history --name "$param" --profile $AWS_PROFILE --query 'Parameters[?Version != `1`].Version' --output text 2>/dev/null || echo "")
            for version in $PARAM_HISTORY; do
                if [ -n "$version" ]; then
                    print_info "    Deleting version: $version"
                    aws ssm delete-parameter --name "$param" --profile $AWS_PROFILE > /dev/null 2>&1
                    # Recreate the parameter with the latest value to maintain current version
                    LATEST_VALUE=$(aws ssm get-parameter --name "$param" --profile $AWS_PROFILE --query 'Parameter.Value' --output text 2>/dev/null || echo "")
                    if [ -n "$LATEST_VALUE" ]; then
                        aws ssm put-parameter --name "$param" --value "$LATEST_VALUE" --type "String" --overwrite --profile $AWS_PROFILE > /dev/null 2>&1
                    fi
                fi
            done
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
    "chatterbox-email-processor"
    "chatterbox-response-generator"
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

# Step 3: Remove SQS queues
print_info "Removing SQS queues..."
SQS_QUEUES=(
    "chatterbox-response-generation"
    "chatterbox-response-generation-dlq"
)

for queue in "${SQS_QUEUES[@]}"; do
    if aws sqs get-queue-url --queue-name "$queue" --profile $AWS_PROFILE > /dev/null 2>&1; then
        QUEUE_URL=$(aws sqs get-queue-url --queue-name "$queue" --profile $AWS_PROFILE --query 'QueueUrl' --output text)
        print_info "Removing SQS queue: $queue"
        aws sqs delete-queue --queue-url "$QUEUE_URL" --profile $AWS_PROFILE
        print_status "Removed SQS queue: $queue"
    else
        print_warning "SQS queue $queue not found"
    fi
done

# Step 4: Remove DynamoDB tables
print_info "Removing DynamoDB tables..."
DYNAMODB_TABLES=(
    "chatterbox-email-queries"
    "chatterbox-conversations"
    "chatterbox-generated-responses"
    "chatterbox-query-records"
    "chatterbox-user-profiles"
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

# Step 5: Remove S3 buckets
print_info "Removing S3 buckets..."
EMAIL_PROCESSING_BUCKETS=$(aws s3api list-buckets --profile $AWS_PROFILE --query 'Buckets[?contains(Name, `chatterbox-attachments`) || contains(Name, `chatterbox-email-content`)].Name' --output text 2>/dev/null || echo "")

if [ -n "$EMAIL_PROCESSING_BUCKETS" ]; then
    for bucket in $EMAIL_PROCESSING_BUCKETS; do
        print_info "Removing S3 bucket: $bucket"
        aws s3 rb "s3://$bucket" --force --profile $AWS_PROFILE
        print_status "Removed S3 bucket: $bucket"
    done
else
    print_warning "No email processing S3 buckets found"
fi

# Step 6: Remove Secrets Manager secrets
print_info "Removing Secrets Manager secrets..."
SECRETS=(
    "chatterbox/openai-api-key"
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
CHATTERBOX_PATHS=(
    "/chatterbox/llm"
    "/chatterbox/billing"
    "/chatterbox/email"
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
    "/aws/lambda/chatterbox-email-processor"
    "/aws/lambda/chatterbox-response-generator"
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

# Step 9: Remove IAM roles and policies
print_info "Removing IAM roles and policies..."
IAM_ROLES=(
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
        aws iam delete-role --role-name "$role" --profile $AWS_PROFILE
        print_status "Removed IAM role: $role"
    else
        print_warning "IAM role $role not found"
    fi
done

IAM_POLICIES=(
    "chatterbox-email-processor-policy"
    "chatterbox-response-generator-policy"
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

# Step 10: Remove API Gateway resources
print_info "Removing API Gateway resources..."
API_GATEWAY_APIS=(
    "${ENVIRONMENT}-chatterbox-email-api"
)

for api_name in "${API_GATEWAY_APIS[@]}"; do
    API_ID=$(aws apigateway get-rest-apis --profile $AWS_PROFILE --query "items[?name=='$api_name'].id" --output text 2>/dev/null || echo "")
    if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
        print_info "Removing API Gateway API: $api_name (ID: $API_ID)"
        aws apigateway delete-rest-api --rest-api-id "$API_ID" --profile $AWS_PROFILE
        print_status "Removed API Gateway API: $api_name"
    else
        print_warning "API Gateway API $api_name not found"
    fi
done

# Step 11: Remove resource group
print_info "Removing resource groups..."
RESOURCE_GROUPS=(
    "${ENVIRONMENT}-chatterbox-email-processing"
)

for group in "${RESOURCE_GROUPS[@]}"; do
    if aws resource-groups get-group --group-name "$group" --profile $AWS_PROFILE > /dev/null 2>&1; then
        print_info "Removing resource group: $group"
        aws resource-groups delete-group --group-name "$group" --profile $AWS_PROFILE
        print_status "Removed resource group: $group"
    else
        print_warning "Resource group $group not found"
    fi
done

# Step 12: Clean up local files
print_info "Cleaning up local files..."
rm -f email-processor.zip
rm -f response-generator.zip
rm -f tfplan
rm -f response.json
rm -f out.json
print_status "Local files cleaned up"

echo ""
echo -e "${GREEN}🎉 Complete Chatterbox Email Processing infrastructure teardown finished!${NC}"
echo ""
echo -e "${CYAN}📋 Next steps:${NC}"
echo "1. Run the deployment script: bash Cloud/AWS/terraform-email-processing/deploy.sh"
echo "2. Test the email processing pipeline"
echo "3. Monitor CloudWatch logs for any issues" 