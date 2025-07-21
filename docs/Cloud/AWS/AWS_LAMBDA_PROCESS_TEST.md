# Lambda Process Test Guide

This guide describes how to test each Lambda function in the Chatterbox AWS system and validate their operation through the AWS Console.

## System Overview

The Chatterbox AWS system consists of four main Lambda functions that work together to process emails and generate AI responses:

1. **Poll Gmail** (`development-poll-gmail`) - Monitors Gmail for new emails
2. **Pull Latest Chatterbox Email** (`development-pull-latest-chatterbox-email`) - Retrieves specific Chatterbox emails
3. **Email Processor** (`chatterbox-email-processor`) - Processes incoming emails and queues responses
4. **Response Generator** (`chatterbox-response-generator`) - Generates AI responses and sends emails

## Prerequisites

Before testing, ensure:
- AWS infrastructure is deployed (`npm run aws:deploy`)
- Gmail tokens are configured (`npm run aws:init:prepare` and `npm run aws:init:migrate`)
- Lambda functions are built and deployed

## Test Email Setup

To seed the system for testing, send an email to your configured Gmail account with:
- **Subject**: `chatterbox Test email processing`
- **Body**: `This is a test email to verify the Lambda processing pipeline. Please respond with a helpful message.`

## Lambda Function Testing

### 1. Poll Gmail Lambda

**Purpose**: Monitors Gmail for new emails, identifies Chatterbox emails, and stores them in S3 and DynamoDB.

**Command**:
```bash
npm run aws:lambda:poll
# or with specific user
npm run aws:lambda:poll awsamram@gmail.com
```

**What it does**:
- Authenticates with Gmail API using OAuth2 tokens
- Polls Gmail for new messages since last poll
- Identifies emails with "chatterbox" in subject
- Extracts email content and metadata
- Stores email content in S3 bucket
- Creates pending email jobs in DynamoDB

**AWS Console Validation**:

**S3 Console** (`https://console.aws.amazon.com/s3/`):
- Navigate to bucket: `chatterbox-email-content-dev-*`
- Look for new objects in `emails/` folder
- Verify email content files with `.json` extension
- Check metadata includes: gmailId, userEmail, subject, fromSender, receivedDate

**DynamoDB Console** (`https://console.aws.amazon.com/dynamodb/`):
- Navigate to table: `development-chatterbox-state-table`
- Check for new items with:
  - PK: `PENDING_EMAIL#<gmail_id>`
  - SK: `USER#<user_email>`
  - Status: `pending`
  - Contains: gmailId, userEmail, subject, fromSender, receivedDate

**CloudWatch Logs** (`https://console.aws.amazon.com/cloudwatch/`):
- Navigate to log group: `/aws/lambda/development-poll-gmail`
- Check latest log stream for:
  - Authentication success
  - Number of new messages found
  - Number of Chatterbox emails identified
  - S3 upload success
  - DynamoDB write success

**Expected Success Indicators**:
- ✅ "Successfully authenticated with Gmail API"
- ✅ "Found X new messages"
- ✅ "Found X Chatterbox emails"
- ✅ "Successfully uploaded email content to S3"
- ✅ "Successfully stored pending email job"

### 2. Pull Latest Chatterbox Email Lambda

**Purpose**: Retrieves the most recent Chatterbox email for testing or manual processing.

**Command**:
```bash
npm run aws:lambda:pull
# or with specific user
npm run aws:lambda:pull awsamram@gmail.com
```

**What it does**:
- Authenticates with Gmail API
- Searches for emails with "chatterbox" in subject from last 7 days
- Retrieves the most recent matching email
- Extracts full email content including attachments
- Stores raw email in S3 archive bucket

**AWS Console Validation**:

**S3 Console**:
- Navigate to bucket: `chatterbox-email-archive`
- Look for new objects in `emails/<message_id>/` folder
- Verify `.eml` files contain raw email content
- Check metadata includes: messageId, threadId, sentDate, receivedDate

**CloudWatch Logs**:
- Navigate to log group: `/aws/lambda/development-pull-latest-chatterbox-email`
- Check for:
  - Authentication success
  - Search query used: "subject:chatterbox newer_than:7d"
  - Number of messages found
  - S3 storage success

**Expected Success Indicators**:
- ✅ "Successfully authenticated with Gmail API"
- ✅ "Found X messages"
- ✅ "Successfully retrieved message: [subject]"
- ✅ "Successfully stored email in S3"

### 3. Email Processor Lambda

**Purpose**: Processes pending email jobs, validates emails, and queues response generation.

**Command**:
```bash
npm run aws:lambda:processor
# or with specific S3 object
npm run aws:lambda:processor chatterbox-email-content-dev-9asadjm4 emails/test-email-metadata.json
```

**What it does**:
- Retrieves email content from S3
- Validates email format and content
- Parses email directives (conversation ID, model name)
- Checks user profile and billing limits
- Creates email query records in DynamoDB
- Queues response generation in SQS

**AWS Console Validation**:

**DynamoDB Console**:
- Navigate to table: `chatterbox-email-queries`
- Check for new items with:
  - queryId: UUID
  - gmailId: from original email
  - userEmail: sender email
  - status: `pending` or `processing`
  - queryType: `standalone` or `conversation`
  - Contains: subject, body, attachments, receivedDate

**SQS Console** (`https://console.aws.amazon.com/sqs/`):
- Navigate to queue: `chatterbox-response-generation`
- Check for new messages in queue
- Message body should contain: queryId, conversationId, emailContent, userEmail

**CloudWatch Logs**:
- Navigate to log group: `/aws/lambda/chatterbox-email-processor`
- Check for:
  - S3 object retrieval success
  - Email validation results
  - User profile lookup
  - DynamoDB write success
  - SQS message queued

**Expected Success Indicators**:
- ✅ "Successfully retrieved email content from S3"
- ✅ "Email validation passed"
- ✅ "User profile retrieved"
- ✅ "Email query stored successfully"
- ✅ "Response generation queued"

### 4. Response Generator Lambda

**Purpose**: Generates AI responses using OpenAI, sends emails, and records costs.

**Command**:
```bash
npm run aws:lambda:generator
# or with specific message
npm run aws:lambda:generator '{"queryId":"test-123","emailContent":"test"}' test-conversation-123
```

**What it does**:
- Retrieves email query from DynamoDB
- Gets conversation context if applicable
- Calls OpenAI API to generate response
- Sends response email via SES
- Records costs and usage in DynamoDB
- Updates query status to completed

**AWS Console Validation**:

**DynamoDB Console**:
- Navigate to table: `chatterbox-generated-responses`
- Check for new items with:
  - responseId: UUID
  - queryId: from original query
  - responseContent: AI-generated response
  - modelUsed: OpenAI model name
  - cost: calculated cost
  - tokens: token count

**DynamoDB Console** (Query Records):
- Navigate to table: `chatterbox-query-records`
- Check for billing records with:
  - queryId: from original query
  - costBreakdown: llmCost, infrastructureCost, licensingCost
  - modelUsed: OpenAI model name
  - wasPreferredModel: boolean

**SES Console** (`https://console.aws.amazon.com/ses/`):
- Navigate to "Sending statistics"
- Check for sent emails
- Verify email content and recipients
- Check bounce/complaint rates

**CloudWatch Logs**:
- Navigate to log group: `/aws/lambda/chatterbox-response-generator`
- Check for:
  - Email query retrieval
  - OpenAI API call success
  - Response generation
  - SES email sent
  - Cost calculation
  - DynamoDB updates

**Expected Success Indicators**:
- ✅ "Email query retrieved successfully"
- ✅ "OpenAI API call successful"
- ✅ "Response generated successfully"
- ✅ "Email sent via SES"
- ✅ "Cost recorded"
- ✅ "Query status updated to completed"

## Complete End-to-End Test

To test the entire pipeline:

1. **Send test email** to your Gmail account
2. **Run poll Lambda**: `npm run aws:lambda:poll`
3. **Run processor Lambda**: `npm run aws:lambda:processor`
4. **Run generator Lambda**: `npm run aws:lambda:generator`

**Expected Flow**:
1. Email appears in S3 and DynamoDB (pending)
2. Email query created in DynamoDB
3. Response generation queued in SQS
4. AI response generated and sent via email
5. All costs and usage recorded

## Troubleshooting

### Common Issues

**Authentication Errors**:
- Check Gmail tokens in Secrets Manager
- Verify OAuth2 credentials
- Ensure tokens haven't expired

**S3 Access Errors**:
- Verify bucket names match environment
- Check IAM permissions for Lambda roles
- Ensure bucket exists and is accessible

**DynamoDB Errors**:
- Verify table names match environment
- Check IAM permissions
- Ensure tables exist and are accessible

**OpenAI API Errors**:
- Check OpenAI API key in Secrets Manager
- Verify API key is valid and has credits
- Check rate limits and quotas

**SES Email Errors**:
- Verify sender email is verified in SES
- Check SES sending limits
- Ensure recipient emails are valid

### Debug Commands

```bash
# Check Lambda function status
aws lambda get-function --function-name development-poll-gmail

# View recent CloudWatch logs
aws logs describe-log-streams --log-group-name /aws/lambda/development-poll-gmail --order-by LastEventTime --descending --max-items 5

# Check DynamoDB table items
aws dynamodb scan --table-name development-chatterbox-state-table --max-items 10

# Check SQS queue messages
aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT/chatterbox-response-generation --attribute-names All
```

## Monitoring Dashboard

For ongoing monitoring, consider setting up CloudWatch dashboards to track:
- Lambda function invocations and errors
- DynamoDB read/write capacity
- SQS queue depth
- S3 bucket usage
- SES sending statistics
- API Gateway requests

This provides real-time visibility into system health and performance. 