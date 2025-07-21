# AWS Query IDs Script

The AWS Query IDs script provides a comprehensive view of all email queries in the system, grouped by their processing status.

## Overview

This script retrieves all email query IDs from AWS DynamoDB and organizes them by status:
- **Pending** - Queries waiting to be processed
- **Processing** - Queries currently being processed
- **Completed** - Successfully processed queries
- **Failed** - Queries that encountered errors
- **Unknown** - Queries with unrecognized status

## Quick Start

```bash
# Show all queries grouped by status
npm run aws:query:ids

# Show only query IDs (for copy-paste)
npm run aws:query:ids --ids-only

# Get JSON output
npm run aws:query:ids --json
```

## Features

### 📊 Grouped Display
Queries are automatically grouped by their processing status with color-coded indicators:
- 🔄 **Processing** (Yellow) - Currently being processed
- ⏳ **Pending** (Blue) - Waiting to be processed  
- ✅ **Completed** (Green) - Successfully processed
- ❌ **Failed** (Red) - Failed with errors
- ❓ **Unknown** (Gray) - Unrecognized status

### 📋 Detailed Information
For each query, the script displays:
- **Query ID** - Unique identifier
- **Status** - Current processing status
- **From** - Sender email address
- **Subject** - Email subject (truncated)
- **User** - Recipient email address
- **Created** - Creation timestamp
- **Processed** - Processing completion timestamp (if available)
- **Error Message** - Error details (if failed)
- **Conversation ID** - Associated conversation (if part of a conversation)

### 📈 Summary Statistics
The script provides a summary showing:
- Total number of queries
- Count by each status
- Quick overview of system activity

### 🎯 Query ID Extraction
The `--ids-only` option provides clean query IDs for easy copy-paste:
```bash
npm run aws:query:ids --ids-only
```

Output:
```
📋 Query IDs by Status:
==================================================

PROCESSING:
  16af0845-7621-49fc-82eb-739512996964
  00748949-f670-4385-a587-ac9385aedce3
  71bf5d5d-91dc-42e1-bb8c-c227add778ff
  ...
```

## Usage Examples

### Monitor System Health
```bash
# Check for stuck queries
npm run aws:query:ids

# Look for failed queries
npm run aws:query:ids | grep -A 10 "FAILED"
```

### Debug Specific Queries
```bash
# Get query IDs for detailed inspection
npm run aws:query:ids --ids-only

# Use a query ID to get details
npm run aws:response:pull query 16af0845-7621-49fc-82eb-739512996964
```

### Data Export
```bash
# Export to JSON for programmatic use
npm run aws:query:ids --json > queries.json

# Export just IDs to a file
npm run aws:query:ids --ids-only > query_ids.txt
```

## Menu Integration

The script is available in the main menu under:
**AWS State & Responses** → **Query IDs (Grouped by Status)**

This provides easy access without needing to remember the command syntax.

## Options

### `--ids-only`
Display only query IDs grouped by status, without detailed information.

### `--json`
Output results in JSON format for programmatic processing.

### `--no-color`
Disable colored output for better compatibility with scripts.

## Sample Output

```
🔍 Retrieving Query IDs from AWS...

📧 Email Queries by Status:
==================================================

🔄 PROCESSING QUERIES:
------------------------------
   1. b3a28b1b-4f85-49fe-959d-d058fc7f7532
      Status: PROCESSING
      From: amram.dworkin@gmail.com
      Subject: test title 0003
      User: awsamram@gmail.com
      Created: 7/9/2025, 9:42:46 AM
      Processed: 7/10/2025, 3:47:52 AM

   2. 6546cfe3-d022-4121-ab39-288c5c33e895
      Status: PROCESSING
      From: amram.dworkin@gmail.com
      Subject: test title 0002
      User: awsamram@gmail.com
      Created: 7/9/2025, 9:42:45 AM
      Processed: 7/10/2025, 3:47:52 AM

📊 Summary Statistics:
==================================================
Total Queries: 20
Pending: 0
Processing: 20
Completed: 0
Failed: 0

💡 Usage Tips:
------------------------------
• Use "npm run aws:query:ids --ids-only" to get just the query IDs
• Use "npm run aws:query:ids --json" to get JSON output
• Copy query IDs to use with "npm run aws:response:pull query <id>"
• Use "npm run aws:response:pull list" for a simpler list view
```

## Related Commands

- `npm run aws:response:pull list` - Simple list of recent queries
- `npm run aws:response:pull query <id>` - Get details of a specific query
- `npm run aws:response:pull failed` - Show only failed queries
- `npm run aws:response:pull pending` - Show only pending queries
- `npm run aws:state` - Complete AWS system state overview

## Troubleshooting

### No Queries Found
If the script shows "No email queries found":
- Check if AWS infrastructure is deployed
- Verify DynamoDB tables exist
- Confirm AWS credentials and region

### Access Denied
If you get access denied errors:
- Check IAM permissions for DynamoDB access
- Verify AWS profile configuration
- Ensure the email processing infrastructure is deployed

## Integration

This script can be integrated into:
- Monitoring dashboards
- CI/CD pipelines
- Automated reporting systems
- Debugging workflows

The JSON output option makes it easy to parse results programmatically for custom integrations. 