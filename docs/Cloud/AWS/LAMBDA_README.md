# Chatterbox Lambda Email Reader

This Lambda function provides HTTP API access to read Gmail messages by their unique ID. It's designed to be the foundation for converting Gmail messages to OpenAI dialog format and processing them.

## Architecture

- **Lambda Function**: `development-chatterbox-email-reader`
- **API Gateway**: HTTP API with route `/email/{gmailId}`
- **Authentication**: Uses Gmail OAuth2 tokens stored in AWS Secrets Manager
- **Logging**: CloudWatch Logs

## Prerequisites

1. **AWS Infrastructure**: The main Chatterbox AWS infrastructure must be deployed
2. **Gmail Authorization**: Gmail users must be authorized and tokens stored in Secrets Manager
3. **Environment Variables**: The Lambda function needs Gmail OAuth2 credentials

## Deployment

### 1. Build the Lambda Function

```bash
npm run aws:build:lambda
```

This script:
- Installs dependencies in the Lambda directory
- Creates a deployment package (ZIP file)
- Places it in the correct location for Terraform

### 2. Deploy Infrastructure

```bash
npm run aws:deploy:lambda
```

This will:
- Build the Lambda function
- Plan and apply Terraform changes
- Create the Lambda function, API Gateway, and IAM roles

### 3. Set Environment Variables

The Lambda function needs these environment variables:

```bash
# Gmail OAuth2 credentials (should be stored in Parameter Store)
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=your_redirect_uri
GMAIL_USER_EMAIL=your_gmail_user@example.com
```

## Usage

### HTTP API Endpoint

```
GET https://<api-gateway-id>.execute-api.<region>.amazonaws.com/email/{gmailId}
```

### Example Request

```bash
curl "https://abc123.execute-api.us-east-1.amazonaws.com/email/18c1234567890abcd"
```

### Example Response

```json
{
  "success": true,
  "data": {
    "id": "18c1234567890abcd",
    "threadId": "18c1234567890abcd",
    "subject": "chatterbox ask about quantum froth",
    "sender": "sender@example.com",
    "body": "what is quantum froth and how do we detect it?",
    "snippet": "what is quantum froth and how do we detect it?",
    "internalDate": "1703123456789",
    "labelIds": ["INBOX", "UNREAD"]
  }
}
```

## Testing

### Test with a Gmail ID

```bash
npm run aws:test:lambda 18c1234567890abcd
```

### Test via API Gateway

```bash
# Get the API Gateway URL
npm run aws:output | grep api_gateway_url

# Test the endpoint
curl "https://<api-gateway-url>/email/18c1234567890abcd"
```

## Monitoring

### CloudWatch Logs

Logs are available at:
```
/aws/lambda/development-chatterbox-email-reader
```

### View Logs

```bash
# View recent logs
aws logs tail /aws/lambda/development-chatterbox-email-reader --follow

# View specific log stream
aws logs describe-log-streams --log-group-name /aws/lambda/development-chatterbox-email-reader
```

## Security

### IAM Permissions

The Lambda function has these permissions:
- **CloudWatch Logs**: Create log groups, streams, and put log events
- **Secrets Manager**: Get secret values for Gmail tokens

### API Gateway Security

- CORS enabled for all origins (configurable)
- HTTP API (faster and cheaper than REST API)
- Automatic deployment on changes

## Troubleshooting

### Common Issues

1. **Authentication Error (401)**
   - Check if Gmail tokens are stored in Secrets Manager
   - Verify tokens haven't expired
   - Run `npm run mail:authorize` to refresh tokens

2. **Gmail ID Not Found (404)**
   - Verify the Gmail ID exists
   - Check if the user has access to the email
   - Ensure the Gmail ID format is correct

3. **Lambda Timeout**
   - Increase timeout in Terraform configuration
   - Check Gmail API response times
   - Monitor CloudWatch logs for slow operations

### Debug Mode

Enable debug logging:

```bash
# Set log level to DEBUG
aws lambda update-function-configuration \
  --function-name development-chatterbox-email-reader \
  --environment Variables='{LOG_LEVEL=DEBUG}'
```

## Next Steps

This Lambda function is the foundation for:

1. **Email to Dialog Conversion**: Convert Gmail messages to OpenAI dialog format
2. **OpenAI Integration**: Process emails through OpenAI API
3. **Response Handling**: Store and manage AI responses
4. **Event Hub Integration**: Process emails from Event Hub triggers

## Development

### Local Testing

```bash
# Test the Lambda function locally
cd Cloud/AWS/terraform/modules/lambda/lambda
npm install
node -e "
const { handler } = require('./index');
const event = {
  pathParameters: { gmailId: 'test-id' },
  httpMethod: 'GET'
};
handler(event, {}, console.log);
"
```

### Updating the Function

1. Modify the code in `Cloud/AWS/terraform/modules/lambda/lambda/`
2. Run `npm run aws:build:lambda`
3. Run `npm run aws:deploy:lambda`

### Adding Dependencies

1. Add to `Cloud/AWS/terraform/modules/lambda/lambda/package.json`
2. Run `npm run aws:build:lambda`
3. Deploy the updated function

## Cost Optimization

- **Memory**: 512MB (adjust based on performance needs)
- **Timeout**: 30 seconds (adjust based on Gmail API response times)
- **Concurrency**: Consider setting limits for high traffic
- **Log Retention**: 14 days (adjust based on compliance needs) 