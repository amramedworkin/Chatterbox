#!/bin/bash

# AWS SES Complete Setup and Verification Script
# This script sets up SES from scratch and verifies all email addresses

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"development"}
AWS_REGION=${AWS_REGION:-"us-east-1"}
AWS_PROFILE=${AWS_PROFILE:-"cliadmin"}
BREAK_ON_FAILURE=${BREAK_ON_FAILURE:-"true"}  # Set to "false" to continue build on verification failure
MAX_VERIFICATION_WAIT=60  # 10 minutes (60 * 10 seconds)
VERIFICATION_POLL_INTERVAL=10  # 10 seconds

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

print_header() {
    echo -e "${CYAN}🔐 $1${NC}"
    echo "=================================="
}

print_step() {
    echo -e "${MAGENTA}🚀 $1${NC}"
}

# Function to check if a command succeeded
check_command_success() {
    if [ $? -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# Function to check if SES needs manual console setup
check_ses_console_setup() {
    print_info "Checking if SES needs manual console setup..."
    
    # Try to access SES and see if we get a proper response
    local response
    response=$(aws ses get-send-quota \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --output json 2>&1 || echo "ERROR")
    
    if echo "$response" | grep -q "GetStarted"; then
        return 0  # Needs console setup
    elif echo "$response" | grep -q "AccessDenied"; then
        return 0  # Needs console setup
    else
        return 1  # Already set up
    fi
}

# Function to check if SES is set up
is_ses_setup() {
    print_info "Checking if SES is set up..."
    
    # Try to get SES account attributes - this will fail if SES is not initialized
    if aws ses get-account-sending-enabled \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        # Additional check to ensure SES is fully initialized
        if aws ses get-send-quota \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE" > /dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# Function to check SES account status
get_ses_status() {
    print_info "Checking SES account status..."
    
    # Get sending quota to determine if in sandbox or production
    local sending_enabled
    sending_enabled=$(aws ses get-send-quota \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "SendingEnabled" \
        --output text 2>/dev/null || echo "false")
    
    echo "$sending_enabled"
}

# Function to set up SES from scratch
setup_ses() {
    print_step "Setting up SES from scratch..."
    
    print_info "Initializing SES service..."
    
    # First, try to get the account sending enabled status to initialize SES
    print_info "Enabling SES account sending..."
    if aws ses put-account-sending-enabled \
        --enabled \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        print_status "SES account sending enabled"
    else
        print_warning "Could not enable SES account sending (may already be enabled)"
    fi
    
    # Set up account attributes
    print_info "Setting up SES account attributes..."
    if aws ses put-account-sending-attributes \
        --sending-enabled \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        print_status "SES account attributes configured"
    else
        print_warning "Could not set SES account attributes (may already be configured)"
    fi
    
    # Wait a moment for SES to fully initialize
    print_info "Waiting for SES to fully initialize..."
    sleep 5
    
    # Verify SES is now properly set up
    if is_ses_setup; then
        print_status "SES is now properly initialized"
    else
        print_error "SES initialization failed - you may need to complete setup via AWS Console"
        print_info "Please visit: https://console.aws.amazon.com/ses/home?region=$AWS_REGION"
        print_info "Click 'Get Started' and follow the setup process"
        return 1
    fi
    
    # Note: Production access requires manual approval via AWS Console
    print_warning "SES setup completed in sandbox mode"
    print_info "To enable production mode (send to any email), request access via AWS Console:"
    print_info "https://console.aws.amazon.com/ses/home?region=$AWS_REGION#/account-dashboard"
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
        return 0
    else
        print_error "Failed to send verification email to $email"
        return 1
    fi
}

# Function to wait for email verification with timeout
wait_for_verification() {
    local email="$1"
    local max_attempts=$MAX_VERIFICATION_WAIT
    local attempt=1
    
    print_info "Waiting for $email to be verified (max ${MAX_VERIFICATION_WAIT} attempts, ${VERIFICATION_POLL_INTERVAL}s each)..."
    
    while [ $attempt -le $max_attempts ]; do
        if is_email_verified "$email"; then
            print_status "Email $email is now verified!"
            return 0
        fi
        
        print_info "Attempt $attempt/$max_attempts: $email not yet verified, waiting ${VERIFICATION_POLL_INTERVAL} seconds..."
        sleep $VERIFICATION_POLL_INTERVAL
        ((attempt++))
    done
    
    print_error "Email $email was not verified within the timeout period"
    return 1
}

# Function to get email addresses from config
get_email_addresses() {
    print_info "Reading email addresses from config.json..."
    
    if [ ! -f "$PROJECT_ROOT/config.json" ]; then
        print_error "config.json not found"
        return 1
    fi
    
    # Extract email addresses from config.json
    local default_poll_user
    local default_send_user
    local default_get_user
    local default_recipient
    
    default_poll_user=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultPollGmailUser)")
    default_send_user=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultSendGmailUser)")
    default_get_user=$(node -e "console.log(require('$PROJECT_ROOT/config.json').app.defaultGetGmailUser)")
    default_recipient=$(node -e "console.log(require('$PROJECT_ROOT/config.json').sendTest.defaultRecipient)")
    
    # Create unique list of email addresses
    EMAILS=()
    for email in "$default_poll_user" "$default_send_user" "$default_get_user" "$default_recipient"; do
        if [[ ! " ${EMAILS[@]} " =~ " ${email} " ]]; then
            EMAILS+=("$email")
        fi
    done
    
    print_info "Found ${#EMAILS[@]} unique email addresses:"
    for email in "${EMAILS[@]}"; do
        echo "  - $email"
    done
    echo ""
}

# Function to display verification instructions
display_verification_instructions() {
    print_header "EMAIL VERIFICATION INSTRUCTIONS"
    echo ""
    print_warning "📧 VERIFICATION EMAILS HAVE BEEN SENT"
    echo ""
    print_info "The following emails have been sent verification requests:"
    for email in "${EMAILS[@]}"; do
        if ! is_email_verified "$email"; then
            echo "  - $email"
        fi
    done
    echo ""
    print_info "📋 WHAT YOU NEED TO DO:"
    echo "1. Check your email inbox for each address listed above"
    echo "2. Look for emails from 'AWS Notification <no-reply-aws@amazon.com>'"
    echo "3. Click the verification link in each email"
    echo "4. You should see a success page confirming verification"
    echo ""
    print_info "🔍 WHY THIS IS NEEDED:"
    echo "- AWS SES requires email verification to prevent spam"
    echo "- Only verified emails can receive messages in sandbox mode"
    echo "- This ensures your AI responses can be delivered"
    echo ""
    print_info "⏱️  TIMEOUT:"
    echo "- The system will wait up to 10 minutes for verification"
    echo "- If verification fails, the build will stop (unless BREAK_ON_FAILURE=false)"
    echo ""
    print_warning "⚠️  IMPORTANT:"
    echo "- Check spam/junk folders if you don't see the emails"
    echo "- Click the verification links within 24 hours"
    echo "- Each email address must be verified separately"
    echo ""
}

# Main execution
main() {
    print_header "AWS SES COMPLETE SETUP AND VERIFICATION"
    echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
    echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
    echo -e "${BLUE}Profile: ${AWS_PROFILE}${NC}"
    echo -e "${BLUE}Break on failure: ${BREAK_ON_FAILURE}${NC}"
    echo ""

    # Check AWS credentials
    print_info "Checking AWS credentials..."
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi
    print_status "AWS credentials verified"

    # Step 1: Check if SES is set up
    print_step "Step 1: Checking SES Setup"
    
    # First check if SES needs manual console setup
    if check_ses_console_setup; then
        print_error "SES needs manual setup via AWS Console"
        print_info "Please complete the following steps:"
        echo ""
        print_info "1. Open AWS Console: https://console.aws.amazon.com/ses/home?region=$AWS_REGION"
        print_info "2. Click 'Get Started' if you see that screen"
        print_info "3. Follow the setup process (usually just clicking through)"
        print_info "4. Once setup is complete, run this script again"
        echo ""
        print_warning "SES must be manually initialized via console before CLI operations can work"
        exit 1
    fi
    
    if ! is_ses_setup; then
        print_warning "SES is not set up, setting up from scratch..."
        if ! setup_ses; then
            print_error "SES setup failed"
            exit 1
        fi
    else
        print_status "SES is already set up"
    fi

    # Step 2: Check SES status
    print_step "Step 2: Checking SES Status"
    local ses_status
    ses_status=$(get_ses_status)
    
    if [ "$ses_status" = "true" ]; then
        print_status "SES is in production mode - no email verification required"
        print_status "SES setup and verification completed successfully"
        exit 0
    else
        print_warning "SES is in sandbox mode - email verification required"
    fi

    # Step 3: Get email addresses
    print_step "Step 3: Getting Email Addresses"
    if ! get_email_addresses; then
        print_error "Failed to get email addresses from config"
        exit 1
    fi

    # Step 4: Verify email addresses
    print_step "Step 4: Verifying Email Addresses"
    local verification_required=false
    local verification_failed=false
    
    for email in "${EMAILS[@]}"; do
        if ! is_email_verified "$email"; then
            verification_required=true
            if ! verify_email "$email"; then
                verification_failed=true
            fi
        fi
    done

    if [ "$verification_required" = "false" ]; then
        print_status "All email addresses are already verified!"
        print_status "SES setup and verification completed successfully"
        exit 0
    fi

    if [ "$verification_failed" = "true" ]; then
        print_error "Failed to send verification emails"
        exit 1
    fi

    # Step 5: Display instructions
    print_step "Step 5: Displaying Verification Instructions"
    display_verification_instructions

    # Step 6: Wait for verification
    print_step "Step 6: Waiting for Email Verification"
    print_info "Starting verification polling..."
    
    local all_verified=true
    for email in "${EMAILS[@]}"; do
        if ! is_email_verified "$email"; then
            if ! wait_for_verification "$email"; then
                all_verified=false
            fi
        fi
    done

    # Step 7: Report results
    print_step "Step 7: Reporting Results"
    if [ "$all_verified" = "true" ]; then
        print_status "🎉 ALL EMAILS VERIFIED SUCCESSFULLY!"
        print_status "SES setup and verification completed successfully"
        print_status "Build can continue"
        exit 0
    else
        print_error "❌ SOME EMAILS FAILED VERIFICATION"
        print_info "The following emails are not verified:"
        for email in "${EMAILS[@]}"; do
            if ! is_email_verified "$email"; then
                echo "  - $email"
            fi
        done
        echo ""
        
        if [ "$BREAK_ON_FAILURE" = "true" ]; then
            print_error "Build will stop due to verification failure"
            print_info "To continue build despite verification failure, set BREAK_ON_FAILURE=false"
            exit 1
        else
            print_warning "Build will continue despite verification failure"
            print_info "You can verify emails later and run this script again"
            print_info "Run 'npm run aws:check:ses' to check verification status"
            exit 0
        fi
    fi
}

# Run main function
main "$@" 