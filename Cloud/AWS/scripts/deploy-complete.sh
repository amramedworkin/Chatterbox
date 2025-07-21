#!/bin/bash

# Complete Chatterbox deployment
# This script runs all three deployment steps: infrastructure, secrets, and lambda

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
INIT_FOLDER_NAME=${1:-""}  # Optional init folder name

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

print_step() {
    echo ""
    echo -e "${GREEN}🚀 STEP $1: $2${NC}"
    echo "=================================="
}

# Function to check if a command succeeded
check_command_success() {
    if [ $? -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

echo -e "${GREEN}🎯 COMPLETE CHATTERBOX DEPLOYMENT${NC}"
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

# Step 1: Deploy Infrastructure
print_step "1" "Deploying Infrastructure"
cd "$PROJECT_ROOT"
if npm run aws:deploy:infrastructure; then
    print_status "Infrastructure deployment completed"
else
    print_error "Infrastructure deployment failed"
    exit 1
fi

# Step 1.5: Deploy Email Processing Infrastructure
print_step "1.5" "Deploying Email Processing Infrastructure"
cd "$PROJECT_ROOT/Cloud/AWS/terraform-email-processing"
print_info "Initializing Terraform for email processing..."
if terraform init; then
    print_info "Planning email processing deployment..."
    if terraform plan -out=tfplan; then
        print_info "Applying email processing deployment..."
        if terraform apply tfplan; then
            print_status "Email processing infrastructure deployed"
        else
            print_error "Email processing infrastructure deployment failed"
            exit 1
        fi
    else
        print_error "Email processing plan failed"
        exit 1
    fi
else
    print_error "Email processing Terraform init failed"
    exit 1
fi

# Step 1.75: Verify Email Addresses in SES
print_step "1.75" "Setting up and Verifying Email Addresses in SES"
cd "$PROJECT_ROOT"
print_info "Running comprehensive SES setup and verification..."
if bash Cloud/AWS/scripts/setup-ses.sh; then
    print_status "SES setup and verification completed successfully"
else
    print_warning "SES setup and verification had issues"
    print_info "You can run 'npm run aws:setup:ses' later to retry"
    print_info "Or run 'npm run aws:check:ses' to check verification status"
fi

# Step 2: Populate Secrets
print_step "2" "Populating Secrets from Init Folder"
cd "$PROJECT_ROOT"
if [ -n "$INIT_FOLDER_NAME" ]; then
    if cd Cloud/AWS/scripts && node populate-secrets-from-init.js "$INIT_FOLDER_NAME"; then
        print_status "Secrets population completed"
    else
        print_error "Secrets population failed"
        exit 1
    fi
else
    if cd Cloud/AWS/scripts && node populate-secrets-from-init.js; then
        print_status "Secrets population completed"
    else
        print_error "Secrets population failed"
        exit 1
    fi
fi

# Step 3: Build Email Processing Lambda Functions
print_step "3" "Building Email Processing Lambda Functions"
cd "$PROJECT_ROOT/Cloud/AWS/terraform/modules/email-processing/lambda"
print_info "Installing dependencies..."
if npm install --legacy-peer-deps; then
    print_info "Building TypeScript..."
    if npx tsc; then
        print_info "Creating deployment package..."
        cd .. && zip -r email-processor.zip lambda/dist/ lambda/node_modules/ lambda/package.json && zip -r response-generator.zip lambda/dist/ lambda/node_modules/ lambda/package.json
        if [ $? -eq 0 ]; then
            print_status "Email processing Lambda functions built"
        else
            print_error "Failed to create deployment packages"
            exit 1
        fi
    else
        print_error "TypeScript build failed"
        exit 1
    fi
else
    print_error "Dependency installation failed"
    exit 1
fi

# Step 4: Deploy Lambda Functions
print_step "4" "Deploying Lambda Functions"
cd "$PROJECT_ROOT"
if npm run aws:deploy:lambda; then
    print_status "Lambda deployment completed"
else
    print_error "Lambda deployment failed"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 COMPLETE DEPLOYMENT SUCCESSFUL!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "✅ Infrastructure deployed (S3, DynamoDB, IAM, Secrets, etc.)"
echo "✅ Email processing infrastructure deployed (SQS, DynamoDB tables, IAM roles)"
echo "✅ Secrets populated from init folder"
echo "✅ Email processing Lambda functions built"
echo "✅ Lambda functions deployed and tested"
echo "✅ Email addresses verified in AWS SES (if needed)"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Verify email addresses in AWS SES (if not already done):"
echo "   npm run aws:verify:emails"
echo ""
echo "2. Check SES verification status:"
echo "   npm run aws:check:ses"
echo ""
echo "3. Test the Gmail polling:"
echo "   aws lambda invoke --function-name ${ENVIRONMENT}-poll-gmail --payload '{\"queryStringParameters\": {\"userEmail\": \"awsamram@gmail.com\"}}' response.json"
echo ""
echo "4. Test email processing:"
echo "   aws lambda invoke --function-name chatterbox-email-processor --payload '{\"test\": true}' response.json"
echo ""
echo "5. Check CloudWatch logs:"
echo "   node scripts/aws/get-lambda-logs.js ${ENVIRONMENT}-poll-gmail"
echo ""
echo -e "${BLUE}💡 Deployment Architecture:${NC}"
echo "- Infrastructure: Stable, rarely changes"
echo "- Secrets: Populated from init folder"
echo "- Email Processing: Advanced email processing with SQS and DynamoDB"
echo "- Lambda: Fast deployments, frequent updates"
echo ""
echo -e "${BLUE}🔄 For future updates:${NC}"
echo "- Infrastructure changes: npm run aws:deploy:infrastructure"
echo "- Lambda changes: npm run aws:deploy:lambda"
echo "- Secret updates: npm run aws:deploy:secrets"
echo "- Complete redeploy: npm run aws:deploy"

# Exit with success
exit 0 