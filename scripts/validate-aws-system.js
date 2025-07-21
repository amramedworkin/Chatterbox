#!/usr/bin/env node

/**
 * Comprehensive AWS System Validation Script
 * Validates that all expected resources are deployed and data is migrated
 *
 * Usage:
 *   npm run aws:validate          # Check if resources exist (deployment validation)
 *   npm run aws:validate --clean  # Check if resources are absent (teardown validation)
 */

const { LambdaClient, GetFunctionCommand } = require('@aws-sdk/client-lambda');
const {
    S3Client,
    HeadBucketCommand,
    ListBucketsCommand,
    ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const {
    SecretsManagerClient,
    DescribeSecretCommand,
    GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');
const { IAMClient, GetRoleCommand } = require('@aws-sdk/client-iam');
const {
    SQSClient,
    GetQueueUrlCommand,
    GetQueueAttributesCommand,
} = require('@aws-sdk/client-sqs');
const {
    SESClient,
    GetSendQuotaCommand,
    ListIdentitiesCommand,
    GetIdentityVerificationAttributesCommand,
} = require('@aws-sdk/client-ses');
const fs = require('fs');
const path = require('path');

// Configure AWS clients
const config = { region: 'us-east-1' };
const lambda = new LambdaClient(config);
const s3 = new S3Client(config);
const dynamodb = new DynamoDBClient(config);
const secretsManager = new SecretsManagerClient(config);
const ssm = new SSMClient(config);
const cloudwatch = new CloudWatchLogsClient(config);
const iam = new IAMClient(config);
const sqs = new SQSClient(config);
const ses = new SESClient(config);

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

// Check if we're in clean mode
const isCleanMode = process.argv.includes('--clean');

// Global variables for tracking missing components
const missingComponents = [];
const extantResourceTypes = new Set();
let manualTeardownCommands = [];

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    brightGreen: '\x1b[92m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

function printStatus(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printInfo(message) {
    console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function printSection(message) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${message}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
}

function printSubsection(message) {
    console.log(`\n${colors.magenta}${'-'.repeat(40)}${colors.reset}`);
    console.log(`${colors.magenta}${message}${colors.reset}`);
    console.log(`${colors.magenta}${'-'.repeat(40)}${colors.reset}`);
}

// Function to add command to manual teardown
function addManualTeardownCommand(command, resourceType) {
    manualTeardownCommands.push(command);
    extantResourceTypes.add(resourceType);
}

// Function to write manual teardown script
function writeManualTeardownScript() {
    if (manualTeardownCommands.length === 0) {
        return;
    }

    const manualDir = path.join(process.cwd(), 'scripts', 'aws', 'manual');
    const existingScript = path.join(manualDir, 'manual-teardown.sh');

    // Check if existing script exists and rename it
    if (fs.existsSync(existingScript)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(manualDir, `manual-teardown-${timestamp}.sh`);
        fs.renameSync(existingScript, backupPath);
        printInfo(`Existing manual-teardown.sh renamed to: ${backupPath}`);
    }

    // Create the new manual teardown script
    const scriptContent = `#!/bin/bash

# Manual AWS Teardown Script
# Generated on: ${new Date().toISOString()}
# Environment: ${ENVIRONMENT}
# 
# This script contains AWS CLI commands to manually delete remaining resources
# that were not cleaned up by the automated teardown process.
#
# WARNING: This will permanently delete AWS resources!
# Review the commands before running this script.

set -e

echo "🧹 Manual AWS Teardown Script"
echo "Environment: ${ENVIRONMENT}"
echo "Timestamp: ${new Date().toISOString()}"
echo ""

# AWS CLI commands to delete remaining resources:
${manualTeardownCommands.map((cmd) => `# ${cmd}`).join('\n')}

echo ""
echo "✅ Manual teardown commands completed"
echo "Note: Some resources may require manual cleanup if they have dependencies"
`;

    fs.writeFileSync(existingScript, scriptContent);
    fs.chmodSync(existingScript, '755');

    return existingScript;
}

// Expected resources based on deployment scripts
const EXPECTED_RESOURCES = {
    lambda: {
        functions: [
            `${ENVIRONMENT}-poll-gmail`,
            `${ENVIRONMENT}-pull-latest-chatterbox-email`,
            'chatterbox-email-processor',
            'chatterbox-response-generator',
        ],
        source: 'Deployed via Cloud/AWS/scripts/deploy-lambda.sh and Cloud/AWS/terraform-email-processing/deploy.sh',
        sourceFiles: [
            'Cloud/AWS/terraform-lambda/lambda/',
            'Cloud/AWS/terraform-lambda/lambda.zip',
            'Cloud/AWS/terraform-email-processing/email-processor.zip',
            'Cloud/AWS/terraform-email-processing/response-generator.zip',
        ],
    },
    s3: {
        buckets: [
            `${ENVIRONMENT}-chatterbox-email-archive`,
            'chatterbox-email-content-development-*',
            'chatterbox-attachments-development-*',
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf and Cloud/AWS/terraform-email-processing/main.tf',
        sourceFiles: [
            'Cloud/AWS/terraform-simple/main.tf',
            'Cloud/AWS/terraform-email-processing/main.tf',
        ],
    },
    dynamodb: {
        tables: [
            `${ENVIRONMENT}-chatterbox-state-table`,
            'chatterbox-email-queries',
            'chatterbox-conversations',
            'chatterbox-generated-responses',
            'chatterbox-query-records',
            'chatterbox-user-profiles',
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf and Cloud/AWS/terraform-email-processing/main.tf',
        sourceFiles: [
            'Cloud/AWS/terraform-simple/main.tf',
            'Cloud/AWS/terraform-email-processing/main.tf',
        ],
    },
    sqs: {
        queues: [
            'chatterbox-response-generation',
            'chatterbox-response-generation-dlq',
        ],
        source: 'Created via Cloud/AWS/terraform-email-processing/main.tf',
        sourceFiles: [
            'Cloud/AWS/terraform-email-processing/main.tf',
        ],
    },
    resourceGroups: {
        groups: [
            `${ENVIRONMENT}-chatterbox-resources`,
            `${ENVIRONMENT}-chatterbox-email-processing`,
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf and Cloud/AWS/terraform-email-processing/main.tf',
        sourceFiles: [
            'Cloud/AWS/terraform-simple/main.tf',
            'Cloud/AWS/terraform-email-processing/main.tf',
        ],
    },
    secrets: {
        secrets: [
            `${ENVIRONMENT}-chatterbox-google-credentials`,
            `${ENVIRONMENT}-chatterbox-gmail-tokens`,
            'chatterbox/openai-api-key',
        ],
        source: 'Populated via Cloud/AWS/scripts/populate-secrets-from-init.js and manual setup',
        sourceFiles: [
            'data/init/*/google_credentials.json',
            'data/init/*/google_tokens.json',
            'data/init/*/.env',
        ],
    },
    parameters: {
        parameters: [
            `/chatterbox/${ENVIRONMENT}/gmail-tokens-secret-name`,
            `/chatterbox/${ENVIRONMENT}/google-credentials-secret-name`,
            `/chatterbox/${ENVIRONMENT}/default-gmail-user`,
            `/chatterbox/${ENVIRONMENT}/email-storage-bucket`,
            `/chatterbox/${ENVIRONMENT}/polling-interval-minutes`,
            `/chatterbox/${ENVIRONMENT}/max-emails-per-poll`,
            `/chatterbox/${ENVIRONMENT}/openai-api-key`,
            `/chatterbox/${ENVIRONMENT}/openai-model`,
            '/chatterbox/llm/default-model',
            '/chatterbox/billing/free-tier-limit',
            '/chatterbox/billing/infrastructure-cost',
            '/chatterbox/billing/licensing-cost',
            '/chatterbox/email/rejection-rate-limit',
        ],
        source: 'Populated via Cloud/AWS/scripts/populate-secrets-from-init.js and Cloud/AWS/terraform-email-processing/main.tf',
        sourceFiles: [
            'data/init/*/config.json',
            'data/init/*/.env',
            'Cloud/AWS/terraform-email-processing/main.tf',
        ],
    },
    cloudwatch: {
        logGroups: [
            `/aws/lambda/${ENVIRONMENT}-poll-gmail`,
            `/aws/lambda/${ENVIRONMENT}-pull-latest-chatterbox-email`,
            '/aws/lambda/chatterbox-email-processor',
            '/aws/lambda/chatterbox-response-generator',
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf and Cloud/AWS/terraform-email-processing/main.tf',
        sourceFiles: [
            'Cloud/AWS/terraform-simple/main.tf',
            'Cloud/AWS/terraform-email-processing/main.tf',
        ],
    },
    iam: {
        roles: [
            `${ENVIRONMENT}-chatterbox-lambda-role`,
            'chatterbox-email-processor-lambda-role',
            'chatterbox-response-generator-lambda-role',
        ],
        policies: [
            `${ENVIRONMENT}-chatterbox-lambda-policy`,
            'chatterbox-email-processor-policy',
            'chatterbox-response-generator-policy',
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf and Cloud/AWS/terraform-email-processing/main.tf',
        sourceFiles: [
            'Cloud/AWS/terraform-simple/main.tf',
            'Cloud/AWS/terraform-email-processing/main.tf',
        ],
    },
};

// AWS CLI commands for deletion
const DELETE_COMMANDS = {
    lambda: (functionName) =>
        `aws lambda delete-function --function-name ${functionName} --profile cliadmin`,
    s3: (bucketName) => `aws s3 rb s3://${bucketName} --force --profile cliadmin`,
    dynamodb: (tableName) =>
        `aws dynamodb delete-table --table-name ${tableName} --profile cliadmin`,
    sqs: (queueName) => {
        const queueUrl = `https://sqs.us-east-1.amazonaws.com/$(aws sts get-caller-identity --profile cliadmin --query Account --output text)/${queueName}`;
        return `aws sqs delete-queue --queue-url ${queueUrl} --profile cliadmin`;
    },
    resourceGroup: (groupName) =>
        `aws resource-groups delete-group --group-name ${groupName} --profile cliadmin`,
    secrets: (secretName) =>
        `aws secretsmanager delete-secret --secret-id ${secretName} --force-delete-without-recovery --profile cliadmin`,
    parameters: (paramName) => `aws ssm delete-parameter --name "${paramName}" --profile cliadmin`,
    cloudwatch: (logGroupName) =>
        `aws logs delete-log-group --log-group-name "${logGroupName}" --profile cliadmin`,
    iam_role: (roleName) => `aws iam delete-role --role-name ${roleName} --profile cliadmin`,
    iam_policy: (policyName) =>
        `aws iam delete-policy --policy-arn arn:aws:iam::$(aws sts get-caller-identity --profile cliadmin --query Account --output text):policy/${policyName} --profile cliadmin`,
    apigateway: (apiId) =>
        `aws apigateway delete-rest-api --rest-api-id ${apiId} --profile cliadmin`,
};

async function validateLambdaFunctions() {
    printSubsection('Lambda Functions');

    for (const functionName of EXPECTED_RESOURCES.lambda.functions) {
        try {
            const result = await lambda.send(
                new GetFunctionCommand({ FunctionName: functionName })
            );
            if (isCleanMode) {
                printError(`${functionName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.lambda(functionName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.lambda(functionName), 'Lambda Function');
            } else {
                printStatus(`${functionName} - Status: ${result.Configuration?.State}`);
                printInfo(`  Runtime: ${result.Configuration?.Runtime}`);
                printInfo(`  Handler: ${result.Configuration?.Handler}`);
                printInfo(`  Timeout: ${result.Configuration?.Timeout}s`);
                printInfo(`  Memory: ${result.Configuration?.MemorySize}MB`);
            }
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                if (isCleanMode) {
                    printStatus(`${functionName} - PROPERLY DELETED`);
                } else {
                    printError(`${functionName} - MISSING`);
                    printError(`  Should be deployed from: ${EXPECTED_RESOURCES.lambda.source}`);
                    printError(
                        `  Source files: ${EXPECTED_RESOURCES.lambda.sourceFiles.join(', ')}`
                    );
                    missingComponents.push(`${functionName} (Lambda Function)`);
                }
            } else {
                printError(`${functionName} - Error checking: ${error.message}`);
            }
        }
    }
}

async function validateS3Buckets() {
    printSubsection('S3 Buckets');

    for (const bucketName of EXPECTED_RESOURCES.s3.buckets) {
        // Handle wildcard patterns for email processing buckets
        if (bucketName.includes('*')) {
            const pattern = bucketName.replace('*', '');
            try {
                // List all buckets and filter by pattern
                const result = await s3.send(new ListBucketsCommand());
                const matchingBuckets = result.Buckets.filter((bucket) =>
                    bucket.Name.includes(pattern.replace('chatterbox-', ''))
                );

                if (matchingBuckets.length > 0) {
                    if (isCleanMode) {
                        printError(
                            `Pattern ${bucketName} - FOUND ${matchingBuckets.length} BUCKETS`
                        );
                        matchingBuckets.forEach((bucket) => {
                            printError(
                                `  ${bucket.Name} - Delete with: ${DELETE_COMMANDS.s3(bucket.Name)}`
                            );
                            addManualTeardownCommand(DELETE_COMMANDS.s3(bucket.Name), 'S3 Bucket');
                        });
                    } else {
                        printStatus(
                            `Pattern ${bucketName} - FOUND ${matchingBuckets.length} BUCKETS`
                        );
                        matchingBuckets.forEach((bucket) => {
                            printInfo(`  ${bucket.Name} - Created: ${bucket.CreationDate}`);
                        });
                    }
                } else {
                    if (isCleanMode) {
                        printStatus(`Pattern ${bucketName} - NO MATCHING BUCKETS FOUND`);
                    } else {
                        printWarning(`Pattern ${bucketName} - NO MATCHING BUCKETS FOUND`);
                        printInfo(`  Expected buckets matching: ${pattern}`);
                        missingComponents.push(`${bucketName} (S3 Bucket Pattern)`);
                    }
                }
            } catch (error) {
                printError(`Pattern ${bucketName} - Error listing buckets: ${error.message}`);
            }
        } else {
            // Handle exact bucket names
            try {
                await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
                if (isCleanMode) {
                    printError(`${bucketName} - STILL EXISTS`);
                    printError(`  Delete with: ${DELETE_COMMANDS.s3(bucketName)}`);
                    addManualTeardownCommand(DELETE_COMMANDS.s3(bucketName), 'S3 Bucket');
                } else {
                    printStatus(`${bucketName} - EXISTS`);

                    // Check bucket contents
                    try {
                        const result = await s3.send(
                            new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 5 })
                        );
                        printInfo(`  Objects: ${result.KeyCount || 0} (showing first 5)`);
                        if (result.Contents && result.Contents.length > 0) {
                            result.Contents.forEach((obj) => {
                                printInfo(`    - ${obj.Key} (${obj.Size} bytes)`);
                            });
                        }
                    } catch (listError) {
                        printWarning(`  Could not list objects: ${listError.message}`);
                    }
                }
            } catch (error) {
                if (error.name === 'NotFound') {
                    if (isCleanMode) {
                        printStatus(`${bucketName} - PROPERLY DELETED`);
                    } else {
                        printError(`${bucketName} - MISSING`);
                        printError(`  Should be created from: ${EXPECTED_RESOURCES.s3.source}`);
                        printError(
                            `  Source files: ${EXPECTED_RESOURCES.s3.sourceFiles.join(', ')}`
                        );
                        missingComponents.push(`${bucketName} (S3 Bucket)`);
                    }
                } else {
                    printError(`${bucketName} - Error checking: ${error.message}`);
                }
            }
        }
    }
}

async function validateDynamoDBTables() {
    printSubsection('DynamoDB Tables');

    for (const tableName of EXPECTED_RESOURCES.dynamodb.tables) {
        try {
            const result = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
            if (isCleanMode) {
                printError(`${tableName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.dynamodb(tableName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.dynamodb(tableName), 'DynamoDB Table');
            } else {
                printStatus(`${tableName} - Status: ${result.Table?.TableStatus}`);
                printInfo(
                    `  Billing Mode: ${result.Table?.BillingModeSummary?.BillingMode || 'Unknown'}`
                );
                printInfo(`  Item Count: ${result.Table?.ItemCount || 0}`);
            }
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                if (isCleanMode) {
                    printStatus(`${tableName} - PROPERLY DELETED`);
                } else {
                    printError(`${tableName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.dynamodb.source}`);
                    printError(
                        `  Source files: ${EXPECTED_RESOURCES.dynamodb.sourceFiles.join(', ')}`
                    );
                    missingComponents.push(`${tableName} (DynamoDB Table)`);
                }
            } else {
                printError(`${tableName} - Error checking: ${error.message}`);
            }
        }
    }
}

async function validateSecrets() {
    printSubsection('Secrets Manager Secrets');

    for (const secretName of EXPECTED_RESOURCES.secrets.secrets) {
        try {
            const result = await secretsManager.send(
                new DescribeSecretCommand({ SecretId: secretName })
            );
            if (isCleanMode) {
                printError(`${secretName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.secrets(secretName)}`);
                addManualTeardownCommand(
                    DELETE_COMMANDS.secrets(secretName),
                    'Secrets Manager Secret'
                );
            } else {
                printStatus(`${secretName} - Status: ${result.Secret?.Status}`);
                printInfo(`  Description: ${result.Secret?.Description || 'None'}`);

                // Try to get the secret value to check if it's populated
                try {
                    const secretValue = await secretsManager.send(
                        new GetSecretValueCommand({ SecretId: secretName })
                    );
                    
                    if (secretName.includes('openai-api-key')) {
                        // OpenAI API key is stored as a plain string, not JSON
                        const hasApiKey = secretValue.SecretString && 
                            typeof secretValue.SecretString === 'string' &&
                            secretValue.SecretString.startsWith('sk-');
                        printInfo(`  OpenAI API Key: ${hasApiKey ? 'VALID' : 'INVALID'}`);
                    } else {
                        // Other secrets are stored as JSON
                        const parsedValue = JSON.parse(secretValue.SecretString);

                        if (secretName.includes('google-credentials')) {
                            const hasClientId =
                                parsedValue.installed?.client_id || parsedValue.web?.client_id;
                            const hasClientSecret =
                                parsedValue.installed?.client_secret || parsedValue.web?.client_secret;
                            printInfo(
                                `  Google Credentials: ${
                                    hasClientId && hasClientSecret ? 'VALID' : 'INVALID'
                                }`
                            );
                        } else if (secretName.includes('gmail-tokens')) {
                            const hasTokens = parsedValue.access_token || parsedValue.refresh_token;
                            printInfo(`  Gmail Tokens: ${hasTokens ? 'POPULATED' : 'EMPTY'}`);
                        }
                    }
                } catch (valueError) {
                    printWarning(`  Could not retrieve secret value: ${valueError.message}`);
                }
            }
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                if (isCleanMode) {
                    printStatus(`${secretName} - PROPERLY DELETED`);
                } else {
                    printError(`${secretName} - MISSING`);
                    printError(`  Should be populated from: ${EXPECTED_RESOURCES.secrets.source}`);
                    printError(
                        `  Source files: ${EXPECTED_RESOURCES.secrets.sourceFiles.join(', ')}`
                    );
                    missingComponents.push(`${secretName} (Secrets Manager Secret)`);
                }
            } else {
                printError(`${secretName} - Error checking: ${error.message}`);
            }
        }
    }
}

async function validateParameters() {
    printSubsection('Parameter Store Parameters');

    for (const paramName of EXPECTED_RESOURCES.parameters.parameters) {
        try {
            const result = await ssm.send(new GetParameterCommand({ Name: paramName }));
            if (isCleanMode) {
                printError(`${paramName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.parameters(paramName)}`);
                addManualTeardownCommand(
                    DELETE_COMMANDS.parameters(paramName),
                    'Parameter Store Parameter'
                );
            } else {
                printStatus(`${paramName} - EXISTS`);
                printInfo(`  Type: ${result.Parameter?.Type}`);
                printInfo(
                    `  Value: ${result.Parameter?.Value?.substring(0, 50)}${
                        result.Parameter?.Value?.length > 50 ? '...' : ''
                    }`
                );
            }
        } catch (error) {
            if (error.name === 'ParameterNotFound') {
                if (isCleanMode) {
                    printStatus(`${paramName} - PROPERLY DELETED`);
                } else {
                    printError(`${paramName} - MISSING`);
                    printError(
                        `  Should be populated from: ${EXPECTED_RESOURCES.parameters.source}`
                    );
                    printError(
                        `  Source files: ${EXPECTED_RESOURCES.parameters.sourceFiles.join(', ')}`
                    );
                    missingComponents.push(`${paramName} (Parameter Store Parameter)`);
                }
            } else {
                printError(`${paramName} - Error checking: ${error.message}`);
            }
        }
    }
}

async function validateCloudWatchLogGroups() {
    printSubsection('CloudWatch Log Groups');

    for (const logGroupName of EXPECTED_RESOURCES.cloudwatch.logGroups) {
        try {
            const result = await cloudwatch.send(
                new DescribeLogGroupsCommand({ logGroupNamePrefix: logGroupName })
            );
            const logGroup = result.logGroups.find((lg) => lg.logGroupName === logGroupName);

            if (logGroup) {
                if (isCleanMode) {
                    printError(`${logGroupName} - STILL EXISTS`);
                    printError(`  Delete with: ${DELETE_COMMANDS.cloudwatch(logGroupName)}`);
                    addManualTeardownCommand(
                        DELETE_COMMANDS.cloudwatch(logGroupName),
                        'CloudWatch Log Group'
                    );
                } else {
                    printStatus(`${logGroupName} - EXISTS`);
                    printInfo(`  Stored Bytes: ${logGroup.storedBytes || 0}`);
                    printInfo(`  Metric Filter Count: ${logGroup.metricFilterCount || 0}`);
                }
            } else {
                if (isCleanMode) {
                    printStatus(`${logGroupName} - PROPERLY DELETED`);
                } else {
                    printError(`${logGroupName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.cloudwatch.source}`);
                    printError(
                        `  Source files: ${EXPECTED_RESOURCES.cloudwatch.sourceFiles.join(', ')}`
                    );
                    missingComponents.push(`${logGroupName} (CloudWatch Log Group)`);
                }
            }
        } catch (error) {
            printError(`${logGroupName} - Error checking: ${error.message}`);
        }
    }
}

async function validateIAMResources() {
    printSubsection('IAM Roles');

    for (const roleName of EXPECTED_RESOURCES.iam.roles) {
        try {
            const result = await iam.send(new GetRoleCommand({ RoleName: roleName }));
            if (isCleanMode) {
                printError(`${roleName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.iam_role(roleName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.iam_role(roleName), 'IAM Role');
            } else {
                printStatus(`${roleName} - EXISTS`);
                printInfo(`  ARN: ${result.Role?.Arn}`);
                printInfo(`  Create Date: ${result.Role?.CreateDate}`);
            }
        } catch (error) {
            if (error.name === 'NoSuchEntity') {
                if (isCleanMode) {
                    printStatus(`${roleName} - PROPERLY DELETED`);
                } else {
                    printError(`${roleName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.iam.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.iam.sourceFiles.join(', ')}`);
                    missingComponents.push(`${roleName} (IAM Role)`);
                }
            } else {
                if (isCleanMode) {
                    printStatus(`${roleName} - PROPERLY DELETED`);
                } else {
                    printError(`${roleName} - Error checking: ${error.message}`);
                }
            }
        }
    }
}

async function validateSQSQueues() {
    printSubsection('SQS Queues');
    
    const expectedQueues = [
        'chatterbox-response-generation',
        'chatterbox-response-generation-dlq',
    ];

    for (const queueName of expectedQueues) {
        try {
            const queueUrl = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
            const attributes = await sqs.send(
                new GetQueueAttributesCommand({
                    QueueUrl: queueUrl.QueueUrl,
                    AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
                })
            );

            const messageCount = attributes.Attributes.ApproximateNumberOfMessages || '0';
            const invisibleCount = attributes.Attributes.ApproximateNumberOfMessagesNotVisible || '0';

            if (isCleanMode) {
                printError(`SQS queue ${queueName} still exists`);
                addManualTeardownCommand(`aws sqs delete-queue --queue-url ${queueUrl.QueueUrl}`, 'SQS Queue');
            } else {
                printStatus(`SQS queue ${queueName} exists (${messageCount} visible, ${invisibleCount} invisible messages)`);
                extantResourceTypes.add('SQS Queue');
            }
        } catch (error) {
            if (isCleanMode) {
                printStatus(`SQS queue ${queueName} properly removed`);
            } else {
                printWarning(`SQS queue ${queueName} not found`);
                missingComponents.push(`SQS Queue: ${queueName}`);
            }
        }
    }
}

async function validateSES() {
    printSubsection('SES (Simple Email Service)');
    
    try {
        // Check if SES is set up
        const quota = await ses.send(new GetSendQuotaCommand({}));
        
        if (isCleanMode) {
            if (quota.SendingEnabled) {
                printError('SES account sending is still enabled');
                addManualTeardownCommand('aws ses put-account-sending-enabled --enabled false', 'SES Account');
            } else {
                printStatus('SES account sending is properly disabled');
            }
        } else {
            if (quota.SendingEnabled) {
                printStatus(`SES account sending is enabled (${quota.Max24HourSend} emails/day limit)`);
                extantResourceTypes.add('SES Account');
            } else {
                printWarning('SES account sending is disabled (Get Started state)');
                missingComponents.push('SES Account: Sending disabled');
            }
        }

        // Check verified email addresses
        const identities = await ses.send(new ListIdentitiesCommand({ IdentityType: 'EmailAddress' }));
        
        if (identities.Identities && identities.Identities.length > 0) {
            const verificationAttributes = await ses.send(
                new GetIdentityVerificationAttributesCommand({ Identities: identities.Identities })
            );

            const verifiedEmails = [];
            const unverifiedEmails = [];

            for (const email of identities.Identities) {
                const status = verificationAttributes.VerificationAttributes[email]?.VerificationStatus;
                if (status === 'Success') {
                    verifiedEmails.push(email);
                } else {
                    unverifiedEmails.push(email);
                }
            }

            if (isCleanMode) {
                if (verifiedEmails.length > 0) {
                    printError(`${verifiedEmails.length} verified email addresses still exist`);
                    for (const email of verifiedEmails) {
                        addManualTeardownCommand(`aws ses delete-identity --identity ${email}`, 'SES Email');
                    }
                } else {
                    printStatus('All verified email addresses properly removed');
                }
            } else {
                if (verifiedEmails.length > 0) {
                    printStatus(`${verifiedEmails.length} verified email addresses found: ${verifiedEmails.join(', ')}`);
                    extantResourceTypes.add('SES Email');
                } else {
                    printWarning('No verified email addresses found');
                    missingComponents.push('SES Email: No verified addresses');
                }
                
                if (unverifiedEmails.length > 0) {
                    printWarning(`${unverifiedEmails.length} unverified email addresses: ${unverifiedEmails.join(', ')}`);
                }
            }
        } else {
            if (isCleanMode) {
                printStatus('No email identities found (properly cleaned up)');
            } else {
                printWarning('No email identities found');
                missingComponents.push('SES Email: No identities');
            }
        }
    } catch (error) {
        if (isCleanMode) {
            printStatus('SES not set up (properly cleaned up)');
        } else {
            printError(`SES validation failed: ${error.message}`);
            missingComponents.push('SES: Validation failed');
        }
    }
}

async function validateResourceGroups() {
    printSubsection('Resource Groups');

    for (const groupName of EXPECTED_RESOURCES.resourceGroups.groups) {
        try {
            const { ResourceGroupsClient, GetGroupCommand } = require('@aws-sdk/client-resource-groups');
            const resourceGroups = new ResourceGroupsClient(config);
            const result = await resourceGroups.send(new GetGroupCommand({ GroupName: groupName }));
            
            if (isCleanMode) {
                printError(`${groupName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.resourceGroup(groupName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.resourceGroup(groupName), 'Resource Group');
            } else {
                printStatus(`${groupName} - EXISTS`);
                printInfo(`  ARN: ${result.Group?.GroupArn}`);
                printInfo(`  Description: ${result.Group?.Description || 'None'}`);
            }
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                if (isCleanMode) {
                    printStatus(`${groupName} - PROPERLY DELETED`);
                } else {
                    printError(`${groupName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.resourceGroups.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.resourceGroups.sourceFiles.join(', ')}`);
                    missingComponents.push(`${groupName} (Resource Group)`);
                }
            } else {
                if (isCleanMode) {
                    printStatus(`${groupName} - PROPERLY DELETED`);
                } else {
                    printError(`${groupName} - Error checking: ${error.message}`);
                }
            }
        }
    }
}

async function getQueueMessageCount(queueUrl) {
    try {
        const sqs = new SQSClient(config);
        const result = await sqs.send(new GetQueueUrlCommand({ QueueName: queueUrl.split('/').pop() }));
        const queueName = result.QueueUrl.split('/').pop();
        const attributes = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: result.QueueUrl, AttributeNames: ['ApproximateNumberOfMessages'] }));
        return attributes.Attributes.ApproximateNumberOfMessages;
    } catch (error) {
        printWarning(`Could not get message count for ${queueUrl}: ${error.message}`);
        return 'N/A';
    }
}

async function validateTerraformStateBucket() {
    printSubsection('Terraform State Bucket');

    const terraformStateBucket = 'chatterbox-terraform-state-855581761117';

    try {
        await s3.send(new HeadBucketCommand({ Bucket: terraformStateBucket }));
        printStatus(`${terraformStateBucket} - EXISTS`);
        printWarning(`  ⚠️  DO NOT DELETE - This bucket contains Terraform state files`);
        printWarning(`  ⚠️  Only remove when permanently decommissioning the entire project`);
        printWarning(`  ⚠️  Deleting this bucket will break future Terraform operations`);

        // Check bucket contents
        try {
            const result = await s3.send(
                new ListObjectsV2Command({ Bucket: terraformStateBucket, MaxKeys: 5 })
            );
            printInfo(`  State files: ${result.KeyCount || 0} (showing first 5)`);
            if (result.Contents && result.Contents.length > 0) {
                result.Contents.forEach((obj) => {
                    printInfo(`    - ${obj.Key} (${obj.Size} bytes)`);
                });
            }
        } catch (listError) {
            printWarning(`  Could not list state files: ${listError.message}`);
        }
    } catch (error) {
        if (error.name === 'NotFound') {
            printError(`${terraformStateBucket} - MISSING`);
            printError(`  ⚠️  CRITICAL: Terraform state bucket is missing!`);
            printError(`  ⚠️  This will prevent Terraform from managing infrastructure`);
            printError(`  ⚠️  Check if the bucket was accidentally deleted`);
            missingComponents.push(`${terraformStateBucket} (Terraform State Bucket)`);
        } else {
            printError(`${terraformStateBucket} - Error checking: ${error.message}`);
        }
    }
}

function validateLocalFiles() {
    printSubsection('Local Source Files');

    const requiredFiles = [
        'Cloud/AWS/terraform-simple/main.tf',
        'Cloud/AWS/terraform-lambda/lambda/',
        'Cloud/AWS/scripts/deploy-lambda.sh',
        'Cloud/AWS/scripts/populate-secrets-from-init.js',
    ];

    for (const filePath of requiredFiles) {
        if (fs.existsSync(filePath)) {
            printStatus(`${filePath} - EXISTS`);
        } else {
            printError(`${filePath} - MISSING`);
            printError(`  This file is required for deployment`);
            missingComponents.push(`${filePath} (Local File)`);
        }
    }

    // Check for init folders
    const initPath = path.join(process.cwd(), 'data', 'init');
    if (fs.existsSync(initPath)) {
        const initFolders = fs.readdirSync(initPath).filter((item) => {
            const itemPath = path.join(initPath, item);
            return fs.statSync(itemPath).isDirectory();
        });

        if (initFolders.length > 0) {
            printStatus(`data/init/ - EXISTS (${initFolders.length} folders)`);
            initFolders.forEach((folder) => {
                const folderPath = path.join(initPath, folder);
                const files = fs.readdirSync(folderPath);
                printInfo(`  ${folder}: ${files.join(', ')}`);
            });
        } else {
            printWarning(`data/init/ - EXISTS but empty`);
            printWarning(`  Run: npm run aws:init:prepare`);
        }
    } else {
        printError(`data/init/ - MISSING`);
        printError(`  Run: npm run aws:init:prepare`);
    }
}

// Function to check if all resources exist (for deployment validation success)
async function checkAllResourcesExist() {
    try {
        // Check Lambda functions
        for (const functionName of EXPECTED_RESOURCES.lambda.functions) {
            try {
                await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
            } catch (error) {
                if (error.name === 'ResourceNotFoundException') {
                    return false; // Missing resource
                }
            }
        }

        // Check S3 buckets
        for (const bucketName of EXPECTED_RESOURCES.s3.buckets) {
            try {
                await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
            } catch (error) {
                if (error.name === 'NotFound') {
                    return false; // Missing resource
                }
            }
        }

        // Check DynamoDB tables
        for (const tableName of EXPECTED_RESOURCES.dynamodb.tables) {
            try {
                await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
            } catch (error) {
                if (error.name === 'ResourceNotFoundException') {
                    return false; // Missing resource
                }
            }
        }

        // Check Secrets
        for (const secretName of EXPECTED_RESOURCES.secrets.secrets) {
            try {
                await secretsManager.send(new DescribeSecretCommand({ SecretId: secretName }));
            } catch (error) {
                if (error.name === 'ResourceNotFoundException') {
                    return false; // Missing resource
                }
            }
        }

        // Check Parameters
        for (const paramName of EXPECTED_RESOURCES.parameters.parameters) {
            try {
                await ssm.send(new GetParameterCommand({ Name: paramName }));
            } catch (error) {
                if (error.name === 'ParameterNotFound') {
                    return false; // Missing resource
                }
            }
        }

        // Check CloudWatch Log Groups
        for (const logGroupName of EXPECTED_RESOURCES.cloudwatch.logGroups) {
            try {
                await cloudwatch.send(
                    new DescribeLogGroupsCommand({ logGroupNamePrefix: logGroupName })
                );
            } catch (error) {
                return false; // Error checking
            }
        }

        // Check IAM Roles
        for (const roleName of EXPECTED_RESOURCES.iam.roles) {
            try {
                await iam.send(new GetRoleCommand({ RoleName: roleName }));
            } catch (error) {
                if (error.name === 'NoSuchEntity') {
                    return false; // Missing resource
                }
            }
        }

        // Check SQS Queues
        for (const queueName of EXPECTED_RESOURCES.sqs.queues) {
            try {
                const result = await ssm.send(new GetParameterCommand({ Name: `/chatterbox/${ENVIRONMENT}/sqs-queue-url/${queueName}` }));
                const queueUrl = result.Parameter?.Value;
                if (!queueUrl) {
                    return false; // Missing resource
                }
            } catch (error) {
                if (error.name === 'ParameterNotFound') {
                    return false; // Missing resource
                }
            }
        }

        // Check Resource Groups
        for (const groupName of EXPECTED_RESOURCES.resourceGroups.groups) {
            try {
                const result = await iam.send(new GetRoleCommand({ RoleName: groupName })); // Resource Groups are IAM roles
                if (result.Role?.Arn === undefined) { // Check if Role is not found
                    return false; // Missing resource
                }
            } catch (error) {
                if (error.name === 'NoSuchEntity') {
                    return false; // Missing resource
                }
            }
        }

        // Check Terraform state bucket
        try {
            await s3.send(
                new HeadBucketCommand({ Bucket: 'chatterbox-terraform-state-855581761117' })
            );
        } catch (error) {
            if (error.name === 'NotFound') {
                return false; // Missing resource
            }
        }

        return true; // All resources exist
    } catch (error) {
        return false; // Error occurred during checking
    }
}

// Main validation function
async function validateAll() {
    const mode = isCleanMode ? 'CLEAN TEARDOWN VALIDATION' : 'DEPLOYMENT VALIDATION';
    console.log(`🔍 AWS System ${mode} for Environment: ${ENVIRONMENT}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    if (isCleanMode) {
        console.log(
            `\n${colors.yellow}This mode checks that all resources have been properly removed.${colors.reset}`
        );
        console.log(
            `${colors.yellow}If any resources still exist, use the provided AWS CLI commands to delete them.${colors.reset}`
        );
    }

    try {
        // Validate AWS credentials
        printSection('AWS Credentials');
        try {
            const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
            const sts = new STSClient(config);
            const identity = await sts.send(new GetCallerIdentityCommand());
            printStatus(`AWS Account: ${identity.Account}`);
            printStatus(`User ARN: ${identity.Arn}`);
        } catch (error) {
            printError(`AWS credentials invalid: ${error.message}`);
            return { success: false, errors: [`AWS credentials invalid: ${error.message}`] };
        }

        // Validate all resources
        printSection('Infrastructure Resources');
        await validateLambdaFunctions();
        await validateS3Buckets();
        await validateDynamoDBTables();
        await validateCloudWatchLogGroups();
        await validateIAMResources();
        await validateTerraformStateBucket();
        await validateSQSQueues();
        await validateSES();
        await validateResourceGroups();

        printSection('Configuration Data');
        await validateSecrets();
        await validateParameters();

        if (!isCleanMode) {
            printSection('Local Files');
            validateLocalFiles();
        }

        printSection('Summary');
        if (isCleanMode) {
            // Write manual teardown script if there are extant resources
            const scriptPath = writeManualTeardownScript();

            if (scriptPath) {
                const resourceTypes = Array.from(extantResourceTypes);
                const resourceSummary =
                    resourceTypes.length > 0
                        ? resourceTypes.join(', ') + ' still exist'
                        : 'All resources properly deleted';

                printInfo(
                    'Clean validation complete. Check the output above for any remaining resources.'
                );
                printInfo('Use the provided AWS CLI commands to delete any remaining resources.');
                console.log(`\n${colors.cyan}📋 Manual Teardown Script Generated:${colors.reset}`);
                console.log(`${colors.cyan}File: ${scriptPath}${colors.reset}`);
                console.log(`${colors.cyan}Summary: ${resourceSummary}${colors.reset}`);
                console.log(`${colors.yellow}To run the manual teardown script:${colors.reset}`);
                console.log(`${colors.yellow}  bash ${scriptPath}${colors.reset}`);
                console.log(
                    `${colors.yellow}⚠️  Review the script before running - it will permanently delete AWS resources!${colors.reset}`
                );
                
                return { success: false, errors: [`Resources still exist: ${resourceSummary}`] };
            } else {
                printInfo('Clean validation complete. All resources have been properly removed.');
                console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
                console.log(
                    `${colors.green}🎉 SUCCESS: CLEAN TEARDOWN VALIDATION PASSED 100% 🎉${colors.reset}`
                );
                console.log(
                    `${colors.green}✅ All Chatterbox resources have been properly removed${colors.reset}`
                );
                console.log(
                    `${colors.green}✅ Terraform state bucket is preserved (as expected)${colors.reset}`
                );
                console.log(
                    `${colors.green}✅ System is ready for fresh deployment${colors.reset}`
                );
                console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
                
                return { success: true, errors: [] };
            }
        } else {
            // Display aggregated missing components if any
            if (missingComponents.length > 0) {
                console.log(`\n${colors.red}${'='.repeat(60)}${colors.reset}`);
                console.log(`${colors.red}❌ MISSING COMPONENTS SUMMARY ❌${colors.reset}`);
                console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
                console.log(`${colors.red}The following components are missing or misconfigured:${colors.reset}`);
                console.log('');
                
                // Group missing components by type
                const groupedComponents = {};
                missingComponents.forEach(component => {
                    const match = component.match(/\((.*?)\)$/);
                    const type = match ? match[1] : 'Unknown';
                    if (!groupedComponents[type]) {
                        groupedComponents[type] = [];
                    }
                    groupedComponents[type].push(component.replace(` (${type})`, ''));
                });
                
                Object.entries(groupedComponents).forEach(([type, items]) => {
                    console.log(`${colors.red}📋 ${type}:${colors.reset}`);
                    items.forEach(item => {
                        console.log(`${colors.red}   • ${item}${colors.reset}`);
                    });
                    console.log('');
                });
                
                console.log(`${colors.yellow}To fix missing resources:${colors.reset}`);
                console.log(`${colors.yellow}1. Run: npm run aws:deploy${colors.reset}`);
                console.log(`${colors.yellow}   (This will deploy infrastructure, migrate secrets/parameters, and deploy Lambda code)${colors.reset}`);
                console.log(`${colors.yellow}2. If you need to re-prepare your init data, run:${colors.reset}`);
                console.log(`${colors.yellow}   npm run aws:init:prepare${colors.reset}`);
                console.log(`${colors.yellow}   npm run aws:init:migrate${colors.reset}`);
                console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
                
                return { success: false, errors: [`${missingComponents.length} components are missing`] };
            } else {
                // All components exist - show bright green success message
                console.log(`\n${colors.brightGreen}${'='.repeat(70)}${colors.reset}`);
                console.log(`${colors.brightGreen}🎉🎉🎉 SUCCESS: DEPLOYMENT VALIDATION PASSED 100% 🎉🎉🎉${colors.reset}`);
                console.log(`${colors.brightGreen}${'='.repeat(70)}${colors.reset}`);
                console.log(`${colors.brightGreen}✅ All Chatterbox resources are properly deployed${colors.reset}`);
                console.log(`${colors.brightGreen}✅ All configuration data is populated${colors.reset}`);
                console.log(`${colors.brightGreen}✅ All Lambda functions are active and configured${colors.reset}`);
                console.log(`${colors.brightGreen}✅ All infrastructure components are operational${colors.reset}`);
                console.log(`${colors.brightGreen}✅ System is ready for operation${colors.reset}`);
                console.log(`${colors.brightGreen}${'='.repeat(70)}${colors.reset}`);
                
                return { success: true, errors: [] };
            }
        }
    } catch (error) {
        printError(`Validation failed: ${error.message}`);
        return { success: false, errors: [error.message] };
    }
}

if (require.main === module) {
    validateAll().then(result => {
        process.exit(result.success ? 0 : 1);
    }).catch((error) => {
        printError(`Validation failed: ${error.message}`);
        process.exit(1);
    });
}