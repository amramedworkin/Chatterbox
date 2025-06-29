#!/bin/zsh

# AWS Resource Inventory Script
# Lists all resources in the AWS account with resource groups and creation dates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

# Configuration
PROFILE="cliadmin"
REGION="us-east-1"
OUTPUT_FILE="aws-resource-inventory-$(date +%Y%m%d-%H%M%S).txt"

# Initialize output file
echo "AWS Resource Inventory - $(date)" > "$OUTPUT_FILE"
echo "Profile: $PROFILE" >> "$OUTPUT_FILE"
echo "Region: $REGION" >> "$OUTPUT_FILE"
echo "==========================================" >> "$OUTPUT_FILE"

log_info "Starting AWS Resource Inventory"
log_info "Output will be saved to: $OUTPUT_FILE"

# Function to get resource group for a resource
get_resource_group() {
    local resource_arn="$1"
    local resource_type="$2"
    
    # Try to get resource group using Resource Groups Tagging API
    local group_info=$(aws resourcegroupstaggingapi get-resources --resource-arn-filters "$resource_arn" --profile "$PROFILE" --region "$REGION" --query 'ResourceTagMappingList[0].ResourceGroupName' --output text 2>/dev/null || echo "N/A")
    
    if [[ "$group_info" == "None" || "$group_info" == "" ]]; then
        echo "N/A"
    else
        echo "$group_info"
    fi
}

# Function to get creation date for a resource
get_creation_date() {
    local resource_id="$1"
    local resource_type="$2"
    local creation_date="N/A"
    
    case "$resource_type" in
        "s3")
            creation_date=$(aws s3api list-buckets --profile "$PROFILE" --query "Buckets[?Name=='$resource_id'].CreationDate" --output text 2>/dev/null || echo "N/A")
            ;;
        "dynamodb")
            creation_date=$(aws dynamodb describe-table --table-name "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Table.CreationDateTime' --output text 2>/dev/null || echo "N/A")
            ;;
        "lambda")
            creation_date=$(aws lambda get-function --function-name "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Configuration.LastModified' --output text 2>/dev/null || echo "N/A")
            ;;
        "apigateway")
            creation_date=$(aws apigateway get-rest-api --rest-api-id "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'createdDate' --output text 2>/dev/null || echo "N/A")
            ;;
        "secretsmanager")
            creation_date=$(aws secretsmanager describe-secret --secret-id "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'CreatedDate' --output text 2>/dev/null || echo "N/A")
            ;;
        "ssm")
            creation_date=$(aws ssm describe-parameters --profile "$PROFILE" --region "$REGION" --query "Parameters[?Name=='$resource_id'].LastModifiedDate" --output text 2>/dev/null || echo "N/A")
            ;;
        "iam")
            creation_date=$(aws iam get-role --role-name "$resource_id" --profile "$PROFILE" --query 'Role.CreateDate' --output text 2>/dev/null || echo "N/A")
            ;;
        "cloudwatch")
            creation_date=$(aws logs describe-log-groups --log-group-name-prefix "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'logGroups[0].creationTime' --output text 2>/dev/null || echo "N/A")
            ;;
        *)
            creation_date="N/A"
            ;;
    esac
    
    if [[ "$creation_date" == "None" || "$creation_date" == "" ]]; then
        echo "N/A"
    else
        echo "$creation_date"
    fi
}

# List S3 Buckets
list_s3_buckets() {
    log_header "S3 Buckets"
    echo "S3 Buckets:" >> "$OUTPUT_FILE"
    echo "-----------" >> "$OUTPUT_FILE"
    
    local buckets=$(aws s3api list-buckets --profile "$PROFILE" --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
    
    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            local creation_date=$(get_creation_date "$bucket" "s3")
            local resource_group=$(get_resource_group "arn:aws:s3:::$bucket" "s3")
            
            echo "Bucket: $bucket" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "S3 Bucket: $bucket (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No S3 buckets found" >> "$OUTPUT_FILE"
        log_info "No S3 buckets found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List DynamoDB Tables
list_dynamodb_tables() {
    log_header "DynamoDB Tables"
    echo "DynamoDB Tables:" >> "$OUTPUT_FILE"
    echo "---------------" >> "$OUTPUT_FILE"
    
    local tables=$(aws dynamodb list-tables --profile "$PROFILE" --region "$REGION" --query 'TableNames[]' --output text 2>/dev/null || echo "")
    
    if [[ -n "$tables" ]]; then
        for table in $tables; do
            local creation_date=$(get_creation_date "$table" "dynamodb")
            local resource_group=$(get_resource_group "arn:aws:dynamodb:$REGION:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):table/$table" "dynamodb")
            
            echo "Table: $table" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "DynamoDB Table: $table (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No DynamoDB tables found" >> "$OUTPUT_FILE"
        log_info "No DynamoDB tables found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List Lambda Functions
list_lambda_functions() {
    log_header "Lambda Functions"
    echo "Lambda Functions:" >> "$OUTPUT_FILE"
    echo "-----------------" >> "$OUTPUT_FILE"
    
    local functions=$(aws lambda list-functions --profile "$PROFILE" --region "$REGION" --query 'Functions[].FunctionName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$functions" ]]; then
        for func in $functions; do
            local creation_date=$(get_creation_date "$func" "lambda")
            local resource_group=$(get_resource_group "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):function:$func" "lambda")
            
            echo "Function: $func" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "Lambda Function: $func (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No Lambda functions found" >> "$OUTPUT_FILE"
        log_info "No Lambda functions found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List API Gateway APIs
list_api_gateway() {
    log_header "API Gateway APIs"
    echo "API Gateway APIs:" >> "$OUTPUT_FILE"
    echo "-----------------" >> "$OUTPUT_FILE"
    
    local apis=$(aws apigateway get-rest-apis --profile "$PROFILE" --region "$REGION" --query 'items[].id' --output text 2>/dev/null || echo "")
    
    if [[ -n "$apis" ]]; then
        for api in $apis; do
            local creation_date=$(get_creation_date "$api" "apigateway")
            local resource_group=$(get_resource_group "arn:aws:apigateway:$REGION::/restapis/$api" "apigateway")
            
            echo "API ID: $api" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "API Gateway: $api (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No API Gateway APIs found" >> "$OUTPUT_FILE"
        log_info "No API Gateway APIs found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List Secrets Manager Secrets
list_secrets() {
    log_header "Secrets Manager Secrets"
    echo "Secrets Manager Secrets:" >> "$OUTPUT_FILE"
    echo "----------------------" >> "$OUTPUT_FILE"
    
    local secrets=$(aws secretsmanager list-secrets --profile "$PROFILE" --region "$REGION" --query 'SecretList[].Name' --output text 2>/dev/null || echo "")
    
    if [[ -n "$secrets" ]]; then
        for secret in $secrets; do
            local creation_date=$(get_creation_date "$secret" "secretsmanager")
            local resource_group=$(get_resource_group "arn:aws:secretsmanager:$REGION:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):secret:$secret" "secretsmanager")
            
            echo "Secret: $secret" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "Secret: $secret (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No Secrets Manager secrets found" >> "$OUTPUT_FILE"
        log_info "No Secrets Manager secrets found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List SSM Parameters
list_ssm_parameters() {
    log_header "SSM Parameters"
    echo "SSM Parameters:" >> "$OUTPUT_FILE"
    echo "--------------" >> "$OUTPUT_FILE"
    
    local parameters=$(aws ssm describe-parameters --profile "$PROFILE" --region "$REGION" --query 'Parameters[].Name' --output text 2>/dev/null || echo "")
    
    if [[ -n "$parameters" ]]; then
        for param in $parameters; do
            local creation_date=$(get_creation_date "$param" "ssm")
            local resource_group=$(get_resource_group "arn:aws:ssm:$REGION:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):parameter/$param" "ssm")
            
            echo "Parameter: $param" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "SSM Parameter: $param (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No SSM parameters found" >> "$OUTPUT_FILE"
        log_info "No SSM parameters found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List IAM Roles
list_iam_roles() {
    log_header "IAM Roles"
    echo "IAM Roles:" >> "$OUTPUT_FILE"
    echo "---------" >> "$OUTPUT_FILE"
    
    local roles=$(aws iam list-roles --profile "$PROFILE" --query 'Roles[].RoleName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$roles" ]]; then
        for role in $roles; do
            local creation_date=$(get_creation_date "$role" "iam")
            local resource_group=$(get_resource_group "arn:aws:iam::$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):role/$role" "iam")
            
            echo "Role: $role" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "IAM Role: $role (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No IAM roles found" >> "$OUTPUT_FILE"
        log_info "No IAM roles found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List IAM Users
list_iam_users() {
    log_header "IAM Users"
    echo "IAM Users:" >> "$OUTPUT_FILE"
    echo "---------" >> "$OUTPUT_FILE"
    
    local users=$(aws iam list-users --profile "$PROFILE" --query 'Users[].UserName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$users" ]]; then
        for user in $users; do
            local creation_date=$(aws iam get-user --user-name "$user" --profile "$PROFILE" --query 'User.CreateDate' --output text 2>/dev/null || echo "N/A")
            local resource_group=$(get_resource_group "arn:aws:iam::$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):user/$user" "iam")
            
            echo "User: $user" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "IAM User: $user (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No IAM users found" >> "$OUTPUT_FILE"
        log_info "No IAM users found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List IAM Groups
list_iam_groups() {
    log_header "IAM Groups"
    echo "IAM Groups:" >> "$OUTPUT_FILE"
    echo "----------" >> "$OUTPUT_FILE"
    
    local groups=$(aws iam list-groups --profile "$PROFILE" --query 'Groups[].GroupName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$groups" ]]; then
        for group in $groups; do
            local creation_date=$(aws iam get-group --group-name "$group" --profile "$PROFILE" --query 'Group.CreateDate' --output text 2>/dev/null || echo "N/A")
            local resource_group=$(get_resource_group "arn:aws:iam::$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):group/$group" "iam")
            
            echo "Group: $group" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "IAM Group: $group (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No IAM groups found" >> "$OUTPUT_FILE"
        log_info "No IAM groups found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List CloudWatch Log Groups
list_cloudwatch_logs() {
    log_header "CloudWatch Log Groups"
    echo "CloudWatch Log Groups:" >> "$OUTPUT_FILE"
    echo "--------------------" >> "$OUTPUT_FILE"
    
    local log_groups=$(aws logs describe-log-groups --profile "$PROFILE" --region "$REGION" --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$log_groups" ]]; then
        for log_group in $log_groups; do
            local creation_date=$(get_creation_date "$log_group" "cloudwatch")
            local resource_group=$(get_resource_group "arn:aws:logs:$REGION:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):log-group:$log_group" "logs")
            
            echo "Log Group: $log_group" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "CloudWatch Log Group: $log_group (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No CloudWatch log groups found" >> "$OUTPUT_FILE"
        log_info "No CloudWatch log groups found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List CloudWatch Alarms
list_cloudwatch_alarms() {
    log_header "CloudWatch Alarms"
    echo "CloudWatch Alarms:" >> "$OUTPUT_FILE"
    echo "-----------------" >> "$OUTPUT_FILE"
    
    local alarms=$(aws cloudwatch describe-alarms --profile "$PROFILE" --region "$REGION" --query 'MetricAlarms[].AlarmName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$alarms" ]]; then
        for alarm in $alarms; do
            local creation_date=$(aws cloudwatch describe-alarms --alarm-names "$alarm" --profile "$PROFILE" --region "$REGION" --query 'MetricAlarms[0].AlarmConfigurationUpdatedTimestamp' --output text 2>/dev/null || echo "N/A")
            local resource_group=$(get_resource_group "arn:aws:cloudwatch:$REGION:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):alarm:$alarm" "cloudwatch")
            
            echo "Alarm: $alarm" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "CloudWatch Alarm: $alarm (Group: $resource_group, Created: $creation_date)"
        done
    else
        echo "No CloudWatch alarms found" >> "$OUTPUT_FILE"
        log_info "No CloudWatch alarms found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List VPC Resources
list_vpc_resources() {
    log_header "VPC Resources"
    echo "VPC Resources:" >> "$OUTPUT_FILE"
    echo "-------------" >> "$OUTPUT_FILE"
    
    local vpcs=$(aws ec2 describe-vpcs --profile "$PROFILE" --region "$REGION" --query 'Vpcs[].VpcId' --output text 2>/dev/null || echo "")
    
    if [[ -n "$vpcs" ]]; then
        for vpc in $vpcs; do
            local creation_date=$(aws ec2 describe-vpcs --vpc-ids "$vpc" --profile "$PROFILE" --region "$REGION" --query 'Vpcs[0].State' --output text 2>/dev/null || echo "N/A")
            local resource_group=$(get_resource_group "arn:aws:ec2:$REGION:$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text):vpc/$vpc" "ec2")
            
            echo "VPC: $vpc" >> "$OUTPUT_FILE"
            echo "  Resource Group: $resource_group" >> "$OUTPUT_FILE"
            echo "  State: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "VPC: $vpc (Group: $resource_group, State: $creation_date)"
        done
    else
        echo "No VPCs found" >> "$OUTPUT_FILE"
        log_info "No VPCs found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# List Resource Groups
list_resource_groups() {
    log_header "Resource Groups"
    echo "Resource Groups:" >> "$OUTPUT_FILE"
    echo "---------------" >> "$OUTPUT_FILE"
    
    local groups=$(aws resource-groups list-groups --profile "$PROFILE" --region "$REGION" --query 'GroupIdentifiers[].GroupArn' --output text 2>/dev/null || echo "")
    
    if [[ -n "$groups" ]]; then
        for group in $groups; do
            local group_name=$(echo "$group" | sed 's/.*group\///')
            local creation_date=$(aws resource-groups get-group --group "$group" --profile "$PROFILE" --region "$REGION" --query 'Group.CreateDate' --output text 2>/dev/null || echo "N/A")
            
            echo "Resource Group: $group_name" >> "$OUTPUT_FILE"
            echo "  ARN: $group" >> "$OUTPUT_FILE"
            echo "  Created: $creation_date" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
            
            log_info "Resource Group: $group_name (Created: $creation_date)"
        done
    else
        echo "No Resource Groups found" >> "$OUTPUT_FILE"
        log_info "No Resource Groups found"
    fi
    echo "" >> "$OUTPUT_FILE"
}

# Main execution
main() {
    log_info "Starting comprehensive AWS resource inventory..."
    
    # Get account information
    local account_id=$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text)
    log_info "Account ID: $account_id"
    
    # List all resource types
    list_s3_buckets
    list_dynamodb_tables
    list_lambda_functions
    list_api_gateway
    list_secrets
    list_ssm_parameters
    list_iam_roles
    list_iam_users
    list_iam_groups
    list_cloudwatch_logs
    list_cloudwatch_alarms
    list_vpc_resources
    list_resource_groups
    
    log_success "Resource inventory completed!"
    log_info "Full report saved to: $OUTPUT_FILE"
    
    # Show summary
    echo "==========================================" >> "$OUTPUT_FILE"
    echo "Inventory completed at: $(date)" >> "$OUTPUT_FILE"
    
    log_info "You can view the full report with: cat $OUTPUT_FILE"
}

# Run main function
main "$@" 