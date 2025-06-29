# AWS Infrastructure Teardown

This document describes the comprehensive AWS infrastructure teardown capability for the Chatterbox project.

## Overview

The AWS teardown system provides a safe, interactive way to completely remove AWS infrastructure components. It includes multiple confirmation levels and comprehensive warnings to prevent accidental data loss.

## Features

### Interactive Environment Selection
- **Checkbox Interface**: Select specific environments to teardown
- **Status Display**: Shows deployment status for each environment
- **VPC Infrastructure**: Separate option for shared VPC infrastructure
- **Flexible Selection**: Choose any combination of environments

### Comprehensive Warnings
- **Critical Warning Display**: Prominent warnings about data loss
- **Resource Listing**: Shows exactly what will be destroyed
- **Multiple Confirmations**: Multiple confirmation steps required
- **Final Confirmation**: Must type "DESTROY" to proceed

### Safe Destruction Process
- **Prerequisites Check**: Validates AWS CLI and Terraform installation
- **Credential Validation**: Ensures AWS credentials are configured
- **State File Management**: Automatic cleanup of Terraform state files
- **Progress Reporting**: Detailed progress during teardown

## Usage

### Basic Usage
```bash
# Interactive teardown
npm run aws:teardown

# Direct script execution
node scripts/aws-teardown.js
```

### Help
```bash
# Show help information
node scripts/aws-teardown.js --help
```

## Environment Options

### Available Environments
- **Development**: Development environment resources
- **Staging**: Staging environment resources  
- **Production**: Production environment resources
- **VPC Infrastructure**: Shared networking infrastructure

### Environment Resources
Each environment includes:
- DynamoDB Tables
- S3 Buckets
- Secrets Manager Secrets
- Parameter Store Parameters
- CloudWatch Log Groups
- IAM Roles and Policies

### VPC Infrastructure
Shared infrastructure includes:
- VPC and Subnets
- Internet Gateway
- Route Tables
- Security Groups
- Network ACLs
- VPC Endpoints

## Teardown Process

### 1. Prerequisites Check
- Validates AWS CLI installation
- Validates Terraform installation
- Validates AWS credentials configuration

### 2. Warning Display
- Shows critical warning about data loss
- Lists all resources that will be destroyed
- Emphasizes irreversible nature of operation

### 3. Environment Selection
- Interactive checkbox interface
- Shows deployment status for each environment
- Allows selection of VPC infrastructure

### 4. Confirmation Process
- **First Confirmation**: General confirmation prompt
- **Final Confirmation**: Must type "DESTROY" to proceed
- **Resource Summary**: Shows selected resources for destruction

### 5. Destruction Execution
- **Environment Teardown**: Destroys selected environments
- **VPC Teardown**: Destroys VPC infrastructure if selected
- **Progress Reporting**: Real-time progress updates
- **Error Handling**: Graceful error handling and reporting

### 6. Cleanup
- **State File Cleanup**: Removes Terraform state files
- **Summary Report**: Shows success/failure statistics
- **Next Steps**: Provides guidance for post-teardown actions

## Safety Features

### Multiple Confirmation Levels
1. **Initial Warning**: Comprehensive warning display
2. **Selection Confirmation**: Confirm selected environments
3. **Final Confirmation**: Type "I WISH TO DELETE" to proceed

### Comprehensive Warnings
- **Data Loss Warning**: Emphasizes permanent data loss
- **Resource Listing**: Shows exactly what will be destroyed
- **No Recovery Warning**: Clear statement about irreversibility
- **No Backup Warning**: Clarifies no automatic backups

### Prerequisites Validation
- **Tool Validation**: Ensures required tools are installed
- **Credential Validation**: Validates AWS access
- **State Validation**: Checks current infrastructure state

## Error Handling

### Graceful Failure
- **Individual Failures**: Continues with other environments if one fails
- **Error Reporting**: Clear error messages for each failure
- **Partial Success**: Reports partial success statistics
- **Manual Cleanup**: Guidance for manual cleanup if needed

### Recovery Options
- **State File Preservation**: State files preserved on failure
- **Manual Cleanup**: Instructions for manual AWS Console cleanup
- **Re-run Capability**: Can re-run teardown for failed components

## Post-Teardown Actions

### Verification
- **AWS Console Check**: Verify resources are removed
- **State File Check**: Confirm state files are cleaned up
- **Cost Verification**: Check AWS billing for cleanup

### Cleanup
- **User Removal**: Consider removing AWS user if no longer needed
- **Documentation Update**: Update project documentation
- **Credential Cleanup**: Remove AWS credentials if no longer needed

## Examples

### Teardown All Environments
```bash
npm run aws:teardown
# Select all environments and VPC infrastructure
# Confirm destruction
# Type "I WISH TO DELETE" to proceed
```

### Teardown Specific Environment
```bash
npm run aws:teardown
# Select only development environment
# Confirm destruction
# Type "I WISH TO DELETE" to proceed
```

### Teardown VPC Only
```bash
npm run aws:teardown
# Select only VPC infrastructure
# Confirm destruction
# Type "I WISH TO DELETE" to proceed
```

## Security Considerations

### Access Control
- **IAM Permissions**: Requires appropriate AWS permissions
- **Profile Usage**: Uses 'cliadmin' AWS profile
- **Credential Validation**: Validates credentials before execution

### Data Protection
- **No Backup Creation**: Does not create backups automatically
- **Permanent Deletion**: All data is permanently deleted
- **No Recovery**: No built-in recovery mechanism

## Troubleshooting

### Common Issues

#### Prerequisites Not Met
```
❌ AWS CLI is not installed or not in PATH
❌ Terraform is not installed or not in PATH
❌ AWS credentials not configured or invalid
```
**Solution**: Install required tools and configure AWS credentials

#### Permission Errors
```
❌ Failed to destroy environment: Access Denied
```
**Solution**: Ensure AWS user has appropriate permissions

#### State File Issues
```
❌ Failed to destroy environment: State file not found
```
**Solution**: Check if environment was previously deployed

### Manual Cleanup
If teardown fails, manual cleanup may be required:
1. **AWS Console**: Use AWS Console to manually delete resources
2. **State Files**: Manually remove Terraform state files
3. **IAM Cleanup**: Remove IAM roles and policies manually

## Best Practices

### Before Teardown
- **Backup Data**: Create manual backups if needed
- **Verify Selection**: Double-check environment selection
- **Team Coordination**: Coordinate with team members
- **Documentation**: Document current state before teardown

### During Teardown
- **Monitor Progress**: Watch for any error messages
- **Don't Interrupt**: Allow process to complete
- **Note Failures**: Document any failed components

### After Teardown
- **Verify Cleanup**: Check AWS Console for remaining resources
- **Update Documentation**: Update project documentation
- **Clean Credentials**: Remove AWS credentials if no longer needed
- **Cost Verification**: Verify AWS billing reflects cleanup

## Integration

### CI/CD Integration
The teardown script can be integrated into CI/CD pipelines:
```bash
# Automated teardown (use with caution)
npm run aws:teardown --non-interactive
```

### Script Integration
The teardown script can be called from other scripts:
```javascript
const { execSync } = require('child_process');
execSync('npm run aws:teardown', { stdio: 'inherit' });
```

## Support

For issues with the teardown process:
1. **Check Prerequisites**: Ensure all tools are installed
2. **Verify Credentials**: Check AWS credential configuration
3. **Review Logs**: Check Terraform logs for detailed errors
4. **Manual Cleanup**: Use AWS Console for manual cleanup if needed

## Related Documentation

- [AWS Infrastructure Setup](README.md)
- [Environment Management](ENVIRONMENT_MANAGEMENT.md)
- [Secrets Migration](SECRETS_MIGRATION.md)
- [Terraform Configuration](terraform/README.md) 