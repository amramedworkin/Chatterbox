#!/bin/bash

# AWS SES Cleanup Script
# This script removes verified email addresses and optionally disables SES

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

print_header() {
    echo -e "${RED}🗑️  $1${NC}"
    echo "=================================="
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

# Function to get all verified email addresses
get_all_verified_emails() {
    # Get all identities
    local identities
    identities=$(aws ses list-identities \
        --identity-type EmailAddress \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Identities[*]' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$identities" ]; then
        return
    fi
    
    # Check which ones are verified and output them
    for email in $identities; do
        if aws ses get-identity-verification-attributes \
            --identities "$email" \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE" \
            --query "VerificationAttributes.$email.VerificationStatus" \
            --output text 2>/dev/null | grep -q "Success"; then
            echo "$email"
        fi
    done
}

# Function to remove verified email addresses
remove_verified_emails() {
    print_info "Removing verified email addresses..."
    
    # Get email addresses from config.json if it exists
    local config_emails=()
    if [ -f "$PROJECT_ROOT/config.json" ]; then
        print_info "Reading email addresses from config.json..."
        
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
        for email in "$default_poll_user" "$default_send_user" "$default_get_user" "$default_recipient"; do
            if [[ ! " ${config_emails[@]} " =~ " ${email} " ]]; then
                config_emails+=("$email")
            fi
        done
        
        print_info "Found ${#config_emails[@]} email addresses in config.json:"
        for email in "${config_emails[@]}"; do
            echo "  - $email"
        done
    else
        print_warning "config.json not found - will remove all verified emails"
    fi
    
    # Get all verified emails
    local all_verified_emails
    all_verified_emails=($(get_all_verified_emails))
    
    if [ ${#all_verified_emails[@]} -eq 0 ]; then
        print_warning "No verified email addresses found"
        return
    fi
    
    print_info "Found ${#all_verified_emails[@]} verified email addresses:"
    for email in "${all_verified_emails[@]}"; do
        echo "  - $email"
    done
    echo ""
    
    # Remove verified emails
    local removed_count=0
    for email in "${all_verified_emails[@]}"; do
        # If we have config emails, only remove those
        if [ ${#config_emails[@]} -gt 0 ]; then
            if [[ " ${config_emails[@]} " =~ " ${email} " ]]; then
                print_info "Removing verified email address: $email"
                if aws ses delete-identity \
                    --identity "$email" \
                    --region "$AWS_REGION" \
                    --profile "$AWS_PROFILE" > /dev/null 2>&1; then
                    print_status "Removed verified email address: $email"
                    ((removed_count++))
                else
                    print_error "Failed to remove email address: $email"
                fi
            else
                print_warning "Skipping email address not in config.json: $email"
            fi
        else
            # Remove all verified emails if no config.json
            print_info "Removing verified email address: $email"
            if aws ses delete-identity \
                --identity "$email" \
                --region "$AWS_REGION" \
                --profile "$AWS_PROFILE" > /dev/null 2>&1; then
                print_status "Removed verified email address: $email"
                ((removed_count++))
            else
                print_error "Failed to remove email address: $email"
            fi
        fi
    done
    
    print_status "Removed $removed_count verified email addresses"
}

# Function to disable SES account sending
disable_ses_account() {
    print_info "Checking current SES account status..."
    
    local sending_enabled
    sending_enabled=$(aws ses get-send-quota \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "SendingEnabled" \
        --output text 2>/dev/null || echo "false")
    
    if [ "$sending_enabled" = "true" ]; then
        print_info "SES account sending is currently enabled - disabling..."
        if aws ses put-account-sending-enabled \
            --enabled false \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE" > /dev/null 2>&1; then
            print_status "SES account sending disabled"
            print_info "SES will return to 'Get Started' state in the AWS Console"
        else
            print_error "Failed to disable SES account sending"
        fi
    else
        print_status "SES account sending is already disabled"
        print_info "SES is already in 'Get Started' state in the AWS Console"
    fi
}

# Main execution
main() {
    print_header "AWS SES CLEANUP"
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

    # Check if SES is set up
    print_info "Checking if SES is set up..."
    if ! aws ses get-account-sending-enabled \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        print_warning "SES is not set up - nothing to clean up"
        exit 0
    fi
    print_status "SES is set up"

    # Remove verified email addresses
    remove_verified_emails

    # Optionally disable SES account
    disable_ses_account

    print_status "SES cleanup completed successfully"
}

# Run main function
main "$@" 