#!/bin/bash

# AWS SES Status Check Script
# This script checks the verification status of email addresses in AWS SES

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

# Function to check if an email is verified
is_email_verified() {
    local email="$1"
    aws ses get-identity-verification-attributes \
        --identities "$email" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "VerificationAttributes.$email.VerificationStatus" \
        --output text 2>/dev/null | grep -q "Success"
}

# Function to check SES account status
check_ses_status() {
    print_info "Checking SES account status..."
    
    local sending_enabled
    sending_enabled=$(aws ses get-send-quota \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "SendingEnabled" \
        --output text 2>/dev/null || echo "false")
    
    if [ "$sending_enabled" = "true" ]; then
        print_status "SES account is in production mode - can send to any email address"
        return 0
    else
        print_warning "SES account is in sandbox mode - only verified emails can receive messages"
        return 1
    fi
}

# Main execution
echo -e "${GREEN}🔍 AWS SES STATUS CHECK${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}Profile: ${AWS_PROFILE}${NC}"
echo ""

# Check AWS credentials
print_info "Checking AWS credentials..."
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" > /dev/null 2>&1; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi
print_status "AWS credentials verified"

# Check SES status
if check_ses_status; then
    print_status "No email verification required - SES is in production mode"
    exit 0
fi

# Get email addresses from config
print_info "Reading email addresses from config.json..."
if [ ! -f "$PROJECT_ROOT/config.json" ]; then
    print_error "config.json not found"
    exit 1
fi

# Extract email addresses from config.json
DEFAULT_POLL_USER=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultPollGmailUser)")
DEFAULT_SEND_USER=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultSendGmailUser)")
DEFAULT_GET_USER=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultGetGmailUser)")
DEFAULT_RECIPIENT=$(node -e "console.log(require('$PROJECT_ROOT/config.json').sendTest.defaultRecipient)")

# Create unique list of email addresses
EMAILS=()
for email in "$DEFAULT_POLL_USER" "$DEFAULT_SEND_USER" "$DEFAULT_GET_USER" "$DEFAULT_RECIPIENT"; do
    if [[ ! " ${EMAILS[@]} " =~ " ${email} " ]]; then
        EMAILS+=("$email")
    fi
done

print_info "Checking verification status for ${#EMAILS[@]} email addresses:"
echo ""

ALL_VERIFIED=true
for email in "${EMAILS[@]}"; do
    if is_email_verified "$email"; then
        print_status "✅ $email - VERIFIED"
    else
        print_error "❌ $email - NOT VERIFIED"
        ALL_VERIFIED=false
    fi
done

echo ""
if [ "$ALL_VERIFIED" = "true" ]; then
    print_status "All email addresses are verified!"
    print_status "SES email verification completed"
else
    print_warning "Some email addresses are not verified"
    print_info "Run 'npm run aws:verify:emails' to send verification emails"
fi 