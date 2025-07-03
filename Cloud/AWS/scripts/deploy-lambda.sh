#!/bin/bash

# Deploy Chatterbox Lambda functions
# This script deploys only the Lambda functions, assuming infrastructure exists

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

echo -e "${GREEN}🚀 CHATTERBOX LAMBDA DEPLOYMENT${NC}"
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

# Check if infrastructure exists
print_info "Checking if infrastructure exists..."
cd "$PROJECT_ROOT/Cloud/AWS/terraform-simple"
if ! terraform output lambda_role_arn > /dev/null 2>&1; then
    print_error "Infrastructure not found. Please run: npm run aws:deploy:infrastructure"
    exit 1
fi
print_status "Infrastructure found"

# Navigate to terraform-lambda directory
cd "$PROJECT_ROOT/Cloud/AWS/terraform-lambda"

# Step 1: Initialize Terraform
print_info "Initializing Terraform..."
terraform init
print_status "Terraform initialized"

# Step 2: Build Lambda functions
print_info "Building Lambda functions..."
cd lambda
# Clean and reinstall dependencies
rm -rf node_modules package-lock.json
npm install
# Build using local TypeScript
npx tsc
print_status "Lambda functions built"

# Step 3: Create Lambda deployment package
print_info "Creating Lambda deployment package..."
rm -f ../lambda.zip
zip -r ../lambda.zip dist/ node_modules/ package.json
print_status "Lambda deployment package created"

# Step 4: Plan the deployment
print_info "Planning Lambda deployment..."
cd ..
terraform plan -out=tfplan
print_status "Terraform plan created"

# Step 5: Apply the deployment
print_info "Applying Lambda deployment..."
terraform apply tfplan
print_status "Lambda deployment completed"

# Step 6: Get deployment outputs
print_info "Getting Lambda deployment outputs..."
terraform output
print_status "Lambda deployment outputs retrieved"

# Step 7: Test the deployment
print_info "Testing Lambda functions..."

# Get default Gmail user from infrastructure
DEFAULT_GMAIL_USER=$(cd ../terraform-simple && terraform output -raw default_gmail_user)

aws lambda invoke \
    --function-name ${ENVIRONMENT}-poll-gmail \
    --payload "{\"queryStringParameters\": {\"userEmail\": \"$DEFAULT_GMAIL_USER\"}}" \
    response.json \
    --cli-binary-format raw-in-base64-out \
    --profile $AWS_PROFILE

if [ -f response.json ]; then
    echo "Lambda response:"
    cat response.json
    rm response.json
fi
print_status "Lambda function test completed"

echo ""
echo -e "${GREEN}🎉 Lambda deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Deployed Lambda Functions:${NC}"
echo "- ${ENVIRONMENT}-poll-gmail"
echo "- ${ENVIRONMENT}-pull-latest-chatterbox-email"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Populate secrets from init folder:"
echo "   npm run aws:deploy:secrets"
echo ""
echo "2. Test the Gmail polling:"
echo "   aws lambda invoke --function-name ${ENVIRONMENT}-poll-gmail --payload '{\"queryStringParameters\": {\"userEmail\": \"$DEFAULT_GMAIL_USER\"}}' response.json"
echo ""
echo -e "${BLUE}💡 Benefits of this approach:${NC}"
echo "- Fast Lambda deployments (only code changes)"
echo "- Independent of infrastructure changes"
echo "- Automatic code hash detection for updates"
echo "- Clean separation of concerns" 