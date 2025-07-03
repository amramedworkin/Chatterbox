# Lambda Email Reader Setup Summary

## What Was Created

### 1. AWS Lambda Infrastructure
- **Lambda Module**: `Cloud/AWS/terraform/modules/lambda/`
  - `main.tf`: Lambda function, API Gateway, IAM roles and policies
  - `variables.tf`: Module variables
  - `outputs.tf`: Module outputs

### 2. Lambda Function Code
- **Handler**: `Cloud/AWS/terraform/modules/lambda/lambda/index.js`
  - Accepts Gmail ID via HTTP API
  - Retrieves Gmail tokens from Secrets Manager
  - Uses Gmail API to fetch email by ID
  - Returns email data in JSON format

### 3. Build and Deployment Scripts
- **Build Script**: `scripts/aws/build-lambda.js`
  - Installs dependencies
  - Creates deployment package
- **Test Script**: `scripts/aws/test-lambda.js`
  - Tests Lambda function with Gmail ID
- **Environment Setup**: `scripts/aws/setup-lambda-env.js`
  - Sets up environment variables in Parameter Store

### 4. Documentation
- **README**: `Cloud/AWS/LAMBDA_README.md`
  - Comprehensive guide for deployment and usage

## Key Features

### HTTP API Endpoint
```
GET /email/{gmailId}
```

### Email Data Returned
- Email ID and Thread ID
- Subject line
- Sender email
- Email body (plain text)
- Snippet
- Internal date
- Label IDs

### Security
- Gmail OAuth2 tokens stored in Secrets Manager
- IAM roles with minimal required permissions
- CORS enabled for API Gateway

## Quick Start Guide

### 1. Set Up Environment Variables
```bash
npm run aws:setup:lambda-env
```

### 2. Build and Deploy
```bash
npm run aws:deploy:lambda
```

### 3. Test the Function
```bash
# Get a Gmail ID first (from your email)
npm run aws:test:lambda <gmail-id>
```

### 4. Use via HTTP API
```bash
# Get API Gateway URL
npm run aws:output | grep api_gateway_url

# Test endpoint
curl "https://<api-gateway-url>/email/<gmail-id>"
```

## Integration Points

### Current Integration
- **Gmail API**: Uses existing `getGmailById` functionality
- **Secrets Manager**: Stores Gmail OAuth2 tokens
- **CloudWatch**: Logging and monitoring

### Future Integration (Next Steps)
1. **OpenAI Integration**: Convert email to dialog format
2. **Event Hub**: Process emails from Event Hub triggers
3. **Response Storage**: Store AI responses in DynamoDB
4. **Email Sending**: Send responses back via Gmail API

## Architecture Diagram

```
HTTP Request → API Gateway → Lambda Function → Gmail API
                                    ↓
                            Secrets Manager (Tokens)
                                    ↓
                            CloudWatch (Logs)
```

## Environment Variables Required

The Lambda function needs these environment variables (set via Parameter Store):
- `GMAIL_CLIENT_ID`: Gmail OAuth2 Client ID
- `GMAIL_CLIENT_SECRET`: Gmail OAuth2 Client Secret  
- `GMAIL_REDIRECT_URI`: Gmail OAuth2 Redirect URI
- `GMAIL_USER_EMAIL`: Default Gmail user email

## Monitoring and Logging

- **CloudWatch Logs**: `/aws/lambda/development-chatterbox-email-reader`
- **API Gateway**: Request/response logging
- **Lambda Metrics**: Duration, errors, invocations

## Cost Considerations

- **Lambda**: Pay per request (very low cost)
- **API Gateway**: Pay per request (very low cost)
- **Secrets Manager**: ~$0.40 per secret per month
- **CloudWatch**: Log storage and metrics

## Next Steps for Full Implementation

1. **Update Lambda Handler**: Add OpenAI integration
2. **Add Response Processing**: Convert email to dialog format
3. **Implement Event Hub**: Add Event Hub trigger support
4. **Add Response Storage**: Store results in DynamoDB
5. **Add Email Sending**: Send AI responses back via Gmail
6. **Add Error Handling**: Comprehensive error handling and retries
7. **Add Monitoring**: CloudWatch alarms and dashboards

## Troubleshooting

### Common Issues
1. **Authentication Errors**: Check Gmail tokens in Secrets Manager
2. **Gmail ID Not Found**: Verify email exists and is accessible
3. **Lambda Timeouts**: Increase timeout or optimize Gmail API calls
4. **Permission Errors**: Check IAM roles and policies

### Debug Commands
```bash
# View Lambda logs
aws logs tail /aws/lambda/development-chatterbox-email-reader --follow

# Test Lambda directly
npm run aws:test:lambda <gmail-id>

# Check API Gateway
npm run aws:output | grep api_gateway
```

## Success Criteria

✅ **Lambda function created and deployed**
✅ **HTTP API endpoint accessible**
✅ **Gmail email retrieval working**
✅ **Security and permissions configured**
✅ **Logging and monitoring set up**
✅ **Documentation and scripts created**

The Lambda function is now ready to accept Gmail IDs via HTTP and return email data. This provides the foundation for the next phase: integrating with OpenAI to process emails and generate responses. 