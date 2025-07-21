#!/usr/bin/env node

/**
 * List Query IDs Script
 * 
 * This script retrieves all email query IDs from AWS DynamoDB
 * and groups them by status for easy reference.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Load configuration
let CONFIG;
try {
    CONFIG = require('../config.json');
} catch (error) {
    console.error('Error loading config.json:', error.message);
    process.exit(1);
}

// AWS Configuration
const TABLES = {
    EMAIL_QUERIES: 'chatterbox-email-queries',
};

const client = new DynamoDBClient({
    region: CONFIG.aws?.region || 'us-east-1',
    profile: CONFIG.aws?.profile,
});

const docClient = DynamoDBDocumentClient.from(client);

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

function colorize(color, text) {
    if (process.argv.includes('--no-color')) {
        return text;
    }
    return `${colors[color]}${text}${colors.reset}`;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function truncate(text, maxLength = 50) {
    if (!text) return 'N/A';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Group queries by status
 */
function groupQueriesByStatus(queries) {
    const groups = {
        pending: [],
        processing: [],
        sent: [],
        failed: [],
        unknown: []
    };

    queries.forEach(query => {
        const status = (query.status || 'unknown').toLowerCase();
        if (groups[status]) {
            groups[status].push(query);
        } else {
            groups.unknown.push(query);
        }
    });

    return groups;
}

/**
 * Display queries in a group
 */
function displayQueryGroup(groupName, queries, color) {
    if (queries.length === 0) {
        console.log(`   ${colorize('gray', 'No queries found')}`);
        return;
    }

    // Sort by creation date (newest first)
    const sortedQueries = queries.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    sortedQueries.forEach((query, index) => {
        const status = query.status || 'unknown';
        const statusColor = status === 'sent' ? 'magenta' :
                          status === 'failed' ? 'red' : 
                          status === 'processing' ? 'yellow' : 
                          status === 'pending' ? 'blue' : 'gray';
        
        console.log(`   ${index + 1}. ${colorize('cyan', query.queryId)}`);
        console.log(`      Status: ${colorize(statusColor, status.toUpperCase())}`);
        console.log(`      From: ${query.fromSender || 'N/A'}`);
        console.log(`      Subject: ${truncate(query.subject, 40)}`);
        console.log(`      User: ${query.userEmail || 'N/A'}`);
        console.log(`      Created: ${formatTimestamp(query.createdAt)}`);
        
        if (query.processedAt) {
            console.log(`      Processed: ${formatTimestamp(query.processedAt)}`);
        }
        
        if (query.errorMessage) {
            console.log(`      ${colorize('red', `Error: ${truncate(query.errorMessage, 60)}`)}`);
        }
        
        if (query.conversationId) {
            console.log(`      ${colorize('blue', `Conversation: ${query.conversationId}`)}`);
        }
        
        console.log('');
    });
}

/**
 * Display summary statistics
 */
function displaySummary(groups) {
    const total = Object.values(groups).reduce((sum, group) => sum + group.length, 0);
    
    console.log(colorize('bright', '\n📊 Summary Statistics:'));
    console.log('='.repeat(50));
    console.log(`Total Queries: ${colorize('cyan', total)}`);
    console.log(`Pending: ${colorize('blue', groups.pending.length)}`);
    console.log(`Processing: ${colorize('yellow', groups.processing.length)}`);
    console.log(`Sent: ${colorize('magenta', groups.sent.length)}`);
    console.log(`Failed: ${colorize('red', groups.failed.length)}`);
    
    if (groups.unknown.length > 0) {
        console.log(`Unknown Status: ${colorize('gray', groups.unknown.length)}`);
    }
    console.log('');
}

/**
 * Display only query IDs (for copy-paste)
 */
function displayQueryIdsOnly(groups) {
    console.log(colorize('bright', '\n📋 Query IDs by Status:'));
    console.log('='.repeat(50));
    
    Object.entries(groups).forEach(([status, queries]) => {
        if (queries.length > 0) {
            console.log(colorize('bright', `\n${status.toUpperCase()}:`));
            queries.forEach(query => {
                console.log(`  ${query.queryId}`);
            });
        }
    });
}

/**
 * Display only totals (no details)
 */
function displayTotalsOnly(groups) {
    const total = Object.values(groups).reduce((sum, group) => sum + group.length, 0);
    
    console.log(colorize('bright', '\n📊 Query Status Totals:'));
    console.log('='.repeat(50));
    console.log(`Total Queries: ${colorize('cyan', total)}`);
    console.log(`Pending: ${colorize('blue', groups.pending.length)}`);
    console.log(`Processing: ${colorize('yellow', groups.processing.length)}`);
    console.log(`Sent: ${colorize('magenta', groups.sent.length)}`);
    console.log(`Failed: ${colorize('red', groups.failed.length)}`);
    
    if (groups.unknown.length > 0) {
        console.log(`Unknown Status: ${colorize('gray', groups.unknown.length)}`);
    }
    console.log('');
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const showIdsOnly = args.includes('--ids-only');
    const showJson = args.includes('--json');
    const showTotalsOnly = args.includes('--totals-only');

    try {
        console.log(colorize('cyan', '\n🔍 Retrieving Query IDs from AWS...\n'));

        const result = await docClient.send(
            new ScanCommand({
                TableName: TABLES.EMAIL_QUERIES,
            })
        );

        if (!result.Items || result.Items.length === 0) {
            console.log(colorize('yellow', 'No email queries found in the system.'));
            return;
        }

        const groups = groupQueriesByStatus(result.Items);

        if (showJson) {
            // Output in JSON format
            console.log(JSON.stringify(groups, null, 2));
            return;
        }

        if (showTotalsOnly) {
            // Show only totals
            displayTotalsOnly(groups);
            return;
        }

        if (showIdsOnly) {
            // Show only query IDs for easy copy-paste
            displayQueryIdsOnly(groups);
            return;
        }

        // Display full information
        console.log(colorize('bright', '📧 Email Queries by Status:'));
        console.log('='.repeat(50));

        // Display each group
        if (groups.pending.length > 0) {
            console.log(colorize('bright', '\n⏳ PENDING QUERIES:'));
            console.log('-'.repeat(30));
            displayQueryGroup('pending', groups.pending, 'blue');
        }

        if (groups.processing.length > 0) {
            console.log(colorize('bright', '\n🔄 PROCESSING QUERIES:'));
            console.log('-'.repeat(30));
            displayQueryGroup('processing', groups.processing, 'yellow');
        }

        if (groups.sent.length > 0) {
            console.log(colorize('bright', '\n📤 SENT QUERIES:'));
            console.log('-'.repeat(30));
            displayQueryGroup('sent', groups.sent, 'magenta');
        }

        if (groups.failed.length > 0) {
            console.log(colorize('bright', '\n❌ FAILED QUERIES:'));
            console.log('-'.repeat(30));
            displayQueryGroup('failed', groups.failed, 'red');
        }

        if (groups.unknown.length > 0) {
            console.log(colorize('bright', '\n❓ UNKNOWN STATUS QUERIES:'));
            console.log('-'.repeat(30));
            displayQueryGroup('unknown', groups.unknown, 'gray');
        }

        // Display summary
        displaySummary(groups);

        // Show usage tips
        console.log(colorize('bright', '💡 Usage Tips:'));
        console.log('-'.repeat(30));
        console.log('• Use "npm run aws:query:ids --totals-only" to get just the totals');
        console.log('• Use "npm run aws:query:ids --ids-only" to get just the query IDs');
        console.log('• Use "npm run aws:query:ids --json" to get JSON output');
        console.log('• Copy query IDs to use with "npm run aws:response:pull query <id>"');
        console.log('• Use "npm run aws:response:pull list" for a simpler list view');

    } catch (error) {
        console.error(colorize('red', 'Error retrieving queries:'), error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    groupQueriesByStatus,
    displayQueryGroup,
    displaySummary,
    displayQueryIdsOnly,
}; 