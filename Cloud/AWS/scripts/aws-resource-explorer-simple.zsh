#!/bin/zsh

# AWS Resource Explorer (Simple)
# Displays all AWS resources in a clean, organized format (read-only)

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
    
    echo -e "  ${BLUE}•${NC} ${WHITE}$type${NC}: ${CYAN}$name${NC}"
    if [[ -n "$details" ]]; then
        echo -e "    ${GRAY}$details${NC}"
    fi
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

# List S3 Buckets
explore_s3() {
    log_section "S3 Buckets"
    local buckets=$(aws s3api list-buckets --profile "$PROFILE" --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            log_resource "S3 Bucket" "$bucket"
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
            log_resource "DynamoDB Table" "$table"
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
            log_resource "Lambda Function" "$func"
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
            log_resource "API Gateway" "$name ($api)"
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
            log_resource "Secret" "$secret"
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
            log_resource "SSM Parameter" "$param"
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
            log_resource "IAM Role" "$role"
            ((role_count++))
        done
    fi
    
    log_count $role_count "IAM role"
    
    # IAM Users
    local users=$(aws iam list-users --profile "$PROFILE" --query 'Users[].UserName' --output text 2>/dev/null || echo "")
    local user_count=0
    
    if [[ -n "$users" ]]; then
        for user in $users; do
            log_resource "IAM User" "$user"
            ((user_count++))
        done
    fi
    
    log_count $user_count "IAM user"
    
    # IAM Groups
    local groups=$(aws iam list-groups --profile "$PROFILE" --query 'Groups[].GroupName' --output text 2>/dev/null || echo "")
    local group_count=0
    
    if [[ -n "$groups" ]]; then
        for group in $groups; do
            log_resource "IAM Group" "$group"
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
            log_resource "Log Group" "$log_group"
            ((log_count++))
        done
    fi
    
    log_count $log_count "CloudWatch log group"
    
    # Alarms
    local alarms=$(aws cloudwatch describe-alarms --profile "$PROFILE" --region "$REGION" --query 'MetricAlarms[].AlarmName' --output text 2>/dev/null || echo "")
    local alarm_count=0
    
    if [[ -n "$alarms" ]]; then
        for alarm in $alarms; do
            log_resource "CloudWatch Alarm" "$alarm"
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
            log_resource "VPC" "$vpc"
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
            log_resource "EC2 Instance" "$instance"
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
            log_resource "RDS Database" "$db"
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
            log_resource "Resource Group" "$group_name"
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