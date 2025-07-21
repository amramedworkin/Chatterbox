# AWS Infrastructure Guide

## Overview

This document describes AWS infrastructure components in the Chatterbox system, including the SES email service integration.

## Infrastructure Components

### 1. Network Infrastructure (VPC)
- **Purpose**: Provides isolated, secure network environment
- **Components**: Public/private subnets, NAT gateways, VPC endpoints
- **Security**: Security groups, network ACLs, private connectivity

### 2. Email Service (SES)
- **Purpose**: Handles all outgoing email communication
- **Components**: Verified email addresses, configuration sets, sending limits
- **Integration**: CloudWatch monitoring, bounce/complaint handling
- **Setup**: Account sending enabled, production mode active

### 3. Data Storage (DynamoDB)
- **Purpose**: Primary application state and data storage
- **Features**: Auto-scaling, point-in-time recovery, encryption
- **Indexes**: Email and timestamp-based queries

### 4. Object Storage (S3)
- **Purpose**: Application data, backups, and file storage
- **Features**: Versioning, lifecycle policies, encryption
- **Buckets**: Data bucket and backup bucket

### 5. Secrets Management (Secrets Manager)
- **Purpose**: Secure storage of credentials and API keys
- **Features**: Encryption, rotation, versioning
- **Secrets**: Gmail tokens, OpenAI API key, Google credentials

### 6. Configuration Management (Parameter Store)
- **Purpose**: Centralized application configuration
- **Features**: Encryption, versioning, hierarchical organization
- **Parameters**: Environment settings, feature flags, service endpoints

### 7. Monitoring & Logging (CloudWatch)
- **Purpose**: Centralized monitoring and alerting
- **Features**: Logs, metrics, alarms, dashboards
- **Integration**: SES metrics, application performance monitoring

### 8. Security (IAM)
- **Purpose**: Access control and permissions management
- **Features**: Role-based access, least privilege, temporary credentials
- **Policies**: Service-specific permissions including SES

## Resource Dependencies

### SES Dependencies
- **IAM**: SES sending permissions required
- **CloudWatch**: For monitoring and alerting
- **VPC**: For private connectivity (optional)

### Application Dependencies
- **DynamoDB**: For state storage
- **S3**: For data and backup storage
- **Secrets Manager**: For credential access
- **Parameter Store**: For configuration access

## Deployment Strategies

### SES Deployment
1. **Account Setup**: Enable SES account sending
2. **Email Verification**: Verify sender email addresses
3. **Configuration Sets**: Create for monitoring and tracking
4. **IAM Permissions**: Grant SES sending permissions
5. **Testing**: Validate email sending functionality

### Infrastructure Deployment
1. **Terraform**: Infrastructure as code deployment
2. **Staged Rollout**: Development → Staging → Production
3. **Backup Strategy**: Automated backups and recovery
4. **Monitoring**: Comprehensive monitoring and alerting

## Scaling Considerations

### SES Scaling
- **Sending Limits**: 200/day (sandbox), 50,000/day (production)
- **Reputation Management**: Monitor bounce and complaint rates
- **Configuration Sets**: For advanced tracking and monitoring

### Application Scaling
- **DynamoDB**: Auto-scaling based on demand
- **S3**: Unlimited storage with lifecycle policies
- **Lambda**: Event-driven scaling

## Cost Optimization

### SES Costs
- **Sending**: $0.10 per 1,000 emails
- **Data Transfer**: Included in sending costs
- **Monitoring**: CloudWatch costs for metrics

### Infrastructure Costs
- **DynamoDB**: Pay-per-request or provisioned capacity
- **S3**: Tiered storage with lifecycle policies
- **CloudWatch**: Log ingestion and metric storage
- **Secrets Manager**: Per-secret monthly costs

## SES Integration

### Email Workflow
1. **Verification**: Email addresses must be verified
2. **Sending**: Use SES API to send emails
3. **Monitoring**: Track sending statistics and reputation
4. **Handling**: Process bounces and complaints

### Configuration
- **Configuration Sets**: For tracking and monitoring
- **Reputation Monitoring**: CloudWatch alarms for metrics
- **Bounce/Complaint Handling**: Automated processing
- **Sending Limits**: Monitor and request increases as needed 