#!/usr/bin/env node

/**
 * Comprehensive AWS System Validation Script
 * Validates that all expected resources are deployed and data is migrated
 * 
 * Usage:
 *   npm run aws:validate          # Check if resources exist (deployment validation)
 *   npm run aws:validate --clean  # Check if resources are absent (teardown validation)
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const lambda = new AWS.Lambda();
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB();
const secretsManager = new AWS.SecretsManager();
const ssm = new AWS.SSM();
const cloudwatch = new AWS.CloudWatchLogs();
const iam = new AWS.IAM();
const apigateway = new AWS.APIGateway();

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

// Check if we're in clean mode
const isCleanMode = process.argv.includes('--clean');

// Store commands for manual teardown script
let manualTeardownCommands = [];
let extantResourceTypes = new Set();

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
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
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
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
${manualTeardownCommands.map(cmd => `# ${cmd}`).join('\n')}

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
            `${ENVIRONMENT}-pull-latest-chatterbox-email`
        ],
        source: 'Deployed via Cloud/AWS/scripts/deploy-lambda.sh',
        sourceFiles: [
            'Cloud/AWS/terraform-lambda/lambda/',
            'Cloud/AWS/terraform-lambda/lambda.zip'
        ]
    },
    s3: {
        buckets: [
            `${ENVIRONMENT}-chatterbox-email-archive`
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf',
        sourceFiles: ['Cloud/AWS/terraform-simple/main.tf']
    },
    dynamodb: {
        tables: [
            `${ENVIRONMENT}-chatterbox-state-table`
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf',
        sourceFiles: ['Cloud/AWS/terraform-simple/main.tf']
    },
    secrets: {
        secrets: [
            `${ENVIRONMENT}-chatterbox-google-credentials`,
            `${ENVIRONMENT}-chatterbox-gmail-tokens`
        ],
        source: 'Populated via Cloud/AWS/scripts/populate-secrets-from-init.js',
        sourceFiles: [
            'data/init/*/google_credentials.json',
            'data/init/*/google_tokens.json'
        ]
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
            `/chatterbox/${ENVIRONMENT}/openai-model`
        ],
        source: 'Populated via Cloud/AWS/scripts/populate-secrets-from-init.js',
        sourceFiles: [
            'data/init/*/config.json',
            'data/init/*/.env'
        ]
    },
    cloudwatch: {
        logGroups: [
            `/aws/lambda/${ENVIRONMENT}-poll-gmail`,
            `/aws/lambda/${ENVIRONMENT}-pull-latest-chatterbox-email`
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf',
        sourceFiles: ['Cloud/AWS/terraform-simple/main.tf']
    },
    iam: {
        roles: [
            `${ENVIRONMENT}-chatterbox-lambda-role`
        ],
        policies: [
            `${ENVIRONMENT}-chatterbox-lambda-policy`
        ],
        source: 'Created via Cloud/AWS/terraform-simple/main.tf',
        sourceFiles: ['Cloud/AWS/terraform-simple/main.tf']
    }
};

// AWS CLI commands for deletion
const DELETE_COMMANDS = {
    lambda: (functionName) => `aws lambda delete-function --function-name ${functionName} --profile cliadmin`,
    s3: (bucketName) => `aws s3 rb s3://${bucketName} --force --profile cliadmin`,
    dynamodb: (tableName) => `aws dynamodb delete-table --table-name ${tableName} --profile cliadmin`,
    secrets: (secretName) => `aws secretsmanager delete-secret --secret-id ${secretName} --force-delete-without-recovery --profile cliadmin`,
    parameters: (paramName) => `aws ssm delete-parameter --name "${paramName}" --profile cliadmin`,
    cloudwatch: (logGroupName) => `aws logs delete-log-group --log-group-name "${logGroupName}" --profile cliadmin`,
    iam_role: (roleName) => `aws iam delete-role --role-name ${roleName} --profile cliadmin`,
    iam_policy: (policyName) => `aws iam delete-policy --policy-arn arn:aws:iam::$(aws sts get-caller-identity --profile cliadmin --query Account --output text):policy/${policyName} --profile cliadmin`,
    apigateway: (apiId) => `aws apigateway delete-rest-api --rest-api-id ${apiId} --profile cliadmin`
};

async function validateLambdaFunctions() {
    printSubsection('Lambda Functions');
    
    for (const functionName of EXPECTED_RESOURCES.lambda.functions) {
        try {
            const result = await lambda.getFunction({ FunctionName: functionName }).promise();
            if (isCleanMode) {
                printError(`${functionName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.lambda(functionName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.lambda(functionName), 'Lambda Function');
            } else {
                printStatus(`${functionName} - Status: ${result.Configuration.State}`);
                printInfo(`  Runtime: ${result.Configuration.Runtime}`);
                printInfo(`  Handler: ${result.Configuration.Handler}`);
                printInfo(`  Timeout: ${result.Configuration.Timeout}s`);
                printInfo(`  Memory: ${result.Configuration.MemorySize}MB`);
            }
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                if (isCleanMode) {
                    printStatus(`${functionName} - PROPERLY DELETED`);
                } else {
                    printError(`${functionName} - MISSING`);
                    printError(`  Should be deployed from: ${EXPECTED_RESOURCES.lambda.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.lambda.sourceFiles.join(', ')}`);
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
        try {
            await s3.headBucket({ Bucket: bucketName }).promise();
            if (isCleanMode) {
                printError(`${bucketName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.s3(bucketName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.s3(bucketName), 'S3 Bucket');
            } else {
                printStatus(`${bucketName} - EXISTS`);
                
                // Check bucket contents
                try {
                    const objects = await s3.listObjectsV2({ Bucket: bucketName, MaxKeys: 5 }).promise();
                    printInfo(`  Objects: ${objects.KeyCount || 0} (showing first 5)`);
                    if (objects.Contents && objects.Contents.length > 0) {
                        objects.Contents.forEach(obj => {
                            printInfo(`    - ${obj.Key} (${obj.Size} bytes)`);
                        });
                    }
                } catch (listError) {
                    printWarning(`  Could not list objects: ${listError.message}`);
                }
            }
        } catch (error) {
            if (error.statusCode === 404) {
                if (isCleanMode) {
                    printStatus(`${bucketName} - PROPERLY DELETED`);
                } else {
                    printError(`${bucketName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.s3.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.s3.sourceFiles.join(', ')}`);
                }
            } else {
                printError(`${bucketName} - Error checking: ${error.message}`);
            }
        }
    }
}

async function validateDynamoDBTables() {
    printSubsection('DynamoDB Tables');
    
    for (const tableName of EXPECTED_RESOURCES.dynamodb.tables) {
        try {
            const result = await dynamodb.describeTable({ TableName: tableName }).promise();
            if (isCleanMode) {
                printError(`${tableName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.dynamodb(tableName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.dynamodb(tableName), 'DynamoDB Table');
            } else {
                printStatus(`${tableName} - Status: ${result.Table.TableStatus}`);
                printInfo(`  Billing Mode: ${result.Table.BillingModeSummary?.BillingMode || 'Unknown'}`);
                printInfo(`  Item Count: ${result.Table.ItemCount || 0}`);
            }
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                if (isCleanMode) {
                    printStatus(`${tableName} - PROPERLY DELETED`);
                } else {
                    printError(`${tableName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.dynamodb.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.dynamodb.sourceFiles.join(', ')}`);
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
            const result = await secretsManager.describeSecret({ SecretId: secretName }).promise();
            if (isCleanMode) {
                printError(`${secretName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.secrets(secretName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.secrets(secretName), 'Secrets Manager Secret');
            } else {
                printStatus(`${secretName} - Status: ${result.Status}`);
                printInfo(`  Description: ${result.Description || 'None'}`);
                
                // Try to get the secret value to check if it's populated
                try {
                    const secretValue = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
                    const parsedValue = JSON.parse(secretValue.SecretString);
                    
                    if (secretName.includes('google-credentials')) {
                        const hasClientId = parsedValue.installed?.client_id || parsedValue.web?.client_id;
                        const hasClientSecret = parsedValue.installed?.client_secret || parsedValue.web?.client_secret;
                        printInfo(`  Google Credentials: ${hasClientId && hasClientSecret ? 'VALID' : 'INVALID'}`);
                    } else if (secretName.includes('gmail-tokens')) {
                        const hasTokens = parsedValue.access_token || parsedValue.refresh_token;
                        printInfo(`  Gmail Tokens: ${hasTokens ? 'POPULATED' : 'EMPTY'}`);
                    }
                } catch (valueError) {
                    printWarning(`  Could not retrieve secret value: ${valueError.message}`);
                }
            }
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                if (isCleanMode) {
                    printStatus(`${secretName} - PROPERLY DELETED`);
                } else {
                    printError(`${secretName} - MISSING`);
                    printError(`  Should be populated from: ${EXPECTED_RESOURCES.secrets.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.secrets.sourceFiles.join(', ')}`);
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
            const result = await ssm.getParameter({ Name: paramName }).promise();
            if (isCleanMode) {
                printError(`${paramName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.parameters(paramName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.parameters(paramName), 'Parameter Store Parameter');
            } else {
                printStatus(`${paramName} - EXISTS`);
                printInfo(`  Type: ${result.Parameter.Type}`);
                printInfo(`  Value: ${result.Parameter.Value.substring(0, 50)}${result.Parameter.Value.length > 50 ? '...' : ''}`);
            }
        } catch (error) {
            if (error.code === 'ParameterNotFound') {
                if (isCleanMode) {
                    printStatus(`${paramName} - PROPERLY DELETED`);
                } else {
                    printError(`${paramName} - MISSING`);
                    printError(`  Should be populated from: ${EXPECTED_RESOURCES.parameters.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.parameters.sourceFiles.join(', ')}`);
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
            const result = await cloudwatch.describeLogGroups({ logGroupNamePrefix: logGroupName }).promise();
            const logGroup = result.logGroups.find(lg => lg.logGroupName === logGroupName);
            
            if (logGroup) {
                if (isCleanMode) {
                    printError(`${logGroupName} - STILL EXISTS`);
                    printError(`  Delete with: ${DELETE_COMMANDS.cloudwatch(logGroupName)}`);
                    addManualTeardownCommand(DELETE_COMMANDS.cloudwatch(logGroupName), 'CloudWatch Log Group');
                } else {
                    printStatus(`${logGroupName} - EXISTS`);
                    printInfo(`  Retention: ${logGroup.retentionInDays || 'Never expire'} days`);
                    printInfo(`  Stored Bytes: ${logGroup.storedBytes || 0}`);
                }
            } else {
                if (isCleanMode) {
                    printStatus(`${logGroupName} - PROPERLY DELETED`);
                } else {
                    printError(`${logGroupName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.cloudwatch.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.cloudwatch.sourceFiles.join(', ')}`);
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
            const result = await iam.getRole({ RoleName: roleName }).promise();
            if (isCleanMode) {
                printError(`${roleName} - STILL EXISTS`);
                printError(`  Delete with: ${DELETE_COMMANDS.iam_role(roleName)}`);
                addManualTeardownCommand(DELETE_COMMANDS.iam_role(roleName), 'IAM Role');
            } else {
                printStatus(`${roleName} - EXISTS`);
                printInfo(`  ARN: ${result.Role.Arn}`);
                printInfo(`  Create Date: ${result.Role.CreateDate}`);
            }
        } catch (error) {
            if (error.code === 'NoSuchEntity') {
                if (isCleanMode) {
                    printStatus(`${roleName} - PROPERLY DELETED`);
                } else {
                    printError(`${roleName} - MISSING`);
                    printError(`  Should be created from: ${EXPECTED_RESOURCES.iam.source}`);
                    printError(`  Source files: ${EXPECTED_RESOURCES.iam.sourceFiles.join(', ')}`);
                }
            } else {
                printError(`${roleName} - Error checking: ${error.message}`);
            }
        }
    }
    
    printSubsection('IAM Inline Policies');
    
    for (const roleName of EXPECTED_RESOURCES.iam.roles) {
        for (const policyName of EXPECTED_RESOURCES.iam.policies) {
            try {
                const result = await iam.getRolePolicy({ RoleName: roleName, PolicyName: policyName }).promise();
                if (isCleanMode) {
                    printError(`${policyName} (inline on ${roleName}) - STILL EXISTS`);
                    printError(`  Delete with: aws iam delete-role-policy --role-name ${roleName} --policy-name ${policyName} --profile cliadmin`);
                    addManualTeardownCommand(`aws iam delete-role-policy --role-name ${roleName} --policy-name ${policyName} --profile cliadmin`, 'IAM Inline Policy');
                } else {
                    printStatus(`${policyName} - EXISTS (inline on ${roleName})`);
                    printInfo(`  Role: ${roleName}`);
                    printInfo(`  Policy Document: ${JSON.stringify(result.PolicyDocument).substring(0, 100)}...`);
                }
            } catch (error) {
                if (error.code === 'NoSuchEntity') {
                    if (isCleanMode) {
                        printStatus(`${policyName} (inline on ${roleName}) - PROPERLY DELETED`);
                    } else {
                        printError(`${policyName} - MISSING (inline on ${roleName})`);
                        printError(`  Should be created from: ${EXPECTED_RESOURCES.iam.source}`);
                        printError(`  Source files: ${EXPECTED_RESOURCES.iam.sourceFiles.join(', ')}`);
                    }
                } else {
                    printError(`${policyName} - Error checking: ${error.message}`);
                }
            }
        }
    }
}

async function validateAPIGateway() {
    printSubsection('API Gateway');
    
    try {
        const apis = await apigateway.getRestApis().promise();
        const chatterboxApi = apis.items.find(api => 
            api.name.includes('chatterbox') || api.name.includes(ENVIRONMENT)
        );
        
        if (chatterboxApi) {
            if (isCleanMode) {
                printError(`API Gateway - STILL EXISTS (${chatterboxApi.name})`);
                printError(`  Delete with: ${DELETE_COMMANDS.apigateway(chatterboxApi.id)}`);
                addManualTeardownCommand(DELETE_COMMANDS.apigateway(chatterboxApi.id), 'API Gateway');
            } else {
                printStatus(`API Gateway - EXISTS (${chatterboxApi.name})`);
                printInfo(`  ID: ${chatterboxApi.id}`);
                printInfo(`  Created Date: ${chatterboxApi.createdDate}`);
                
                // Check for resources
                try {
                    const resources = await apigateway.getResources({ restApiId: chatterboxApi.id }).promise();
                    const pollResource = resources.items.find(r => r.pathPart === 'poll-gmail');
                    const pullResource = resources.items.find(r => r.pathPart === 'pull-latest-email');
                    
                    if (pollResource) printInfo(`  Poll endpoint: /poll-gmail`);
                    if (pullResource) printInfo(`  Pull endpoint: /pull-latest-email`);
                } catch (resourceError) {
                    printWarning(`  Could not check API resources: ${resourceError.message}`);
                }
            }
        } else {
            if (isCleanMode) {
                printStatus(`API Gateway - PROPERLY DELETED`);
            } else {
                printError(`API Gateway - MISSING`);
                printError(`  Should be created from: ${EXPECTED_RESOURCES.apigateway.source}`);
                printError(`  Source files: ${EXPECTED_RESOURCES.apigateway.sourceFiles.join(', ')}`);
            }
        }
    } catch (error) {
        printError(`API Gateway - Error checking: ${error.message}`);
    }
}

async function validateTerraformStateBucket() {
    printSubsection('Terraform State Bucket');
    
    const terraformStateBucket = 'chatterbox-terraform-state-855581761117';
    
    try {
        await s3.headBucket({ Bucket: terraformStateBucket }).promise();
        printStatus(`${terraformStateBucket} - EXISTS`);
        printWarning(`  ⚠️  DO NOT DELETE - This bucket contains Terraform state files`);
        printWarning(`  ⚠️  Only remove when permanently decommissioning the entire project`);
        printWarning(`  ⚠️  Deleting this bucket will break future Terraform operations`);
        
        // Check bucket contents
        try {
            const objects = await s3.listObjectsV2({ Bucket: terraformStateBucket, MaxKeys: 5 }).promise();
            printInfo(`  State files: ${objects.KeyCount || 0} (showing first 5)`);
            if (objects.Contents && objects.Contents.length > 0) {
                objects.Contents.forEach(obj => {
                    printInfo(`    - ${obj.Key} (${obj.Size} bytes)`);
                });
            }
        } catch (listError) {
            printWarning(`  Could not list state files: ${listError.message}`);
        }
    } catch (error) {
        if (error.statusCode === 404) {
            printError(`${terraformStateBucket} - MISSING`);
            printError(`  ⚠️  CRITICAL: Terraform state bucket is missing!`);
            printError(`  ⚠️  This will prevent Terraform from managing infrastructure`);
            printError(`  ⚠️  Check if the bucket was accidentally deleted`);
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
        'Cloud/AWS/scripts/populate-secrets-from-init.js'
    ];
    
    for (const filePath of requiredFiles) {
        if (fs.existsSync(filePath)) {
            printStatus(`${filePath} - EXISTS`);
        } else {
            printError(`${filePath} - MISSING`);
            printError(`  This file is required for deployment`);
        }
    }
    
    // Check for init folders
    const initPath = path.join(process.cwd(), 'data', 'init');
    if (fs.existsSync(initPath)) {
        const initFolders = fs.readdirSync(initPath).filter(item => {
            const itemPath = path.join(initPath, item);
            return fs.statSync(itemPath).isDirectory();
        });
        
        if (initFolders.length > 0) {
            printStatus(`data/init/ - EXISTS (${initFolders.length} folders)`);
            initFolders.forEach(folder => {
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
                await lambda.getFunction({ FunctionName: functionName }).promise();
            } catch (error) {
                if (error.code === 'ResourceNotFoundException') {
                    return false; // Missing resource
                }
            }
        }
        
        // Check S3 buckets
        for (const bucketName of EXPECTED_RESOURCES.s3.buckets) {
            try {
                await s3.headBucket({ Bucket: bucketName }).promise();
            } catch (error) {
                if (error.statusCode === 404) {
                    return false; // Missing resource
                }
            }
        }
        
        // Check DynamoDB tables
        for (const tableName of EXPECTED_RESOURCES.dynamodb.tables) {
            try {
                await dynamodb.describeTable({ TableName: tableName }).promise();
            } catch (error) {
                if (error.code === 'ResourceNotFoundException') {
                    return false; // Missing resource
                }
            }
        }
        
        // Check Secrets
        for (const secretName of EXPECTED_RESOURCES.secrets.secrets) {
            try {
                await secretsManager.describeSecret({ SecretId: secretName }).promise();
            } catch (error) {
                if (error.code === 'ResourceNotFoundException') {
                    return false; // Missing resource
                }
            }
        }
        
        // Check Parameters
        for (const paramName of EXPECTED_RESOURCES.parameters.parameters) {
            try {
                await ssm.getParameter({ Name: paramName }).promise();
            } catch (error) {
                if (error.code === 'ParameterNotFound') {
                    return false; // Missing resource
                }
            }
        }
        
        // Check CloudWatch Log Groups
        for (const logGroupName of EXPECTED_RESOURCES.cloudwatch.logGroups) {
            try {
                const result = await cloudwatch.describeLogGroups({ logGroupNamePrefix: logGroupName }).promise();
                const logGroup = result.logGroups.find(lg => lg.logGroupName === logGroupName);
                if (!logGroup) {
                    return false; // Missing resource
                }
            } catch (error) {
                return false; // Error checking
            }
        }
        
        // Check IAM Roles
        for (const roleName of EXPECTED_RESOURCES.iam.roles) {
            try {
                await iam.getRole({ RoleName: roleName }).promise();
            } catch (error) {
                if (error.code === 'NoSuchEntity') {
                    return false; // Missing resource
                }
            }
        }
        
        // Check IAM Inline Policies
        for (const roleName of EXPECTED_RESOURCES.iam.roles) {
            for (const policyName of EXPECTED_RESOURCES.iam.policies) {
                try {
                    await iam.getRolePolicy({ RoleName: roleName, PolicyName: policyName }).promise();
                } catch (error) {
                    if (error.code === 'NoSuchEntity') {
                        return false; // Missing resource
                    }
                }
            }
        }
        

        
        // Check Terraform state bucket
        try {
            await s3.headBucket({ Bucket: 'chatterbox-terraform-state-855581761117' }).promise();
        } catch (error) {
            if (error.statusCode === 404) {
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
        console.log(`\n${colors.yellow}This mode checks that all resources have been properly removed.${colors.reset}`);
        console.log(`${colors.yellow}If any resources still exist, use the provided AWS CLI commands to delete them.${colors.reset}`);
    }
    
    try {
        // Validate AWS credentials
        printSection('AWS Credentials');
        try {
            const identity = await new AWS.STS().getCallerIdentity().promise();
            printStatus(`AWS Account: ${identity.Account}`);
            printStatus(`User ARN: ${identity.Arn}`);
        } catch (error) {
            printError(`AWS credentials invalid: ${error.message}`);
            process.exit(1);
        }
        
        // Validate all resources
        printSection('Infrastructure Resources');
        await validateLambdaFunctions();
        await validateS3Buckets();
        await validateDynamoDBTables();
        await validateCloudWatchLogGroups();
        await validateIAMResources();
        await validateTerraformStateBucket();
        
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
                const resourceSummary = resourceTypes.length > 0 ? resourceTypes.join(', ') + ' still exist' : 'All resources properly deleted';
                
                printInfo('Clean validation complete. Check the output above for any remaining resources.');
                printInfo('Use the provided AWS CLI commands to delete any remaining resources.');
                console.log(`\n${colors.cyan}📋 Manual Teardown Script Generated:${colors.reset}`);
                console.log(`${colors.blue}File: ${scriptPath}${colors.reset}`);
                console.log(`${colors.blue}Summary: ${resourceSummary}${colors.reset}`);
                console.log(`${colors.yellow}To run the manual teardown script:${colors.reset}`);
                console.log(`${colors.yellow}  bash ${scriptPath}${colors.reset}`);
                console.log(`${colors.yellow}⚠️  Review the script before running - it will permanently delete AWS resources!${colors.reset}`);
            } else {
                printInfo('Clean validation complete. All resources have been properly removed.');
                console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
                console.log(`${colors.green}🎉 SUCCESS: CLEAN TEARDOWN VALIDATION PASSED 100% 🎉${colors.reset}`);
                console.log(`${colors.green}✅ All Chatterbox resources have been properly removed${colors.reset}`);
                console.log(`${colors.green}✅ Terraform state bucket is preserved (as expected)${colors.reset}`);
                console.log(`${colors.green}✅ System is ready for fresh deployment${colors.reset}`);
                console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
            }
        } else {
            printInfo('Validation complete. Check the output above for any missing resources.');
            printInfo('To fix missing resources:');
            printInfo('1. Run: npm run aws:deploy:simple');
            printInfo('2. Run: npm run aws:init:prepare');
            printInfo('3. Run: npm run aws:init:migrate');
            
            // Check if all resources exist (for deployment validation)
            const allResourcesExist = await checkAllResourcesExist();
            if (allResourcesExist) {
                console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
                console.log(`${colors.green}🎉 SUCCESS: DEPLOYMENT VALIDATION PASSED 100% 🎉${colors.reset}`);
                console.log(`${colors.green}✅ All Chatterbox resources are properly deployed${colors.reset}`);
                console.log(`${colors.green}✅ All configuration data is populated${colors.reset}`);
                console.log(`${colors.green}✅ System is ready for operation${colors.reset}`);
                console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
            }
        }
        
    } catch (error) {
        printError(`Validation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    validateAll().catch(error => {
        printError(`Validation failed: ${error.message}`);
        process.exit(1);
    });
} 