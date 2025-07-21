# AWS-Native Email Processing Infrastructure

This directory contains the Terraform configuration and deployment scripts for the AWS-native email processing system that leverages native AWS services to implement the Chatterbox email processing capabilities.

## Architecture Overview

The AWS-native email processing system is designed to maximize the use of native AWS services while implementing all the requirements from the Chatterbox project specification. The architecture follows an event-driven, serverless pattern:

### Core Components

1. **Lambda Functions**
   - `emailProcessor` - Processes incoming emails from S3 events
   - `responseGenerator` - Generates LLM responses from SQS messages

2. **DynamoDB Tables**
   - `email-queries` - Stores email query metadata and status
   - `conversations` - Stores conversation history and context
   - `generated-responses` - Stores LLM responses and metadata
   - `query-records` - Stores billing and analytics data
   - `user-profiles` - Stores user preferences and subscription info

3. **S3 Buckets**
   - `attachments` - Stores email attachments
   - `email-content` - Stores email content for processing

4. **SQS Queues**
   - `response-generation` - Queues queries for LLM processing
   - `response-generation-dlq` - Dead letter queue for failed messages

5. **Other AWS Services**
   - **SES** - Email sending
   - **Secrets Manager** - Secure credential storage
   - **Parameter Store** - Configuration management
   - **CloudWatch** - Monitoring and logging
   - **IAM** - Access control

### Event Flow

1. **Email Detection**: Gmail polling Lambda uploads email content to S3
2. **Email Processing**: S3 event triggers Email Processor Lambda
3. **Query Validation**: Email Processor validates and stores query in DynamoDB
4. **Queue Processing**: Query is sent to SQS for async processing
5. **Response Generation**: SQS message triggers Response Generator Lambda
6. **LLM Integration**: Response Generator calls OpenAI API
7. **Response Storage**: Generated response is stored in DynamoDB
8. **Email Sending**: Response is sent via SES or Gmail API
9. **Billing**: Query record is created for billing and analytics

## Features Implemented

### Email Processing
- ✅ Subject line validation (must contain "chatterbox")
- ✅ Email directive parsing (conversation ID, model selection)
- ✅ Attachment handling and S3 storage
- ✅ Query content extraction from body/subject
- ✅ Free tier limit enforcement
- ✅ User profile management

### Conversation Management
- ✅ Conversation context retrieval
- ✅ Conversation history formatting for LLM
- ✅ Conversation persistence (optional per user)
- ✅ Conversation cost and token tracking

### Response Generation
- ✅ OpenAI API integration
- ✅ Conversation history inclusion
- ✅ Attachment reference in prompts
- ✅ Response formatting with GUIDs
- ✅ Email response sending via SES

### Billing and Analytics
- ✅ Query record creation
- ✅ Cost breakdown (LLM, infrastructure, licensing)
- ✅ Token counting
- ✅ Usage tracking
- ✅ Model preference tracking

### AWS-Native Features
- ✅ Event-driven architecture
- ✅ Serverless compute
- ✅ Managed databases
- ✅ Managed messaging
- ✅ Managed storage
- ✅ Centralized logging
- ✅ IAM-based security
- ✅ Parameter-based configuration

## Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** installed (version >= 1.0)
3. **Node.js** and **npm** installed
4. **jq** installed for JSON processing

### Quick Start

1. **Deploy to dev environment**:
   ```bash
   ./deploy.sh
   ```

2. **Deploy to staging environment**:
   ```bash
   ./deploy.sh -e staging
   ```

3. **Deploy to production environment**:
   ```bash
   ./deploy.sh -e prod
   ```

### Deployment Options

- `-e, --environment`: Environment (dev, staging, prod) [default: dev]
- `-r, --region`: AWS region [default: us-east-1]
- `-s, --skip-build`: Skip Lambda function build
- `-d, --skip-deploy`: Skip Terraform deployment
- `-v, --verbose`: Enable verbose output
- `-h, --help`: Show help message

### Examples

```bash
# Deploy to dev environment
./deploy.sh

# Deploy to staging in us-west-2
./deploy.sh -e staging -r us-west-2

# Skip Lambda build, deploy existing packages
./deploy.sh -s

# Only build Lambda, skip Terraform deploy
./deploy.sh -d
```

## Configuration

### Parameter Store Parameters

The system uses AWS Parameter Store for configuration:

- `/chatterbox/llm/default-model` - Default LLM model (default: gpt-4o)
- `/chatterbox/billing/free-tier-limit` - Free queries per user (default: 10)
- `/chatterbox/billing/infrastructure-cost` - Infrastructure cost per query (default: $0.01)
- `/chatterbox/billing/licensing-cost` - Licensing cost per query (default: $0.005)
- `/chatterbox/email/rejection-rate-limit` - Rejection notification rate limit (default: 300s)

### Secrets Manager

The system requires the following secrets:

- `chatterbox/openai-api-key` - OpenAI API key for LLM integration

## Integration with Existing System

### Gmail Polling Integration

The email processing system integrates with the existing Gmail polling Lambda:

1. **Gmail Polling Lambda** (`pollGmail.ts`) identifies Chatterbox emails
2. **Email content** is uploaded to S3 bucket `chatterbox-email-content`
3. **S3 event** triggers the Email Processor Lambda
4. **Email Processor** processes the email and queues for response generation

### Local System Compatibility

The AWS-native system is designed to be compatible with the local system:

- **Same data structures** for email queries and responses
- **Same validation rules** for email processing
- **Same conversation management** logic
- **Same billing and analytics** tracking

## Monitoring and Logging

### CloudWatch Logs

- **Email Processor**: `/aws/lambda/chatterbox-email-processor`
- **Response Generator**: `/aws/lambda/chatterbox-response-generator`

### Key Metrics to Monitor

- Lambda function execution times and errors
- SQS queue depth and message processing rates
- DynamoDB read/write capacity and throttling
- S3 bucket access patterns
- API Gateway request rates and errors

### Alerts to Set Up

- Lambda function errors > 5% in 5 minutes
- SQS queue depth > 100 messages
- DynamoDB throttling events
- S3 bucket access denied errors

## Security

### IAM Roles and Policies

- **Least privilege access** for all Lambda functions
- **Resource-level permissions** for DynamoDB tables
- **Bucket-level permissions** for S3 access
- **Queue-level permissions** for SQS access

### Data Protection

- **Encryption at rest** for all DynamoDB tables
- **Encryption in transit** for all API calls
- **Secure credential storage** in Secrets Manager
- **Parameter encryption** for sensitive configuration

## Cost Optimization

### Lambda Optimization

- **Memory allocation** optimized for workload
- **Timeout settings** based on expected processing time
- **Concurrency limits** to prevent cost spikes

### DynamoDB Optimization

- **On-demand billing** for unpredictable workloads
- **Efficient query patterns** to minimize read/write units
- **TTL settings** for automatic data cleanup

### S3 Optimization

- **Lifecycle policies** for automatic data deletion
- **Storage class optimization** for different access patterns
- **Versioning** for data protection

## Troubleshooting

### Common Issues

1. **Lambda function errors**:
   - Check CloudWatch logs for detailed error messages
   - Verify IAM permissions
   - Check function timeout settings

2. **SQS message processing failures**:
   - Check DLQ for failed messages
   - Verify Lambda function error handling
   - Check queue visibility timeout settings

3. **DynamoDB throttling**:
   - Monitor read/write capacity
   - Consider switching to on-demand billing
   - Optimize query patterns

4. **S3 access issues**:
   - Verify bucket permissions
   - Check IAM role policies
   - Verify bucket lifecycle policies

### Debug Commands

```bash
# Check Lambda function status
aws lambda get-function --function-name chatterbox-email-processor

# Check SQS queue attributes
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All

# Check DynamoDB table status
aws dynamodb describe-table --table-name chatterbox-email-queries

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/chatterbox
```

## Future Enhancements

### Planned Features

1. **API Gateway Integration** - HTTP endpoints for manual testing
2. **EventBridge Rules** - Scheduled tasks and event routing
3. **Step Functions** - Complex workflow orchestration
4. **X-Ray Tracing** - Distributed tracing for debugging
5. **CloudWatch Dashboards** - Custom monitoring dashboards

### Scalability Improvements

1. **Auto-scaling** for Lambda functions
2. **Read replicas** for DynamoDB tables
3. **CDN integration** for S3 content delivery
4. **Multi-region deployment** for global users

## Support

For issues and questions:

1. Check CloudWatch logs for detailed error information
2. Review this README for troubleshooting steps
3. Check the main project documentation
4. Review Terraform outputs for resource information 