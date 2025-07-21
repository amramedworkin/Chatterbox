# AWS Response Puller

The AWS Response Puller is a command-line tool that allows you to retrieve and display email queries, responses, and conversation history from the Chatterbox AWS system.

## Overview

This tool connects to AWS DynamoDB tables to retrieve:
- Email queries and their processing status
- Generated responses and metadata
- Conversation history and context
- Failed queries and error messages
- Pending queries awaiting processing

## Quick Start

```bash
# Show help
npm run aws:response:pull help

# List recent email queries
npm run aws:response:pull list

# Show details of a specific query
npm run aws:response:pull query <queryId>

# Show conversation history
npm run aws:response:pull conversation <conversationId>
```

## Commands

### `list [limit]`
List recent email queries with their status and basic information.

**Options:**
- `limit` - Number of queries to display (default: 10)

**Example:**
```bash
npm run aws:response:pull list 20
```

**Output:**
```
📧 Listing 20 recent email queries...

1. Query ID: 83cabd36-1f46-4253-b129-74a7e78b1104
   Status: PROCESSING
   From: amram.dworkin@gmail.com
   Subject: test title 0001
   User: awsamram@gmail.com
   Created: 7/9/2025, 9:42:45 AM
   Processed: 7/10/2025, 3:47:52 AM
```

### `query <queryId>`
Show detailed information about a specific email query.

**Parameters:**
- `queryId` - The unique identifier of the query

**Example:**
```bash
npm run aws:response:pull query 83cabd36-1f46-4253-b129-74a7e78b1104
```

**Output:**
```
🔍 Query Details: 83cabd36-1f46-4253-b129-74a7e78b1104

📧 Email Query Details
==================================================
Query ID: 83cabd36-1f46-4253-b129-74a7e78b1104
Status: PROCESSING
Gmail ID: 197dbcf11a7b2b77
User Email: awsamram@gmail.com
From: amram.dworkin@gmail.com
Subject: test title 0001
Query Type: standalone
Model: gpt-4o
Created: 7/9/2025, 9:42:45 AM
Processed: 7/10/2025, 3:47:52 AM

📝 Email Body:
------------------------------
What is the definition of quantum froth? Does it exist? How did we
find it or are we still looking to verify its existence?
```

### `conversation <conversationId>`
Display conversation history and context.

**Parameters:**
- `conversationId` - The unique identifier of the conversation

**Example:**
```bash
npm run aws:response:pull conversation conv-xyz789
```

**Output:**
```
💬 Conversation: conv-xyz789

Conversation Details
==================================================
Conversation ID: conv-xyz789
User Email: awsamram@gmail.com
Model: gpt-4o
Created: 7/9/2025, 9:42:45 AM
Last Updated: 7/10/2025, 3:47:52 AM
Total Cost: $0.0123
Total Tokens: 1250
Message Count: 4

💬 Messages:
------------------------------

1. 👤 User
   Time: 7/9/2025, 9:42:45 AM
   Content: What is quantum entanglement?

2. 🤖 Assistant
   Time: 7/9/2025, 9:43:12 AM
   Cost: $0.0034
   Tokens: 450
   Content: Quantum entanglement is a phenomenon where two or more particles...
```

### `latest [count]`
Show the most recent completed responses.

**Options:**
- `count` - Number of responses to display (default: 5)

**Example:**
```bash
npm run aws:response:pull latest 3
```

### `failed`
Display all failed queries with their error messages.

**Example:**
```bash
npm run aws:response:pull failed
```

### `pending`
Show all queries that are currently pending processing.

**Example:**
```bash
npm run aws:response:pull pending
```

## Options

### `--json`
Output results in JSON format instead of formatted text.

### `--verbose`
Show detailed information including all metadata fields.

### `--no-color`
Disable colored output for better compatibility with scripts.

## Data Structure

The tool connects to two main DynamoDB tables:

### Email Queries (`chatterbox-email-queries`)
Stores email queries and their processing status:

- `queryId` - Unique identifier
- `gmailId` - Gmail message ID
- `userEmail` - User's email address
- `fromSender` - Sender's email address
- `subject` - Email subject
- `body` - Email content
- `status` - Processing status (pending, processing, completed, failed)
- `createdAt` - Creation timestamp
- `processedAt` - Processing completion timestamp
- `errorMessage` - Error details (if failed)
- `conversationId` - Associated conversation (if part of a conversation)
- `modelName` - AI model used
- `costEstimate` - Estimated processing cost
- `tokenCount` - Token usage

### Conversations (`chatterbox-conversations`)
Stores conversation history and context:

- `conversationId` - Unique conversation identifier
- `userEmail` - User's email address
- `modelName` - AI model used
- `messages` - Array of conversation messages
- `createdAt` - Conversation creation timestamp
- `lastUpdated` - Last message timestamp
- `totalCost` - Total conversation cost
- `totalTokens` - Total token usage

## Use Cases

### Monitoring System Health
```bash
# Check for failed queries
npm run aws:response:pull failed

# Check pending queries
npm run aws:response:pull pending

# Monitor recent activity
npm run aws:response:pull list 10
```

### Debugging Issues
```bash
# Get details of a specific query
npm run aws:response:pull query <queryId>

# Check conversation context
npm run aws:response:pull conversation <conversationId>
```

### Cost Analysis
```bash
# View latest responses with cost information
npm run aws:response:pull latest 20
```

### Data Export
```bash
# Export data in JSON format
npm run aws:response:pull list 100 --json > queries.json
```

## Troubleshooting

### AWS Credentials
Ensure your AWS credentials are properly configured:
- AWS CLI profile set up
- Appropriate permissions for DynamoDB access
- Correct AWS region configured

### Common Issues

**"No email queries found"**
- Check if the AWS infrastructure is deployed
- Verify DynamoDB tables exist
- Confirm AWS credentials and region

**"Access denied"**
- Check IAM permissions for DynamoDB access
- Verify AWS profile configuration

**"Table not found"**
- Ensure the email processing infrastructure is deployed
- Check table names in AWS console

## Integration

This tool can be integrated into monitoring scripts, CI/CD pipelines, or automated reporting systems. The JSON output option makes it easy to parse results programmatically.

## Related Commands

- `npm run aws:lambda:generate` - Test response generation
- `npm run aws:validate` - Validate AWS infrastructure
- `npm run aws:state` - Check AWS system state 