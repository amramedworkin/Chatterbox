#!/usr/bin/env node

/**
 * Pull AWS Response Script
 * 
 * This script retrieves email queries and their responses from AWS DynamoDB
 * and displays them on the console. It can:
 * - List recent email queries
 * - Show details of a specific query by ID
 * - Display conversation history
 * - Show response content and metadata
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const path = require('path');

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
    CONVERSATIONS: 'chatterbox-conversations',
};

const client = new DynamoDBClient({
    region: CONFIG.aws?.region || 'us-east-1',
    profile: CONFIG.aws?.profile,
});

const docClient = DynamoDBDocumentClient.from(client);

/**
 * Display help information
 */
function showHelp() {
    console.log(`
🔍 AWS Response Puller - Chatterbox

Usage: node scripts/pull-aws-response.js [command] [options]

Commands:
  list [limit]                    List recent email queries (default: 10)
  query <queryId>                 Show details of a specific query
  conversation <conversationId>   Show conversation history
  latest [count]                  Show latest responses (default: 5)
  failed                          Show failed queries
  pending                         Show pending queries
  help                            Show this help message

Examples:
  node scripts/pull-aws-response.js list 20
  node scripts/pull-aws-response.js query abc123-def456
  node scripts/pull-aws-response.js conversation conv-xyz789
  node scripts/pull-aws-response.js latest 3
  node scripts/pull-aws-response.js failed
  node scripts/pull-aws-response.js pending

Options:
  --json                          Output in JSON format
  --verbose                       Show detailed information
  --no-color                      Disable colored output
`);
}

/**
 * Colorize console output
 */
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

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

/**
 * Truncate text for display
 */
function truncate(text, maxLength = 100) {
    if (!text) return 'N/A';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * List recent email queries
 */
async function listQueries(limit = 10) {
    try {
        console.log(colorize('cyan', `\n📧 Listing ${limit} recent email queries...\n`));

        const result = await docClient.send(
            new ScanCommand({
                TableName: TABLES.EMAIL_QUERIES,
                Limit: limit,
            })
        );

        if (!result.Items || result.Items.length === 0) {
            console.log(colorize('yellow', 'No email queries found.'));
            return;
        }

        // Sort by creation date (newest first)
        const sortedItems = result.Items.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        sortedItems.forEach((item, index) => {
            const status = item.status || 'unknown';
            const statusColor = status === 'completed' ? 'green' : 
                              status === 'failed' ? 'red' : 
                              status === 'processing' ? 'yellow' : 'gray';
            
            console.log(colorize('bright', `${index + 1}. Query ID: ${item.queryId}`));
            console.log(`   Status: ${colorize(statusColor, status.toUpperCase())}`);
            console.log(`   From: ${item.fromSender || 'N/A'}`);
            console.log(`   Subject: ${truncate(item.subject, 60)}`);
            console.log(`   User: ${item.userEmail || 'N/A'}`);
            console.log(`   Created: ${formatTimestamp(item.createdAt)}`);
            console.log(`   Processed: ${formatTimestamp(item.processedAt)}`);
            
            if (item.errorMessage) {
                console.log(`   ${colorize('red', `Error: ${truncate(item.errorMessage, 80)}`)}`);
            }
            
            if (item.conversationId) {
                console.log(`   ${colorize('blue', `Conversation: ${item.conversationId}`)}`);
            }
            
            console.log('');
        });

    } catch (error) {
        console.error(colorize('red', 'Error listing queries:'), error.message);
    }
}

/**
 * Show details of a specific query
 */
async function showQuery(queryId) {
    try {
        console.log(colorize('cyan', `\n🔍 Query Details: ${queryId}\n`));

        const result = await docClient.send(
            new GetCommand({
                TableName: TABLES.EMAIL_QUERIES,
                Key: { queryId },
            })
        );

        if (!result.Item) {
            console.log(colorize('red', 'Query not found.'));
            return;
        }

        const query = result.Item;
        const status = query.status || 'unknown';
        const statusColor = status === 'sent' ? 'magenta' : 
                          status === 'failed' ? 'red' : 
                          status === 'processing' ? 'yellow' : 'gray';

        console.log(colorize('bright', '📧 Email Query Details'));
        console.log('='.repeat(50));
        console.log(`Query ID: ${colorize('cyan', query.queryId)}`);
        console.log(`Status: ${colorize(statusColor, status.toUpperCase())}`);
        console.log(`Gmail ID: ${query.gmailId || 'N/A'}`);
        console.log(`User Email: ${query.userEmail || 'N/A'}`);
        console.log(`From: ${query.fromSender || 'N/A'}`);
        console.log(`Subject: ${query.subject || 'N/A'}`);
        console.log(`Query Type: ${query.queryType || 'N/A'}`);
        console.log(`Model: ${query.modelName || 'N/A'}`);
        console.log(`Created: ${formatTimestamp(query.createdAt)}`);
        console.log(`Processed: ${formatTimestamp(query.processedAt)}`);
        
        if (query.conversationId) {
            console.log(`Conversation ID: ${colorize('blue', query.conversationId)}`);
        }

        if (query.costEstimate) {
            console.log(`Cost Estimate: $${query.costEstimate.toFixed(4)}`);
        }

        if (query.tokenCount) {
            console.log(`Token Count: ${query.tokenCount}`);
        }

        if (query.errorMessage) {
            console.log(colorize('red', `\n❌ Error: ${query.errorMessage}`));
        }

        console.log(colorize('bright', '\n📝 Email Body:'));
        console.log('-'.repeat(30));
        console.log(query.body || 'No body content');

        if (query.attachments && query.attachments.length > 0) {
            console.log(colorize('bright', '\n📎 Attachments:'));
            console.log('-'.repeat(30));
            query.attachments.forEach((attachment, index) => {
                console.log(`${index + 1}. ${attachment.filename} (${attachment.mimeType}, ${attachment.size} bytes)`);
            });
        }

        // If this is part of a conversation, show conversation context
        if (query.conversationId) {
            console.log(colorize('bright', '\n💬 Conversation Context:'));
            console.log('-'.repeat(30));
            await showConversation(query.conversationId, true);
        }

    } catch (error) {
        console.error(colorize('red', 'Error retrieving query:'), error.message);
    }
}

/**
 * Show conversation history
 */
async function showConversation(conversationId, brief = false) {
    try {
        if (!brief) {
            console.log(colorize('cyan', `\n💬 Conversation: ${conversationId}\n`));
        }

        const result = await docClient.send(
            new GetCommand({
                TableName: TABLES.CONVERSATIONS,
                Key: { conversationId },
            })
        );

        if (!result.Item) {
            if (!brief) {
                console.log(colorize('red', 'Conversation not found.'));
            }
            return;
        }

        const conversation = result.Item;

        if (!brief) {
            console.log(colorize('bright', 'Conversation Details'));
            console.log('='.repeat(50));
            console.log(`Conversation ID: ${colorize('cyan', conversation.conversationId)}`);
            console.log(`User Email: ${conversation.userEmail || 'N/A'}`);
            console.log(`Model: ${conversation.modelName || 'N/A'}`);
            console.log(`Created: ${formatTimestamp(conversation.createdAt)}`);
            console.log(`Last Updated: ${formatTimestamp(conversation.lastUpdated)}`);
            console.log(`Total Cost: $${conversation.totalCost?.toFixed(4) || '0.0000'}`);
            console.log(`Total Tokens: ${conversation.totalTokens || 0}`);
            console.log(`Message Count: ${conversation.messages?.length || 0}`);
        }

        if (conversation.messages && conversation.messages.length > 0) {
            if (!brief) {
                console.log(colorize('bright', '\n💬 Messages:'));
                console.log('-'.repeat(30));
            }

            conversation.messages.forEach((message, index) => {
                const role = message.role === 'user' ? '👤 User' : '🤖 Assistant';
                const roleColor = message.role === 'user' ? 'blue' : 'green';
                
                if (!brief) {
                    console.log(colorize('bright', `\n${index + 1}. ${colorize(roleColor, role)}`));
                    console.log(`   Time: ${formatTimestamp(message.timestamp)}`);
                    if (message.gmailId) {
                        console.log(`   Gmail ID: ${message.gmailId}`);
                    }
                    if (message.cost) {
                        console.log(`   Cost: $${message.cost.toFixed(4)}`);
                    }
                    if (message.tokens) {
                        console.log(`   Tokens: ${message.tokens}`);
                    }
                    console.log(`   Content: ${message.content}`);
                } else {
                    console.log(`   ${colorize(roleColor, role)}: ${truncate(message.content, 80)}`);
                }
            });
        } else {
            if (!brief) {
                console.log(colorize('yellow', 'No messages in conversation.'));
            }
        }

    } catch (error) {
        console.error(colorize('red', 'Error retrieving conversation:'), error.message);
    }
}

/**
 * Show latest responses
 */
async function showLatestResponses(count = 5) {
    try {
        console.log(colorize('cyan', `\n🕒 Latest ${count} responses...\n`));

        const result = await docClient.send(
            new ScanCommand({
                TableName: TABLES.EMAIL_QUERIES,
                FilterExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':status': 'sent',
                },
            })
        );

        if (!result.Items || result.Items.length === 0) {
            console.log(colorize('yellow', 'No sent responses found.'));
            return;
        }

        // Sort by processed date (newest first)
        const sortedItems = result.Items
            .filter(item => item.processedAt)
            .sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt))
            .slice(0, count);

        sortedItems.forEach((item, index) => {
            console.log(colorize('bright', `${index + 1}. ${truncate(item.subject, 50)}`));
            console.log(`   Query ID: ${colorize('cyan', item.queryId)}`);
            console.log(`   From: ${item.fromSender || 'N/A'}`);
            console.log(`   User: ${item.userEmail || 'N/A'}`);
            console.log(`   Processed: ${formatTimestamp(item.processedAt)}`);
            console.log(`   Model: ${item.modelName || 'N/A'}`);
            
            if (item.costEstimate) {
                console.log(`   Cost: $${item.costEstimate.toFixed(4)}`);
            }
            
            console.log('');
        });

    } catch (error) {
        console.error(colorize('red', 'Error retrieving latest responses:'), error.message);
    }
}

/**
 * Show failed queries
 */
async function showFailedQueries() {
    try {
        console.log(colorize('cyan', '\n❌ Failed Queries\n'));

        const result = await docClient.send(
            new ScanCommand({
                TableName: TABLES.EMAIL_QUERIES,
                FilterExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':status': 'failed',
                },
            })
        );

        if (!result.Items || result.Items.length === 0) {
            console.log(colorize('green', 'No failed queries found.'));
            return;
        }

        // Sort by creation date (newest first)
        const sortedItems = result.Items.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        sortedItems.forEach((item, index) => {
            console.log(colorize('bright', `${index + 1}. ${truncate(item.subject, 50)}`));
            console.log(`   Query ID: ${colorize('cyan', item.queryId)}`);
            console.log(`   From: ${item.fromSender || 'N/A'}`);
            console.log(`   User: ${item.userEmail || 'N/A'}`);
            console.log(`   Created: ${formatTimestamp(item.createdAt)}`);
            console.log(`   ${colorize('red', `Error: ${truncate(item.errorMessage, 80)}`)}`);
            console.log('');
        });

    } catch (error) {
        console.error(colorize('red', 'Error retrieving failed queries:'), error.message);
    }
}

/**
 * Show pending queries
 */
async function showPendingQueries() {
    try {
        console.log(colorize('cyan', '\n⏳ Pending Queries\n'));

        const result = await docClient.send(
            new ScanCommand({
                TableName: TABLES.EMAIL_QUERIES,
                FilterExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':status': 'pending',
                },
            })
        );

        if (!result.Items || result.Items.length === 0) {
            console.log(colorize('green', 'No pending queries found.'));
            return;
        }

        // Sort by creation date (newest first)
        const sortedItems = result.Items.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        sortedItems.forEach((item, index) => {
            console.log(colorize('bright', `${index + 1}. ${truncate(item.subject, 50)}`));
            console.log(`   Query ID: ${colorize('cyan', item.queryId)}`);
            console.log(`   From: ${item.fromSender || 'N/A'}`);
            console.log(`   User: ${item.userEmail || 'N/A'}`);
            console.log(`   Created: ${formatTimestamp(item.createdAt)}`);
            console.log(`   Query Type: ${item.queryType || 'N/A'}`);
            console.log(`   Model: ${item.modelName || 'N/A'}`);
            console.log('');
        });

    } catch (error) {
        console.error(colorize('red', 'Error retrieving pending queries:'), error.message);
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || command === 'help' || command === '--help' || command === '-h') {
        showHelp();
        return;
    }

    try {
        switch (command) {
            case 'list':
                const limit = parseInt(args[1]) || 10;
                await listQueries(limit);
                break;

            case 'query':
                const queryId = args[1];
                if (!queryId) {
                    console.error(colorize('red', 'Error: Query ID is required.'));
                    console.log('Usage: node scripts/pull-aws-response.js query <queryId>');
                    process.exit(1);
                }
                await showQuery(queryId);
                break;

            case 'conversation':
                const conversationId = args[1];
                if (!conversationId) {
                    console.error(colorize('red', 'Error: Conversation ID is required.'));
                    console.log('Usage: node scripts/pull-aws-response.js conversation <conversationId>');
                    process.exit(1);
                }
                await showConversation(conversationId);
                break;

            case 'latest':
                const count = parseInt(args[1]) || 5;
                await showLatestResponses(count);
                break;

            case 'failed':
                await showFailedQueries();
                break;

            case 'pending':
                await showPendingQueries();
                break;

            default:
                console.error(colorize('red', `Unknown command: ${command}`));
                showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error(colorize('red', 'Script error:'), error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    listQueries,
    showQuery,
    showConversation,
    showLatestResponses,
    showFailedQueries,
    showPendingQueries,
};