#!/bin/bash

# AWS SES Email Verification Script
# This script verifies email addresses in AWS SES for the Chatterbox system

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

# Function to check if an email is already verified
is_email_verified() {
    local email="$1"
    aws ses get-identity-verification-attributes \
        --identities "$email" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "VerificationAttributes.$email.VerificationStatus" \
        --output text 2>/dev/null | grep -q "Success"
}

# Function to verify an email address
verify_email() {
    local email="$1"
    
    if is_email_verified "$email"; then
        print_status "Email $email is already verified"
        return 0
    fi
    
    print_info "Verifying email address: $email"
    
    # Request verification
    if aws ses verify-email-identity \
        --email-address "$email" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        print_status "Verification email sent to $email"
        print_warning "Please check your email and click the verification link"
        return 0
    else
        print_error "Failed to send verification email to $email"
        return 1
    fi
}

# Function to wait for email verification
wait_for_verification() {
    local email="$1"
    local max_attempts=30
    local attempt=1
    
    print_info "Waiting for $email to be verified..."
    
    while [ $attempt -le $max_attempts ]; do
        if is_email_verified "$email"; then
            print_status "Email $email is now verified!"
            return 0
        fi
        
        print_info "Attempt $attempt/$max_attempts: $email not yet verified, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    print_error "Email $email was not verified within the timeout period"
    return 1
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
echo -e "${GREEN}🔐 AWS SES EMAIL VERIFICATION${NC}"
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
    print_info "SES is in production mode - email verification not required"
    print_status "SES email verification completed"
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

print_info "Found ${#EMAILS[@]} unique email addresses to verify:"
for email in "${EMAILS[@]}"; do
    echo "  - $email"
done
echo ""

# Verify each email address
VERIFICATION_REQUIRED=false
for email in "${EMAILS[@]}"; do
    if ! is_email_verified "$email"; then
        VERIFICATION_REQUIRED=true
        if ! verify_email "$email"; then
            print_error "Failed to initiate verification for $email"
            exit 1
        fi
    fi
done

if [ "$VERIFICATION_REQUIRED" = "false" ]; then
    print_status "All email addresses are already verified!"
    exit 0
fi

echo ""
print_warning "📧 VERIFICATION EMAILS SENT"
echo "=================================="
print_info "Verification emails have been sent to the following addresses:"
for email in "${EMAILS[@]}"; do
    if ! is_email_verified "$email"; then
        echo "  - $email"
    fi
done
echo ""
print_warning "Please check your email and click the verification links before continuing."
echo ""
print_info "You can run this script again to check verification status:"
echo "  npm run aws:verify:emails"
echo ""
print_info "Or wait for verification and continue with deployment:"
echo "  npm run aws:deploy"
echo ""

# Ask user if they want to wait for verification
read -p "Do you want to wait for email verification? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    print_info "Waiting for email verification..."
    
    ALL_VERIFIED=true
    for email in "${EMAILS[@]}"; do
        if ! wait_for_verification "$email"; then
            ALL_VERIFIED=false
        fi
    done
    
    if [ "$ALL_VERIFIED" = "true" ]; then
        print_status "All email addresses are now verified!"
        exit 0
    else
        print_error "Some email addresses are not yet verified"
        print_warning "You can continue with deployment and verify later"
        exit 1
    fi
else
    print_info "Continuing without waiting for verification"
    print_warning "Make sure to verify emails before testing email functionality"
    exit 0
fi 