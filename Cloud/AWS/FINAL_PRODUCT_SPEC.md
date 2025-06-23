# Final Product Specification - Chatterbox AWS Infrastructure

## Overview

This document specifies the complete AWS infrastructure deployment for the Chatterbox application, including all resources, configurations, data sources, and operational procedures. This represents the final state after successful deployment and migration.

## Infrastructure Components

### 1. Network Infrastructure (VPC)

**Resource**: `vpc-06259608776abe095`

**Configuration**:
- **CIDR Block**: `10.0.0.0/16`
- **Availability Zones**: 2 (us-east-1a, us-east-1b)
- **Subnets**:
  - Public Subnets: `10.0.1.0/24`, `10.0.2.0/24`
  - Private Subnets: `10.0.10.0/24`, `10.0.11.0/24`
- **NAT Gateways**: 2 (one per AZ for high availability)
- **VPC Endpoints**: S3, DynamoDB, Secrets Manager, SSM
- **Internet Gateway**: 1
- **Route Tables**: 4 (2 public, 2 private)

**Purpose**: Provides isolated, secure network environment with private connectivity to AWS services.

### 2. Data Storage (DynamoDB)

**Resource**: `chatterbox-state`

**Configuration**:
- **Billing Mode**: On-demand
- **Primary Key**: `id` (String)
- **Global Secondary Indexes**:
  - `email-index`: Partition key `email` (String)
  - `timestamp-index`: Partition key `timestamp` (String)
- **Encryption**: AES-256 (AWS managed)
- **Point-in-Time Recovery**: Enabled
- **Auto-scaling**: Enabled

**Data Structure**:
```json
{
  "id": "unique-identifier",
  "email": "user@example.com",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "last_history_id": "12345",
    "last_polled_email": "user@example.com",
    "total_poll_cycles": 100,
    "state": {
      "status": "active",
      "last_updated": "2024-01-01T00:00:00Z"
    }
  }
}
```

**Purpose**: Primary storage for application state, email polling data, and user session information.

### 3. Object Storage (S3)

**Resources**:
- **Data Bucket**: `chatterbox-data`
- **Backup Bucket**: `chatterbox-backups`

**Configuration**:
- **Versioning**: Enabled
- **Encryption**: AES-256 (AWS managed)
- **Lifecycle Policies**:
  - Data Bucket: Transition to IA after 30 days, Glacier after 90 days
  - Backup Bucket: Transition to IA after 7 days, Glacier after 30 days
- **Access Control**: Private (no public access)
- **Cross-Region Replication**: Disabled (can be enabled for DR)

**Purpose**: 
- Data Bucket: Application data, attachments, logs
- Backup Bucket: Automated backups, disaster recovery

### 4. Secrets Management (Secrets Manager)

**Resources**:
- **Gmail Tokens**: `chatterbox/gmail-tokens`
- **OpenAI API Key**: `chatterbox/openai-api-key`
- **Google Credentials**: `chatterbox/google-credentials`

**Configuration**:
- **Encryption**: AES-256 (AWS managed)
- **Rotation**: Manual (can be automated)
- **Access Control**: IAM role-based
- **Versioning**: Enabled

**Data Sources**:
- **Gmail Tokens**: Migrated from `tokens/gmail_tokens.json`
- **OpenAI API Key**: Migrated from `.env` file
- **Google Credentials**: Migrated from `tokens/google_credentials.json`

**Purpose**: Secure storage of sensitive credentials and API keys.

### 5. Configuration Management (Parameter Store)

**Resource**: `/chatterbox/*`

**Configuration**:
- **Encryption**: AES-256 (AWS managed)
- **Tier**: Standard
- **Versioning**: Enabled

**Parameters**:
- `/chatterbox/environment`: `development`
- `/chatterbox/aws_region`: `us-east-1`
- `/chatterbox/application_version`: `1.0.0`
- `/chatterbox/features/enabled`: `gmail,openai,aws`

**Purpose**: Centralized application configuration and feature flags.

### 6. Monitoring & Logging (CloudWatch)

**Resources**:
- **Log Group**: `/aws/chatterbox`
- **Dashboard**: `Chatterbox-Monitoring`
- **Alarms**: Multiple (errors, performance, costs)

**Configuration**:
- **Retention**: 30 days
- **Encryption**: AES-256 (AWS managed)
- **Metrics**: Custom application metrics
- **Alarms**: Email/SNS notifications

**Purpose**: Centralized logging, monitoring, and alerting.

### 7. Security (IAM)

**Resources**:
- **Role**: `development-chatterbox-role`
- **Policy**: `ChatterboxApplicationPolicy`

**Configuration**:
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

### Migration Process

1. **Secrets Migration**: Used `npm run aws:migrate:secrets`
2. **Data Migration**: Manual migration of state data to DynamoDB
3. **Configuration Migration**: Parameters stored in SSM Parameter Store
4. **Validation**: All resources tested with `npm run aws:test:all`

## Application Integration

### TypeScript Utilities

**File**: `src/utils/awsSecrets.ts`

**Functionality**:
- AWS Secrets Manager integration
- Automatic credential retrieval
- Fallback to local storage for development
- Error handling and retry logic

**Usage**:
```typescript
import { getSecret } from './utils/awsSecrets';

// Get Gmail tokens
const gmailTokens = await getSecret('chatterbox/gmail-tokens');

// Get OpenAI API key
const openaiKey = await getSecret('chatterbox/openai-api-key');
```

### Configuration Loading

**File**: `src/loadConfig.ts`

**Functionality**:
- Environment-based configuration
- AWS service endpoint resolution
- Fallback mechanisms for local development
- Parameter Store integration

## Operational Procedures

### Daily Operations

1. **Monitoring**: Check CloudWatch dashboard for alerts
2. **Logs**: Review application logs in CloudWatch
3. **Backups**: Verify DynamoDB and S3 backups
4. **Costs**: Monitor AWS billing and usage

### Maintenance Procedures

1. **Secret Rotation**: Use `npm run aws:rotate:secrets`
2. **Backup Verification**: Test restore procedures monthly
3. **Security Updates**: Review IAM policies quarterly
4. **Performance Tuning**: Monitor and adjust DynamoDB capacity

### Disaster Recovery

1. **Data Recovery**: Use DynamoDB point-in-time recovery
2. **Infrastructure Recovery**: Use Terraform to recreate resources
3. **Secrets Recovery**: Use Secrets Manager versioning
4. **Configuration Recovery**: Use Parameter Store versioning

## Security Posture

### Network Security
- ✅ VPC isolation with private subnets
- ✅ Security groups with minimal required access
- ✅ VPC endpoints for private AWS service access
- ✅ No public internet access for private resources

### Data Security
- ✅ Encryption at rest (AES-256)
- ✅ Encryption in transit (TLS 1.2+)
- ✅ IAM least-privilege access
- ✅ Secrets Manager for sensitive data
- ✅ Parameter Store for configuration

### Access Control
- ✅ Role-based access control (RBAC)
- ✅ Temporary credentials with expiration
- ✅ Audit logging via CloudTrail
- ✅ Multi-factor authentication (MFA) recommended

## Cost Structure

### Monthly Estimated Costs (Development)

| Service | Estimated Cost | Billing Model |
|---------|----------------|---------------|
| DynamoDB | $5-15 | On-demand (pay per request) |
| S3 | $2-5 | Pay per GB stored |
| Secrets Manager | $1.20 | $0.40 per secret per month |
| CloudWatch | $3-8 | Logs + metrics + alarms |
| VPC | $0 | No additional charges |
| Parameter Store | $0 | Standard tier included |
| **Total** | **$11-29** | **Monthly** |

### Cost Optimization

1. **DynamoDB**: Use on-demand billing for variable workloads
2. **S3**: Implement lifecycle policies for cost-effective storage
3. **CloudWatch**: Set appropriate log retention periods
4. **Monitoring**: Use CloudWatch alarms for cost alerts

## Performance Characteristics

### DynamoDB
- **Read Capacity**: Auto-scaling based on demand
- **Write Capacity**: Auto-scaling based on demand
- **Latency**: < 10ms for single-digit millisecond reads
- **Throughput**: Unlimited with on-demand billing

### S3
- **Availability**: 99.99% (SLA)
- **Durability**: 99.999999999% (11 9's)
- **Latency**: < 100ms for standard operations
- **Throughput**: 3,500 PUT/COPY/POST/DELETE requests per second

### Secrets Manager
- **Availability**: 99.9% (SLA)
- **Latency**: < 100ms for API calls
- **Throughput**: 10,000 requests per second per region

## Monitoring and Alerting

### CloudWatch Dashboard

**Metrics Monitored**:
- DynamoDB: Read/Write capacity, throttled requests, errors
- S3: Request counts, errors, data transfer
- Application: Custom metrics, error rates
- Costs: Billing and usage metrics

### Alarms Configured

1. **DynamoDB Throttling**: Alert when read/write capacity is exceeded
2. **S3 Errors**: Alert on 4xx/5xx errors
3. **Secrets Manager Access**: Alert on failed secret access
4. **Cost Threshold**: Alert when monthly costs exceed budget
5. **Application Errors**: Alert on high error rates

## Backup and Recovery

### Backup Strategy

1. **DynamoDB**: Point-in-time recovery (35 days)
2. **S3**: Object versioning + lifecycle policies
3. **Secrets**: Automatic versioning in Secrets Manager
4. **Configuration**: Versioning in Parameter Store
5. **Terraform State**: Stored in S3 with versioning

### Recovery Procedures

1. **Data Recovery**: Use DynamoDB console or CLI
2. **Infrastructure Recovery**: Use Terraform apply
3. **Secrets Recovery**: Use Secrets Manager console
4. **Configuration Recovery**: Use Parameter Store console

## Compliance and Governance

### Data Protection
- ✅ Encryption at rest and in transit
- ✅ Access logging and audit trails
- ✅ Data retention policies
- ✅ Secure credential management

### Operational Compliance
- ✅ Infrastructure as Code (Terraform)
- ✅ Version control for all configurations
- ✅ Automated testing and validation
- ✅ Documentation and runbooks

## Future Enhancements

### Phase 2 Improvements
1. **Multi-Region Deployment**: Cross-region replication for DR
2. **Auto-scaling**: Application-level auto-scaling
3. **CI/CD Pipeline**: Automated deployment pipeline
4. **Advanced Monitoring**: Custom dashboards and metrics
5. **Cost Optimization**: Reserved capacity and spot instances

### Phase 3 Enhancements
1. **Microservices**: Break down into smaller services
2. **Containerization**: Docker and ECS/EKS deployment
3. **API Gateway**: Centralized API management
4. **CDN**: CloudFront for content delivery
5. **Advanced Security**: WAF, Shield, and GuardDuty

## Support and Maintenance

### Documentation
- ✅ Infrastructure setup guide
- ✅ Secrets migration guide
- ✅ Operational procedures
- ✅ Troubleshooting guide
- ✅ Final product specification

### Tools and Scripts
- ✅ NPM scripts for all operations
- ✅ Terraform modules for infrastructure
- ✅ Testing scripts for validation
- ✅ Migration scripts for data
- ✅ Monitoring and alerting setup

### Support Procedures
1. **Issue Reporting**: Use CloudWatch alarms and logs
2. **Escalation**: Defined escalation procedures
3. **Documentation**: Comprehensive runbooks
4. **Training**: Team training on AWS services

## Conclusion

This specification represents the complete, production-ready AWS infrastructure for the Chatterbox application. All components are deployed, tested, and operational with proper security, monitoring, and backup procedures in place. The infrastructure is designed for scalability, reliability, and cost-effectiveness while maintaining security best practices.

The migration from local storage to AWS services is complete, and the application is ready for production use with full cloud-native capabilities. 