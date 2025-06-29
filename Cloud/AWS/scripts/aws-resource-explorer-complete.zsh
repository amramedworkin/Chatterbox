#!/bin/zsh

# AWS Resource Explorer (Complete)
# Displays all AWS resources across all regions with creation dates (read-only)

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
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query 'Account' --output text 2>/dev/null || echo "Unknown")

# Get all available regions
REGIONS=$(aws ec2 describe-regions --profile "$PROFILE" --query 'Regions[].RegionName' --output text 2>/dev/null || echo "us-east-1")

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

log_region() {
    echo -e "\n${YELLOW}📍 Region: $1${NC}"
    echo -e "${GRAY}────────────────────────────────────────────────────────────────${NC}"
}

log_resource() {
    local type="$1"
    local name="$2"
    local region="$3"
    local details="$4"
    local created="$5"
    
    echo -e "  ${BLUE}•${NC} ${WHITE}$type${NC}: ${CYAN}$name${NC}"
    if [[ -n "$region" ]]; then
        echo -e "    ${GRAY}Region: $region${NC}"
    fi
    if [[ -n "$details" ]]; then
        echo -e "    ${GRAY}$details${NC}"
    fi
    if [[ -n "$created" ]]; then
        echo -e "    ${GREEN}Created: $created${NC}"
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

# Function to get creation date for a resource
get_creation_date() {
    local resource_id="$1"
    local resource_type="$2"
    local region="$3"
    local created="N/A"
    
    case "$resource_type" in
        "s3")
            created=$(aws s3api list-buckets --profile "$PROFILE" --query "Buckets[?Name=='$resource_id'].CreationDate" --output text 2>/dev/null || echo "N/A")
            ;;
        "dynamodb")
            created=$(aws dynamodb describe-table --table-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Table.CreationDateTime' --output text 2>/dev/null || echo "N/A")
            ;;
        "lambda")
            created=$(aws lambda get-function --function-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Configuration.LastModified' --output text 2>/dev/null || echo "N/A")
            ;;
        "apigateway")
            created=$(aws apigateway get-rest-api --rest-api-id "$resource_id" --profile "$PROFILE" --region "$region" --query 'createdDate' --output text 2>/dev/null || echo "N/A")
            ;;
        "secretsmanager")
            created=$(aws secretsmanager describe-secret --secret-id "$resource_id" --profile "$PROFILE" --region "$region" --query 'CreatedDate' --output text 2>/dev/null || echo "N/A")
            ;;
        "ssm")
            created=$(aws ssm describe-parameters --profile "$PROFILE" --region "$region" --query "Parameters[?Name=='$resource_id'].LastModifiedDate" --output text 2>/dev/null || echo "N/A")
            ;;
        "iam")
            created=$(aws iam get-role --role-name "$resource_id" --profile "$PROFILE" --query 'Role.CreateDate' --output text 2>/dev/null || echo "N/A")
            ;;
        "cloudwatch")
            created=$(aws logs describe-log-groups --log-group-name-prefix "$resource_id" --profile "$PROFILE" --region "$region" --query 'logGroups[0].creationTime' --output text 2>/dev/null || echo "N/A")
            ;;
        "vpc")
            created=$(aws ec2 describe-vpcs --vpc-ids "$resource_id" --profile "$PROFILE" --region "$region" --query 'Vpcs[0].CreationDate' --output text 2>/dev/null || echo "N/A")
            ;;
        "ec2")
            created=$(aws ec2 describe-instances --instance-ids "$resource_id" --profile "$PROFILE" --region "$region" --query 'Reservations[0].Instances[0].LaunchTime' --output text 2>/dev/null || echo "N/A")
            ;;
        "rds")
            created=$(aws rds describe-db-instances --db-instance-identifier "$resource_id" --profile "$PROFILE" --region "$region" --query 'DBInstances[0].InstanceCreateTime' --output text 2>/dev/null || echo "N/A")
            ;;
        "elasticache")
            created=$(aws elasticache describe-cache-clusters --cache-cluster-id "$resource_id" --profile "$PROFILE" --region "$region" --query 'CacheClusters[0].CacheClusterCreateTime' --output text 2>/dev/null || echo "N/A")
            ;;
        "memorydb")
            created=$(aws memorydb describe-clusters --cluster-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Clusters[0].CreationTime' --output text 2>/dev/null || echo "N/A")
            ;;
        "events")
            created=$(aws events describe-rule --name "$resource_id" --profile "$PROFILE" --region "$region" --query 'CreatedDate' --output text 2>/dev/null || echo "N/A")
            ;;
        *)
            created="N/A"
            ;;
    esac
    
    if [[ "$created" == "None" || "$created" == "" ]]; then
        echo "N/A"
    else
        echo "$created"
    fi
}

# Function to get resource details
get_resource_details() {
    local resource_id="$1"
    local resource_type="$2"
    local region="$3"
    local details=""
    
    case "$resource_type" in
        "s3")
            local size=$(aws s3 ls s3://"$resource_id" --recursive --summarize --profile "$PROFILE" 2>/dev/null | grep "Total Size" | awk '{print $3, $4}' || echo "Unknown")
            local objects=$(aws s3 ls s3://"$resource_id" --recursive --summarize --profile "$PROFILE" 2>/dev/null | grep "Total Objects" | awk '{print $3}' || echo "Unknown")
            details="Size: $size, Objects: $objects"
            ;;
        "dynamodb")
            local item_count=$(aws dynamodb describe-table --table-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Table.ItemCount' --output text 2>/dev/null || echo "Unknown")
            local status=$(aws dynamodb describe-table --table-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Table.TableStatus' --output text 2>/dev/null || echo "Unknown")
            details="Items: $item_count, Status: $status"
            ;;
        "lambda")
            local runtime=$(aws lambda get-function --function-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Configuration.Runtime' --output text 2>/dev/null || echo "Unknown")
            local memory=$(aws lambda get-function --function-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Configuration.MemorySize' --output text 2>/dev/null || echo "Unknown")
            details="Runtime: $runtime, Memory: ${memory}MB"
            ;;
        "apigateway")
            local description=$(aws apigateway get-rest-api --rest-api-id "$resource_id" --profile "$PROFILE" --region "$region" --query 'description' --output text 2>/dev/null || echo "No description")
            details="Description: $description"
            ;;
        "secretsmanager")
            local description=$(aws secretsmanager describe-secret --secret-id "$resource_id" --profile "$PROFILE" --region "$region" --query 'Description' --output text 2>/dev/null || echo "No description")
            details="Description: $description"
            ;;
        "ssm")
            local type=$(aws ssm describe-parameters --profile "$PROFILE" --region "$region" --query "Parameters[?Name=='$resource_id'].Type" --output text 2>/dev/null || echo "Unknown")
            details="Type: $type"
            ;;
        "iam")
            local description=$(aws iam get-role --role-name "$resource_id" --profile "$PROFILE" --query 'Role.Description' --output text 2>/dev/null || echo "No description")
            details="Description: $description"
            ;;
        "cloudwatch")
            local metric_count=$(aws cloudwatch list-metrics --namespace "AWS/Logs" --metric-name "IncomingLogEvents" --dimensions Name=LogGroupName,Value="$resource_id" --profile "$PROFILE" --region "$region" --query 'Metrics | length(@)' --output text 2>/dev/null || echo "0")
            details="Metrics: $metric_count"
            ;;
        "vpc")
            local cidr=$(aws ec2 describe-vpcs --vpc-ids "$resource_id" --profile "$PROFILE" --region "$region" --query 'Vpcs[0].CidrBlock' --output text 2>/dev/null || echo "Unknown")
            local state=$(aws ec2 describe-vpcs --vpc-ids "$resource_id" --profile "$PROFILE" --region "$region" --query 'Vpcs[0].State' --output text 2>/dev/null || echo "Unknown")
            details="CIDR: $cidr, State: $state"
            ;;
        "ec2")
            local instance_type=$(aws ec2 describe-instances --instance-ids "$resource_id" --profile "$PROFILE" --region "$region" --query 'Reservations[0].Instances[0].InstanceType' --output text 2>/dev/null || echo "Unknown")
            local state=$(aws ec2 describe-instances --instance-ids "$resource_id" --profile "$PROFILE" --region "$region" --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo "Unknown")
            details="Type: $instance_type, State: $state"
            ;;
        "rds")
            local engine=$(aws rds describe-db-instances --db-instance-identifier "$resource_id" --profile "$PROFILE" --region "$region" --query 'DBInstances[0].Engine' --output text 2>/dev/null || echo "Unknown")
            local status=$(aws rds describe-db-instances --db-instance-identifier "$resource_id" --profile "$PROFILE" --region "$region" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo "Unknown")
            details="Engine: $engine, Status: $status"
            ;;
        "elasticache")
            local engine=$(aws elasticache describe-cache-clusters --cache-cluster-id "$resource_id" --profile "$PROFILE" --region "$region" --query 'CacheClusters[0].Engine' --output text 2>/dev/null || echo "Unknown")
            local status=$(aws elasticache describe-cache-clusters --cache-cluster-id "$resource_id" --profile "$PROFILE" --region "$region" --query 'CacheClusters[0].CacheClusterStatus' --output text 2>/dev/null || echo "Unknown")
            details="Engine: $engine, Status: $status"
            ;;
        "memorydb")
            local engine=$(aws memorydb describe-clusters --cluster-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Clusters[0].Engine' --output text 2>/dev/null || echo "Unknown")
            local status=$(aws memorydb describe-clusters --cluster-name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Clusters[0].Status' --output text 2>/dev/null || echo "Unknown")
            details="Engine: $engine, Status: $status"
            ;;
        "events")
            local description=$(aws events describe-rule --name "$resource_id" --profile "$PROFILE" --region "$region" --query 'Description' --output text 2>/dev/null || echo "No description")
            local state=$(aws events describe-rule --name "$resource_id" --profile "$PROFILE" --region "$region" --query 'State' --output text 2>/dev/null || echo "Unknown")
            details="Description: $description, State: $state"
            ;;
        *)
            details=""
            ;;
    esac
    
    echo "$details"
}

# List S3 Buckets (global)
explore_s3() {
    log_section "S3 Buckets (Global)"
    local buckets=$(aws s3api list-buckets --profile "$PROFILE" --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
    local count=0
    
    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            local details=$(get_resource_details "$bucket" "s3" "")
            local created=$(get_creation_date "$bucket" "s3" "")
            
            log_resource "S3 Bucket" "$bucket" "" "$details" "$created"
            ((count++))
        done
    fi
    
    log_count $count "S3 bucket"
}

# List DynamoDB Tables (all regions)
explore_dynamodb() {
    log_section "DynamoDB Tables"
    local total_count=0
    
    for region in $REGIONS; do
        local tables=$(aws dynamodb list-tables --profile "$PROFILE" --region "$region" --query 'TableNames[]' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$tables" ]]; then
            log_region "$region"
            for table in $tables; do
                local details=$(get_resource_details "$table" "dynamodb" "$region")
                local created=$(get_creation_date "$table" "dynamodb" "$region")
                
                log_resource "DynamoDB Table" "$table" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "DynamoDB table"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "DynamoDB table"
    fi
}

# List Lambda Functions (all regions)
explore_lambda() {
    log_section "Lambda Functions"
    local total_count=0
    
    for region in $REGIONS; do
        local functions=$(aws lambda list-functions --profile "$PROFILE" --region "$region" --query 'Functions[].FunctionName' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$functions" ]]; then
            log_region "$region"
            for func in $functions; do
                local details=$(get_resource_details "$func" "lambda" "$region")
                local created=$(get_creation_date "$func" "lambda" "$region")
                
                log_resource "Lambda Function" "$func" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "Lambda function"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "Lambda function"
    fi
}

# List API Gateway APIs (all regions)
explore_apigateway() {
    log_section "API Gateway APIs"
    local total_count=0
    
    for region in $REGIONS; do
        local apis=$(aws apigateway get-rest-apis --profile "$PROFILE" --region "$region" --query 'items[].id' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$apis" ]]; then
            log_region "$region"
            for api in $apis; do
                local name=$(aws apigateway get-rest-api --rest-api-id "$api" --profile "$PROFILE" --region "$region" --query 'name' --output text 2>/dev/null || echo "Unknown")
                local details=$(get_resource_details "$api" "apigateway" "$region")
                local created=$(get_creation_date "$api" "apigateway" "$region")
                
                log_resource "API Gateway" "$name ($api)" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "API Gateway API"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "API Gateway API"
    fi
}

# List Secrets Manager Secrets (all regions)
explore_secrets() {
    log_section "Secrets Manager Secrets"
    local total_count=0
    
    for region in $REGIONS; do
        local secrets=$(aws secretsmanager list-secrets --profile "$PROFILE" --region "$region" --query 'SecretList[].Name' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$secrets" ]]; then
            log_region "$region"
            for secret in $secrets; do
                local details=$(get_resource_details "$secret" "secretsmanager" "$region")
                local created=$(get_creation_date "$secret" "secretsmanager" "$region")
                
                log_resource "Secret" "$secret" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "secret"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "secret"
    fi
}

# List SSM Parameters (all regions)
explore_ssm() {
    log_section "SSM Parameters"
    local total_count=0
    
    for region in $REGIONS; do
        local parameters=$(aws ssm describe-parameters --profile "$PROFILE" --region "$region" --query 'Parameters[].Name' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$parameters" ]]; then
            log_region "$region"
            for param in $parameters; do
                local details=$(get_resource_details "$param" "ssm" "$region")
                local created=$(get_creation_date "$param" "ssm" "$region")
                
                log_resource "SSM Parameter" "$param" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "SSM parameter"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "SSM parameter"
    fi
}

# List IAM Resources (global)
explore_iam() {
    log_section "IAM Resources (Global)"
    
    # IAM Roles
    local roles=$(aws iam list-roles --profile "$PROFILE" --query 'Roles[].RoleName' --output text 2>/dev/null || echo "")
    local role_count=0
    
    if [[ -n "$roles" ]]; then
        for role in $roles; do
            local details=$(get_resource_details "$role" "iam" "")
            local created=$(get_creation_date "$role" "iam" "")
            
            log_resource "IAM Role" "$role" "" "$details" "$created"
            ((role_count++))
        done
    fi
    
    log_count $role_count "IAM role"
    
    # IAM Users
    local users=$(aws iam list-users --profile "$PROFILE" --query 'Users[].UserName' --output text 2>/dev/null || echo "")
    local user_count=0
    
    if [[ -n "$users" ]]; then
        for user in $users; do
            local created=$(aws iam get-user --user-name "$user" --profile "$PROFILE" --query 'User.CreateDate' --output text 2>/dev/null || echo "N/A")
            
            log_resource "IAM User" "$user" "" "" "$created"
            ((user_count++))
        done
    fi
    
    log_count $user_count "IAM user"
    
    # IAM Groups
    local groups=$(aws iam list-groups --profile "$PROFILE" --query 'Groups[].GroupName' --output text 2>/dev/null || echo "")
    local group_count=0
    
    if [[ -n "$groups" ]]; then
        for group in $groups; do
            local created=$(aws iam get-group --group-name "$group" --profile "$PROFILE" --query 'Group.CreateDate' --output text 2>/dev/null || echo "N/A")
            
            log_resource "IAM Group" "$group" "" "" "$created"
            ((group_count++))
        done
    fi
    
    log_count $group_count "IAM group"
}

# List CloudWatch Resources (all regions)
explore_cloudwatch() {
    log_section "CloudWatch Resources"
    local total_log_count=0
    local total_alarm_count=0
    
    for region in $REGIONS; do
        # Log Groups
        local log_groups=$(aws logs describe-log-groups --profile "$PROFILE" --region "$region" --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")
        local log_count=0
        
        if [[ -n "$log_groups" ]]; then
            log_region "$region"
            for log_group in $log_groups; do
                local details=$(get_resource_details "$log_group" "cloudwatch" "$region")
                local created=$(get_creation_date "$log_group" "cloudwatch" "$region")
                
                log_resource "Log Group" "$log_group" "$region" "$details" "$created"
                ((log_count++))
                ((total_log_count++))
            done
            log_count $log_count "CloudWatch log group"
        fi
        
        # Alarms
        local alarms=$(aws cloudwatch describe-alarms --profile "$PROFILE" --region "$region" --query 'MetricAlarms[].AlarmName' --output text 2>/dev/null || echo "")
        local alarm_count=0
        
        if [[ -n "$alarms" ]]; then
            if [[ $log_count -eq 0 ]]; then
                log_region "$region"
            fi
            for alarm in $alarms; do
                local state=$(aws cloudwatch describe-alarms --alarm-names "$alarm" --profile "$PROFILE" --region "$region" --query 'MetricAlarms[0].StateValue' --output text 2>/dev/null || echo "Unknown")
                local created=$(aws cloudwatch describe-alarms --alarm-names "$alarm" --profile "$PROFILE" --region "$region" --query 'MetricAlarms[0].AlarmConfigurationUpdatedTimestamp' --output text 2>/dev/null || echo "N/A")
                
                log_resource "CloudWatch Alarm" "$alarm" "$region" "State: $state" "$created"
                ((alarm_count++))
                ((total_alarm_count++))
            done
            log_count $alarm_count "CloudWatch alarm"
        fi
    done
    
    if [[ $total_log_count -eq 0 && $total_alarm_count -eq 0 ]]; then
        log_count 0 "CloudWatch resource"
    fi
}

# List VPC Resources (all regions)
explore_vpc() {
    log_section "VPC Resources"
    local total_count=0
    
    for region in $REGIONS; do
        local vpcs=$(aws ec2 describe-vpcs --profile "$PROFILE" --region "$region" --query 'Vpcs[].VpcId' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$vpcs" ]]; then
            log_region "$region"
            for vpc in $vpcs; do
                local details=$(get_resource_details "$vpc" "vpc" "$region")
                local created=$(get_creation_date "$vpc" "vpc" "$region")
                
                log_resource "VPC" "$vpc" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "VPC"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "VPC"
    fi
}

# List EC2 Instances (all regions)
explore_ec2() {
    log_section "EC2 Instances"
    local total_count=0
    
    for region in $REGIONS; do
        local instances=$(aws ec2 describe-instances --profile "$PROFILE" --region "$region" --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$instances" ]]; then
            log_region "$region"
            for instance in $instances; do
                local details=$(get_resource_details "$instance" "ec2" "$region")
                local created=$(get_creation_date "$instance" "ec2" "$region")
                
                log_resource "EC2 Instance" "$instance" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "EC2 instance"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "EC2 instance"
    fi
}

# List RDS Databases (all regions)
explore_rds() {
    log_section "RDS Databases"
    local total_count=0
    
    for region in $REGIONS; do
        local databases=$(aws rds describe-db-instances --profile "$PROFILE" --region "$region" --query 'DBInstances[].DBInstanceIdentifier' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$databases" ]]; then
            log_region "$region"
            for db in $databases; do
                local details=$(get_resource_details "$db" "rds" "$region")
                local created=$(get_creation_date "$db" "rds" "$region")
                
                log_resource "RDS Database" "$db" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "RDS database"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "RDS database"
    fi
}

# List ElastiCache Clusters (all regions)
explore_elasticache() {
    log_section "ElastiCache Clusters"
    local total_count=0
    
    for region in $REGIONS; do
        local clusters=$(aws elasticache describe-cache-clusters --profile "$PROFILE" --region "$region" --query 'CacheClusters[].CacheClusterId' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$clusters" ]]; then
            log_region "$region"
            for cluster in $clusters; do
                local details=$(get_resource_details "$cluster" "elasticache" "$region")
                local created=$(get_creation_date "$cluster" "elasticache" "$region")
                
                log_resource "ElastiCache Cluster" "$cluster" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "ElastiCache cluster"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "ElastiCache cluster"
    fi
}

# List MemoryDB Clusters (all regions)
explore_memorydb() {
    log_section "MemoryDB Clusters"
    local total_count=0
    
    for region in $REGIONS; do
        local clusters=$(aws memorydb describe-clusters --profile "$PROFILE" --region "$region" --query 'Clusters[].Name' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$clusters" ]]; then
            log_region "$region"
            for cluster in $clusters; do
                local details=$(get_resource_details "$cluster" "memorydb" "$region")
                local created=$(get_creation_date "$cluster" "memorydb" "$region")
                
                log_resource "MemoryDB Cluster" "$cluster" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "MemoryDB cluster"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "MemoryDB cluster"
    fi
}

# List CloudTrail Trails (all regions)
explore_cloudtrail() {
    log_section "CloudTrail Trails"
    local total_count=0
    
    for region in $REGIONS; do
        local trails=$(aws cloudtrail list-trails --profile "$PROFILE" --region "$region" --query 'Trails[].Name' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$trails" ]]; then
            log_region "$region"
            for trail in $trails; do
                local details=$(aws cloudtrail describe-trails --trail-name-list "$trail" --profile "$PROFILE" --region "$region" --query 'trailList[0].S3BucketName' --output text 2>/dev/null || echo "No S3 bucket")
                local created=$(aws cloudtrail describe-trails --trail-name-list "$trail" --profile "$PROFILE" --region "$region" --query 'trailList[0].CreatedTime' --output text 2>/dev/null || echo "N/A")
                
                log_resource "CloudTrail Trail" "$trail" "$region" "S3 Bucket: $details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "CloudTrail trail"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "CloudTrail trail"
    fi
}

# List EventBridge Rules (all regions)
explore_events() {
    log_section "EventBridge Rules"
    local total_count=0
    
    for region in $REGIONS; do
        local rules=$(aws events list-rules --profile "$PROFILE" --region "$region" --query 'Rules[].Name' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$rules" ]]; then
            log_region "$region"
            for rule in $rules; do
                local details=$(get_resource_details "$rule" "events" "$region")
                local created=$(get_creation_date "$rule" "events" "$region")
                
                log_resource "EventBridge Rule" "$rule" "$region" "$details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "EventBridge rule"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "EventBridge rule"
    fi
}

# List Resource Explorer 2 Indexes (all regions)
explore_resource_explorer() {
    log_section "Resource Explorer 2 Indexes"
    local total_count=0
    
    for region in $REGIONS; do
        local indexes=$(aws resource-explorer-2 list-indexes --profile "$PROFILE" --region "$region" --query 'Indexes[].Arn' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$indexes" ]]; then
            log_region "$region"
            for index in $indexes; do
                local index_name=$(echo "$index" | sed 's/.*index\///')
                local details=$(aws resource-explorer-2 get-index --arn "$index" --profile "$PROFILE" --region "$region" --query 'Type' --output text 2>/dev/null || echo "Unknown type")
                local created=$(aws resource-explorer-2 get-index --arn "$index" --profile "$PROFILE" --region "$region" --query 'CreatedAt' --output text 2>/dev/null || echo "N/A")
                
                log_resource "Resource Explorer Index" "$index_name" "$region" "Type: $details" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "Resource Explorer index"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "Resource Explorer index"
    fi
}

# List Resource Groups (all regions)
explore_resource_groups() {
    log_section "Resource Groups"
    local total_count=0
    
    for region in $REGIONS; do
        local groups=$(aws resource-groups list-groups --profile "$PROFILE" --region "$region" --query 'GroupIdentifiers[].GroupArn' --output text 2>/dev/null || echo "")
        local count=0
        
        if [[ -n "$groups" ]]; then
            log_region "$region"
            for group in $groups; do
                local group_name=$(echo "$group" | sed 's/.*group\///')
                local created=$(aws resource-groups get-group --group "$group" --profile "$PROFILE" --region "$region" --query 'Group.CreateDate' --output text 2>/dev/null || echo "N/A")
                
                log_resource "Resource Group" "$group_name" "$region" "" "$created"
                ((count++))
                ((total_count++))
            done
            log_count $count "resource group"
        fi
    done
    
    if [[ $total_count -eq 0 ]]; then
        log_count 0 "resource group"
    fi
}

# Show account summary
show_summary() {
    log_header "AWS Account Summary"
    echo -e "${WHITE}Account ID:${NC} ${CYAN}$ACCOUNT_ID${NC}"
    echo -e "${WHITE}Profile:${NC} ${CYAN}$PROFILE${NC}"
    echo -e "${WHITE}Regions Checked:${NC} ${CYAN}$(echo $REGIONS | wc -w | tr -d ' ')${NC}"
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
    explore_elasticache
    explore_memorydb
    explore_cloudtrail
    explore_events
    explore_resource_explorer
    explore_resource_groups
    
    echo -e "\n${GREEN}✓ Complete resource exploration finished!${NC}"
    echo -e "${GRAY}This is a read-only view. No resources were modified.${NC}"
}

# Help function
show_help() {
    echo -e "${WHITE}AWS Resource Explorer (Complete)${NC}"
    echo ""
    echo -e "${CYAN}Usage:${NC} $0 [options]"
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo -e "  --help, -h    Show this help message"
    echo -e "  --profile     AWS profile to use (default: cliadmin)"
    echo ""
    echo -e "${CYAN}Description:${NC}"
    echo -e "  Displays all AWS resources across all regions with creation dates."
    echo -e "  This is a read-only tool - no resources are modified."
    echo ""
    echo -e "${CYAN}Services Covered:${NC}"
    echo -e "  • S3, DynamoDB, Lambda, API Gateway"
    echo -e "  • Secrets Manager, SSM Parameters, IAM"
    echo -e "  • CloudWatch, VPC, EC2, RDS"
    echo -e "  • ElastiCache, MemoryDB, CloudTrail"
    echo -e "  • EventBridge, Resource Explorer 2"
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
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@" 