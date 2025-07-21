#!/usr/bin/env node
// scripts/clear-aws-data.js
// Clear AWS DynamoDB data with various filtering options

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Load configuration
let CONFIG;
try {
    CONFIG = require('../config.json');
} catch (error) {
    console.error('Error loading config.json:', error.message);
    process.exit(1);
}

// AWS configuration
const TABLES = {
    EMAIL_QUERIES: 'chatterbox-email-queries',
    CONVERSATIONS: 'chatterbox-conversations',
    GENERATED_RESPONSES: 'chatterbox-generated-responses',
    QUERY_RECORDS: 'chatterbox-query-records',
    USER_PROFILES: 'chatterbox-user-profiles',
};

const client = new DynamoDBClient({
    region: CONFIG.aws?.region || 'us-east-1',
    profile: CONFIG.aws?.profile,
});

const docClient = DynamoDBDocumentClient.from(client);

// Colors for console output
const colors = {
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    reset: '\x1b[0m',
};

// Valid status types
const VALID_STATUSES = ['pending', 'processing', 'sent', 'failed'];

/**
 * Colorize text
 */
function colorize(color, text) {
    return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Show help information
 */
function showHelp() {
    console.log(`
AWS Data Clear Script

Usage: node scripts/clear-aws-data.js [options]

Options:
  --all                    Clear all data from all tables
  --status=<status>        Clear data with specific status (pending, processing, sent, failed)
  --table=<table>          Clear data from specific table only
  --dry-run               Show what would be deleted without actually deleting
  --confirm               Skip confirmation prompt
  --quiet                 Suppress all console output except confirmations
  --what-if               Show what would be deleted without actually deleting
  --no-verbose            Suppress verbose output (default: verbose mode is ON)
  --help, -h              Show this help

Examples:
  # Clear all AWS data (requires confirmation)
  node scripts/clear-aws-data.js --all

  # Clear only pending queries
  node scripts/clear-aws-data.js --status=pending

  # Clear only failed queries
  node scripts/clear-aws-data.js --status=failed

  # Clear only processing queries
  node scripts/clear-aws-data.js --status=processing

  # Clear only sent queries
  node scripts/clear-aws-data.js --status=sent

  # Clear only email queries table
  node scripts/clear-aws-data.js --table=email-queries

  # Dry run to see what would be deleted
  node scripts/clear-aws-data.js --status=pending --dry-run

  # What-if mode (same as dry-run)
  node scripts/clear-aws-data.js --status=pending --what-if

  # Quiet mode (no prompts, no output)
  node scripts/clear-aws-data.js --status=pending --quiet

  # Non-verbose mode (minimal output)
  node scripts/clear-aws-data.js --status=pending --no-verbose

  # Skip confirmation prompt
  node scripts/clear-aws-data.js --status=pending --confirm

Available Tables:
  - email-queries (${TABLES.EMAIL_QUERIES})
  - conversations (${TABLES.CONVERSATIONS})
  - generated-responses (${TABLES.GENERATED_RESPONSES})
  - query-records (${TABLES.QUERY_RECORDS})
  - user-profiles (${TABLES.USER_PROFILES})

⚠️  WARNING: This will permanently delete data from AWS DynamoDB tables!
⚠️  WARNING: User profile deletion ALWAYS requires confirmation!
`);
}

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {
        all: false,
        status: null,
        table: null,
        dryRun: false,
        confirm: false,
        quiet: false,
        whatIf: false,
        verbose: true, // Default to verbose mode
    };

    for (const arg of args) {
        if (arg === '--all') {
            options.all = true;
        } else if (arg.startsWith('--status=')) {
            options.status = arg.split('=')[1];
        } else if (arg.startsWith('--table=')) {
            options.table = arg.split('=')[1];
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--confirm') {
            options.confirm = true;
        } else if (arg === '--quiet') {
            options.quiet = true;
        } else if (arg === '--what-if') {
            options.whatIf = true;
        } else if (arg === '--no-verbose') {
            options.verbose = false;
        } else if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }
    }

    return options;
}

/**
 * Validate status
 */
function validateStatus(status) {
    if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status: "${status}". Valid statuses are: ${VALID_STATUSES.join(', ')}`);
    }
}

/**
 * Get table name from alias
 */
function getTableName(tableAlias) {
    const tableMap = {
        'email-queries': TABLES.EMAIL_QUERIES,
        'conversations': TABLES.CONVERSATIONS,
        'generated-responses': TABLES.GENERATED_RESPONSES,
        'query-records': TABLES.QUERY_RECORDS,
        'user-profiles': TABLES.USER_PROFILES,
    };

    if (!tableMap[tableAlias]) {
        throw new Error(`Invalid table: "${tableAlias}". Valid tables are: ${Object.keys(tableMap).join(', ')}`);
    }

    return tableMap[tableAlias];
}

/**
 * Get tables to process
 */
function getTablesToProcess(options) {
    if (options.table) {
        return [getTableName(options.table)];
    }

    return Object.values(TABLES);
}

/**
 * Scan table for items
 */
async function scanTable(tableName, statusFilter = null) {
    try {
        const params = {
            TableName: tableName,
        };

        const items = [];
        let lastEvaluatedKey = undefined;

        do {
            if (lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }

            const result = await docClient.send(new ScanCommand(params));
            
            if (result && result.Items) {
                items.push(...result.Items);
            }
            
            lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        
        // Apply status filter in JavaScript if needed
        if (statusFilter && tableName === TABLES.EMAIL_QUERIES) {
            const filteredItems = items.filter(item => {
                const itemStatus = item.status?.S || item.status; // Handle both raw and marshalled formats
                return itemStatus === statusFilter;
            });
            return filteredItems;
        }
        
        return items;
    } catch (error) {
        console.error(colorize('red', `  Error scanning table ${tableName}: ${error.message}`));
        return [];
    }
}

/**
 * Delete items from table
 */
async function deleteItems(tableName, items, dryRun = false, quiet = false) {
    if (items.length === 0) {
        return 0;
    }

    if (dryRun) {
        if (!quiet) {
            console.log(colorize('yellow', `  Would delete ${items.length} items from ${tableName}`));
        }
        return 0;
    }

    let deletedCount = 0;
    const batchSize = 25; // DynamoDB batch delete limit

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const deleteRequests = [];
        
        // Filter out items with missing primary keys
        for (const item of batch) {
            try {
                const key = getPrimaryKey(tableName, item);
                deleteRequests.push({
                    DeleteRequest: { Key: key },
                });
            } catch (error) {
                if (!quiet) {
                    console.log(colorize('yellow', `  Skipping item with missing primary key: ${error.message}`));
                }
            }
        }

        if (deleteRequests.length === 0) {
            continue;
        }

        try {
            await docClient.send(new BatchWriteCommand({
                RequestItems: {
                    [tableName]: deleteRequests,
                },
            }));
            deletedCount += deleteRequests.length;
        } catch (error) {
            if (!quiet) {
                console.error(colorize('red', `  Error deleting batch: ${error.message}`));
            }
        }
    }

    return deletedCount;
}

/**
 * Get primary key for table
 */
function getPrimaryKey(tableName, item) {
    switch (tableName) {
        case TABLES.EMAIL_QUERIES:
            if (!item.queryId) {
                throw new Error(`Missing queryId for item in ${tableName}`);
            }
            return { queryId: item.queryId };
        case TABLES.CONVERSATIONS:
            if (!item.conversationId) {
                throw new Error(`Missing conversationId for item in ${tableName}`);
            }
            return { conversationId: item.conversationId };
        case TABLES.GENERATED_RESPONSES:
            if (!item.responseId) {
                throw new Error(`Missing responseId for item in ${tableName}`);
            }
            return { responseId: item.responseId };
        case TABLES.QUERY_RECORDS:
            if (!item.recordId) {
                throw new Error(`Missing recordId for item in ${tableName}`);
            }
            return { recordId: item.recordId };
        case TABLES.USER_PROFILES:
            if (!item.userEmail) {
                throw new Error(`Missing userEmail for item in ${tableName}`);
            }
            return { userEmail: item.userEmail };
        default:
            throw new Error(`Unknown table: ${tableName}`);
    }
}

/**
 * Get confirmation from user
 */
async function getConfirmation(options) {
    // User profile deletion always requires confirmation
    if (options.table === 'user-profiles' || options.table === TABLES.USER_PROFILES) {
        if (options.quiet) {
            console.log(colorize('red', '❌ User profile deletion cannot be performed in quiet mode. Confirmation required.'));
            return false;
        }
    } else if (options.confirm || options.quiet) {
        return true;
    }

    if (options.dryRun) {
        return true;
    }

    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        let message = colorize('red', '⚠️  WARNING: This will permanently delete data from AWS DynamoDB tables!\n');
        
        if (options.table === 'user-profiles' || options.table === TABLES.USER_PROFILES) {
            message += colorize('red', '🚨 CRITICAL: You are about to delete ALL USER PROFILE DATA!\n');
            message += colorize('red', 'This will permanently remove all user information and cannot be undone!\n');
        } else if (options.all) {
            message += colorize('yellow', 'You are about to delete ALL data from ALL tables.\n');
        } else if (options.status) {
            message += colorize('yellow', `You are about to delete all items with status "${options.status}".\n`);
        } else if (options.table) {
            message += colorize('yellow', `You are about to delete all data from table "${options.table}".\n`);
        }

        message += colorize('cyan', '\nType "DELETE" to confirm, or anything else to cancel: ');

        rl.question(message, (answer) => {
            rl.close();
            resolve(answer.trim() === 'DELETE');
        });
    });
}

/**
 * Get status message for clear operation
 */
function getStatusMessage(options) {
    if (options.all) {
        return "Clearing ALL data from ALL AWS resources";
    } else if (options.status) {
        return `Clearing ${options.status.toUpperCase()} items`;
    } else if (options.table) {
        return `Clearing data from ${options.table} table`;
    }
    return "Clearing data";
}

/**
 * Get verbose description for clear operation
 */
function getVerboseDescription(options) {
    if (options.all) {
        return `All data will be cleared from the following AWS resources:
  • DynamoDB Table: ${TABLES.EMAIL_QUERIES} (Email queries and their states)
  • DynamoDB Table: ${TABLES.CONVERSATIONS} (Conversation history and context)
  • DynamoDB Table: ${TABLES.GENERATED_RESPONSES} (AI-generated email responses)
  • DynamoDB Table: ${TABLES.QUERY_RECORDS} (Query processing records)
  • DynamoDB Table: ${TABLES.USER_PROFILES} (User profile information)`;
    } else if (options.status) {
        return `${options.status.toUpperCase()} items are stored in DynamoDB Table: ${TABLES.EMAIL_QUERIES} with the "status" field set to "${options.status}". These represent email queries that are currently in the ${options.status} state.`;
    } else if (options.table) {
        const tableDescriptions = {
            'email-queries': `${TABLES.EMAIL_QUERIES} contains all email queries and their processing states (pending, processing, sent, failed).`,
            'conversations': `${TABLES.CONVERSATIONS} contains conversation history and context for email threads.`,
            'generated-responses': `${TABLES.GENERATED_RESPONSES} contains AI-generated email responses and their metadata.`,
            'query-records': `${TABLES.QUERY_RECORDS} contains processing records and audit trails for email queries.`,
            'user-profiles': `${TABLES.USER_PROFILES} contains user profile information and preferences. WARNING: This will delete ALL user data!`
        };
        return tableDescriptions[options.table] || `DynamoDB Table: ${getTableName(options.table)}`;
    }
    return "Data will be cleared from AWS DynamoDB tables.";
}

/**
 * Main function
 */
async function main() {
    try {
        const options = parseArguments();

        // Validate options
        if (!options.all && !options.status && !options.table) {
            console.error(colorize('red', 'Error: Must specify --all, --status, or --table'));
            showHelp();
            process.exit(1);
        }

        if (options.status) {
            validateStatus(options.status);
        }

        // Handle what-if mode (same as dry-run)
        if (options.whatIf) {
            options.dryRun = true;
        }

        // Show what will be done (unless quiet mode)
        if (!options.quiet) {
            console.log(colorize('cyan', '🔍 AWS Data Clear Script'));
            console.log(colorize('cyan', '='.repeat(50)));

            if (options.dryRun) {
                console.log(colorize('yellow', '🧪 DRY RUN MODE - No data will be deleted'));
            }

            // Show status message
            const statusMessage = getStatusMessage(options);
            console.log(colorize('blue', `📋 ${statusMessage}`));

            // Show verbose description if enabled
            if (options.verbose) {
                const verboseDescription = getVerboseDescription(options);
                console.log(colorize('gray', `\nℹ️  ${verboseDescription}\n`));
            }
        } else if (options.whatIf) {
            // For what-if mode, show verbose output even in quiet mode
            console.log(colorize('cyan', '🔍 AWS Data Clear Script'));
            console.log(colorize('cyan', '='.repeat(50)));
            console.log(colorize('yellow', '🧪 DRY RUN MODE - No data will be deleted'));

            // Show status message
            const statusMessage = getStatusMessage(options);
            console.log(colorize('blue', `📋 ${statusMessage}`));

            // Show verbose description
            const verboseDescription = getVerboseDescription(options);
            console.log(colorize('gray', `\nℹ️  ${verboseDescription}\n`));
        }

        // Get confirmation (unless quiet mode or dry run)
        const confirmed = await getConfirmation(options);
        if (!confirmed) {
            if (!options.quiet) {
                console.log(colorize('green', '✅ Operation cancelled'));
            }
            return;
        }

        // Get tables to process
        const tables = getTablesToProcess(options);
        if (!options.quiet) {
            console.log(colorize('blue', `\n📋 Processing tables: ${tables.join(', ')}`));
        }

        let totalDeleted = 0;
        const tableStats = {};

        // Process each table
        for (const tableName of tables) {
            if (!options.quiet) {
                console.log(colorize('blue', `\n📊 Processing table: ${tableName}`));
            }

            try {
                // Scan for items
                const items = await scanTable(tableName, options.status);
                if (!options.quiet) {
                    console.log(colorize('gray', `  Found ${items.length} items`));
                }

                if (items.length === 0) {
                    if (!options.quiet) {
                        console.log(colorize('gray', '  No items to delete'));
                    }
                    continue;
                }

                // Delete items
                const deletedCount = await deleteItems(tableName, items, options.dryRun, options.quiet);
                totalDeleted += deletedCount;
                tableStats[tableName] = { found: items.length, deleted: deletedCount };

                if (!options.dryRun && !options.quiet) {
                    console.log(colorize('green', `  ✅ Deleted ${deletedCount} items`));
                }

            } catch (error) {
                if (!options.quiet) {
                    console.error(colorize('red', `  ❌ Error processing table ${tableName}: ${error.message}`));
                }
            }
        }

        // Summary (always show in quiet mode)
        if (!options.quiet) {
            console.log(colorize('cyan', '\n📊 Summary'));
            console.log(colorize('cyan', '='.repeat(50)));

            if (options.dryRun) {
                console.log(colorize('yellow', '🧪 DRY RUN - No data was actually deleted'));
            } else {
                console.log(colorize('green', `✅ Total items deleted: ${totalDeleted}`));
            }

            console.log(colorize('blue', '\nTable Statistics:'));
            for (const [tableName, stats] of Object.entries(tableStats)) {
                const status = options.dryRun ? 'would delete' : 'deleted';
                console.log(colorize('gray', `  ${tableName}: ${stats.found} found, ${stats.deleted} ${status}`));
            }
        } else {
            // Quiet mode - just show the total
            if (options.dryRun) {
                console.log(`Would delete ${totalDeleted} items`);
            } else {
                console.log(`Deleted ${totalDeleted} items`);
            }
        }

    } catch (error) {
        if (!options.quiet) {
            console.error(colorize('red', `❌ Error: ${error.message}`));
        }
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, parseArguments, validateStatus }; 