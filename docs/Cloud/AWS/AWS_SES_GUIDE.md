# AWS SES (Simple Email Service) Guide

## What is AWS SES?

AWS SES (Simple Email Service) is a cloud-based email sending service designed to help digital marketers and application developers send marketing, notification, and transactional emails. It provides a reliable, cost-effective service for building bulk and transactional email-sending capabilities into any application.

### Key Features:
- **High Deliverability**: Built on the reliable, scalable infrastructure that Amazon.com developed to serve its own customer base
- **Cost-Effective**: Pay only for what you use, with no minimum fees or setup costs
- **Easy Integration**: Simple API that can be integrated into any application
- **Scalable**: Can handle any volume of email sending
- **Monitoring**: Built-in monitoring and analytics

## How SES is Used in Chatterbox

### Email Architecture Overview

Chatterbox uses a **hybrid email architecture**:

1. **Gmail API for Receiving**: Polls Gmail for incoming emails using OAuth2 authentication
2. **AWS SES for Sending**: Sends AI-generated responses using AWS SES

### Why Not Use Gmail API for Both?

**Gmail API Limitations:**
- **Rate Limits**: Gmail API has strict rate limits (250 units/second, 1 billion units/day)
- **Quota Restrictions**: Limited to 10,000 API calls per day for free accounts
- **Authentication Complexity**: Requires OAuth2 tokens that expire and need refresh
- **No Bulk Sending**: Not designed for high-volume email sending

**AWS SES Advantages:**
- **Higher Limits**: 50,000 emails/day in sandbox, unlimited in production
- **Better Deliverability**: Professional email infrastructure
- **Cost-Effective**: $0.10 per 1,000 emails
- **Reliable**: Built on Amazon's infrastructure
- **Monitoring**: CloudWatch integration for delivery tracking

## SES Setup Process

### 1. Initial Setup (Get Started Phase)

When you first access SES in the AWS Console, you'll see a "Get Started" screen. This is the initial setup phase.

**Manual Console Setup Required:**
- Navigate to AWS SES Console
- Click "Get Started"
- Review and accept the terms
- SES account is now initialized

**Automated CLI Setup:**
```bash
# Run the SES setup script
npm run aws:setup:ses
```

### 2. Account Configuration

**Sandbox Mode (Default):**
- Only verified email addresses can receive emails
- Limited to 200 emails/day
- Perfect for development and testing

**Production Mode (Request Required):**
- Can send to any email address
- Higher sending limits
- Requires AWS support ticket approval

### 3. Email Verification

**Why Verification is Required:**
- Prevents spam and abuse
- Ensures email deliverability
- Required in sandbox mode
- Best practice even in production

**Verification Process:**
1. Email address is submitted for verification
2. AWS sends verification email with link
3. User clicks link to verify ownership
4. Email address becomes verified in SES

## Email Verification Requirements

### Required Email Addresses

The system extracts email addresses from `config.json`:

```json
{
  "app": {
    "defaultPollGmailUser": "user@gmail.com",
    "defaultSendGmailUser": "sender@gmail.com", 
    "defaultGetGmailUser": "getter@gmail.com"
  },
  "sendTest": {
    "defaultRecipient": "recipient@gmail.com"
  }
}
```

### Verification Status Check

**Check verification status:**
```bash
npm run aws:check:ses
```

**Output example:**
```
✅ awsamram@gmail.com - VERIFIED
❌ amram.dworkin@gmail.com - NOT VERIFIED
```

### Verification Process

**Send verification emails:**
```bash
npm run aws:verify:emails
```

**Automated verification (with polling):**
```bash
npm run aws:setup:ses
```

## SES Scripts and Commands

### Setup and Verification Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `setup-ses.sh` | `npm run aws:setup:ses` | Complete SES setup and verification |
| `verify-ses-emails.sh` | `npm run aws:verify:emails` | Send verification emails |
| `check-ses-status.sh` | `npm run aws:check:ses` | Check verification status |

### Cleanup Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `cleanup-ses.sh` | `npm run aws:cleanup:ses` | Remove verified emails and disable SES |

### Build Integration

**Deployment Scripts:**
- `deploy-complete.sh`: Includes SES setup as Step 1.75
- `aws-build.js`: Includes SES setup as Step 3

**Teardown Scripts:**
- `teardown.sh`: Includes SES cleanup as Step 14

## SES Teardown Process

### What Gets Removed

1. **Verified Email Addresses**: All email addresses are removed from SES
2. **Account Sending**: SES account sending is disabled
3. **Return to Get Started**: SES returns to initial "Get Started" state

### Teardown Commands

**Standalone SES cleanup:**
```bash
npm run aws:cleanup:ses
```

**Complete infrastructure teardown:**
```bash
cd Cloud/AWS/terraform-simple
./teardown.sh
```

### Teardown Verification

After teardown:
- SES console shows "Get Started" screen
- No verified email addresses remain
- Account sending is disabled
- Ready for fresh setup

## SES Integration with Build Process

### Automated Build Steps

1. **Infrastructure Deployment** (Terraform)
2. **SES Setup and Verification** (CLI scripts)
3. **Secrets and Parameters** (Node.js scripts)
4. **Testing and Validation**

### Build Scripts

**Complete deployment:**
```bash
npm run aws:deploy:complete
```

**Step-by-step:**
```bash
npm run aws:deploy:init -- <init-folder>
npm run aws:setup:ses
npm run aws:populate:secrets
```

### Failure Handling

**Verification Timeout:**
- Script polls for 10 minutes
- User can continue build with `BREAK_ON_FAILURE=false`
- Manual verification instructions provided

**SES Setup Issues:**
- Detects "Get Started" screen requirement
- Provides console navigation instructions
- Retries after manual setup

## SES Monitoring and Troubleshooting

### CloudWatch Integration

**Log Groups:**
- `/aws/ses/` - SES delivery logs
- `/aws/lambda/` - Lambda function logs

**Metrics:**
- Send attempts
- Bounces
- Complaints
- Delivery delays

### Common Issues

**1. Email Not Verified**
```
Error: Email address not verified
```
**Solution:** Run `npm run aws:verify:emails` and click verification link

**2. Sandbox Mode Limits**
```
Error: Sending quota exceeded
```
**Solution:** Request production access or verify more email addresses

**3. SES Not Set Up**
```
Error: SES account not initialized
```
**Solution:** Complete "Get Started" setup in AWS Console

### Debugging Commands

**Check SES status:**
```bash
npm run aws:check:ses
```

**Check sending quota:**
```bash
aws ses get-send-quota --region us-east-1 --profile cliadmin
```

**List verified identities:**
```bash
aws ses list-identities --identity-type EmailAddress --region us-east-1 --profile cliadmin
```

## SES Best Practices

### Security
- **Never hardcode credentials** in code
- **Use IAM roles** for Lambda functions
- **Store secrets** in AWS Secrets Manager
- **Monitor access** with CloudTrail

### Deliverability
- **Verify all sender addresses** before sending
- **Use consistent sender addresses**
- **Monitor bounce and complaint rates**
- **Request production access** for high volume

### Cost Optimization
- **Use sandbox mode** for development
- **Monitor sending quotas** to avoid overages
- **Clean up unused verified addresses**
- **Use CloudWatch alarms** for monitoring

## SES vs Gmail API Comparison

| Feature | AWS SES | Gmail API |
|---------|---------|-----------|
| **Sending Limits** | 50K/day (sandbox), unlimited (prod) | 10K API calls/day |
| **Rate Limits** | 14 emails/second | 250 units/second |
| **Cost** | $0.10/1K emails | Free (with limits) |
| **Authentication** | IAM roles/keys | OAuth2 tokens |
| **Deliverability** | High (Amazon infrastructure) | Good (Google infrastructure) |
| **Monitoring** | CloudWatch integration | Limited |
| **Bulk Sending** | Designed for it | Not optimized |
| **Setup Complexity** | Simple | Complex OAuth2 flow |

## SES Configuration Files

### Terraform Configuration

**SES Module** (`Cloud/AWS/terraform/modules/ses/`):
- Email identity verification
- Account sending configuration
- CloudWatch alarms

### Environment Variables

**Required for SES:**
```bash
AWS_REGION=us-east-1
AWS_PROFILE=cliadmin
ENVIRONMENT=development
```

### Configuration Files

**`config.json`:**
- Email addresses for verification
- Sender/recipient configuration
- Test email settings

## SES Testing

### Test Email Sending

**Send test email:**
```bash
npm run mail:send:test
```

**Verify delivery:**
- Check recipient inbox
- Monitor CloudWatch logs
- Check SES console metrics

### Load Testing

**Sandbox limits:**
- 200 emails/day
- 14 emails/second
- Only verified addresses

**Production testing:**
- Higher limits available
- Any recipient address
- Monitor bounce rates

## SES Migration and Backup

### Backup Strategy

**Verified Email Addresses:**
- Stored in `config.json`
- Can be re-verified after teardown
- No permanent backup needed

**SES Configuration:**
- Terraform state tracks configuration
- IAM roles and policies preserved
- CloudWatch logs retained

### Migration Process

**Development to Production:**
1. Request production access
2. Update environment variables
3. Re-run setup scripts
4. Test with production limits

**Account Migration:**
1. Export verified addresses
2. Update `config.json`
3. Re-verify in new account
4. Update IAM roles and policies

## Conclusion

AWS SES provides a robust, scalable email sending solution for the Chatterbox system. The hybrid architecture (Gmail API for receiving, SES for sending) offers the best of both worlds: reliable email polling with high-volume, cost-effective sending capabilities.

The automated setup and teardown processes ensure consistent deployment and cleanup, while the comprehensive monitoring and validation scripts help maintain system reliability and deliverability. 