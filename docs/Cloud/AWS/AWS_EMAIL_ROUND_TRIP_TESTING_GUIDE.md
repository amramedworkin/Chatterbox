# AWS Email Round Trip Testing Guide

## Overview

The Email Round Trip Tester Lambda function provides comprehensive testing capabilities for email delivery across AWS SES and Gmail API. This function validates that emails can be sent and received through various combinations of email services, ensuring the Chatterbox system's email infrastructure is working correctly.

## Purpose

The round trip testing function serves several critical purposes:

1. **Infrastructure Validation**: Verifies that SES and Gmail API configurations are working correctly
2. **Email Delivery Testing**: Tests actual email delivery between different email services
3. **Cross-Service Compatibility**: Validates that emails can flow between SES and Gmail
4. **Troubleshooting**: Provides detailed logging and error information for debugging
5. **Compliance Testing**: Ensures email capabilities meet system requirements

## Architecture

### Lambda Function Details

- **Function Name**: `chatterbox-email-round-trip-tester`
- **Runtime**: Node.js 18.x
- **Memory**: 512 MB
- **Timeout**: 300 seconds (5 minutes)
- **Handler**: `emailRoundTripTester.handler`

### Dependencies

- **AWS SES**: For sending emails via Simple Email Service
- **AWS Secrets Manager**: For storing Gmail OAuth credentials and tokens
- **Gmail API**: For sending emails via Gmail API
- **AWS SSM Parameter Store**: For configuration parameters

### Test Types

The function supports four main test categories:

1. **SES-to-SES**: Tests email delivery between SES verified addresses
2. **Gmail-to-Gmail**: Tests email delivery between Gmail API authorized addresses
3. **SES-to-Gmail**: Tests sending from SES to Gmail addresses
4. **Gmail-to-SES**: Tests sending from Gmail to SES addresses

## Test Scenarios

### 1. SES-to-SES Testing

**Purpose**: Validates SES email sending and receiving capabilities

**Test Cases**:
- **Self Test**: Each verified SES email sends an email to itself
- **Cross Test**: Each verified SES email sends emails to all other verified SES emails

**Requirements**:
- Email addresses must be verified in AWS SES
- SES account sending must be enabled

**Example Test Flow**:
```
awsamram@gmail.com (SES) → awsamram@gmail.com (SES) [Self Test]
awsamram@gmail.com (SES) → amram.dworkin@gmail.com (SES) [Cross Test]
amram.dworkin@gmail.com (SES) → awsamram@gmail.com (SES) [Cross Test]
```

### 2. Gmail-to-Gmail Testing

**Purpose**: Validates Gmail API email sending and receiving capabilities

**Test Cases**:
- **Self Test**: Each Gmail-authorized email sends an email to itself
- **Cross Test**: Each Gmail-authorized email sends emails to all other Gmail-authorized emails

**Requirements**:
- Email addresses must have valid OAuth2 tokens
- Gmail API scopes must include `gmail.send` and `gmail.readonly`

**Example Test Flow**:
```
awsamram@gmail.com (Gmail) → awsamram@gmail.com (Gmail) [Self Test]
awsamram@gmail.com (Gmail) → amram.dworkin@gmail.com (Gmail) [Cross Test]
amram.dworkin@gmail.com (Gmail) → awsamram@gmail.com (Gmail) [Cross Test]
```

### 3. SES-to-Gmail Testing

**Purpose**: Validates sending emails from SES to Gmail addresses

**Test Cases**:
- Each verified SES email sends emails to all Gmail-authorized addresses

**Requirements**:
- SES emails must be verified
- Gmail emails must have read access (for receiving)

**Example Test Flow**:
```
awsamram@gmail.com (SES) → awsamram@gmail.com (Gmail)
awsamram@gmail.com (SES) → amram.dworkin@gmail.com (Gmail)
amram.dworkin@gmail.com (SES) → awsamram@gmail.com (Gmail)
```

### 4. Gmail-to-SES Testing

**Purpose**: Validates sending emails from Gmail to SES addresses

**Test Cases**:
- Each Gmail-authorized email sends emails to all verified SES addresses

**Requirements**:
- Gmail emails must have send access
- SES emails must be verified

**Example Test Flow**:
```
awsamram@gmail.com (Gmail) → awsamram@gmail.com (SES)
awsamram@gmail.com (Gmail) → amram.dworkin@gmail.com (SES)
amram.dworkin@gmail.com (Gmail) → awsamram@gmail.com (SES)
```

## API Usage

### HTTP Methods

The Lambda function supports both GET and POST requests:

#### GET Request

**URL Parameters**:
- `tests`: Comma-separated list of test types
- `help`: Set to `true` to show help information
- `verbose`: Set to `true` for detailed test results

**Examples**:
```bash
# Run all tests
?tests=ALL

# Run specific tests
?tests=SES-to-SES,Gmail-to-Gmail

# Get help
?help=true

# Run tests with verbose output
?tests=ALL&verbose=true
```

#### POST Request

**JSON Body**:
```json
{
  "tests": ["SES-to-SES", "Gmail-to-Gmail"],
  "verbose": true,
  "help": false
}
```

**Examples**:
```json
// Run all tests
{
  "tests": ["ALL"]
}

// Run specific tests with verbose output
{
  "tests": ["SES-to-SES", "Gmail-to-Gmail"],
  "verbose": true
}

// Get help information
{
  "help": true
}
```

### Response Format

#### Success Response

```json
{
  "success": true,
  "testSuite": {
    "testId": "uuid",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "summary": {
      "total": 10,
      "passed": 9,
      "failed": 1,
      "successRate": 90.0
    }
  },
  "capabilities": [
    {
      "email": "awsamram@gmail.com",
      "sesVerified": true,
      "gmailScopes": ["gmail.readonly", "gmail.send"],
      "canSendViaSES": true,
      "canSendViaGmail": true
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "duration": "5000ms"
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Error message describing the failure",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Help Response

```json
{
  "success": true,
  "help": {
    "function": "Email Round Trip Tester",
    "description": "Comprehensive email round trip testing for SES and Gmail API",
    "usage": {
      "get": { /* GET usage details */ },
      "post": { /* POST usage details */ }
    },
    "testTypes": { /* Test type descriptions */ }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Prerequisites

### AWS Configuration

1. **SES Setup**:
   - SES account sending enabled
   - Email addresses verified in SES
   - IAM permissions for SES operations

2. **Secrets Manager**:
   - Google OAuth credentials stored
   - Gmail tokens stored per email address

3. **Lambda Permissions**:
   - SES send permissions
   - Secrets Manager read permissions
   - SSM Parameter Store read permissions

### Gmail Configuration

1. **OAuth2 Setup**:
   - Gmail API enabled in Google Cloud Console
   - OAuth2 credentials configured
   - Required scopes: `gmail.readonly`, `gmail.send`

2. **Token Management**:
   - Valid OAuth2 tokens for each email address
   - Tokens stored in AWS Secrets Manager

## Deployment

### Terraform Integration

The Lambda function is deployed as part of the main Terraform infrastructure:

```hcl
# In Cloud/AWS/terraform/modules/email-processing/main.tf
resource "aws_lambda_function" "email_round_trip_tester" {
  filename      = data.archive_file.email_round_trip_tester_zip.output_path
  function_name = "chatterbox-email-round-trip-tester"
  role          = aws_iam_role.email_round_trip_tester_lambda.arn
  handler       = "dist/emailRoundTripTester.handler"
  runtime       = "nodejs18.x"
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      GMAIL_TOKENS_SECRET_NAME = var.gmail_tokens_secret_name
      GOOGLE_CREDENTIALS_SECRET_NAME = var.google_credentials_secret_name
      PARAMETER_STORE_PREFIX = var.parameter_store_prefix
    }
  }

  tags = {
    Name        = "chatterbox-email-round-trip-tester"
    Subsystem   = "email-testing"
  }
}
```

### Build Process

The function is built and deployed as part of the standard build process:

```bash
# Build and deploy
npm run aws:deploy

# Or build specifically
npm run aws:build:lambda
```

## Testing Scripts

### Available Scripts

The following npm scripts are available for testing:

```bash
# Run all round trip tests
npm run aws:test:email:roundtrip

# Run specific test types
npm run aws:test:email:ses-to-ses
npm run aws:test:email:gmail-to-gmail
npm run aws:test:email:ses-to-gmail
npm run aws:test:email:gmail-to-ses

# Get help information
npm run aws:test:email:help

# Run tests with verbose output
npm run aws:test:email:verbose
```

### Script Implementation

The scripts are implemented in `scripts/` directory and use the AWS Lambda invoke API to execute the function:

```javascript
// Example script implementation
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

async function runEmailRoundTripTests(testType = 'ALL', verbose = false) {
  const lambda = new LambdaClient({ region: 'us-east-1' });
  
  const payload = {
    tests: testType === 'ALL' ? ['SES-to-SES', 'Gmail-to-Gmail', 'SES-to-Gmail', 'Gmail-to-SES'] : [testType],
    verbose
  };

  const command = new InvokeCommand({
    FunctionName: 'chatterbox-email-round-trip-tester',
    Payload: JSON.stringify(payload)
  });

  const response = await lambda.send(command);
  const result = JSON.parse(Buffer.from(response.Payload).toString());
  
  return result;
}
```

## Monitoring and Logging

### CloudWatch Logs

All test execution is logged to CloudWatch with detailed information:

- Test start/completion timestamps
- Individual test results
- Error details and stack traces
- Email capabilities analysis
- Performance metrics

### Log Structure

```
[INFO] Email Round Trip Tester Lambda started
[INFO] Event: { /* event details */ }
[INFO] Tests to run: SES-to-SES, Gmail-to-Gmail
[INFO] Analyzing email capabilities...
[INFO] Found 2 SES verified emails: awsamram@gmail.com, amram.dworkin@gmail.com
[INFO] === Running SES-to-SES tests ===
[INFO] Sending SES email from awsamram@gmail.com to awsamram@gmail.com
[SUCCESS] SES email sent successfully: 1234567890abcdef
[INFO] === Running Gmail-to-Gmail tests ===
[INFO] Creating Gmail auth client for: awsamram@gmail.com
[SUCCESS] Gmail auth client created for: awsamram@gmail.com
[INFO] Sending Gmail email from awsamram@gmail.com to awsamram@gmail.com
[SUCCESS] Gmail email sent successfully: 18c1234567890abc
[INFO] Test Summary:
[INFO]   Total tests: 8
[INFO]   Passed: 8
[INFO]   Failed: 0
[INFO]   Success rate: 100%
[INFO]   Duration: 5000ms
```

### Metrics

The function provides the following metrics:

- **Test Count**: Total number of tests executed
- **Success Rate**: Percentage of successful tests
- **Duration**: Total execution time
- **Error Rate**: Percentage of failed tests by type

## Troubleshooting

### Common Issues

#### 1. SES Verification Errors

**Symptoms**: Tests fail with "Email address not verified" errors

**Solutions**:
- Verify email addresses in SES console
- Run `npm run aws:setup:ses` to verify emails
- Check SES account sending status

#### 2. Gmail API Authorization Errors

**Symptoms**: Tests fail with "401 Unauthorized" or "Invalid credentials"

**Solutions**:
- Re-authorize Gmail users: `npm run mail:authorize`
- Check OAuth2 token validity
- Verify Gmail API scopes include `gmail.send`

#### 3. Lambda Timeout Errors

**Symptoms**: Function times out after 5 minutes

**Solutions**:
- Reduce number of test types
- Check email service response times
- Increase Lambda timeout if needed

#### 4. Secrets Manager Access Errors

**Symptoms**: "Access denied" errors when accessing secrets

**Solutions**:
- Verify Lambda IAM role has Secrets Manager permissions
- Check secret names and ARNs
- Ensure secrets exist and are accessible

### Debugging Steps

1. **Check CloudWatch Logs**:
   ```bash
   npm run aws:logs:email-round-trip-tester
   ```

2. **Verify Email Capabilities**:
   ```bash
   npm run aws:check:ses
   npm run mail:validate:tokens
   ```

3. **Test Individual Components**:
   ```bash
   npm run aws:test:ses
   npm run mail:send:test
   ```

4. **Check Infrastructure**:
   ```bash
   npm run aws:validate
   ```

## Best Practices

### Testing Strategy

1. **Regular Testing**: Run round trip tests after infrastructure changes
2. **Gradual Testing**: Start with individual test types before running all
3. **Monitoring**: Set up CloudWatch alarms for test failures
4. **Documentation**: Keep test results for troubleshooting

### Performance Optimization

1. **Parallel Execution**: Tests are executed in parallel where possible
2. **Timeout Management**: Set appropriate timeouts for email delivery
3. **Resource Allocation**: Monitor Lambda memory and CPU usage
4. **Rate Limiting**: Respect SES and Gmail API rate limits

### Security Considerations

1. **Credential Management**: Use AWS Secrets Manager for sensitive data
2. **IAM Permissions**: Follow principle of least privilege
3. **Token Security**: Secure OAuth2 tokens and refresh tokens
4. **Audit Logging**: Enable CloudTrail for API access monitoring

## Integration with Menu System

The email round trip testing is integrated into the main menu system under the "Validation and State" category:

```
Validation and State (5 items)
├── AWS Validation (5 items)
│   ├── Validate AWS System
│   ├── Validate SES Setup
│   ├── Validate Gmail Tokens
│   └── Email Round Trip Tests (5 items)
│       ├── Run All Email Tests
│       ├── SES-to-SES Tests
│       ├── Gmail-to-Gmail Tests
│       ├── SES-to-Gmail Tests
│       └── Gmail-to-SES Tests
```

### Menu Integration Benefits

1. **Easy Access**: Quick access to testing functions
2. **Organized Structure**: Logical grouping of related functions
3. **Consistent Interface**: Same menu system as other AWS operations
4. **Help Integration**: Built-in help and documentation

## Conclusion

The Email Round Trip Tester Lambda function provides comprehensive validation of the Chatterbox email infrastructure. By testing all possible email delivery paths between SES and Gmail, it ensures the system can reliably send and receive emails through both services.

Regular execution of these tests helps maintain system reliability and provides early warning of infrastructure issues. The detailed logging and error reporting make troubleshooting straightforward, while the integration with the menu system makes testing accessible to all users.

For production deployments, consider setting up automated testing schedules and CloudWatch alarms to monitor email delivery health continuously. 