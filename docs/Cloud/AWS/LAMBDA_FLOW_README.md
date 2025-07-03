# Lambda Functions Flow Documentation

This document describes the flow and architecture of all Lambda functions in the Chatterbox system. Each Lambda function is designed to handle specific tasks within the email processing and AI interaction pipeline.

## Table of Contents

- [Overview](#overview)
- [Lambda Functions](#lambda-functions)
  - [pullLatestChatterboxEmail](#pulllatestchatterboxemail)
- [Common Infrastructure](#common-infrastructure)
- [Security & Permissions](#security--permissions)
- [Monitoring & Logging](#monitoring--logging)
- [Development & Deployment](#development--deployment)

## Overview

The Chatterbox Lambda functions are serverless components that handle email processing, AI interactions, and data management. They integrate with AWS services including Secrets Manager, S3, DynamoDB, and CloudWatch for a complete serverless architecture.

## Lambda Functions

### pullLatestChatterboxEmail

**Purpose:** Retrieves the most recent Gmail message with subject "chatterbox" for a given user, stores the raw email in S3, and returns structured email data.

**Function Name:** `development-pull-latest-chatterbox-email`  
**Runtime:** Node.js 18.x  
**Memory:** 256 MB  
**Timeout:** 30 seconds  
**Handler:** `pullLatestChatterboxEmail.handler`

#### Flow Diagram

```
API Gateway → Lambda → Secrets Manager → Gmail API → S3 → Response
```

#### Detailed Process Flow

1. **Event Reception**
   - Receives API Gateway event with optional `userEmail` query parameter
   - Default user email: `default@example.com`
   - Validates input parameters

2. **Credential Retrieval**
   - **Google API Credentials** (from Secrets Manager):
     - Secret Name: `chatterbox/google-credentials`
     - Format: JSON object containing:
       ```json
       {
         "client_id": "your-google-client-id.apps.googleusercontent.com",
         "client_secret": "your-google-client-secret",
         "redirect_uris": ["https://your-domain.com/oauth2callback"]
       }
       ```
   
   - **Gmail OAuth Tokens** (from Secrets Manager):
     - Secret Name: `chatterbox-gmail-tokens`
     - Format: JSON object with user email as key:
       ```json
       {
         "user@example.com": {
           "access_token": "ya29.a0AfH6SMC...",
           "refresh_token": "1//04dX...",
           "scope": "https://www.googleapis.com/auth/gmail.readonly",
           "token_type": "Bearer",
           "expiry_date": 1640995200000
         }
       }
       ```

3. **Gmail API Authentication**
   - Creates OAuth2 client using Google credentials
   - Sets credentials using user's OAuth tokens
   - Initializes Gmail API client

4. **Email Retrieval**
   - Searches Gmail for messages with subject containing "chatterbox"
   - Uses Gmail API `users.messages.list` with:
     - `userId`: "me" (authenticated user)
     - `q`: "subject:chatterbox"
     - `maxResults`: 1
   - Retrieves full message using `users.messages.get` with `format: 'full'`

5. **Email Processing**
   - Extracts email metadata from headers:
     - Subject
     - From address
     - Date sent
     - Message ID
     - Thread ID
   - Decodes email body (base64) from payload
   - Identifies and extracts attachments
   - Processes both text/plain and text/html content

6. **Data Storage**
   - **S3 Storage**:
     - Bucket: `chatterbox-email-archive`
     - Key format: `emails/{messageId}/{timestamp}.eml`
     - Content-Type: `message/rfc822`
     - Metadata includes email ID, thread ID, subject, sender, dates
   - **Response Data**:
     - Returns structured JSON with all extracted email data

7. **Response Format**
   ```json
   {
     "success": true,
     "data": {
       "address": "user@example.com",
       "id": "18c1234567890abcdef",
       "threadId": "18c1234567890abcdef",
       "sentDate": "Mon, 28 Jun 2025 10:30:00 +0000",
       "receivedDate": "2025-06-28T10:30:00.000Z",
       "subject": "Chatterbox: Test Email",
       "fromSender": "sender@example.com",
       "bodyText": "Email body content...",
       "attachments": [
         {
           "name": "document.pdf",
           "size": 1024000,
           "mimeType": "application/pdf"
         }
       ],
       "rawEmail": "base64-encoded-raw-email-content"
     }
   }
   ```

#### Environment Variables

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `GMAIL_TOKENS_SECRET_NAME` | `chatterbox-gmail-tokens` | Secrets Manager secret name for Gmail OAuth tokens |
| `GOOGLE_CREDENTIALS_SECRET_NAME` | `chatterbox/google-credentials` | Secrets Manager secret name for Google API credentials |
| `EMAIL_STORAGE_BUCKET` | `chatterbox-email-archive` | S3 bucket for storing raw emails |
| `AWS_REGION` | `us-east-1` | AWS region for service clients |
| `DEFAULT_GMAIL_USER` | `default@example.com` | Default user email if not provided in request |

#### Error Handling

- **No emails found**: Returns error with message "No Chatterbox emails found"
- **Missing tokens**: Returns error with message "No tokens found for user: {userEmail}"
- **Gmail API errors**: Returns error with Gmail API error message
- **S3 storage errors**: Returns error with S3 error message
- **Secrets Manager errors**: Returns error with secret retrieval error message

#### API Gateway Integration

- **HTTP Method**: GET
- **Endpoint**: `/pull-latest-chatterbox-email`
- **Query Parameters**: 
  - `userEmail` (optional): Email address of the user
- **CORS**: Enabled for all origins
- **Response Codes**:
  - 200: Success
  - 500: Internal server error

## Common Infrastructure

### IAM Role Permissions

The Lambda function uses the IAM role `development-chatterbox-role` with the following permissions:

#### Secrets Manager Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:855581761117:secret:chatterbox-gmail-tokens-*",
        "arn:aws:secretsmanager:us-east-1:855581761117:secret:chatterbox/google-credentials-*"
      ]
    }
  ]
}
```

#### S3 Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::chatterbox-email-archive",
        "arn:aws:s3:::chatterbox-email-archive/*"
      ]
    }
  ]
}
```

#### CloudWatch Logs Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:855581761117:log-group:/aws/lambda/development-pull-latest-chatterbox-email:*"
    }
  ]
}
```

### Required AWS Services

1. **AWS Secrets Manager**
   - Stores sensitive credentials and tokens
   - Automatic rotation support
   - Encryption at rest

2. **Amazon S3**
   - Stores raw email data
   - Versioning enabled
   - Lifecycle policies for cost optimization

3. **Amazon API Gateway**
   - RESTful API endpoints
   - Request/response transformation
   - CORS support

4. **AWS CloudWatch**
   - Function monitoring and logging
   - Custom metrics
   - Alarm notifications

## Security & Permissions

### Authentication & Authorization

- **Gmail OAuth2**: Uses Google's OAuth2 flow for Gmail API access
- **AWS IAM**: Role-based access control for AWS services
- **Secrets Manager**: Encrypted storage of sensitive credentials

### Data Protection

- **Encryption in Transit**: All API calls use HTTPS/TLS
- **Encryption at Rest**: S3 and Secrets Manager data encrypted
- **Token Security**: OAuth tokens stored encrypted in Secrets Manager
- **Access Logging**: CloudTrail logs all API access

### Compliance

- **Data Retention**: S3 lifecycle policies manage email retention
- **Audit Trail**: CloudWatch logs all function executions
- **Error Handling**: Sensitive data not exposed in error messages

## Monitoring & Logging

### CloudWatch Metrics

- **Invocation Count**: Number of function invocations
- **Duration**: Function execution time
- **Error Rate**: Percentage of failed invocations
- **Throttles**: Number of throttled invocations

### Custom Metrics

- **Emails Processed**: Number of emails successfully processed
- **S3 Storage Used**: Amount of data stored in S3
- **Gmail API Calls**: Number of Gmail API requests

### Log Structure

```json
{
  "timestamp": "2025-06-28T10:30:00.000Z",
  "level": "INFO",
  "function": "pullLatestChatterboxEmail",
  "userEmail": "user@example.com",
  "messageId": "18c1234567890abcdef",
  "s3Key": "emails/18c1234567890abcdef/2025-06-28T10-30-00-000Z.eml",
  "duration": 2500,
  "success": true
}
```

### Alarms

- **High Error Rate**: Alert when error rate exceeds 5%
- **Long Duration**: Alert when function takes longer than 25 seconds
- **S3 Storage**: Alert when storage exceeds 1GB

## Development & Deployment

### Local Development

1. **Environment Setup**
   ```bash
   npm install
   npm run build
   ```

2. **Testing**
   ```bash
   npm run test:lambda:integration
   ```

3. **Local Testing**
   ```bash
   # Set environment variables
   export GMAIL_TOKENS_SECRET_NAME="chatterbox-gmail-tokens"
   export GOOGLE_CREDENTIALS_SECRET_NAME="chatterbox/google-credentials"
   export EMAIL_STORAGE_BUCKET="chatterbox-email-archive"
   
   # Test locally
   node dist/src/lambda/pullLatestChatterboxEmail.js
   ```

### Deployment

1. **Build Lambda Package**
   ```bash
   npm run aws:lambda:build
   ```

2. **Deploy Infrastructure**
   ```bash
   npm run aws:deploy:auto
   ```

3. **Update Function Code**
   ```bash
   npm run aws:lambda:deploy
   ```

### Testing

#### Unit Tests
- Test individual functions with mocked AWS services
- Validate error handling and edge cases
- Ensure proper data transformation

#### Integration Tests
- Test with real AWS services
- Validate end-to-end functionality
- Test API Gateway integration

#### Load Tests
- Test function performance under load
- Validate timeout and memory usage
- Test concurrent execution

### Troubleshooting

#### Common Issues

1. **OAuth Token Expired**
   - Error: "Invalid Credentials"
   - Solution: Refresh OAuth tokens using refresh token

2. **S3 Permission Denied**
   - Error: "Access Denied"
   - Solution: Check IAM role permissions for S3

3. **Secrets Manager Access Denied**
   - Error: "User is not authorized"
   - Solution: Verify IAM role has Secrets Manager permissions

4. **Gmail API Quota Exceeded**
   - Error: "Quota exceeded"
   - Solution: Implement exponential backoff and retry logic

#### Debugging

1. **Enable Detailed Logging**
   ```bash
   export TF_LOG=DEBUG
   export TF_LOG_PATH=terraform.log
   ```

2. **Check CloudWatch Logs**
   ```bash
   aws logs tail /aws/lambda/development-pull-latest-chatterbox-email --follow
   ```

3. **Test API Endpoint**
   ```bash
   curl -X GET "https://api-gateway-url/pull-latest-chatterbox-email?userEmail=user@example.com"
   ```

## Future Lambda Functions

This document will be expanded to include additional Lambda functions as they are developed:

### Planned Functions

1. **emailProcessor** - Process and analyze email content
2. **aiResponseGenerator** - Generate AI responses to emails
3. **emailSender** - Send responses via Gmail API
4. **dataArchiver** - Archive old emails and data
5. **metricsCollector** - Collect and aggregate system metrics

### Template for New Functions

When adding new Lambda functions, use this template:

```markdown
### [FunctionName]

**Purpose:** [Brief description of what the function does]

**Function Name:** `development-[function-name]`  
**Runtime:** Node.js 18.x  
**Memory:** [X] MB  
**Timeout:** [X] seconds  
**Handler:** `[functionName].handler`

#### Flow Diagram
[ASCII or reference to diagram]

#### Detailed Process Flow
1. [Step 1]
2. [Step 2]
...

#### Environment Variables
| Variable | Default Value | Description |
|----------|---------------|-------------|
| [VAR_NAME] | [default] | [description] |

#### Error Handling
[Describe error scenarios and handling]

#### API Gateway Integration
[If applicable]
```

---

**Last Updated:** June 28, 2025  
**Version:** 1.0  
**Maintainer:** Chatterbox Development Team 