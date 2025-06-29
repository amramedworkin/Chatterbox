#!/bin/zsh

# Create AWS Resource Group for Chatterbox
# This groups all resources together for easier management and teardown

set -e

PROFILE="cliadmin"
REGION="us-east-1"
RESOURCE_GROUP_NAME="chatterbox-resources"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Create resource group query
create_resource_group() {
    log_info "Creating AWS Resource Group: $RESOURCE_GROUP_NAME"
    
    # Create the resource group with a query that finds all chatterbox resources
    aws resource-groups create-group \
        --name $RESOURCE_GROUP_NAME \
        --description "Chatterbox project resources for easier management and teardown" \
        --resource-query '{
            "Type": "TAG_FILTERS_1_0",
            "Query": "{\"ResourceTypeFilters\":[\"AWS::*\"],\"TagFilters\":[{\"Key\":\"Project\",\"Values\":[\"Chatterbox\"]}]}"
        }' \
        --profile $PROFILE \
        --region $REGION
    
    log_success "Resource group created successfully"
}

# Add tags to existing resources
tag_existing_resources() {
    log_info "Adding Project:Chatterbox tags to existing resources"
    
    # Tag S3 buckets
    local buckets=$(aws s3 ls --profile $PROFILE --region $REGION | grep chatterbox | awk '{print $3}' 2>/dev/null || echo "")
    for bucket in $buckets; do
        aws s3api put-bucket-tagging \
            --bucket $bucket \
            --tagging 'TagSet=[{Key=Project,Value=Chatterbox}]' \
            --profile $PROFILE --region $REGION 2>/dev/null || true
    done
    
    # Tag DynamoDB tables
    local tables=$(aws dynamodb list-tables --profile $PROFILE --region $REGION | grep chatterbox | tr -d '",' 2>/dev/null || echo "")
    for table in $tables; do
        aws dynamodb tag-resource \
            --resource-arn "arn:aws:dynamodb:$REGION:$(aws sts get-caller-identity --profile $PROFILE --query Account --output text):table/$table" \
            --tags '[{"Key":"Project","Value":"Chatterbox"}]' \
            --profile $PROFILE --region $REGION 2>/dev/null || true
    done
    
    # Tag Lambda functions
    local functions=$(aws lambda list-functions --profile $PROFILE --region $REGION --query 'Functions[?contains(FunctionName, `chatterbox`)].FunctionName' --output text 2>/dev/null || echo "")
    for func in $functions; do
        aws lambda tag-resource \
            --resource "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --profile $PROFILE --query Account --output text):function:$func" \
            --tags '{"Project":"Chatterbox"}' \
            --profile $PROFILE --region $REGION 2>/dev/null || true
    done
    
    # Tag VPCs
    local vpcs=$(aws ec2 describe-vpcs --profile $PROFILE --region $REGION --query 'Vpcs[?Tags[?Value==`development-chatterbox-vpc`]].VpcId' --output text 2>/dev/null || echo "")
    for vpc in $vpcs; do
        aws ec2 create-tags \
            --resources $vpc \
            --tags 'Key=Project,Value=Chatterbox' \
            --profile $PROFILE --region $REGION 2>/dev/null || true
    done
    
    log_success "Resource tagging completed"
}

# List resources in the group
list_group_resources() {
    log_info "Listing resources in group: $RESOURCE_GROUP_NAME"
    
    aws resource-groups list-group-resources \
        --group-name $RESOURCE_GROUP_NAME \
        --profile $PROFILE \
        --region $REGION
}

# Main function
main() {
    log_info "Setting up AWS Resource Group for Chatterbox"
    
    create_resource_group
    tag_existing_resources
    list_group_resources
    
    log_success "Resource group setup completed"
    log_info "You can now use: aws resource-groups list-group-resources --group-name $RESOURCE_GROUP_NAME"
}

# Run main function
main "$@" 