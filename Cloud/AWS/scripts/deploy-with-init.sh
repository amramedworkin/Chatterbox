#!/bin/bash

# Deployment script for Chatterbox with Init Folder Support
# This script deploys the simplified architecture using data from a specified init folder

set -e

# Add at the top after set -e
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

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
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [init_folder_name]"
    echo ""
    echo "Arguments:"
    echo "  init_folder_name    Name of the init folder to use (optional)"
    echo "                      If not provided, uses the most recently created folder"
    echo ""
    echo "Examples:"
    echo "  $0                    # Use most recent init folder"
    echo "  $0 awsinit           # Use specific init folder"
    echo "  $0 my-migration      # Use custom init folder"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT          AWS environment (default: development)"
    echo "  AWS_REGION           AWS region (default: us-east-1)"
    echo "  AWS_PROFILE          AWS profile (default: cliadmin)"
}

# Parse command line arguments
INIT_FOLDER_NAME=""
if [ $# -gt 0 ]; then
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_usage
        exit 0
    fi
    INIT_FOLDER_NAME="$1"
fi

echo -e "${BLUE}🚀 Deploying Chatterbox with Init Folder Support${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}Profile: ${AWS_PROFILE}${NC}"
if [ -n "$INIT_FOLDER_NAME" ]; then
    echo -e "${BLUE}Init Folder: ${INIT_FOLDER_NAME}${NC}"
else
    echo -e "${BLUE}Init Folder: Most recent${NC}"
fi
echo ""

# Check AWS credentials
print_info "Checking AWS credentials..."
if ! aws sts get-caller-identity --profile $AWS_PROFILE > /dev/null 2>&1; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi
print_status "AWS credentials verified"

# Check if init folder exists
print_info "Validating init folder..."
INIT_PATH="data/init"
if [ ! -d "$INIT_PATH" ]; then
    print_error "Init folder not found: $INIT_PATH"
    print_error "Please run: npm run aws:init:prepare"
    exit 1
fi

# Find the target init folder
if [ -n "$INIT_FOLDER_NAME" ]; then
    TARGET_FOLDER="$INIT_PATH/$INIT_FOLDER_NAME"
    if [ ! -d "$TARGET_FOLDER" ]; then
        print_error "Init folder not found: $TARGET_FOLDER"
        echo "Available folders:"
        if [ -d "$INIT_PATH" ]; then
            ls -1 "$INIT_PATH" | grep -E '^[^.]' || echo "  (no folders found)"
        else
            echo "  (init path not found)"
        fi
        exit 1
    fi
    print_status "Using specified init folder: $INIT_FOLDER_NAME"
else
    # Find most recent folder
    TARGET_FOLDER=$(ls -1t "$INIT_PATH" 2>/dev/null | grep -E '^[^.]' | head -1 2>/dev/null || echo "")
    if [ -z "$TARGET_FOLDER" ]; then
        print_error "No init folders found in $INIT_PATH"
        print_error "Please run: npm run aws:init:prepare"
        exit 1
    fi
    TARGET_FOLDER="$INIT_PATH/$TARGET_FOLDER"
    print_status "Using most recent init folder: $(basename "$TARGET_FOLDER")"
fi

# Display init folder contents
print_info "Init folder contents:"
if [ -d "$TARGET_FOLDER" ]; then
    ls -la "$TARGET_FOLDER"
else
    echo "  (folder not found)"
fi

# Check for required files
print_info "Checking required files in init folder..."
REQUIRED_FILES=("config.json" "google_credentials.json" ".env")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$TARGET_FOLDER/$file" ]; then
        print_status "Found: $file"
    else
        print_warning "Missing: $file"
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    print_warning "Some required files are missing, but continuing..."
fi

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

# Step 4: Build Lambda functions
print_info "Building Lambda functions..."
cd lambda
npm install
npm run build
print_status "Lambda functions built"

# Step 5: Create Lambda deployment package
print_info "Creating Lambda deployment package..."
rm -f ../lambda.zip
zip -r ../lambda.zip dist/ node_modules/ package.json
print_status "Lambda deployment package created"

# Step 6: Deploy Lambda functions
print_info "Deploying Lambda functions..."
cd ..
aws lambda update-function-code \
    --function-name ${ENVIRONMENT}-poll-gmail \
    --zip-file fileb://lambda.zip \
    --profile $AWS_PROFILE

aws lambda update-function-code \
    --function-name ${ENVIRONMENT}-pull-latest-chatterbox-email \
    --zip-file fileb://lambda.zip \
    --profile $AWS_PROFILE
print_status "Lambda functions deployed"

# Step 7: Populate secrets and parameters from init folder
print_info "Populating AWS Secrets Manager and Parameter Store from init folder..."
cd "$PROJECT_ROOT/Cloud/AWS/scripts"

# Set environment variable for the populate script
export INIT_FOLDER_NAME="$INIT_FOLDER_NAME"

if [ -n "$INIT_FOLDER_NAME" ]; then
    node populate-secrets-from-init.js "$INIT_FOLDER_NAME"
else
    node populate-secrets-from-init.js
fi
print_status "Secrets and parameters populated from init folder"

# Step 8: Get deployment outputs
print_info "Getting deployment outputs..."
cd "$PROJECT_ROOT/Cloud/AWS/terraform-simple"
terraform output
print_status "Deployment outputs retrieved"

# Step 9: Test the deployment
print_info "Testing Lambda functions..."

# Get default Gmail user from init folder config
DEFAULT_GMAIL_USER="awsamram@gmail.com"
if [ -f "../../$TARGET_FOLDER/config.json" ]; then
    DEFAULT_GMAIL_USER=$(node -e "
        const config = JSON.parse(require('fs').readFileSync('../../$TARGET_FOLDER/config.json', 'utf8'));
        console.log(config.app?.defaultPollGmailUser || 'awsamram@gmail.com');
    ")
fi

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
echo -e "${GREEN}🎉 Deployment with init folder completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Architecture Summary:${NC}"
echo "- No VPC (uses default AWS networking)"
echo "- Lambda functions with direct internet access"
echo "- S3, DynamoDB, Secrets Manager, Parameter Store"
echo "- API Gateway for HTTP endpoints"
echo "- CloudWatch for logging"
echo "- Configuration from init folder: $(basename "$TARGET_FOLDER")"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Run the OAuth flow to populate Gmail tokens (if needed):"
echo "   node scripts/oauth-flow.js"
echo ""
echo "2. Test the Gmail polling:"
echo "   aws lambda invoke --function-name ${ENVIRONMENT}-poll-gmail --payload '{\"queryStringParameters\": {\"userEmail\": \"$DEFAULT_GMAIL_USER\"}}' response.json"
echo ""
echo "3. Check CloudWatch logs:"
echo "   node scripts/aws/get-lambda-logs.js ${ENVIRONMENT}-poll-gmail"
echo ""
echo -e "${BLUE}🔗 API Gateway endpoints:${NC}"
POLL_ENDPOINT=$(terraform output -raw poll_gmail_endpoint 2>/dev/null || echo "https://<api-id>.execute-api.${AWS_REGION}.amazonaws.com/${ENVIRONMENT}/poll-gmail")
PULL_ENDPOINT=$(terraform output -raw pull_email_endpoint 2>/dev/null || echo "https://<api-id>.execute-api.${AWS_REGION}.amazonaws.com/${ENVIRONMENT}/pull-latest-email")
echo "Poll Gmail: $POLL_ENDPOINT"
echo "Pull Email: $PULL_ENDPOINT"
echo ""
echo -e "${BLUE}💡 Benefits of this deployment:${NC}"
echo "- Configuration isolated in init folder"
echo "- Reproducible deployments"
echo "- Version-controlled configuration"
echo "- Easy rollback to previous configurations" 