#!/bin/zsh

# Chatterbox AWS Complete Teardown Script
# Two-phase teardown: 1) Chatterbox resources, 2) IAM users/groups/roles

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROFILE="cliadmin"
REGION="us-east-1"
ENVIRONMENT="development"  # Default environment

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

# Retry function
retry_command() {
    local cmd="$1"
    local description="$2"
    local max_attempts=3
    
    for i in $(seq 1 $max_attempts); do
        log_info "Attempting: $description (attempt $i/$max_attempts)"
        if eval "$cmd"; then
            log_success "$description completed successfully"
            return 0
        else
            if [[ $i -eq $max_attempts ]]; then
                log_error "$description failed after $max_attempts attempts"
                return 1
            else
                log_warning "$description failed, retrying in 10 seconds..."
                sleep 10
            fi
        fi
    done
}

# Phase 1: Remove Chatterbox Resources
remove_chatterbox_resources() {
    log_header "PHASE 1: Removing Chatterbox Resources"
    
    # Remove resource group first
    remove_resource_group
    
    # Remove API Gateway and Lambda (highest level services)
    remove_api_gateway
    remove_lambda_functions
    
    # Remove data storage
    remove_dynamodb_tables
    remove_s3_buckets
    
    # Remove configuration and secrets
    remove_ssm_parameters
    remove_secrets
    
    # Remove monitoring
    remove_cloudwatch_resources
    
    # Remove networking
    remove_vpc_resources
    
    log_success "Phase 1 completed - Chatterbox resources removed"
}

# Phase 2: Remove IAM Resources
remove_iam_resources() {
    log_header "PHASE 2: Removing IAM Resources"
    
    # Remove IAM roles first
    remove_iam_roles
    
    # Remove IAM groups
    remove_iam_groups
    
    # Remove IAM users last
    remove_iam_users
    
    log_success "Phase 2 completed - IAM resources removed"
}

# Remove Resource Group
remove_resource_group() {
    log_info "=== Removing Resource Group ==="
    
    local resource_group_name="${ENVIRONMENT}-chatterbox-resources"
    
    log_info "Removing resource group: $resource_group_name"
    retry_command \
        "aws resource-groups delete-group --group-name '$resource_group_name' --profile $PROFILE --region $REGION" \
        "Delete resource group $resource_group_name"
}

# Remove API Gateway Resources
remove_api_gateway() {
    log_info "=== Removing API Gateway Resources ==="
    
    local apis=$(aws apigatewayv2 get-apis --profile "$PROFILE" --region "$REGION" --query 'Items[?contains(Name, `chatterbox`)].ApiId' --output text 2>/dev/null || echo "")
    
    if [[ -n "$apis" ]]; then
        for api in $apis; do
            log_info "Removing API Gateway: $api"
            retry_command \
                "aws apigatewayv2 delete-api --api-id $api --profile $PROFILE --region $REGION" \
                "Delete API Gateway $api"
        done
    else
        log_info "No Chatterbox API Gateway resources found"
    fi
}

# Remove Lambda Functions
remove_lambda_functions() {
    log_info "=== Removing Lambda Functions ==="
    
    local functions=$(aws lambda list-functions --profile "$PROFILE" --region "$REGION" --query 'Functions[?contains(FunctionName, `chatterbox`)].FunctionName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$functions" ]]; then
        for func in $functions; do
            log_info "Removing Lambda function: $func"
            retry_command \
                "aws lambda delete-function --function-name $func --profile $PROFILE --region $REGION" \
                "Delete Lambda function $func"
        done
    else
        log_info "No Chatterbox Lambda functions found"
    fi
}

# Remove DynamoDB Tables
remove_dynamodb_tables() {
    log_info "=== Removing DynamoDB Tables ==="
    
    local tables=$(aws dynamodb list-tables --profile "$PROFILE" --region "$REGION" --query 'TableNames[?contains(@, `chatterbox`)]' --output text 2>/dev/null || echo "")
    
    if [[ -n "$tables" ]]; then
        for table in $tables; do
            log_info "Removing DynamoDB table: $table"
            retry_command \
                "aws dynamodb delete-table --table-name $table --profile $PROFILE --region $REGION" \
                "Delete DynamoDB table $table"
            
            # Wait for table to be deleted
            log_info "Waiting for DynamoDB table $table to be deleted..."
            aws dynamodb wait table-not-exists --table-name "$table" --profile "$PROFILE" --region "$REGION" 2>/dev/null || true
            log_success "DynamoDB table $table deleted successfully"
        done
    else
        log_info "No Chatterbox DynamoDB tables found"
    fi
}

# Remove S3 Buckets
remove_s3_buckets() {
    log_info "=== Removing S3 Buckets ==="
    
    local buckets=$(aws s3api list-buckets --profile "$PROFILE" --query 'Buckets[?contains(Name, `chatterbox`)].Name' --output text 2>/dev/null || echo "")
    
    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            log_info "Removing S3 bucket: $bucket"
            
            # Remove object versions first
            log_info "Removing object versions from $bucket"
            aws s3api list-object-versions --bucket "$bucket" --profile "$PROFILE" --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output json 2>/dev/null | \
            jq -r '.[] | "\(.Key) \(.VersionId)"' | \
            while read -r key version; do
                if [[ -n "$key" && -n "$version" ]]; then
                    aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" --profile "$PROFILE" 2>/dev/null || true
                fi
            done
            
            # Remove delete markers
            log_info "Removing delete markers from $bucket"
            aws s3api list-object-versions --bucket "$bucket" --profile "$PROFILE" --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output json 2>/dev/null | \
            jq -r '.[] | "\(.Key) \(.VersionId)"' | \
            while read -r key version; do
                if [[ -n "$key" && -n "$version" ]]; then
                    aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" --profile "$PROFILE" 2>/dev/null || true
                fi
            done
            
            # Remove all objects
            retry_command \
                "aws s3 rm s3://$bucket --recursive --profile $PROFILE" \
                "Remove all objects from bucket $bucket"
            
            # Delete the bucket
            retry_command \
                "aws s3api delete-bucket --bucket $bucket --profile $PROFILE" \
                "Delete S3 bucket $bucket"
        done
    else
        log_info "No Chatterbox S3 buckets found"
    fi
}

# Remove SSM Parameters
remove_ssm_parameters() {
    log_info "=== Removing SSM Parameters ==="
    
    PARAMS=(
        "/chatterbox/app-config"
        "/chatterbox/polling-config"
        "/chatterbox/openai-config"
        "/chatterbox/google-config"
    )
    
    for PARAM in "${PARAMS[@]}"; do
        log_info "Removing SSM parameter: $PARAM"
        # Check if parameter exists before trying to delete
        if aws ssm describe-parameters --profile "$PROFILE" --region "$REGION" --query "Parameters[?Name=='$PARAM'].Name" --output text 2>/dev/null | grep -q "$PARAM"; then
            retry_command \
                "aws ssm delete-parameter --name '$PARAM' --profile $PROFILE --region $REGION" \
                "Delete SSM parameter $PARAM"
        else
            log_info "SSM parameter $PARAM does not exist, skipping"
        fi
    done
}

# Remove Secrets Manager Secrets
remove_secrets() {
    log_info "=== Removing Secrets Manager Secrets ==="
    
    local secrets=$(aws secretsmanager list-secrets --profile "$PROFILE" --region "$REGION" --query 'SecretList[?contains(Name, `chatterbox`)].Name' --output text 2>/dev/null || echo "")
    
    if [[ -n "$secrets" ]]; then
        for secret in $secrets; do
            log_info "Removing secret: $secret"
            retry_command \
                "aws secretsmanager delete-secret --secret-id '$secret' --force-delete-without-recovery --profile $PROFILE --region $REGION" \
                "Delete secret $secret"
        done
    else
        log_info "No Chatterbox secrets found"
    fi
}

# Remove CloudWatch Resources
remove_cloudwatch_resources() {
    log_info "=== Removing CloudWatch Resources ==="
    
    # Remove CloudWatch alarms
    local alarms=$(aws cloudwatch describe-alarms --profile "$PROFILE" --region "$REGION" --query 'MetricAlarms[?contains(AlarmName, `chatterbox`)].AlarmName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$alarms" ]]; then
        for alarm in $alarms; do
            log_info "Removing CloudWatch alarm: $alarm"
            retry_command \
                "aws cloudwatch delete-alarms --alarm-names '$alarm' --profile $PROFILE --region $REGION" \
                "Delete CloudWatch alarm $alarm"
        done
    else
        log_info "No Chatterbox CloudWatch alarms found"
    fi
    
    # Remove CloudWatch log groups
    local log_groups=$(aws logs describe-log-groups --profile "$PROFILE" --region "$REGION" --query 'logGroups[?contains(logGroupName, `chatterbox`)].logGroupName' --output text 2>/dev/null | tr '\t' '\n' || echo "")
    
    if [[ -n "$log_groups" ]]; then
        # Process each log group individually
        while IFS= read -r log_group; do
            if [[ -n "$log_group" ]]; then
                log_info "Removing CloudWatch log group: $log_group"
                retry_command \
                    "aws logs delete-log-group --log-group-name '$log_group' --profile $PROFILE --region $REGION" \
                    "Delete CloudWatch log group $log_group"
            fi
        done <<< "$log_groups"
    else
        log_info "No Chatterbox CloudWatch log groups found"
    fi
    
    # Remove CloudWatch dashboards
    local dashboards=$(aws cloudwatch list-dashboards --profile "$PROFILE" --region "$REGION" --query 'DashboardEntries[?contains(DashboardName, `chatterbox`)].DashboardName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$dashboards" ]]; then
        for dashboard in $dashboards; do
            log_info "Removing CloudWatch dashboard: $dashboard"
            retry_command \
                "aws cloudwatch delete-dashboards --dashboard-names '$dashboard' --profile $PROFILE --region $REGION" \
                "Delete CloudWatch dashboard $dashboard"
        done
    else
        log_info "No Chatterbox CloudWatch dashboards found"
    fi
}

# Remove VPC Resources
remove_vpc_resources() {
    log_info "=== Removing VPC Resources ==="
    
    local vpcs=$(aws ec2 describe-vpcs --profile "$PROFILE" --region "$REGION" --query 'Vpcs[?contains(Tags[?Key==`Name`].Value, `chatterbox`)].VpcId' --output text 2>/dev/null || echo "")
    
    if [[ -n "$vpcs" ]]; then
        for vpc in $vpcs; do
            log_info "Removing VPC: $vpc"
            
            # Get VPC name for logging
            local vpc_name=$(aws ec2 describe-vpcs --vpc-ids "$vpc" --profile "$PROFILE" --region "$REGION" --query 'Vpcs[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "Unknown")
            
            # Delete VPC (this will fail if there are dependencies, which is expected)
            if aws ec2 delete-vpc --vpc-id "$vpc" --profile "$PROFILE" --region "$REGION" 2>/dev/null; then
                log_success "VPC $vpc ($vpc_name) deleted successfully"
            else
                log_warning "VPC $vpc ($vpc_name) could not be deleted - checking dependencies..."
                check_vpc_dependencies "$vpc" "$vpc_name"
            fi
        done
    else
        log_info "No Chatterbox VPCs found"
    fi
}

# Check VPC dependencies and display them
check_vpc_dependencies() {
    local vpc_id="$1"
    local vpc_name="$2"
    
    log_info "=== VPC Dependencies for $vpc_id ($vpc_name) ==="
    
    # Check for subnets
    local subnets=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'Subnets[].SubnetId' --output text 2>/dev/null || echo "")
    if [[ -n "$subnets" ]]; then
        log_warning "  Subnets: $subnets"
    fi
    
    # Check for network interfaces
    local enis=$(aws ec2 describe-network-interfaces --filters "Name=vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'NetworkInterfaces[].NetworkInterfaceId' --output text 2>/dev/null || echo "")
    if [[ -n "$enis" ]]; then
        log_warning "  Network Interfaces: $enis"
    fi
    
    # Check for internet gateways
    local igws=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'InternetGateways[].InternetGatewayId' --output text 2>/dev/null || echo "")
    if [[ -n "$igws" ]]; then
        log_warning "  Internet Gateways: $igws"
    fi
    
    # Check for NAT gateways
    local nat_gateways=$(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'NatGateways[].NatGatewayId' --output text 2>/dev/null || echo "")
    if [[ -n "$nat_gateways" ]]; then
        log_warning "  NAT Gateways: $nat_gateways"
    fi
    
    # Check for route tables
    local route_tables=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'RouteTables[].RouteTableId' --output text 2>/dev/null || echo "")
    if [[ -n "$route_tables" ]]; then
        log_warning "  Route Tables: $route_tables"
    fi
    
    # Check for security groups
    local security_groups=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'SecurityGroups[].GroupId' --output text 2>/dev/null || echo "")
    if [[ -n "$security_groups" ]]; then
        log_warning "  Security Groups: $security_groups"
    fi
    
    # Check for VPC endpoints
    local vpc_endpoints=$(aws ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'VpcEndpoints[].VpcEndpointId' --output text 2>/dev/null || echo "")
    if [[ -n "$vpc_endpoints" ]]; then
        log_warning "  VPC Endpoints: $vpc_endpoints"
    fi
    
    # Check for VPN gateways
    local vpn_gateways=$(aws ec2 describe-vpn-gateways --filters "Name=attachment.vpc-id,Values=$vpc_id" --profile "$PROFILE" --region "$REGION" --query 'VpnGateways[].VpnGatewayId' --output text 2>/dev/null || echo "")
    if [[ -n "$vpn_gateways" ]]; then
        log_warning "  VPN Gateways: $vpn_gateways"
    fi
    
    # Check for EC2 instances
    local instances=$(aws ec2 describe-instances --filters "Name=vpc-id,Values=$vpc_id" "Name=instance-state-name,Values=running,stopped,stopping,starting" --profile "$PROFILE" --region "$REGION" --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")
    if [[ -n "$instances" ]]; then
        log_warning "  EC2 Instances: $instances"
    fi
    
    # Check for load balancers
    local load_balancers=$(aws elbv2 describe-load-balancers --profile "$PROFILE" --region "$REGION" --query 'LoadBalancers[?VpcId==`'$vpc_id'`].LoadBalancerArn' --output text 2>/dev/null || echo "")
    if [[ -n "$load_balancers" ]]; then
        log_warning "  Load Balancers: $load_balancers"
    fi
    
    # Check for elastic IPs
    local eips=$(aws ec2 describe-addresses --profile "$PROFILE" --region "$REGION" --query 'Addresses[?InstanceId!=`null`].AllocationId' --output text 2>/dev/null || echo "")
    if [[ -n "$eips" ]]; then
        log_warning "  Elastic IPs: $eips"
    fi
    
    # Check for Lambda functions using VPC
    local lambda_functions=$(aws lambda list-functions --profile "$PROFILE" --region "$REGION" --query 'Functions[?VpcConfig.VpcId==`'$vpc_id'`].FunctionName' --output text 2>/dev/null || echo "")
    if [[ -n "$lambda_functions" ]]; then
        log_warning "  Lambda Functions: $lambda_functions"
    fi
    
    # Check for RDS instances
    local rds_instances=$(aws rds describe-db-instances --profile "$PROFILE" --region "$REGION" --query 'DBInstances[?DBSubnetGroup.VpcId==`'$vpc_id'`].DBInstanceIdentifier' --output text 2>/dev/null || echo "")
    if [[ -n "$rds_instances" ]]; then
        log_warning "  RDS Instances: $rds_instances"
    fi
    
    # Check for ElastiCache clusters
    local elasticache_clusters=$(aws elasticache describe-cache-clusters --profile "$PROFILE" --region "$REGION" --query 'CacheClusters[?CacheSubnetGroup.VpcId==`'$vpc_id'`].CacheClusterId' --output text 2>/dev/null || echo "")
    if [[ -n "$elasticache_clusters" ]]; then
        log_warning "  ElastiCache Clusters: $elasticache_clusters"
    fi
    
    # Check for Redshift clusters
    local redshift_clusters=$(aws redshift describe-clusters --profile "$PROFILE" --region "$REGION" --query 'Clusters[?VpcId==`'$vpc_id'`].ClusterIdentifier' --output text 2>/dev/null || echo "")
    if [[ -n "$redshift_clusters" ]]; then
        log_warning "  Redshift Clusters: $redshift_clusters"
    fi
    
    # Check for EKS clusters
    local eks_clusters=$(aws eks list-clusters --profile "$PROFILE" --region "$REGION" --query 'clusters[]' --output text 2>/dev/null | while read -r cluster; do
        if aws eks describe-cluster --name "$cluster" --profile "$PROFILE" --region "$REGION" --query 'cluster.resourcesVpcConfig.vpcId' --output text 2>/dev/null | grep -q "$vpc_id"; then
            echo "$cluster"
        fi
    done)
    if [[ -n "$eks_clusters" ]]; then
        log_warning "  EKS Clusters: $eks_clusters"
    fi
    
    # Check for ECS services
    local ecs_clusters=$(aws ecs list-clusters --profile "$PROFILE" --region "$REGION" --query 'clusterArns[]' --output text 2>/dev/null || echo "")
    if [[ -n "$ecs_clusters" ]]; then
        for cluster_arn in $ecs_clusters; do
            local cluster_name=$(echo "$cluster_arn" | cut -d'/' -f2)
            local vpc_config=$(aws ecs describe-clusters --clusters "$cluster_name" --profile "$PROFILE" --region "$REGION" --query 'clusters[0].vpcConfiguration.vpcId' --output text 2>/dev/null || echo "")
            if [[ "$vpc_config" == "$vpc_id" ]]; then
                log_warning "  ECS Cluster: $cluster_name"
            fi
        done
    fi
    
    log_warning "VPC $vpc_id ($vpc_name) has dependencies listed above and cannot be deleted"
    log_info "Manual cleanup of these dependencies is required before VPC deletion"
}

# Remove IAM Roles
remove_iam_roles() {
    log_info "=== Removing IAM Roles ==="
    
    ROLES=(
        "${ENVIRONMENT}-chatterbox-lambda-role"
        "${ENVIRONMENT}-chatterbox-role"
    )
    
    for ROLE in "${ROLES[@]}"; do
        log_info "Removing IAM role: $ROLE"
        
        # Detach all attached policies
        local policy_arns=$(aws iam list-attached-role-policies --role-name "$ROLE" --profile "$PROFILE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
        for policy_arn in $policy_arns; do
            log_info "Detaching policy $policy_arn from $ROLE"
            aws iam detach-role-policy --role-name "$ROLE" --policy-arn "$policy_arn" --profile "$PROFILE" 2>/dev/null || true
        done
        
        # Delete all inline policies
        local inline_policies=$(aws iam list-role-policies --role-name "$ROLE" --profile "$PROFILE" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
        for policy_name in $inline_policies; do
            log_info "Deleting inline policy $policy_name from $ROLE"
            aws iam delete-role-policy --role-name "$ROLE" --policy-name "$policy_name" --profile "$PROFILE" 2>/dev/null || true
        done
        
        # Now delete the role
        retry_command \
            "aws iam delete-role --role-name '$ROLE' --profile $PROFILE" \
            "Delete IAM role $ROLE"
    done
}

# Remove IAM Groups
remove_iam_groups() {
    log_info "=== Removing IAM Groups ==="
    
    GROUPS=(
        "chatteradmingrp"
        "AdminAccess"
        "PowerUser"
    )
    
    for GROUP in "${GROUPS[@]}"; do
        log_info "Removing IAM group: $GROUP"
        
        # Remove all users from the group
        local users=$(aws iam get-group --group-name "$GROUP" --profile "$PROFILE" --query 'Users[].UserName' --output text 2>/dev/null || echo "")
        for user in $users; do
            log_info "Removing user $user from group $GROUP"
            aws iam remove-user-from-group --group-name "$GROUP" --user-name "$user" --profile "$PROFILE" 2>/dev/null || true
        done
        
        # Delete the group
        retry_command \
            "aws iam delete-group --group-name '$GROUP' --profile $PROFILE" \
            "Delete IAM group $GROUP"
    done
}

# Remove IAM Users
remove_iam_users() {
    log_info "=== Removing IAM Users ==="
    
    USERS=(
        "chatteradmin"
        "cliadmin"
        "clipower"
    )
    
    for USER in "${USERS[@]}"; do
        log_info "Removing IAM user: $USER"
        
        # Detach all policies from user
        local policy_arns=$(aws iam list-attached-user-policies --user-name "$USER" --profile "$PROFILE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
        for policy_arn in $policy_arns; do
            log_info "Detaching policy $policy_arn from user $USER"
            aws iam detach-user-policy --user-name "$USER" --policy-arn "$policy_arn" --profile "$PROFILE" 2>/dev/null || true
        done
        
        # Delete all inline policies
        local inline_policies=$(aws iam list-user-policies --user-name "$USER" --profile "$PROFILE" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
        for policy_name in $inline_policies; do
            log_info "Deleting inline policy $policy_name from user $USER"
            aws iam delete-user-policy --user-name "$USER" --policy-name "$policy_name" --profile "$PROFILE" 2>/dev/null || true
        done
        
        # Remove user from all groups
        local groups=$(aws iam list-groups-for-user --user-name "$USER" --profile "$PROFILE" --query 'Groups[].GroupName' --output text 2>/dev/null || echo "")
        for group in $groups; do
            log_info "Removing user $USER from group $group"
            aws iam remove-user-from-group --group-name "$group" --user-name "$USER" --profile "$PROFILE" 2>/dev/null || true
        done
        
        # Delete access keys
        local access_keys=$(aws iam list-access-keys --user-name "$USER" --profile "$PROFILE" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || echo "")
        for key in $access_keys; do
            log_info "Deleting access key $key for user $USER"
            aws iam delete-access-key --user-name "$USER" --access-key-id "$key" --profile "$PROFILE" 2>/dev/null || true
        done
        
        # Delete the user
        retry_command \
            "aws iam delete-user --user-name '$USER' --profile $PROFILE" \
            "Delete IAM user $USER"
    done
}

# Forcefully remove Chatterbox IAM resources
force_remove_chatterbox_iam() {
    log_header "Forcefully Removing Chatterbox IAM Resources"

    local user="chatteradmin"
    local group="chatteradmingrp"
    local role="${ENVIRONMENT}-chatterbox-role"

    # Remove all access keys for user
    log_info "Checking for access keys for user $user..."
    local access_keys=$(aws iam list-access-keys --user-name "$user" --profile "$PROFILE" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || echo "")
    for key in $access_keys; do
        log_info "Deleting access key $key for user $user..."
        aws iam delete-access-key --user-name "$user" --access-key-id "$key" --profile "$PROFILE" 2>/dev/null && \
            log_success "Access key $key deleted" || log_warning "Failed to delete access key $key or it does not exist"
    done

    # Remove user from all groups
    log_info "Checking for groups for user $user..."
    local groups=$(aws iam list-groups-for-user --user-name "$user" --profile "$PROFILE" --query 'Groups[].GroupName' --output text 2>/dev/null || echo "")
    for g in $groups; do
        log_info "Removing user $user from group $g..."
        aws iam remove-user-from-group --user-name "$user" --group-name "$g" --profile "$PROFILE" 2>/dev/null && \
            log_success "User $user removed from group $g" || log_warning "Failed to remove user $user from group $g or not a member"
    done

    # Detach all policies from user
    log_info "Detaching all policies from user $user..."
    local user_policies=$(aws iam list-attached-user-policies --user-name "$user" --profile "$PROFILE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
    for policy_arn in $user_policies; do
        log_info "Detaching policy $policy_arn from user $user..."
        aws iam detach-user-policy --user-name "$user" --policy-arn "$policy_arn" --profile "$PROFILE" 2>/dev/null && \
            log_success "Policy $policy_arn detached from user $user" || log_warning "Failed to detach policy $policy_arn from user $user"
    done

    # Delete user
    log_info "Deleting user $user..."
    aws iam delete-user --user-name "$user" --profile "$PROFILE" 2>/dev/null && \
        log_success "User $user deleted" || log_warning "User $user not found or could not be deleted"

    # Delete group
    log_info "Deleting group $group..."
    aws iam delete-group --group-name "$group" --profile "$PROFILE" 2>/dev/null && \
        log_success "Group $group deleted" || log_warning "Group $group not found or could not be deleted"

    # Detach all policies from role
    log_info "Detaching all policies from role $role..."
    local role_policies=$(aws iam list-attached-role-policies --role-name "$role" --profile "$PROFILE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
    for policy_arn in $role_policies; do
        log_info "Detaching policy $policy_arn from role $role..."
        aws iam detach-role-policy --role-name "$role" --policy-arn "$policy_arn" --profile "$PROFILE" 2>/dev/null && \
            log_success "Policy $policy_arn detached from role $role" || log_warning "Failed to detach policy $policy_arn from role $role"
    done

    # Delete all inline policies from role
    log_info "Deleting all inline policies from role $role..."
    local inline_policies=$(aws iam list-role-policies --role-name "$role" --profile "$PROFILE" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
    for policy_name in $inline_policies; do
        log_info "Deleting inline policy $policy_name from role $role..."
        aws iam delete-role-policy --role-name "$role" --policy-name "$policy_name" --profile "$PROFILE" 2>/dev/null && \
            log_success "Inline policy $policy_name deleted from role $role" || log_warning "Failed to delete inline policy $policy_name from role $role"
    done

    # Remove role from any instance profiles
    log_info "Checking for instance profiles for role $role..."
    local instance_profiles=$(aws iam list-instance-profiles-for-role --role-name "$role" --profile "$PROFILE" --query 'InstanceProfiles[].InstanceProfileName' --output text 2>/dev/null || echo "")
    for profile in $instance_profiles; do
        log_info "Removing role $role from instance profile $profile..."
        aws iam remove-role-from-instance-profile --instance-profile-name "$profile" --role-name "$role" --profile "$PROFILE" 2>/dev/null && \
            log_success "Role $role removed from instance profile $profile" || log_warning "Failed to remove role $role from instance profile $profile"
    done

    # Delete role
    log_info "Deleting role $role..."
    aws iam delete-role --role-name "$role" --profile "$PROFILE" 2>/dev/null && \
        log_success "Role $role deleted" || log_warning "Role $role not found or could not be deleted"
}

# Final cleanup and verification
final_cleanup() {
    log_header "Final Cleanup and Verification"
    
    # Check for any remaining chatterbox resources
    log_info "Checking for remaining chatterbox resources..."
    
    # Check S3
    local remaining_buckets=$(aws s3api list-buckets --profile "$PROFILE" --query 'Buckets[?contains(Name, `chatterbox`)].Name' --output text 2>/dev/null || echo "")
    if [[ -n "$remaining_buckets" ]]; then
        log_warning "Remaining S3 buckets: $remaining_buckets"
    fi
    
    # Check DynamoDB
    local remaining_tables=$(aws dynamodb list-tables --profile "$PROFILE" --region "$REGION" --query 'TableNames[?contains(@, `chatterbox`)]' --output text 2>/dev/null || echo "")
    if [[ -n "$remaining_tables" ]]; then
        log_warning "Remaining DynamoDB tables: $remaining_tables"
    fi
    
    # Check Lambda
    local remaining_functions=$(aws lambda list-functions --profile "$PROFILE" --region "$REGION" --query 'Functions[?contains(FunctionName, `chatterbox`)].FunctionName' --output text 2>/dev/null || echo "")
    if [[ -n "$remaining_functions" ]]; then
        log_warning "Remaining Lambda functions: $remaining_functions"
    fi
    
    # Check IAM
    local remaining_roles=$(aws iam list-roles --profile "$PROFILE" --query 'Roles[?contains(RoleName, `chatterbox`)].RoleName' --output text 2>/dev/null || echo "")
    if [[ -n "$remaining_roles" ]]; then
        log_warning "Remaining IAM roles: $remaining_roles"
    fi
    
    local remaining_users=$(aws iam list-users --profile "$PROFILE" --query 'Users[?contains(UserName, `chatter`)].UserName' --output text 2>/dev/null || echo "")
    if [[ -n "$remaining_users" ]]; then
        log_warning "Remaining IAM users: $remaining_users"
    fi
    
    local remaining_groups=$(aws iam list-groups --profile "$PROFILE" --query 'Groups[?contains(GroupName, `chatter`)].GroupName' --output text 2>/dev/null || echo "")
    if [[ -n "$remaining_groups" ]]; then
        log_warning "Remaining IAM groups: $remaining_groups"
    fi
}

# Main teardown function
main() {
    log_info "Starting Chatterbox AWS Complete Teardown (Two-Phase)"
    log_warning "This will permanently delete ALL Chatterbox AWS resources!"
    log_warning "This action cannot be undone!"
    
    # Confirmation
    if [[ "$FORCE_MODE" != "true" ]]; then
        echo
        log_warning "To proceed with complete teardown, type: COMPLETE TEARDOWN"
        read -r "REPLY?Confirmation: "
        echo
        if [[ $REPLY != "COMPLETE TEARDOWN" ]]; then
            log_info "Teardown cancelled - incorrect confirmation"
            exit 0
        fi
    fi
    
    log_info "Proceeding with two-phase teardown..."
    
    # Phase 1: Remove Chatterbox resources
    remove_chatterbox_resources
    
    # Phase 2: Remove IAM resources
    remove_iam_resources
    
    # Final cleanup and verification
    final_cleanup

    # Forcefully remove Chatterbox IAM resources
    force_remove_chatterbox_iam

    log_success "Chatterbox AWS teardown completed successfully!"
    log_info "All chatterbox resources have been removed from your AWS account."
}

# Help function
show_help() {
    echo "Chatterbox AWS Complete Teardown Script (Two-Phase)"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo "  --force       Skip confirmation prompts"
    echo "  --env ENV     Specify environment (development, staging, production)"
    echo ""
    echo "Two-Phase Teardown:"
    echo "  Phase 1: Remove Chatterbox resources (S3, DynamoDB, Lambda, etc.)"
    echo "  Phase 2: Remove IAM resources (users, groups, roles)"
    echo ""
    echo "This script will remove ALL AWS resources related to the Chatterbox project."
    echo "This action cannot be undone!"
    echo ""
    echo "Confirmation: Type 'COMPLETE TEARDOWN' when prompted to proceed."
}

# Parse command line arguments
FORCE_MODE="false"
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --force)
            FORCE_MODE="true"
            shift
            ;;
        --env)
            ENVIRONMENT="$2"
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