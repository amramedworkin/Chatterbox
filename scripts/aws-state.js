#!/usr/bin/env node

/**
 * AWS System State Script
 * Provides comprehensive overview of the current state of the Chatterbox AWS system
 *
 * Shows:
 * - Email processing statistics (pending, completed, failed)
 * - Polling information (last poll, poll ID, interval)
 * - Gmail user configuration
 * - System health and performance metrics
 * - Resource utilization
 */

const chalk = require('chalk');
const {
    DynamoDBClient,
    QueryCommand, // eslint-disable-line no-unused-vars
    ScanCommand,
} = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const {
    S3Client,
    HeadObjectCommand, // eslint-disable-line no-unused-vars
    ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { SQSClient, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { LambdaClient, GetFunctionConfigurationCommand } = require('@aws-sdk/client-lambda');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

// AWS Clients
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });
const ssmClient = new SSMClient({ region: 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });
const cloudwatchClient = new CloudWatchLogsClient({ region: 'us-east-1' });
const lambdaClient = new LambdaClient({ region: 'us-east-1' });
const stsClient = new STSClient({ region: 'us-east-1' });

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
};

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
}

// eslint-disable-next-line no-unused-vars
function printSection(title, content) {
    console.log(chalk.cyan(`\n${'='.repeat(60)}`));
    console.log(chalk.cyan(title));
    console.log(chalk.cyan(`${'='.repeat(60)}`));
    if (content) {
        console.log(content);
    }
}

function printSubsection(message) {
    console.log(`\n${colors.blue}${message}${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(40)}${colors.reset}`);
}

function printMetric(label, value, unit = '', status = 'info') {
    const statusColors = {
        success: colors.green,
        warning: colors.yellow,
        error: colors.red,
        info: colors.blue,
    };
    const statusIcons = {
        success: '✅',
        warning: '⚠️',
        error: '❌',
        info: 'ℹ️',
    };

    const color = statusColors[status] || colors.blue;
    const icon = statusIcons[status] || 'ℹ️';

    console.log(`${icon} ${color}${label}:${colors.reset} ${value}${unit}`);
}

function printTable(headers, rows) {
    // Calculate column widths
    const widths = headers.map((header, i) => {
        const maxWidth = Math.max(
            header.length,
            ...rows.map((row) => (row[i] || '').toString().length)
        );
        return Math.min(maxWidth, 30); // Cap at 30 characters
    });

    // Print header
    const headerRow = headers.map((header, i) => header.padEnd(widths[i])).join(' | ');
    console.log(`${colors.bright}${headerRow}${colors.reset}`);
    console.log(`${colors.dim}${'-'.repeat(headerRow.length)}${colors.reset}`);

    // Print rows
    rows.forEach((row) => {
        const dataRow = row.map((cell, i) => (cell || '').toString().padEnd(widths[i])).join(' | ');
        console.log(dataRow);
    });
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
    });
}

function formatDuration(ms) {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

async function getSystemConfiguration() {
    const config = {};

    try {
        // Get default Gmail user
        const defaultUserParam = await ssmClient.send(
            new GetParameterCommand({
                Name: `/chatterbox/${ENVIRONMENT}/default-gmail-user`,
            })
        );
        config.defaultGmailUser = defaultUserParam.Parameter?.Value;

        // Get polling interval
        const pollingIntervalParam = await ssmClient.send(
            new GetParameterCommand({
                Name: `/chatterbox/${ENVIRONMENT}/polling-interval-minutes`,
            })
        );
        config.pollingIntervalMinutes = pollingIntervalParam.Parameter?.Value || '5';

        // Get Gmail tokens to see configured users
        const tokensSecret = await secretsClient.send(
            new GetSecretValueCommand({
                SecretId: `${ENVIRONMENT}-chatterbox-gmail-tokens`,
            })
        );
        const tokens = JSON.parse(tokensSecret.SecretString || '{}');
        config.configuredUsers = Object.keys(tokens);
    } catch (error) {
        console.log(
            `${colors.yellow}Warning: Could not retrieve some configuration: ${error.message}${colors.reset}`
        );
    }

    return config;
}

async function getEmailProcessingStats() {
    const stats = {
        staged: 0,           // Items staged (pending processing)
        processed: 0,        // Items processed but no response generated yet
        generated: 0,        // Total number of generated responses
        failed: 0,           // Total number of failed emails
        total: 0,
    };

    try {
        // Get email queries from the correct table
        const queriesScan = await docClient.send(
            new ScanCommand({
                TableName: 'chatterbox-email-queries',
            })
        );

        if (queriesScan.Items) {
            queriesScan.Items.forEach((item) => {
                const status = item.status?.S || item.status || 'unknown';
                if (status === 'pending') stats.staged++;
                else if (status === 'processing') stats.processed++;
                else if (status === 'completed') stats.processed++; // Completed but might not have response yet
                else if (status === 'failed') stats.failed++;
            });
        }

        // Get generated responses count
        const responsesScan = await docClient.send(
            new ScanCommand({
                TableName: 'chatterbox-generated-responses',
            })
        );

        if (responsesScan.Items) {
            stats.generated = responsesScan.Items.length;
        }

        stats.total = stats.staged + stats.processed + stats.generated + stats.failed;
    } catch (error) {
        console.log(
            `${colors.yellow}Warning: Could not retrieve email processing stats: ${error.message}${colors.reset}`
        );
    }

    return stats;
}

async function getPollingState() {
    const pollingState = {
        lastPolledUser: null,
        lastPolledTimestamp: null,
        lastHistoryId: null,
        totalPollCycles: 0,
    };

    try {
        // Get polling state from local file if available
        const fs = require('fs');
        const path = require('path');
        
        const lastHistoryIdFile = path.join(__dirname, '..', 'data', 'last_history_id.txt');
        const totalPollCyclesFile = path.join(__dirname, '..', 'data', 'total_poll_cycles.txt');
        
        if (fs.existsSync(lastHistoryIdFile)) {
            pollingState.lastHistoryId = fs.readFileSync(lastHistoryIdFile, 'utf8').trim();
        }
        
        if (fs.existsSync(totalPollCyclesFile)) {
            pollingState.totalPollCycles = parseInt(fs.readFileSync(totalPollCyclesFile, 'utf8').trim()) || 0;
        }
        
        // Get recent email queries to determine last poll info
        const recentQueries = await docClient.send(
            new ScanCommand({
                TableName: 'chatterbox-email-queries',
                Limit: 1,
            })
        );
        
        if (recentQueries.Items && recentQueries.Items.length > 0) {
            const latestQuery = recentQueries.Items[0];
            pollingState.lastPolledTimestamp = latestQuery.createdAt?.S || latestQuery.createdAt;
            pollingState.lastPolledUser = latestQuery.gmailUser || 'Unknown';
        }
    } catch (error) {
        console.log(
            `${colors.yellow}Warning: Could not retrieve polling state: ${error.message}${colors.reset}`
        );
    }

    return pollingState;
}

async function getRecentActivity() {
    const activity = {
        lastEmailReceived: null,
        lastResponseSent: null,
        lastError: null,
        recentEmails: [],
    };

    try {
        // Get recent email queries
        const recentQueries = await docClient.send(
            new ScanCommand({
                TableName: 'chatterbox-email-queries',
                Limit: 5,
            })
        );

        if (recentQueries.Items) {
            activity.recentEmails = recentQueries.Items.map(item => ({
                userEmail: item.userEmail?.S || item.userEmail || 'Unknown',
                subject: item.subject?.S || item.subject || 'No Subject',
                status: item.status?.S || item.status || 'unknown',
                createdAt: item.createdAt?.S || item.createdAt || 'Unknown'
            })).sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            ).slice(0, 5);

            if (activity.recentEmails.length > 0) {
                activity.lastEmailReceived = activity.recentEmails[0].createdAt;
            }
        }

        // Get recent responses
        const recentResponses = await docClient.send(
            new ScanCommand({
                TableName: 'chatterbox-generated-responses',
                Limit: 1,
            })
        );

        if (recentResponses.Items && recentResponses.Items.length > 0) {
            const response = recentResponses.Items[0];
            activity.lastResponseSent = response.createdAt?.S || response.createdAt;
        }

        // Get recent errors from CloudWatch logs
        const errorLogs = await cloudwatchClient.send(
            new FilterLogEventsCommand({
                logGroupName: `/aws/lambda/${ENVIRONMENT}-poll-gmail`,
                filterPattern: 'ERROR',
                startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
                limit: 1,
            })
        );

        if (errorLogs.events && errorLogs.events.length > 0) {
            activity.lastError = errorLogs.events[0].timestamp;
        }
    } catch (error) {
        console.log(
            `${colors.yellow}Warning: Could not retrieve recent activity: ${error.message}${colors.reset}`
        );
    }

    return activity;
}

async function getQueueStatus() {
    const queueStatus = {
        messagesInQueue: 0,
        messagesInFlight: 0,
        queueUrl: null,
    };

    try {
        // Get AWS account ID from STS
        const identity = await stsClient.send(new GetCallerIdentityCommand());
        const accountId = identity.Account;

        // Get the queue URL dynamically
        const queueName = 'chatterbox-response-generation';
        const queueUrl = `https://sqs.us-east-1.amazonaws.com/${accountId}/${queueName}`;

        const queueAttributes = await sqsClient.send(
            new GetQueueAttributesCommand({
                QueueUrl: queueUrl,
                AttributeNames: [
                    'ApproximateNumberOfMessages',
                    'ApproximateNumberOfMessagesNotVisible',
                ],
            })
        );

        queueStatus.messagesInQueue = parseInt(
            queueAttributes.Attributes?.ApproximateNumberOfMessages || '0'
        );
        queueStatus.messagesInFlight = parseInt(
            queueAttributes.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'
        );
        queueStatus.queueUrl = queueUrl;
    } catch (error) {
        console.log(
            `${colors.yellow}Warning: Could not retrieve queue status: ${error.message}${colors.reset}`
        );
    }

    return queueStatus;
}

async function getStorageStats() {
    const storageStats = {
        emailContentBucket: {
            objects: 0,
            size: 0,
        },
        emailArchiveBucket: {
            objects: 0,
            size: 0,
        },
        attachmentsBucket: {
            objects: 0,
            size: 0,
        },
    };

    try {
        // Get bucket names dynamically
        const identity = await stsClient.send(new GetCallerIdentityCommand());
        const accountId = identity.Account;

        // Email content bucket - use pattern matching since it has a random suffix
        try {
            const { ListBucketsCommand } = require('@aws-sdk/client-s3');
            const buckets = await s3Client.send(new ListBucketsCommand());
            const contentBucket = buckets.Buckets?.find(bucket => 
                bucket.Name?.startsWith('chatterbox-email-content-development-')
            );
            
            if (contentBucket) {
                const contentObjects = await s3Client.send(
                    new ListObjectsV2Command({
                        Bucket: contentBucket.Name,
                    })
                );

                storageStats.emailContentBucket.objects = contentObjects.Contents?.length || 0;
                storageStats.emailContentBucket.size =
                    contentObjects.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0;
            }
        } catch (error) {
            console.log(`${colors.yellow}Warning: Could not access email content bucket: ${error.message}${colors.reset}`);
        }

        // Email archive bucket
        try {
            const archiveObjects = await s3Client.send(
                new ListObjectsV2Command({
                    Bucket: `${ENVIRONMENT}-chatterbox-email-archive`,
                })
            );

            storageStats.emailArchiveBucket.objects = archiveObjects.Contents?.length || 0;
            storageStats.emailArchiveBucket.size =
                archiveObjects.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0;
        } catch (error) {
            console.log(`${colors.yellow}Warning: Could not access email archive bucket: ${error.message}${colors.reset}`);
        }

        // Attachments bucket - use pattern matching since it has a random suffix
        try {
            const { ListBucketsCommand } = require('@aws-sdk/client-s3');
            const buckets = await s3Client.send(new ListBucketsCommand());
            const attachmentsBucket = buckets.Buckets?.find(bucket => 
                bucket.Name?.startsWith('chatterbox-attachments-development-')
            );
            
            if (attachmentsBucket) {
                const attachmentObjects = await s3Client.send(
                    new ListObjectsV2Command({
                        Bucket: attachmentsBucket.Name,
                    })
                );

                storageStats.attachmentsBucket.objects = attachmentObjects.Contents?.length || 0;
                storageStats.attachmentsBucket.size =
                    attachmentObjects.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0;
            }
        } catch (error) {
            console.log(`${colors.yellow}Warning: Could not access attachments bucket: ${error.message}${colors.reset}`);
        }
    } catch (error) {
        console.log(
            `${colors.yellow}Warning: Could not retrieve storage stats: ${error.message}${colors.reset}`
        );
    }

    return storageStats;
}

async function getLambdaHealth() {
    const lambdaHealth = {};

    try {
        const functions = [
            `${ENVIRONMENT}-poll-gmail`,
            `${ENVIRONMENT}-pull-latest-chatterbox-email`,
            'chatterbox-email-processor',
            'chatterbox-response-generator',
        ];

        for (const functionName of functions) {
            try {
                const config = await lambdaClient.send(
                    new GetFunctionConfigurationCommand({
                        FunctionName: functionName,
                    })
                );

                lambdaHealth[functionName] = {
                    state: config.State,
                    lastUpdateStatus: config.LastUpdateStatus,
                    lastModified: config.LastModified,
                    timeout: config.Timeout,
                    memorySize: config.MemorySize,
                };
            } catch (error) {
                lambdaHealth[functionName] = {
                    state: 'NOT_FOUND',
                    error: error.message,
                };
            }
        }
    } catch (error) {
        console.log(
            `${colors.yellow}Warning: Could not retrieve Lambda health: ${error.message}${colors.reset}`
        );
    }

    return lambdaHealth;
}

async function displaySystemState() {
    console.log(`${colors.bright}${colors.cyan}🤖 Chatterbox AWS System State${colors.reset}`);
    console.log(`${colors.dim}Generated at: ${new Date().toLocaleString()}${colors.reset}`);

    // Get all state data
    const config = await getSystemConfiguration();
    const emailStats = await getEmailProcessingStats();
    const pollingState = await getPollingState();
    const recentActivity = await getRecentActivity();
    const queueStatus = await getQueueStatus();
    const storageStats = await getStorageStats();
    const lambdaHealth = await getLambdaHealth();

    // System Configuration
    printHeader('System Configuration');

    printSubsection('Gmail Configuration');
    printMetric('Default Gmail User', config.defaultGmailUser || 'Not configured', '', 'info');
    printMetric('Configured Users', config.configuredUsers?.length || 0, ' users', 'info');
    if (config.configuredUsers?.length > 0) {
        console.log(`${colors.dim}  Users: ${config.configuredUsers.join(', ')}${colors.reset}`);
    }
    printMetric('Polling Interval', config.pollingIntervalMinutes || '5', ' minutes', 'info');

    // Email Processing Statistics
    printHeader('Email Processing Statistics');

    printSubsection('Pipeline Status');
    printMetric('Items Staged', emailStats.staged, ' emails', emailStats.staged > 0 ? 'warning' : 'success');
    printMetric('Items Processed (No Response)', emailStats.processed, ' emails', 'info');
    printMetric('Responses Generated', emailStats.generated, ' responses', 'success');
    printMetric('Failed Emails', emailStats.failed, ' emails', emailStats.failed > 0 ? 'error' : 'success');

    const successRate =
        emailStats.total > 0 ? ((emailStats.generated / emailStats.total) * 100).toFixed(1) : 100;
    printMetric(
        'Response Generation Rate',
        `${successRate}%`,
        '',
        successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'error'
    );

    // Polling Information
    printHeader('Polling Information');

    printSubsection('Last Poll Details');
    printMetric('Last Polled User', pollingState.lastPolledUser || 'Never', '', 'info');
    printMetric('Last Poll Time', formatTimestamp(pollingState.lastPolledTimestamp), '', 'info');
    printMetric('Last History ID', pollingState.lastHistoryId || 'None', '', 'info');
    printMetric('Total Poll Cycles', pollingState.totalPollCycles, ' cycles', 'info');

    if (pollingState.lastPolledTimestamp) {
        const timeSinceLastPoll = Date.now() - new Date(pollingState.lastPolledTimestamp).getTime();
        const pollIntervalMs = parseInt(config.pollingIntervalMinutes || '5') * 60 * 1000;
        const isOverdue = timeSinceLastPoll > pollIntervalMs * 2;

        printMetric(
            'Time Since Last Poll',
            formatDuration(timeSinceLastPoll),
            '',
            isOverdue ? 'warning' : 'success'
        );
        printMetric(
            'Next Expected Poll',
            formatDuration(pollIntervalMs - timeSinceLastPoll),
            '',
            'info'
        );
    }

    // Recent Activity
    printHeader('Recent Activity');

    printSubsection('Timeline');
    printMetric(
        'Last Email Received',
        formatTimestamp(recentActivity.lastEmailReceived),
        '',
        'info'
    );
    printMetric('Last Response Sent', formatTimestamp(recentActivity.lastResponseSent), '', 'info');
    printMetric(
        'Last Error Occurred',
        formatTimestamp(recentActivity.lastError),
        '',
        recentActivity.lastError ? 'warning' : 'success'
    );

    if (recentActivity.recentEmails.length > 0) {
        printSubsection('Recent Emails');
        const emailRows = recentActivity.recentEmails.map((email) => [
            email.userEmail || 'Unknown',
            email.subject || 'No Subject',
            email.status || 'Unknown',
            formatTimestamp(email.createdAt),
        ]);

        printTable(['User', 'Subject', 'Status', 'Received'], emailRows);
    }

    // Queue Status
    printHeader('Queue Status');

    printSubsection('Response Generation Queue');
    printMetric(
        'Messages in Queue',
        queueStatus.messagesInQueue,
        ' messages',
        queueStatus.messagesInQueue > 0 ? 'warning' : 'success'
    );
    printMetric('Messages in Flight', queueStatus.messagesInFlight, ' messages', 'info');
    printMetric(
        'Total Pending',
        queueStatus.messagesInQueue + queueStatus.messagesInFlight,
        ' messages',
        'info'
    );

    // Storage Statistics
    printHeader('Storage Statistics');

    printSubsection('S3 Bucket Usage');
    printMetric(
        'Email Content Objects',
        storageStats.emailContentBucket.objects,
        ' objects',
        'info'
    );
    printMetric(
        'Email Content Size',
        (storageStats.emailContentBucket.size / 1024 / 1024).toFixed(2),
        ' MB',
        'info'
    );
    printMetric(
        'Email Archive Objects',
        storageStats.emailArchiveBucket.objects,
        ' objects',
        'info'
    );
    printMetric(
        'Email Archive Size',
        (storageStats.emailArchiveBucket.size / 1024 / 1024).toFixed(2),
        ' MB',
        'info'
    );
    printMetric('Attachment Objects', storageStats.attachmentsBucket.objects, ' objects', 'info');
    printMetric(
        'Attachment Size',
        (storageStats.attachmentsBucket.size / 1024 / 1024).toFixed(2),
        ' MB',
        'info'
    );

    const totalSize =
        storageStats.emailContentBucket.size +
        storageStats.emailArchiveBucket.size +
        storageStats.attachmentsBucket.size;
    printMetric('Total Storage Used', (totalSize / 1024 / 1024).toFixed(2), ' MB', 'info');

    // Lambda Health
    printHeader('Lambda Function Health');

    printSubsection('Function Status');
    for (const [functionName, health] of Object.entries(lambdaHealth)) {
        const status =
            health.state === 'Active'
                ? 'success'
                : health.state === 'NOT_FOUND'
                ? 'error'
                : 'warning';
        const statusText =
            health.state === 'Active'
                ? 'Active'
                : health.state === 'NOT_FOUND'
                ? 'Not Found'
                : health.state;

        printMetric(functionName, statusText, '', status);

        if (health.lastModified) {
            console.log(
                `${colors.dim}  Last Modified: ${formatTimestamp(health.lastModified)}${
                    colors.reset
                }`
            );
        }
        if (health.timeout) {
            console.log(`${colors.dim}  Timeout: ${health.timeout}s${colors.reset}`);
        }
        if (health.memorySize) {
            console.log(`${colors.dim}  Memory: ${health.memorySize}MB${colors.reset}`);
        }
    }

    // Email Processing Summary
    printHeader('Email Processing Summary');

    printSubsection('Pipeline Overview');
    const totalEmails = emailStats.staged + emailStats.processed + emailStats.generated + emailStats.failed;
    printMetric('Total Emails in System', totalEmails, ' emails', 'info');
    printMetric('Items Staged for Processing', emailStats.staged, ' emails', emailStats.staged > 0 ? 'warning' : 'success');
    printMetric('Items Processed (No Response)', emailStats.processed, ' emails', 'info');
    printMetric('Total Responses Generated', emailStats.generated, ' responses', 'success');
    printMetric('Total Failed Emails', emailStats.failed, ' emails', emailStats.failed > 0 ? 'error' : 'success');

    // Calculate processing efficiency
    const processingRate = totalEmails > 0 ? ((emailStats.processed + emailStats.generated) / totalEmails * 100).toFixed(1) : 100;
    const responseRate = totalEmails > 0 ? (emailStats.generated / totalEmails * 100).toFixed(1) : 100;
    
    printMetric('Processing Rate', `${processingRate}%`, '', processingRate >= 90 ? 'success' : 'warning');
    printMetric('Response Generation Rate', `${responseRate}%`, '', responseRate >= 80 ? 'success' : 'warning');

    // System Health Summary
    printHeader('System Health Summary');

    const healthIndicators = [];

    // Check email processing health
    if (emailStats.failed > 0) {
        healthIndicators.push({
            status: 'error',
            message: `${emailStats.failed} failed email(s) need attention`,
        });
    }
    if (emailStats.staged > 10) {
        healthIndicators.push({
            status: 'warning',
            message: `${emailStats.staged} emails staged (high backlog)`,
        });
    }

    // Check polling health
    if (pollingState.lastPolledTimestamp) {
        const timeSinceLastPoll = Date.now() - new Date(pollingState.lastPolledTimestamp).getTime();
        const pollIntervalMs = parseInt(config.pollingIntervalMinutes || '5') * 60 * 1000;
        if (timeSinceLastPoll > pollIntervalMs * 2) {
            healthIndicators.push({ status: 'error', message: 'Polling appears to be stalled' });
        }
    }

    // Check queue health
    if (queueStatus.messagesInQueue > 5) {
        healthIndicators.push({
            status: 'warning',
            message: `${queueStatus.messagesInQueue} messages in response queue`,
        });
    }

    // Check Lambda health
    const inactiveFunctions = Object.values(lambdaHealth).filter(
        (h) => h.state !== 'Active'
    ).length;
    if (inactiveFunctions > 0) {
        healthIndicators.push({
            status: 'error',
            message: `${inactiveFunctions} Lambda function(s) not active`,
        });
    }

    if (healthIndicators.length === 0) {
        printMetric('Overall Status', 'Healthy', '', 'success');
        console.log(`${colors.green}All systems operational${colors.reset}`);
    } else {
        printMetric('Overall Status', 'Issues Detected', '', 'warning');
        healthIndicators.forEach((indicator) => {
            const color = indicator.status === 'error' ? colors.red : colors.yellow;
            const icon = indicator.status === 'error' ? '❌' : '⚠️';
            console.log(`${icon} ${color}${indicator.message}${colors.reset}`);
        });
    }

    console.log(`\n${colors.dim}${'='.repeat(80)}${colors.reset}`);
    console.log(
        `${colors.dim}State report completed at ${new Date().toLocaleString()}${colors.reset}`
    );
    console.log(`${colors.dim}${'='.repeat(80)}${colors.reset}`);
}

// Run the script
if (require.main === module) {
    displaySystemState().catch((error) => {
        console.error(
            `${colors.red}❌ Failed to get system state: ${error.message}${colors.reset}`
        );
        process.exit(1);
    });
}

module.exports = { displaySystemState };
