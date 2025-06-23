# AWS Architecture Summary for Chatterbox

## Overview

This document summarizes the AWS infrastructure implementation for the Chatterbox application, providing a complete cloud-native solution for data storage, configuration management, and application deployment. The infrastructure is fully deployed and operational.

## Current Deployment Status

**Environment**: Development  
**Region**: us-east-1  
**Account ID**: 855581761117  
**Deployment Date**: June 2024  
**Status**: ✅ Fully Operational

## Architecture Components

### 1. Network Infrastructure (VPC)
- **VPC ID**: `vpc-06259608776abe095`
- **CIDR Block**: `10.0.0.0/16`
- **Availability Zones**: 2 (us-east-1a, us-east-1b)
- **Public Subnets**: `10.0.1.0/24`, `10.0.2.0/24`
- **Private Subnets**: `10.0.10.0/24`, `10.0.11.0/24`
- **NAT Gateways**: 2 (one per AZ for high availability)
- **VPC Endpoints**: S3, DynamoDB, Secrets Manager, SSM
- **Internet Gateway**: 1
- **Route Tables**: 4 (2 public, 2 private)

**Purpose**: Provides isolated, secure network environment with private connectivity to AWS services.

### 2. Data Storage (DynamoDB)
- **Table Name**: `chatterbox-state`
- **Billing Mode**: On-demand
- **Primary Key**: `id` (String)
- **Global Secondary Indexes**:
  - `email-index`: Partition key `email` (String)
  - `timestamp-index`: Partition key `timestamp` (String)
- **Encryption**: AES-256 (AWS managed)
- **Point-in-Time Recovery**: Enabled
- **Auto-scaling**: Enabled

**Purpose**: Primary storage for application state, email polling data, and user session information.

### 3. Object Storage (S3)
- **Data Bucket**: `chatterbox-data`
- **Backup Bucket**: `chatterbox-backups`
- **Versioning**: Enabled
- **Encryption**: AES-256 (AWS managed)
- **Lifecycle Policies**:
  - Data Bucket: Transition to IA after 30 days, Glacier after 90 days
  - Backup Bucket: Transition to IA after 7 days, Glacier after 30 days
- **Access Control**: Private (no public access)

**Purpose**: 
- Data Bucket: Application data, attachments, logs
- Backup Bucket: Automated backups, disaster recovery

### 4. Secrets Management (Secrets Manager)
- **Gmail Tokens**: `chatterbox/gmail-tokens` (Version 1 available)
- **OpenAI API Key**: `chatterbox/openai-api-key`
- **Google Credentials**: `chatterbox/google-credentials`
- **Encryption**: AES-256 (AWS managed)
- **Rotation**: Manual (can be automated)
- **Access Control**: IAM role-based
- **Versioning**: Enabled

**Purpose**: Secure storage of sensitive credentials and API keys.

### 5. Configuration Management (Parameter Store)
- **Prefix**: `/chatterbox`
- **Encryption**: AES-256 (AWS managed)
- **Tier**: Standard
- **Versioning**: Enabled
- **Parameters**:
  - `/chatterbox/environment`: `development`
  - `/chatterbox/aws_region`: `us-east-1`
  - `/chatterbox/application_version`: `1.0.0`
  - `/chatterbox/features/enabled`: `gmail,openai,aws`

**Purpose**: Centralized application configuration and feature flags.

### 6. Monitoring & Logging (CloudWatch)
- **Log Group**: `/aws/chatterbox`
- **Dashboard**: `Chatterbox-Monitoring`
- **Alarms**: Multiple (errors, performance, costs)
- **Retention**: 30 days
- **Encryption**: AES-256 (AWS managed)
- **Metrics**: Custom application metrics
- **Alarms**: Email/SNS notifications

**Purpose**: Centralized logging, monitoring, and alerting.

### 7. Security (IAM)
- **Role**: `development-chatterbox-role`
- **Role ARN**: `arn:aws:iam::855581761117:role/development-chatterbox-role`
- **Policy**: `ChatterboxApplicationPolicy`
- **Trust Policy**: EC2 instances and Lambda functions
- **Permissions**: Least privilege access to required services
- **Session Duration**: 1 hour (for temporary credentials)

**Purpose**: Secure access control for application resources.

## Data Migration Status

### Successfully Migrated

| Local File | AWS Service | Status | Notes |
|------------|-------------|--------|-------|
| `tokens/gmail_tokens.json` | Secrets Manager | ✅ Complete | Version 1 available |
| `.env` (OpenAI key) | Secrets Manager | ✅ Complete | API key stored |
| `tokens/google_credentials.json` | Secrets Manager | ✅ Complete | OAuth credentials stored |
| `config.json` | Parameter Store | ✅ Complete | Application config migrated |
| `data/state.json` | DynamoDB | ✅ Complete | Application state migrated |

### Migration Benefits

1. **Scalability**: Auto-scaling based on demand
2. **Reliability**: Multi-AZ deployment with automatic failover
3. **Security**: Encryption at rest and in transit
4. **Cost Optimization**: Pay-per-use pricing model
5. **Monitoring**: Centralized logging and alerting
6. **Backup**: Automated backup and recovery

## Configuration Updates

### Environment Variables (.env)
- AWS region and profile configuration
- Resource names and endpoints
- Environment-specific settings

### Application Config (config.json)
- AWS service endpoints
- Resource ARNs and names
- Environment indicators

### LoadConfig.ts Updates
- AWS configuration loading
- Environment-based endpoint selection
- Fallback to local storage for development

## Deployment Process

### 1. Infrastructure Setup
```bash
cd Cloud/AWS
npm run aws:setup
```

### 2. Configuration Update
- Update `config.json` with AWS resource names
- Set environment variables in `.env`
- Configure application for AWS services

### 3. Data Migration
- Migrate existing data from local files to AWS services
- Update application to use AWS endpoints
- Test functionality with cloud resources

### 4. Application Deployment
- Deploy application to use AWS services
- Configure monitoring and alerting
- Set up backup and recovery procedures

## Cost Considerations

### DynamoDB
- **On-Demand Billing**: Pay per request (recommended for variable workloads)
- **Provisioned Capacity**: Fixed pricing for predictable workloads
- **Storage**: $0.25 per GB-month
- **Requests**: $1.25 per million write requests, $0.25 per million read requests

### S3
- **Standard Storage**: $0.023 per GB-month
- **Standard-IA**: $0.0125 per GB-month (after 30 days)
- **Glacier**: $0.004 per GB-month (after 90 days)
- **Requests**: $0.0004 per 1,000 requests

### Secrets Manager
- **Storage**: $0.40 per secret per month
- **API Calls**: $0.05 per 10,000 API calls

### CloudWatch
- **Logs**: $0.50 per GB ingested
- **Metrics**: $0.30 per metric per month
- **Alarms**: $0.10 per alarm per month

## Security Features

### Network Security
- VPC isolation with private subnets
- Security groups and network ACLs
- VPC endpoints for private AWS service access

### Data Security
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.2+)
- IAM least-privilege access
- Secrets Manager for sensitive data

### Access Control
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Audit logging and monitoring

## Monitoring and Alerting

### CloudWatch Dashboard
- DynamoDB capacity and error metrics
- S3 storage and request metrics
- Application performance indicators
- Cost and usage monitoring

### Alarms
- DynamoDB throttling and errors
- S3 access and error monitoring
- Secrets Manager access monitoring
- Application error rate tracking

## Backup and Recovery

### DynamoDB
- Point-in-time recovery (35 days)
- On-demand backup capability
- Cross-region replication (optional)

### S3
- Object versioning
- Cross-region replication
- Lifecycle policies for cost optimization

### Configuration
- Parameter Store versioning
- Secrets Manager automatic rotation
- Terraform state backup in S3

## Available NPM Scripts

### Infrastructure Management
```bash
npm run aws:setup              # Complete setup
npm run aws:deploy             # Plan and show summary
npm run aws:deploy:auto        # Deploy automatically
npm run aws:validate           # Validate configuration
npm run aws:format             # Format Terraform code
npm run aws:plan               # Create deployment plan
npm run aws:apply              # Apply infrastructure
npm run aws:destroy            # Destroy infrastructure
```

### Testing and Validation
```bash
npm run aws:test:all           # Test all resources
npm run aws:test:vpc           # Test VPC
npm run aws:test:dynamodb      # Test DynamoDB
npm run aws:test:s3            # Test S3
npm run aws:test:secrets       # Test Secrets Manager
npm run aws:test:parameters    # Test Parameter Store
npm run aws:test:iam           # Test IAM
npm run aws:test:cloudwatch    # Test CloudWatch
```

### Secrets Management
```bash
npm run aws:migrate:secrets    # Migrate all secrets
npm run aws:update:secret      # Update individual secret
npm run aws:rotate:secrets     # Interactive rotation menu
npm run aws:secrets:status     # Check rotation status
```

### State Management
```bash
npm run aws:state:list         # List all resources
npm run aws:state:show         # Show current state
npm run aws:output             # Show outputs
npm run aws:output:json        # Show outputs as JSON
```

## Next Steps

### Phase 1: Infrastructure Deployment ✅ COMPLETE
1. ✅ Deploy AWS infrastructure using Terraform
2. ✅ Configure application for AWS services
3. ✅ Migrate existing data to cloud storage

### Phase 2: Application Updates
1. Update application code to use AWS SDK
2. Implement AWS service abstractions
3. Add error handling and retry logic

### Phase 3: Production Readiness
1. Multi-region deployment
2. Advanced monitoring and alerting
3. Automated backup and recovery
4. Performance optimization

## Documentation

- [Complete Setup Guide](README.md)
- [Secrets Migration Guide](SECRETS_MIGRATION.md)
- [Final Product Specification](FINAL_PRODUCT_SPEC.md)

## Support

For issues related to:
- **AWS Services**: Contact AWS Support
- **Terraform**: Check Terraform documentation and community forums
- **This Project**: Check the project repository issues 