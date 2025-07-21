# AWS Testing Guide

## Overview

This document describes AWS testing procedures for the Chatterbox system, including SES email service testing.

## Testing Strategy

### 1. Infrastructure Testing
- **VPC Testing**: Network connectivity and security groups
- **DynamoDB Testing**: Data storage and retrieval operations
- **S3 Testing**: Object storage and lifecycle policies
- **Secrets Manager Testing**: Secure credential storage
- **Parameter Store Testing**: Configuration management
- **IAM Testing**: Access control and permissions
- **CloudWatch Testing**: Monitoring and logging
- **SES Testing**: Email service functionality

### 2. SES Testing Procedures

#### Email Verification Testing
```bash
# Test SES account status
npm run aws:check:ses

# Test email verification
npm run aws:validate:ses

# Test SES setup (clean mode)
npm run aws:validate:ses --clean
```

#### Email Sending Testing
```bash
# Test email sending functionality
npm run test:mail:send

# Test email sending with clean state
npm run test:mail:send:clean
```

#### SES Configuration Testing
- Verify account sending is enabled
- Check verified email addresses
- Validate configuration sets
- Test bounce/complaint handling
- Monitor sending statistics

### 3. Integration Testing
- **Lambda Integration**: Test Lambda functions with SES
- **API Testing**: Test API endpoints that use SES
- **End-to-End Testing**: Complete email workflow testing

### 4. Performance Testing
- **Load Testing**: Test SES sending limits
- **Concurrency Testing**: Multiple simultaneous email sends
- **Error Handling**: Test bounce and complaint scenarios

## Test Commands

### Automated Testing
```bash
# Test all AWS resources
npm run aws:test:all

# Test specific services
npm run aws:test:vpc
npm run aws:test:dynamodb
npm run aws:test:s3
npm run aws:test:secrets
npm run aws:test:parameters
npm run aws:test:iam
npm run aws:test:cloudwatch
npm run aws:test:ses
```

### Manual Testing
```bash
# Test SES manually
aws ses get-account-sending-enabled --profile cliadmin
aws ses list-identities --profile cliadmin
aws ses get-send-statistics --profile cliadmin
```

## Test Data

### SES Test Scenarios
1. **Valid Email Sending**: Send to verified addresses
2. **Invalid Email Sending**: Test bounce handling
3. **Complaint Testing**: Test complaint handling
4. **Rate Limiting**: Test sending limits
5. **Configuration Testing**: Test configuration sets

## Test Environment

### Prerequisites
- AWS CLI configured with cliadmin profile
- SES account sending enabled
- Verified email addresses
- Proper IAM permissions

### Test Data Setup
- Test email addresses
- Sample email content
- Configuration set for testing
- CloudWatch alarms for monitoring 