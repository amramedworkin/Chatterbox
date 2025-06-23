#!/bin/bash

# Test AWS Credentials Script
# This script tests the AWS credentials for the Chatterbox project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test AWS profile
test_aws_profile() {
    local profile=$1
    print_status "Testing AWS profile: $profile"
    
    # Test basic authentication
    if AWS_PROFILE=$profile aws sts get-caller-identity >/dev/null 2>&1; then
        print_success "Profile $profile authentication successful"
        
        # Get user info
        local user_info=$(AWS_PROFILE=$profile aws sts get-caller-identity 2>/dev/null)
        echo "User Info: $user_info"
        
        return 0
    else
        print_error "Profile $profile authentication failed"
        return 1
    fi
}

# Test AWS services
test_aws_services() {
    local profile=$1
    print_status "Testing AWS services with profile: $profile"
    
    # Test S3 access
    if AWS_PROFILE=$profile aws s3 ls >/dev/null 2>&1; then
        print_success "S3 access successful"
    else
        print_warning "S3 access failed (may not have permissions)"
    fi
    
    # Test IAM access
    if AWS_PROFILE=$profile aws iam list-users >/dev/null 2>&1; then
        print_success "IAM access successful"
    else
        print_warning "IAM access failed (may not have permissions)"
    fi
    
    # Test DynamoDB access
    if AWS_PROFILE=$profile aws dynamodb list-tables >/dev/null 2>&1; then
        print_success "DynamoDB access successful"
    else
        print_warning "DynamoDB access failed (may not have permissions)"
    fi
}

# Main test function
main() {
    print_status "Starting AWS credentials test"
    
    # Test cliadmin profile
    if test_aws_profile "cliadmin"; then
        test_aws_services "cliadmin"
        print_success "AWS credentials test completed successfully!"
    else
        print_error "AWS credentials test failed!"
        exit 1
    fi
}

# Run the test
main 