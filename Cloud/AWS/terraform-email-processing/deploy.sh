#!/bin/bash
# Cloud/AWS/terraform-email-processing/deploy.sh
# Deployment script for AWS-native email processing infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR"
LAMBDA_SRC_DIR="$PROJECT_ROOT/src/aws"

# Default values
ENVIRONMENT="development"
AWS_REGION="us-east-1"
SKIP_BUILD=false
SKIP_DEPLOY=false
VERBOSE=false

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

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy AWS-native email processing infrastructure

OPTIONS:
    -e, --environment ENV    Environment (development, staging, prod) [default: development]
    -r, --region REGION      AWS region [default: us-east-1]
    -s, --skip-build         Skip Lambda function build
    -d, --skip-deploy        Skip Terraform deployment
    -v, --verbose            Enable verbose output
    -h, --help               Show this help message

EXAMPLES:
    $0                          # Deploy to development environment
    $0 -e staging              # Deploy to staging environment
    $0 -e prod -r us-west-2    # Deploy to prod in us-west-2
    $0 -s                      # Skip Lambda build, deploy existing packages
    $0 -d                      # Only build Lambda, skip Terraform deploy

EOF
}

# Function to parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--region)
                AWS_REGION="$2"
                shift 2
                ;;
            -s|--skip-build)
                SKIP_BUILD=true
                shift
                ;;
            -d|--skip-deploy)
                SKIP_DEPLOY=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Function to validate environment
validate_environment() {
    case $ENVIRONMENT in
        development|staging|prod)
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT"
            print_error "Valid environments: development, staging, prod"
            exit 1
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to build Lambda functions
build_lambda_functions() {
    if [ "$SKIP_BUILD" = true ]; then
        print_warning "Skipping Lambda function build"
        return
    fi
    
    print_status "Building Lambda functions..."
    
    # Create temporary build directory
    BUILD_DIR="$TERRAFORM_DIR/build"
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    
    # Build email processor Lambda
    print_status "Building email processor Lambda..."
    EMAIL_PROCESSOR_DIR="$BUILD_DIR/email-processor"
    mkdir -p "$EMAIL_PROCESSOR_DIR"
    
    # Copy source files
    cp "$LAMBDA_SRC_DIR/emailProcessor.ts" "$EMAIL_PROCESSOR_DIR/"
    cp "$PROJECT_ROOT/package.json" "$EMAIL_PROCESSOR_DIR/"
    cp "$PROJECT_ROOT/tsconfig.json" "$EMAIL_PROCESSOR_DIR/"
    
    # Install dependencies
    cd "$EMAIL_PROCESSOR_DIR"
    npm install --production --legacy-peer-deps
    
    # Compile TypeScript
    npx tsc emailProcessor.ts --target es2020 --module commonjs --outDir .
    
    # Create ZIP package
    zip -r "$TERRAFORM_DIR/email-processor.zip" . -x "*.ts" "package.json" "package-lock.json" "tsconfig.json" "node_modules/.cache/*"
    
    # Build response generator Lambda
    print_status "Building response generator Lambda..."
    RESPONSE_GENERATOR_DIR="$BUILD_DIR/response-generator"
    mkdir -p "$RESPONSE_GENERATOR_DIR"
    
    # Copy source files
    cp "$LAMBDA_SRC_DIR/responseGenerator.ts" "$RESPONSE_GENERATOR_DIR/"
    cp "$PROJECT_ROOT/package.json" "$RESPONSE_GENERATOR_DIR/"
    cp "$PROJECT_ROOT/tsconfig.json" "$RESPONSE_GENERATOR_DIR/"
    
    # Install dependencies
    cd "$RESPONSE_GENERATOR_DIR"
    npm install --production --legacy-peer-deps
    
    # Compile TypeScript
    npx tsc responseGenerator.ts --target es2020 --module commonjs --outDir .
    
    # Create ZIP package
    zip -r "$TERRAFORM_DIR/response-generator.zip" . -x "*.ts" "package.json" "package-lock.json" "tsconfig.json" "node_modules/.cache/*"
    
    # Clean up build directory
    rm -rf "$BUILD_DIR"
    
    print_success "Lambda functions built successfully"
}

# Function to deploy Terraform infrastructure
deploy_terraform() {
    if [ "$SKIP_DEPLOY" = true ]; then
        print_warning "Skipping Terraform deployment"
        return
    fi
    
    print_status "Deploying Terraform infrastructure..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    print_status "Initializing Terraform..."
    terraform init
    
    # Plan deployment
    print_status "Planning Terraform deployment..."
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="aws_region=$AWS_REGION" \
        -out=tfplan
    
    # Apply deployment
    print_status "Applying Terraform deployment..."
    terraform apply tfplan
    
    # Get outputs
    print_status "Getting Terraform outputs..."
    terraform output -json > outputs.json
    
    print_success "Terraform deployment completed"
}

# Function to validate deployment
validate_deployment() {
    if [ "$SKIP_DEPLOY" = true ]; then
        print_warning "Skipping deployment validation"
        return
    fi
    
    print_status "Validating deployment..."
    
    # Check if Lambda functions exist
    EMAIL_PROCESSOR_NAME="chatterbox-email-processor"
    RESPONSE_GENERATOR_NAME="chatterbox-response-generator"
    
    if aws lambda get-function --function-name "$EMAIL_PROCESSOR_NAME" --region "$AWS_REGION" &> /dev/null; then
        print_success "Email processor Lambda function exists"
    else
        print_error "Email processor Lambda function not found"
        return 1
    fi
    
    if aws lambda get-function --function-name "$RESPONSE_GENERATOR_NAME" --region "$AWS_REGION" &> /dev/null; then
        print_success "Response generator Lambda function exists"
    else
        print_error "Response generator Lambda function not found"
        return 1
    fi
    
    # Check if DynamoDB tables exist
    TABLES=(
        "chatterbox-email-queries"
        "chatterbox-conversations"
        "chatterbox-generated-responses"
        "chatterbox-query-records"
        "chatterbox-user-profiles"
    )
    
    for table in "${TABLES[@]}"; do
        if aws dynamodb describe-table --table-name "$table" --region "$AWS_REGION" &> /dev/null; then
            print_success "DynamoDB table $table exists"
        else
            print_error "DynamoDB table $table not found"
            return 1
        fi
    done
    
    # Check if SQS queue exists
    QUEUE_NAME="chatterbox-response-generation"
    if aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$AWS_REGION" &> /dev/null; then
        print_success "SQS queue $QUEUE_NAME exists"
    else
        print_error "SQS queue $QUEUE_NAME not found"
        return 1
    fi
    
    print_success "Deployment validation completed"
}

# Function to display deployment summary
show_deployment_summary() {
    print_status "Deployment Summary"
    echo "=================="
    echo "Environment: $ENVIRONMENT"
    echo "AWS Region: $AWS_REGION"
    echo "Terraform Directory: $TERRAFORM_DIR"
    echo "Lambda Source Directory: $LAMBDA_SRC_DIR"
    echo ""
    
    if [ -f "$TERRAFORM_DIR/outputs.json" ]; then
        print_status "Infrastructure Outputs:"
        cat "$TERRAFORM_DIR/outputs.json" | jq -r 'to_entries[] | "\(.key): \(.value.value)"'
    fi
    
    print_status "Next Steps:"
    echo "1. Configure Gmail API credentials in AWS Secrets Manager"
    echo "2. Set up SES for email sending (if not using Gmail API)"
    echo "3. Test the email processing pipeline"
    echo "4. Monitor CloudWatch logs for any issues"
}

# Main execution
main() {
    print_status "Starting AWS-native email processing infrastructure deployment"
    echo "Environment: $ENVIRONMENT"
    echo "AWS Region: $AWS_REGION"
    echo ""
    
    # Parse command line arguments
    parse_args "$@"
    
    # Validate environment
    validate_environment
    
    # Check prerequisites
    check_prerequisites
    
    # Build Lambda functions
    build_lambda_functions
    
    # Deploy Terraform infrastructure
    deploy_terraform
    
    # Validate deployment
    validate_deployment
    
    # Show deployment summary
    show_deployment_summary
    
    print_success "Deployment completed successfully!"
}

# Execute main function with all arguments
main "$@" 