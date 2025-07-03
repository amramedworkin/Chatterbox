# Chatterbox Simplified Architecture (No VPC)

This directory contains the simplified Terraform configuration for Chatterbox without VPC components. This architecture is simpler, faster, and more cost-effective than the original VPC-based setup.

## Architecture Overview

### Components
- **Lambda Functions**: Run in default AWS networking with direct internet access
- **API Gateway**: Provides HTTP endpoints for Lambda functions
- **S3 Bucket**: Stores email archives
- **DynamoDB Table**: Stores application state
- **Secrets Manager**: Stores Google OAuth credentials and Gmail tokens
- **Parameter Store**: Stores configuration parameters
- **CloudWatch**: Provides logging and monitoring
- **IAM**: Manages permissions and roles

### Benefits of Simplified Architecture
- ✅ **Faster Lambda cold starts** (no VPC networking overhead)
- ✅ **Lower costs** (no NAT gateway charges)
- ✅ **Simpler debugging** (direct internet access)
- ✅ **Easier deployment** (fewer networking components)
- ✅ **Better performance** (no network latency)

## Deployment Steps

### 1. Teardown Existing Infrastructure
```bash
# Run the complete teardown script (preserves chatteradmin IAM)
npm run aws:teardown
```

### 2. Deploy Simplified Infrastructure
```bash
# Deploy the simplified architecture
bash Cloud/AWS/scripts/deploy-simplified.sh
```

### 3. Populate Secrets and Parameters
The deployment script will automatically run the secrets population script, but you can also run it manually:
```bash
node Cloud/AWS/scripts/populate-secrets.js
```

### 4. Set Up OAuth (if needed)
```bash
# Run OAuth flow to populate Gmail tokens
node scripts/oauth-flow.js
```

## Configuration

### Environment Variables
- `ENVIRONMENT`: Set to "development", "staging", or "production"
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_PROFILE`: AWS profile (default: cliadmin)

### Default Values
- **Default Gmail User**: awsamram@gmail.com
- **Log Retention**: 90 days
- **Lambda Timeout**: 60 seconds (poll), 30 seconds (pull)
- **Lambda Memory**: 256 MB

## API Endpoints

After deployment, you'll get these HTTP endpoints:

- **Poll Gmail**: `GET /poll-gmail?userEmail=<email>`
- **Pull Latest Email**: `GET /pull-latest-email?userEmail=<email>`

Example usage:
```bash
# Poll Gmail for new emails
curl "https://<api-id>.execute-api.us-east-1.amazonaws.com/development/poll-gmail?userEmail=awsamram@gmail.com"

# Pull latest Chatterbox email
curl "https://<api-id>.execute-api.us-east-1.amazonaws.com/development/pull-latest-email?userEmail=awsamram@gmail.com"
```

## Testing

### Test Lambda Functions Directly
```bash
# Test poll Gmail function
aws lambda invoke \
    --function-name development-poll-gmail \
    --payload '{"queryStringParameters": {"userEmail": "awsamram@gmail.com"}}' \
    response.json \
    --cli-binary-format raw-in-base64-out

# Check response
cat response.json
```

### Check CloudWatch Logs
```bash
# Get Lambda logs
node Cloud/AWS/scripts/aws/get-lambda-logs.js development-poll-gmail
```

## Security

### IAM Permissions
The Lambda role has minimal required permissions:
- CloudWatch Logs access
- S3 bucket access (email archive only)
- DynamoDB table access
- Secrets Manager access (specific secrets only)
- Parameter Store access (chatterbox parameters only)

### Network Security
- No VPC means Lambda functions have direct internet access
- All AWS services are accessed via IAM policies, not network restrictions
- API Gateway provides HTTPS endpoints with optional authentication

## Troubleshooting

### Common Issues

1. **Lambda deployment fails**
   - Check that the lambda.zip file was created correctly
   - Verify the Lambda source code is in the `lambda/` directory

2. **API Gateway returns 500 errors**
   - Check CloudWatch logs for Lambda function errors
   - Verify Lambda function environment variables are set correctly

3. **Secrets not found**
   - Run the populate-secrets.js script
   - Check that secrets exist in AWS Secrets Manager

4. **Gmail authentication fails**
   - Verify Google OAuth credentials are stored in Secrets Manager
   - Check that Gmail tokens are valid and not expired

### Debugging Commands
```bash
# Check Terraform state
terraform show

# Check Lambda function configuration
aws lambda get-function --function-name development-poll-gmail

# Check API Gateway configuration
aws apigateway get-rest-api --rest-api-id <api-id>

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/development"
```

## Migration from VPC Architecture

If you're migrating from the VPC-based architecture:

1. **Run the teardown script** to remove VPC components
2. **Deploy the simplified architecture** using this directory
3. **Update any client applications** to use the new API endpoints
4. **Test thoroughly** to ensure all functionality works as expected

The simplified architecture maintains all the same functionality but with better performance and lower complexity. 