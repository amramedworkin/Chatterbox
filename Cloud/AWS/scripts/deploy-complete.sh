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
npm run aws:deploy:infrastructure
print_status "Infrastructure deployment completed"

# Step 2: Populate Secrets
print_step "2" "Populating Secrets from Init Folder"
cd "$PROJECT_ROOT"
if [ -n "$INIT_FOLDER_NAME" ]; then
    cd Cloud/AWS/scripts && node populate-secrets-from-init.js "$INIT_FOLDER_NAME"
else
    cd Cloud/AWS/scripts && node populate-secrets-from-init.js
fi
print_status "Secrets population completed"

# Step 3: Deploy Lambda Functions
print_step "3" "Deploying Lambda Functions"
cd "$PROJECT_ROOT"
npm run aws:deploy:lambda
print_status "Lambda deployment completed"

echo ""
echo -e "${GREEN}🎉 COMPLETE DEPLOYMENT SUCCESSFUL!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "✅ Infrastructure deployed (S3, DynamoDB, IAM, Secrets, etc.)"
echo "✅ Secrets populated from init folder"
echo "✅ Lambda functions deployed and tested"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Test the Gmail polling:"
echo "   aws lambda invoke --function-name ${ENVIRONMENT}-poll-gmail --payload '{\"queryStringParameters\": {\"userEmail\": \"awsamram@gmail.com\"}}' response.json"
echo ""
echo "2. Check CloudWatch logs:"
echo "   node scripts/aws/get-lambda-logs.js ${ENVIRONMENT}-poll-gmail"
echo ""
echo -e "${BLUE}💡 Deployment Architecture:${NC}"
echo "- Infrastructure: Stable, rarely changes"
echo "- Secrets: Populated from init folder"
echo "- Lambda: Fast deployments, frequent updates"
echo ""
echo -e "${BLUE}🔄 For future updates:${NC}"
echo "- Infrastructure changes: npm run aws:deploy:infrastructure"
echo "- Lambda changes: npm run aws:deploy:lambda"
echo "- Secret updates: npm run aws:deploy:secrets"
echo "- Complete redeploy: npm run aws:deploy" 