#!/bin/bash

# Deploy Chatterbox infrastructure (without Lambda functions)
# This script deploys the core infrastructure that Lambda functions depend on

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

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Print functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo -e "${GREEN}🚀 CHATTERBOX INFRASTRUCTURE DEPLOYMENT${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}Profile: ${AWS_PROFILE}${NC}"
echo ""

# Check AWS credentials
print_info "Checking AWS credentials..."
if ! aws sts get-caller-identity --profile $AWS_PROFILE > /dev/null 2>&1; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi
print_status "AWS credentials verified"

# Navigate to terraform-simple directory
cd "$PROJECT_ROOT/Cloud/AWS/terraform-simple"

# Step 1: Initialize Terraform
print_info "Initializing Terraform..."
terraform init
print_status "Terraform initialized"

# Step 2: Plan the deployment
print_info "Planning Terraform deployment..."
terraform plan -out=tfplan
print_status "Terraform plan created"

# Step 3: Apply the deployment
print_info "Applying Terraform deployment..."
terraform apply tfplan
print_status "Terraform deployment completed"

# Step 4: Get deployment outputs
print_info "Getting deployment outputs..."
terraform output
print_status "Deployment outputs retrieved"

echo ""
echo -e "${GREEN}🎉 Infrastructure deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Deployed Resources:${NC}"
echo "- S3 Bucket for email storage"
echo "- DynamoDB table for state management"
echo "- Secrets Manager secrets"
echo "- Parameter Store parameters"
echo "- IAM roles and policies"
echo "- CloudWatch log groups"
echo "- Resource group"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Deploy Lambda functions:"
echo "   npm run aws:deploy:lambda"
echo ""
echo "2. Populate secrets from init folder:"
echo "   npm run aws:deploy:secrets"
echo ""
echo -e "${BLUE}💡 Benefits of this approach:${NC}"
echo "- Infrastructure changes are rare and stable"
echo "- Lambda functions can be updated independently"
echo "- Faster Lambda deployments"
echo "- Better separation of concerns" 