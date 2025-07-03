# Chatterbox Lambda Functions

This directory contains the Terraform configuration for deploying Chatterbox Lambda functions independently from the core infrastructure.

## Architecture

This approach separates Lambda function deployment from infrastructure deployment:

- **`terraform-simple/`** - Core infrastructure (S3, DynamoDB, IAM, Secrets, etc.)
- **`terraform-lambda/`** - Lambda functions only

## Benefits

1. **Faster Deployments** - Lambda functions can be updated without touching infrastructure
2. **Independent Changes** - Code changes don't require infrastructure updates
3. **Better CI/CD** - Can deploy Lambda changes more frequently
4. **Reduced Risk** - Infrastructure changes are rare and stable

## Usage

### Prerequisites

1. **Infrastructure must be deployed first:**
   ```bash
   npm run aws:deploy:infrastructure
   ```

2. **Secrets must be populated:**
   ```bash
   npm run aws:deploy:secrets
   ```

### Deploy Lambda Functions

```bash
npm run aws:deploy:lambda
```

This will:
1. Build the TypeScript code
2. Create the deployment package
3. Deploy both Lambda functions
4. Test the deployment

### Manual Deployment

```bash
cd Cloud/AWS/terraform-lambda

# Initialize Terraform
terraform init

# Build Lambda functions
cd lambda
npm install
npm run build
cd ..

# Deploy
terraform plan
terraform apply
```

## Configuration

The Lambda configuration references infrastructure outputs from `terraform-simple`:

- **IAM Role** - `lambda_role_arn`
- **S3 Bucket** - `email_archive_bucket`
- **Secrets** - `google_credentials_secret_name`, `gmail_tokens_secret_name`
- **Parameters** - `default_gmail_user`

## Lambda Functions

1. **`development-poll-gmail`** - Polls Gmail for new emails
2. **`development-pull-latest-chatterbox-email`** - Retrieves the latest Chatterbox email

## State Management

- **State File**: `terraform-lambda.tfstate` in S3
- **Backend**: S3 backend shared with infrastructure
- **Isolation**: Separate state from infrastructure

## Dependencies

- AWS CLI configured with `cliadmin` profile
- Node.js and npm for building Lambda functions
- TypeScript for compilation
- Infrastructure must be deployed first

## Troubleshooting

### Infrastructure Not Found
```
Error: Infrastructure not found. Please run: npm run aws:deploy:infrastructure
```
**Solution**: Deploy infrastructure first

### Build Errors
```
Error: TypeScript compilation failed
```
**Solution**: Check TypeScript code and dependencies

### Permission Errors
```
Error: Access denied
```
**Solution**: Verify AWS credentials and IAM permissions 