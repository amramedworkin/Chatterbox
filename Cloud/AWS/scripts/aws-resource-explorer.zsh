#!/bin/zsh

# AWS Resource Explorer
# Displays all AWS resources in a clean, organized format (read-only)
# Similar to AWS Resource Explorer but for command line

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Configuration
PROFILE="cliadmin"
REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text 2>/dev/null || echo "Unknown")

# Logging functions
log_header() {
    echo -e "\n${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC} ${WHITE}$1${NC} ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
}

log_section() {
    echo -e "\n${CYAN}▸ $1${NC}"
    echo -e "${GRAY}────────────────────────────────────────────────────────────────${NC}"
}

log_resource() {
    local type="$1"
    local name="$2"
    local details="$3"
    local status="$4"
    
    local status_color=""
    case "$status" in
        "active"|"available"|"running")
            status_color="${GREEN}"
            ;;
        "pending"|"creating"|"updating")
            status_color="${YELLOW}"
            ;;
        "error"|"failed"|"deleting")
            status_color="${RED}"
            ;;
        *)
            status_color="${GRAY}"
            ;;
    esac
    
    echo -e "  ${BLUE}•${NC} ${WHITE}$type${NC}: ${CYAN}$name${NC}"
    if [[ -n "$details" ]]; then
        echo -e "    ${GRAY}$details${NC}"
    fi
    if [[ -n "$status" ]]; then
        echo -e "    ${status_color}Status: $status${NC}"
    fi
}

log_empty() {
    echo -e "  ${GRAY}┄ No resources found${NC}"
}

log_count() {
    local count="$1"
    local type="$2"
    if [[ $count -eq 0 ]]; then
        echo -e "${GRAY}  ┄ No $type found${NC}"
    elif [[ $count -eq 1 ]]; then
        echo -e "${GREEN}  ✓ 1 $type found${NC}"
    else
        echo -e "${GREEN}  ✓ $count $type found${NC}"
    fi
}

# Function to get resource tags
get_resource_tags() {
    local resource_arn="$1"
    local tags=$(aws resourcegroupstaggingapi get-resources --resource-arn-filters "$resource_arn" --profile "$PROFILE" --region "$REGION" --query 'ResourceTagMappingList[0].Tags' --output json 2>/dev/null || echo "[]")
    echo "$tags"
}

# Function to format tags for display
format_tags() {
    local tags="$1"
    if [[ "$tags" == "[]" || "$tags" == "null" ]]; then
        echo "No tags"
    else
        echo "$tags" | jq -r 'to_entries | map("\(.key)=\(.value)") | join(", ")' 2>/dev/null || echo "Tags available"
    fi
}

# Function to get resource details
get_resource_details() {
    local resource_id="$1"
    local resource_type="$2"
    local details=""
    
    case "$resource_type" in
        "s3")
            local size=$(aws s3 ls s3://"$resource_id" --recursive --summarize --profile "$PROFILE" 2>/dev/null | grep "Total Size" | awk '{print $3, $4}' || echo "Unknown")
            local objects=$(aws s3 ls s3://"$resource_id" --recursive --summarize --profile "$PROFILE" 2>/dev/null | grep "Total Objects" | awk '{print $3}' || echo "Unknown")
            details="Size: $size, Objects: $objects"
            ;;
        "dynamodb")
            local item_count=$(aws dynamodb describe-table --table-name "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Table.ItemCount' --output text 2>/dev/null || echo "Unknown")
            local status=$(aws dynamodb describe-table --table-name "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Table.TableStatus' --output text 2>/dev/null || echo "Unknown")
            details="Items: $item_count, Status: $status"
            ;;
        "lambda")
            local runtime=$(aws lambda get-function --function-name "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Configuration.Runtime' --output text 2>/dev/null || echo "Unknown")
            local memory=$(aws lambda get-function --function-name "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Configuration.MemorySize' --output text 2>/dev/null || echo "Unknown")
            details="Runtime: $runtime, Memory: ${memory}MB"
            ;;
        "apigateway")
            local description=$(aws apigateway get-rest-api --rest-api-id "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'description' --output text 2>/dev/null || echo "No description")
            details="Description: $description"
            ;;
        "secretsmanager")
            local description=$(aws secretsmanager describe-secret --secret-id "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Description' --output text 2>/dev/null || echo "No description")
            details="Description: $description"
            ;;
        "ssm")
            local type=$(aws ssm describe-parameters --profile "$PROFILE" --region "$REGION" --query "Parameters[?Name=='$resource_id'].Type" --output text 2>/dev/null || echo "Unknown")
            details="Type: $type"
            ;;
        "iam")
            local description=$(aws iam get-role --role-name "$resource_id" --profile "$PROFILE" --query 'Role.Description' --output text 2>/dev/null || echo "No description")
            details="Description: $description"
            ;;
        "cloudwatch")
            local metric_count=$(aws cloudwatch list-metrics --namespace "AWS/Logs" --metric-name "IncomingLogEvents" --dimensions Name=LogGroupName,Value="$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Metrics | length(@)' --output text 2>/dev/null || echo "0")
            details="Metrics: $metric_count"
            ;;
        "vpc")
            local cidr=$(aws ec2 describe-vpcs --vpc-ids "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Vpcs[0].CidrBlock' --output text 2>/dev/null || echo "Unknown")
            local state=$(aws ec2 describe-vpcs --vpc-ids "$resource_id" --profile "$PROFILE" --region "$REGION" --query 'Vpcs[0].State' --output text 2>/dev/null || echo "Unknown")
            details="CIDR: $cidr, State: $state"
            ;;
        *)
            details=""
            ;;
    esac
    
    echo "$details"
}

# Function to get status color
get_status_color() {
    local status="$1"
    local color=""
    
    case "$status" in
        "active"|"available"|"running")
            color="${GREEN}"
            ;;
        "pending"|"creating"|"updating")
            color="${YELLOW}"
            ;;
        "error"|"failed"|"deleting")
            color="${RED}"
            ;;
        *)
            color="${GRAY}"
            ;;
    esac
    
    echo "$color"
}

# List S3 Buckets
explore_s3() {
    log_section "S3 Buckets"
    local buckets=$(aws s3api list-buckets --profile "$PROFILE" --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            local details=$(get_resource_details "$bucket" "s3")
            local tags=$(get_resource_tags "arn:aws:s3:::$bucket")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "S3 Bucket" "$bucket" "$details | Tags: $formatted_tags"
            ((count++))
        done
    fi
    
    log_count $count "S3 bucket"
}

# List DynamoDB Tables
explore_dynamodb() {
    log_section "DynamoDB Tables"
    local tables=$(aws dynamodb list-tables --profile "$PROFILE" --region "$REGION" --query 'TableNames[]' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$tables" ]]; then
        for table in $tables; do
            local details=$(get_resource_details "$table" "dynamodb")
            local tags=$(get_resource_tags "arn:aws:dynamodb:$REGION:$ACCOUNT_ID:table/$table")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "DynamoDB Table" "$table" "$details | Tags: $formatted_tags"
            ((count++))
        done
    fi
    
    log_count $count "DynamoDB table"
}

# List Lambda Functions
explore_lambda() {
    log_section "Lambda Functions"
    local functions=$(aws lambda list-functions --profile "$PROFILE" --region "$REGION" --query 'Functions[].FunctionName' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$functions" ]]; then
        for func in $functions; do
            local details=$(get_resource_details "$func" "lambda")
            local tags=$(get_resource_tags "arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$func")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "Lambda Function" "$func" "$details | Tags: $formatted_tags"
            ((count++))
        done
    fi
    
    log_count $count "Lambda function"
}

# List API Gateway APIs
explore_apigateway() {
    log_section "API Gateway APIs"
    local apis=$(aws apigateway get-rest-apis --profile "$PROFILE" --region "$REGION" --query 'items[].id' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$apis" ]]; then
        for api in $apis; do
            local name=$(aws apigateway get-rest-api --rest-api-id "$api" --profile "$PROFILE" --region "$REGION" --query 'name' --output text 2>/dev/null || echo "Unknown")
            local details=$(get_resource_details "$api" "apigateway")
            local tags=$(get_resource_tags "arn:aws:apigateway:$REGION::/restapis/$api")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "API Gateway" "$name ($api)" "$details | Tags: $formatted_tags"
            ((count++))
        done
    fi
    
    log_count $count "API Gateway API"
}

# List Secrets Manager Secrets
explore_secrets() {
    log_section "Secrets Manager Secrets"
    local secrets=$(aws secretsmanager list-secrets --profile "$PROFILE" --region "$REGION" --query 'SecretList[].Name' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$secrets" ]]; then
        for secret in $secrets; do
            local details=$(get_resource_details "$secret" "secretsmanager")
            local tags=$(get_resource_tags "arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:$secret")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "Secret" "$secret" "$details | Tags: $formatted_tags"
            ((count++))
        done
    fi
    
    log_count $count "secret"
}

# List SSM Parameters
explore_ssm() {
    log_section "SSM Parameters"
    local parameters=$(aws ssm describe-parameters --profile "$PROFILE" --region "$REGION" --query 'Parameters[].Name' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$parameters" ]]; then
        for param in $parameters; do
            local details=$(get_resource_details "$param" "ssm")
            local tags=$(get_resource_tags "arn:aws:ssm:$REGION:$ACCOUNT_ID:parameter/$param")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "SSM Parameter" "$param" "$details | Tags: $formatted_tags"
            ((count++))
        done
    fi
    
    log_count $count "SSM parameter"
}

# List IAM Resources
explore_iam() {
    log_section "IAM Resources"
    
    # IAM Roles
    local roles=$(aws iam list-roles --profile "$PROFILE" --query 'Roles[].RoleName' --output text 2>/dev/null || echo "")
    local role_count=0
    
    if [[ -n "$roles" ]]; then
        for role in $roles; do
            local details=$(get_resource_details "$role" "iam")
            local tags=$(get_resource_tags "arn:aws:iam::$ACCOUNT_ID:role/$role")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "IAM Role" "$role" "$details | Tags: $formatted_tags"
            ((role_count++))
        done
    fi
    
    log_count $role_count "IAM role"
    
    # IAM Users
    local users=$(aws iam list-users --profile "$PROFILE" --query 'Users[].UserName' --output text 2>/dev/null || echo "")
    local user_count=0
    
    if [[ -n "$users" ]]; then
        for user in $users; do
            local creation_date=$(aws iam get-user --user-name "$user" --profile "$PROFILE" --query 'User.CreateDate' --output text 2>/dev/null || echo "Unknown")
            local tags=$(get_resource_tags "arn:aws:iam::$ACCOUNT_ID:user/$user")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "IAM User" "$user" "Created: $creation_date | Tags: $formatted_tags"
            ((user_count++))
        done
    fi
    
    log_count $user_count "IAM user"
    
    # IAM Groups
    local groups=$(aws iam list-groups --profile "$PROFILE" --query 'Groups[].GroupName' --output text 2>/dev/null || echo "")
    local group_count=0
    
    if [[ -n "$groups" ]]; then
        for group in $groups; do
            local creation_date=$(aws iam get-group --group-name "$group" --profile "$PROFILE" --query 'Group.CreateDate' --output text 2>/dev/null || echo "Unknown")
            local tags=$(get_resource_tags "arn:aws:iam::$ACCOUNT_ID:group/$group")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "IAM Group" "$group" "Created: $creation_date | Tags: $formatted_tags"
            ((group_count++))
        done
    fi
    
    log_count $group_count "IAM group"
}

# List CloudWatch Resources
explore_cloudwatch() {
    log_section "CloudWatch Resources"
    
    # Log Groups
    local log_groups=$(aws logs describe-log-groups --profile "$PROFILE" --region "$REGION" --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")
    local log_count=0
    
    if [[ -n "$log_groups" ]]; then
        for log_group in $log_groups; do
            local details=$(get_resource_details "$log_group" "cloudwatch")
            local tags=$(get_resource_tags "arn:aws:logs:$REGION:$ACCOUNT_ID:log-group:$log_group")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "Log Group" "$log_group" "$details | Tags: $formatted_tags"
            ((log_count++))
        done
    fi
    
    log_count $log_count "CloudWatch log group"
    
    # Alarms
    local alarms=$(aws cloudwatch describe-alarms --profile "$PROFILE" --region "$REGION" --query 'MetricAlarms[].AlarmName' --output text 2>/dev/null || echo "")
    local alarm_count=0
    
    if [[ -n "$alarms" ]]; then
        for alarm in $alarms; do
            local state=$(aws cloudwatch describe-alarms --alarm-names "$alarm" --profile "$PROFILE" --region "$REGION" --query 'MetricAlarms[0].StateValue' --output text 2>/dev/null || echo "Unknown")
            local tags=$(get_resource_tags "arn:aws:cloudwatch:$REGION:$ACCOUNT_ID:alarm:$alarm")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "CloudWatch Alarm" "$alarm" "State: $state | Tags: $formatted_tags" "$state"
            ((alarm_count++))
        done
    fi
    
    log_count $alarm_count "CloudWatch alarm"
}

# List VPC Resources
explore_vpc() {
    log_section "VPC Resources"
    local vpcs=$(aws ec2 describe-vpcs --profile "$PROFILE" --region "$REGION" --query 'Vpcs[].VpcId' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$vpcs" ]]; then
        for vpc in $vpcs; do
            local details=$(get_resource_details "$vpc" "vpc")
            local tags=$(get_resource_tags "arn:aws:ec2:$REGION:$ACCOUNT_ID:vpc/$vpc")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "VPC" "$vpc" "$details | Tags: $formatted_tags"
            ((count++))
        done
    fi
    
    log_count $count "VPC"
}

# List EC2 Instances
explore_ec2() {
    log_section "EC2 Instances"
    local instances=$(aws ec2 describe-instances --profile "$PROFILE" --region "$REGION" --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$instances" ]]; then
        for instance in $instances; do
            local instance_type=$(aws ec2 describe-instances --instance-ids "$instance" --profile "$PROFILE" --region "$REGION" --query 'Reservations[0].Instances[0].InstanceType' --output text 2>/dev/null || echo "Unknown")
            local state=$(aws ec2 describe-instances --instance-ids "$instance" --profile "$PROFILE" --region "$REGION" --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo "Unknown")
            local tags=$(get_resource_tags "arn:aws:ec2:$REGION:$ACCOUNT_ID:instance/$instance")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "EC2 Instance" "$instance" "Type: $instance_type | Tags: $formatted_tags" "$state"
            ((count++))
        done
    fi
    
    log_count $count "EC2 instance"
}

# List RDS Databases
explore_rds() {
    log_section "RDS Databases"
    local databases=$(aws rds describe-db-instances --profile "$PROFILE" --region "$REGION" --query 'DBInstances[].DBInstanceIdentifier' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$databases" ]]; then
        for db in $databases; do
            local engine=$(aws rds describe-db-instances --db-instance-identifier "$db" --profile "$PROFILE" --region "$REGION" --query 'DBInstances[0].Engine' --output text 2>/dev/null || echo "Unknown")
            local status=$(aws rds describe-db-instances --db-instance-identifier "$db" --profile "$PROFILE" --region "$REGION" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo "Unknown")
            local tags=$(get_resource_tags "arn:aws:rds:$REGION:$ACCOUNT_ID:db:$db")
            local formatted_tags=$(format_tags "$tags")
            
            log_resource "RDS Database" "$db" "Engine: $engine | Tags: $formatted_tags" "$status"
            ((count++))
        done
    fi
    
    log_count $count "RDS database"
}

# List Resource Groups
explore_resource_groups() {
    log_section "Resource Groups"
    local groups=$(aws resource-groups list-groups --profile "$PROFILE" --region "$REGION" --query 'GroupIdentifiers[].GroupArn' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$groups" ]]; then
        for group in $groups; do
            local group_name=$(echo "$group" | sed 's/.*group\///')
            local creation_date=$(aws resource-groups get-group --group "$group" --profile "$PROFILE" --region "$REGION" --query 'Group.CreateDate' --output text 2>/dev/null || echo "Unknown")
            
            log_resource "Resource Group" "$group_name" "Created: $creation_date | ARN: $group"
            ((count++))
        done
    fi
    
    log_count $count "resource group"
}

# Show account summary
show_summary() {
    log_header "AWS Account Summary"
    echo -e "${WHITE}Account ID:${NC} ${CYAN}$ACCOUNT_ID${NC}"
    echo -e "${WHITE}Profile:${NC} ${CYAN}$PROFILE${NC}"
    echo -e "${WHITE}Region:${NC} ${CYAN}$REGION${NC}"
    echo -e "${WHITE}Timestamp:${NC} ${CYAN}$(date)${NC}"
}

# Main execution
main() {
    show_summary
    
    # Explore all resource types
    explore_s3
    explore_dynamodb
    explore_lambda
    explore_apigateway
    explore_secrets
    explore_ssm
    explore_iam
    explore_cloudwatch
    explore_vpc
    explore_ec2
    explore_rds
    explore_resource_groups
    
    echo -e "\n${GREEN}✓ Resource exploration completed!${NC}"
    echo -e "${GRAY}This is a read-only view. No resources were modified.${NC}"
}

# Help function
show_help() {
    echo -e "${WHITE}AWS Resource Explorer${NC}"
    echo ""
    echo -e "${CYAN}Usage:${NC} $0 [options]"
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo -e "  --help, -h    Show this help message"
    echo -e "  --profile     AWS profile to use (default: cliadmin)"
    echo -e "  --region      AWS region to explore (default: us-east-1)"
    echo ""
    echo -e "${CYAN}Description:${NC}"
    echo -e "  Displays all AWS resources in a clean, organized format."
    echo -e "  This is a read-only tool - no resources are modified."
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo -e "  $0                    # Use default profile and region"
    echo -e "  $0 --profile myprofile --region us-west-2"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@" 