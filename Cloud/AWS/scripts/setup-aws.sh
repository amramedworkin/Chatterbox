#!/bin/bash

# AWS Infrastructure Setup Script for Chatterbox
# This script sets up the complete AWS infrastructure using Terraform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check AWS CLI configuration
check_aws_config() {
    if ! command_exists aws; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    # Check if AWS CLI is configured and working
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS CLI is not configured or not working. Please check your AWS_PROFILE setting and credentials."
        exit 1
    fi

    print_success "AWS CLI is configured and working"
}

# Function to check Terraform installation
check_terraform() {
    if ! command_exists terraform; then
        print_error "Terraform is not installed. Please install it first."
        exit 1
    fi

    print_success "Terraform is installed"
}

# Function to create S3 bucket for Terraform state
create_terraform_state_bucket() {
    local bucket_name="chatterbox-terraform-state-855581761117"
    local region="${AWS_REGION:-us-east-1}"

    print_status "Creating S3 bucket for Terraform state: $bucket_name"

    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        print_warning "S3 bucket $bucket_name already exists"
    else
        if [ "$region" = "us-east-1" ]; then
            aws s3api create-bucket --bucket "$bucket_name" --region "$region"
        else
            aws s3api create-bucket \
                --bucket "$bucket_name" \
                --region "$region" \
                --create-bucket-configuration LocationConstraint="$region"
        fi

        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled

        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket "$bucket_name" \
            --server-side-encryption-configuration '{
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            }'

        print_success "S3 bucket $bucket_name created successfully"
    fi
}

# Function to initialize Terraform
init_terraform() {
    print_status "Initializing Terraform"
    
    cd "$(dirname "$0")/../terraform"
    
    terraform init
    print_success "Terraform initialized"
}

# Function to plan Terraform deployment
plan_terraform() {
    print_status "Planning Terraform deployment"
    
    cd "$(dirname "$0")/../terraform"
    
    terraform plan -out=tfplan
    print_success "Terraform plan created"
}

# Function to apply Terraform deployment
apply_terraform() {
    print_status "Applying Terraform deployment"
    
    cd "$(dirname "$0")/../terraform"
    
    if [ -f tfplan ]; then
        terraform apply tfplan
    else
        terraform apply
    fi
    
    print_success "Terraform deployment completed"
}

# Function to show Terraform outputs
show_outputs() {
    print_status "Terraform outputs:"
    
    cd "$(dirname "$0")/../terraform"
    
    terraform output
}

# Function to update configuration files
update_config() {
    print_status "Updating configuration files with AWS resources"
    
    # Get Terraform outputs
    cd "$(dirname "$0")/../terraform"
    local vpc_id=$(terraform output -raw vpc_id 2>/dev/null || echo "")
    local dynamodb_table=$(terraform output -raw dynamodb_table_name 2>/dev/null || echo "")
    local s3_bucket=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
    local secrets_name=$(terraform output -raw secrets_gmail_tokens_name 2>/dev/null || echo "")
    
    # Update config.json
    if [ -n "$vpc_id" ]; then
        print_status "Updating config.json with VPC ID: $vpc_id"
        # This would require jq to be installed for JSON manipulation
        # For now, we'll just print the values
        echo "VPC ID: $vpc_id"
        echo "DynamoDB Table: $dynamodb_table"
        echo "S3 Bucket: $s3_bucket"
        echo "Secrets Name: $secrets_name"
    fi
}

# Main script
main() {
    print_status "Starting AWS infrastructure setup for Chatterbox"
    
    # Check prerequisites
    check_aws_config
    check_terraform
    
    # Create Terraform state bucket
    create_terraform_state_bucket
    
    # Initialize and deploy Terraform
    init_terraform
    plan_terraform
    
    # Ask for confirmation
    echo
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        apply_terraform
        show_outputs
        update_config
        print_success "AWS infrastructure setup completed successfully!"
    else
        print_warning "Deployment cancelled"
        exit 0
    fi
}

# Handle script arguments
case "${1:-}" in
    "init")
        check_aws_config
        check_terraform
        create_terraform_state_bucket
        init_terraform
        ;;
    "plan")
        init_terraform
        plan_terraform
        ;;
    "apply")
        apply_terraform
        show_outputs
        update_config
        ;;
    "destroy")
        print_warning "This will destroy all AWS resources!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd "$(dirname "$0")/../terraform"
            terraform destroy
        fi
        ;;
    "outputs")
        show_outputs
        ;;
    *)
        main
        ;;
esac 