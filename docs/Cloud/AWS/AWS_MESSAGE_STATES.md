# AWS Message States

This document provides detailed information about all the possible states that an email message can be in within the Chatterbox AWS system.

## Overview

Email messages in the Chatterbox system progress through a series of states as they are processed by the AWS infrastructure. Understanding these states is crucial for monitoring system health, debugging issues, and ensuring proper message flow.

## Message State Lifecycle

```
📧 Email Received
    ↓
⏳ PENDING (Queued for processing)
    ↓
🔄 PROCESSING (AI processing in progress)
    ↓
📤 SENT (Response delivered to originator)
    ↓
❌ FAILED (Error occurred at any stage)
```

## Detailed State Descriptions

### ⏳ PENDING

**Status Code**: `pending`  
**Description**: The email has been received and queued for processing but has not yet been picked up by the processing system.

**When it occurs**:
- Email is first received by the email processor
- Message is stored in DynamoDB with initial metadata
- Waiting to be picked up by the response generator

**What happens in this state**:
- Email content is parsed and stored
- Attachments are processed and stored in S3
- Basic metadata is extracted (sender, recipient, subject, etc.)
- Query ID is generated
- Initial timestamp is recorded

**Database fields populated**:
- `queryId` - Unique identifier
- `gmailId` - Gmail message ID
- `userEmail` - Recipient email
- `fromSender` - Sender email
- `subject` - Email subject
- `body` - Email content
- `attachments` - Array of attachment metadata
- `receivedDate` - When email was received
- `createdAt` - When record was created
- `status` - Set to "pending"

**Typical duration**: 0-30 seconds  
**Next state**: PROCESSING  
**Error handling**: If not picked up within 5 minutes, may indicate system issues

---

### 🔄 PROCESSING

**Status Code**: `processing`  
**Description**: The email is actively being processed by the AI system to generate a response.

**When it occurs**:
- Response generator Lambda picks up the pending message
- AI processing begins
- OpenAI API calls are being made

**What happens in this state**:
- Email content is analyzed by the AI model
- Context is built from conversation history (if applicable)
- Response generation is in progress
- Cost and token usage is being tracked
- Processing timestamp is updated

**Database fields updated**:
- `status` - Changed to "processing"
- `processedAt` - Updated with current timestamp
- `modelName` - AI model being used
- `costEstimate` - Estimated processing cost
- `tokenCount` - Token usage

**Typical duration**: 10-60 seconds (depends on response complexity)  
**Next state**: SENT or FAILED  
**Error handling**: If processing takes longer than 2 minutes, may indicate API issues

---

### 📤 SENT

**Status Code**: `sent`  
**Description**: The AI has successfully generated a response and it has been delivered back to the original email sender.

**When it occurs**:
- AI response generation is successful
- Response email is sent via Gmail API
- Delivery confirmation is received
- Message lifecycle is complete

**What happens in this state**:
- Generated response is stored in the system
- Response email is sent to the originator
- Gmail delivery confirmation is received
- Cost and token information is finalized
- Final delivery timestamp is recorded
- Message is marked as fully processed

**Database fields updated**:
- `status` - Changed to "sent"
- `responseContent` - Generated AI response
- `finalCost` - Actual processing cost
- `finalTokens` - Actual token usage
- `responseGeneratedAt` - When response was created
- `sentAt` - When response was delivered
- `gmailResponseId` - Gmail message ID of the sent response
- `deliveryStatus` - Confirmation of successful delivery
- `errorMessage` - Cleared if previously set

**Typical duration**: 5-15 seconds  
**Next state**: None (final state)  
**Error handling**: If sending fails, may retry or move to FAILED state

---

### ❌ FAILED

**Status Code**: `failed`  
**Description**: An error occurred during any stage of the message processing, preventing successful completion.

**When it occurs**:
- Processing errors during any stage
- API failures (OpenAI, Gmail)
- System errors or timeouts
- Invalid message format
- Authentication failures

**What happens in this state**:
- Error details are recorded
- Processing is halted
- Error message is stored for debugging
- Message may be retried depending on error type

**Database fields updated**:
- `status` - Changed to "failed"
- `errorMessage` - Detailed error description
- `errorCode` - Specific error code
- `failedAt` - When the error occurred
- `retryCount` - Number of retry attempts (if applicable)

**Error types and handling**:
- **Transient errors** (API timeouts, rate limits): May be retried
- **Permanent errors** (invalid content, auth failures): No retry
- **System errors** (database issues, Lambda failures): May be retried

**Typical duration**: Immediate (when error occurs)  
**Next state**: May be retried or remain failed  
**Recovery**: Manual intervention may be required for permanent failures

---

## State Transitions and Rules

### Valid State Transitions

```
PENDING → PROCESSING
PENDING → FAILED (if immediate error)

PROCESSING → SENT
PROCESSING → FAILED

SENT → (final state)

FAILED → PROCESSING (if retried)
FAILED → (final state if permanent)
```

### State Transition Rules

1. **One-way progression**: States generally progress forward (PENDING → PROCESSING → SENT)
2. **Error handling**: Any state can transition to FAILED if an error occurs
3. **Retry logic**: FAILED state can transition back to PROCESSING for retry attempts
4. **Final states**: SENT and permanent FAILED are final states
5. **No backward progression**: SENT cannot go back to PROCESSING

## Monitoring and Debugging

### State-Specific Monitoring

#### PENDING State
- **Monitor**: Queue depth and processing delays
- **Alert**: If messages stay pending > 5 minutes
- **Debug**: Check Lambda function health and DynamoDB connectivity

#### PROCESSING State
- **Monitor**: Processing time and API response times
- **Alert**: If processing takes > 2 minutes
- **Debug**: Check OpenAI API status and Lambda function performance

#### SENT State
- **Monitor**: Delivery success rate and delivery time
- **Alert**: If delivery fails or takes > 30 seconds
- **Debug**: Check Gmail API quotas and authentication

#### FAILED State
- **Monitor**: Failure rate and error types
- **Alert**: If failure rate > 5% or specific error patterns
- **Debug**: Check error messages and system logs

### Query Examples

#### Find Stuck Messages
```bash
# Messages stuck in processing
npm run aws:response:pull list | grep "PROCESSING"

# Messages stuck in pending
npm run aws:response:pull pending

# Failed messages
npm run aws:response:pull failed
```

#### Monitor State Distribution
```bash
# Get state distribution
npm run aws:query:ids

# Get summary statistics
npm run aws:query:ids --totals-only

# Get summary statistics in JSON
npm run aws:query:ids --json | jq '.[] | length'
```

## Implementation Notes

### Current System Implementation

The system now properly tracks the SENT state:

1. **SENT state tracking**: After successful Gmail send, status is updated to 'sent'
2. **Delivery confirmation**: Gmail API provides delivery confirmation
3. **State transition logging**: Status changes are logged for audit purposes
4. **Retry logic**: Smart retry with exponential backoff for transient failures

### State Management Code

```javascript
// After successful Gmail send
await updateQueryStatus(queryId, 'sent');

// Verify email was delivered
const deliveryStatus = await verifyEmailDelivery(gmailResponseId);

// Log state changes
await logStateTransition(queryId, oldStatus, newStatus, reason);
```

## Troubleshooting Guide

### Common Issues by State

#### PENDING → No Transition
- **Cause**: Lambda function not running or DynamoDB issues
- **Solution**: Check Lambda function health and DynamoDB connectivity

#### PROCESSING → Stuck
- **Cause**: OpenAI API issues or Lambda timeout
- **Solution**: Check OpenAI API status and Lambda timeout settings

#### PROCESSING → No SENT
- **Cause**: Gmail API issues or authentication problems
- **Solution**: Check Gmail API quotas and OAuth tokens

#### High FAILED Rate
- **Cause**: System-wide issues or configuration problems
- **Solution**: Check system logs and configuration

### Debugging Commands

```bash
# Check current state distribution
npm run aws:query:ids --totals-only

# Get details of a specific message
npm run aws:response:pull query <queryId>

# Check for stuck messages
npm run aws:response:pull list | grep -E "(PROCESSING|PENDING)"

# Monitor recent activity
npm run aws:response:pull latest 10
```

## Related Documentation

- [AWS Response Puller](./AWS_RESPONSE_PULLER.md) - How to retrieve and display message states
- [AWS Query IDs](./AWS_QUERY_IDS.md) - How to list and group messages by state
- [Lambda Flow Guide](./AWS_LAMBDA_FLOW_README.md) - Technical details of message processing
- [AWS Infrastructure Guide](./AWS_INFRASTRUCTURE_GUIDE.md) - System architecture overview 