#!/usr/bin/env node

/**
 * AWS Configuration Dump Script
 * Dumps all AWS parameters and bucket values related to Chatterbox
 * 
 * This script retrieves:
 * - Parameter Store parameters (all chatterbox parameters)
 * - Secrets Manager secrets (chatterbox secrets)
 * - S3 bucket contents (chatterbox buckets)
 * - DynamoDB table contents (chatterbox tables)
 * - Lambda function configurations
 * - CloudWatch log groups
 */

const { SSMClient, GetParametersByPathCommand, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');
const { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, ScanCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { LambdaClient, GetFunctionConfigurationCommand, ListFunctionsCommand } = require('@aws-sdk/client-lambda');

// AWS Clients
const ssmClient = new SSMClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin'
});
const secretsClient = new SecretsManagerClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin'
});
const s3Client = new S3Client({ 
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin'
});
const dynamoClient = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin'
});
const lambdaClient = new LambdaClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin'
});


// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const PARAMETER_STORE_PREFIX = `/chatterbox/${ENVIRONMENT}`;

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function printInfo(message) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${'='.repeat(message.length)}`);
}

function printSubsection(message) {
    console.log(`\n${colors.bright}${colors.magenta}${message}${colors.reset}`);
    console.log(`${'-'.repeat(message.length)}`);
}

/**
 * Dumps Parameter Store parameters
 */
async function dumpParameterStore() {
    printHeader('Parameter Store Parameters');
    
    try {
        const command = new GetParametersByPathCommand({
            Path: PARAMETER_STORE_PREFIX,
            Recursive: true,
            WithDecryption: true
        });
        
        const response = await ssmClient.send(command);
        
        if (!response.Parameters || response.Parameters.length === 0) {
            printWarning(`No parameters found under ${PARAMETER_STORE_PREFIX}`);
            return;
        }
        
        printSuccess(`Found ${response.Parameters.length} parameters:`);
        
        for (const param of response.Parameters) {
            console.log(`\n${colors.cyan}Parameter:${colors.reset} ${param.Name}`);
            console.log(`  Type: ${param.Type}`);
            console.log(`  Value: ${param.Value}`);
            console.log(`  Last Modified: ${param.LastModifiedDate}`);
            console.log(`  Version: ${param.Version}`);
        }
        
    } catch (error) {
        printError(`Error retrieving parameters: ${error.message}`);
    }
}

/**
 * Dumps Secrets Manager secrets
 */
async function dumpSecretsManager() {
    printHeader('Secrets Manager Secrets');
    
    try {
        const listCommand = new ListSecretsCommand({});
        const listResponse = await secretsClient.send(listCommand);
        
        const chatterboxSecrets = listResponse.SecretList?.filter(secret => 
            secret.Name?.includes('chatterbox') || secret.Name?.includes(ENVIRONMENT)
        ) || [];
        
        if (chatterboxSecrets.length === 0) {
            printWarning('No Chatterbox secrets found');
            return;
        }
        
        printSuccess(`Found ${chatterboxSecrets.length} Chatterbox secrets:`);
        
        for (const secret of chatterboxSecrets) {
            console.log(`\n${colors.cyan}Secret:${colors.reset} ${secret.Name}`);
            console.log(`  Description: ${secret.Description || 'N/A'}`);
            console.log(`  Created: ${secret.CreatedDate}`);
            console.log(`  Last Modified: ${secret.LastModifiedDate}`);
            console.log(`  Version Count: ${secret.SecretVersionsToStages ? Object.keys(secret.SecretVersionsToStages).length : 'N/A'}`);
            
            // Try to get the secret value (without sensitive data)
            try {
                const getCommand = new GetSecretValueCommand({ SecretId: secret.Name });
                const secretResponse = await secretsClient.send(getCommand);
                
                if (secretResponse.SecretString) {
                    const secretData = JSON.parse(secretResponse.SecretString);
                    console.log(`  Keys: ${Object.keys(secretData).join(', ')}`);
                    
                    // Show non-sensitive keys only
                    const safeKeys = Object.keys(secretData).filter(key => 
                        !key.toLowerCase().includes('token') && 
                        !key.toLowerCase().includes('secret') && 
                        !key.toLowerCase().includes('password') &&
                        !key.toLowerCase().includes('key')
                    );
                    
                    if (safeKeys.length > 0) {
                        console.log(`  Safe Keys: ${safeKeys.join(', ')}`);
                    }
                }
            } catch (secretError) {
                console.log(`  Error retrieving secret value: ${secretError.message}`);
            }
        }
        
    } catch (error) {
        printError(`Error retrieving secrets: ${error.message}`);
    }
}

/**
 * Dumps S3 bucket contents
 */
async function dumpS3Buckets() {
    printHeader('S3 Bucket Contents');
    
    const chatterboxBuckets = [
        `${ENVIRONMENT}-chatterbox-email-archive`,
        `${ENVIRONMENT}-chatterbox-data-bucket`,
        `${ENVIRONMENT}-chatterbox-backup-bucket`,
        'chatterbox-email-archive',
        'chatterbox-terraform-state-855581761117'
    ];
    
    for (const bucketName of chatterboxBuckets) {
        printSubsection(`Bucket: ${bucketName}`);
        
        try {
            // Check if bucket exists
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                MaxKeys: 50 // Limit to first 50 objects
            });
            
            const response = await s3Client.send(listCommand);
            
            if (!response.Contents || response.Contents.length === 0) {
                printWarning(`  Bucket is empty or does not exist`);
                continue;
            }
            
            printSuccess(`  Found ${response.Contents.length} objects (showing first 50):`);
            
            for (const object of response.Contents) {
                const size = object.Size || 0;
                const sizeStr = size < 1024 ? `${size} B` : 
                               size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : 
                               `${(size / (1024 * 1024)).toFixed(1)} MB`;
                
                console.log(`    ${object.Key} (${sizeStr}) - ${object.LastModified}`);
            }
            
            if (response.IsTruncated) {
                printWarning(`    ... and ${response.KeyCount || 0} more objects`);
            }
            
        } catch (error) {
            if (error.name === 'NoSuchBucket') {
                printWarning(`  Bucket does not exist`);
            } else {
                printError(`  Error accessing bucket: ${error.message}`);
            }
        }
    }
}

/**
 * Dumps DynamoDB table contents
 */
async function dumpDynamoDBTables() {
    printHeader('DynamoDB Table Contents');
    
    const chatterboxTables = [
        `${ENVIRONMENT}-chatterbox-state-table`,
        'chatterbox-state-table'
    ];
    
    for (const tableName of chatterboxTables) {
        printSubsection(`Table: ${tableName}`);
        
        try {
            // Describe table
            const describeCommand = new DescribeTableCommand({ TableName: tableName });
            const describeResponse = await dynamoClient.send(describeCommand);
            const table = describeResponse.Table;
            
            console.log(`  Status: ${table.TableStatus}`);
            console.log(`  Item Count: ${table.ItemCount || 'N/A'}`);
            console.log(`  Size: ${table.TableSizeBytes ? `${(table.TableSizeBytes / 1024).toFixed(1)} KB` : 'N/A'}`);
            
            // Scan table (limit to first 10 items)
            const scanCommand = new ScanCommand({
                TableName: tableName,
                Limit: 10
            });
            
            const scanResponse = await dynamoClient.send(scanCommand);
            
            if (!scanResponse.Items || scanResponse.Items.length === 0) {
                printWarning(`  Table is empty`);
                continue;
            }
            
            printSuccess(`  Found ${scanResponse.Items.length} items (showing first 10):`);
            
            for (const item of scanResponse.Items) {
                console.log(`    ${JSON.stringify(item, null, 4)}`);
            }
            
            if (scanResponse.ScannedCount > scanResponse.Items.length) {
                printWarning(`    ... and ${scanResponse.ScannedCount - scanResponse.Items.length} more items`);
            }
            
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                printWarning(`  Table does not exist`);
            } else {
                printError(`  Error accessing table: ${error.message}`);
            }
        }
    }
}

/**
 * Dumps Lambda function configurations
 */
async function dumpLambdaFunctions() {
    printHeader('Lambda Function Configurations');
    
    try {
        const listCommand = new ListFunctionsCommand({});
        const response = await lambdaClient.send(listCommand);
        
        const chatterboxFunctions = response.Functions?.filter(func => 
            func.FunctionName?.includes('chatterbox') || func.FunctionName?.includes(ENVIRONMENT)
        ) || [];
        
        if (chatterboxFunctions.length === 0) {
            printWarning('No Chatterbox Lambda functions found');
            return;
        }
        
        printSuccess(`Found ${chatterboxFunctions.length} Chatterbox Lambda functions:`);
        
        for (const func of chatterboxFunctions) {
            console.log(`\n${colors.cyan}Function:${colors.reset} ${func.FunctionName}`);
            console.log(`  Runtime: ${func.Runtime}`);
            console.log(`  Handler: ${func.Handler}`);
            console.log(`  Memory: ${func.MemorySize} MB`);
            console.log(`  Timeout: ${func.Timeout} seconds`);
            console.log(`  Last Modified: ${func.LastModified}`);
            console.log(`  State: ${func.State}`);
            
            // Get detailed configuration
            try {
                const configCommand = new GetFunctionConfigurationCommand({
                    FunctionName: func.FunctionName
                });
                const configResponse = await lambdaClient.send(configCommand);
                
                if (configResponse.Environment?.Variables) {
                    console.log(`  Environment Variables:`);
                    for (const [key, value] of Object.entries(configResponse.Environment.Variables)) {
                        console.log(`    ${key}: ${value}`);
                    }
                }
            } catch (configError) {
                console.log(`  Error getting configuration: ${configError.message}`);
            }
        }
        
    } catch (error) {
        printError(`Error retrieving Lambda functions: ${error.message}`);
    }
}



/**
 * Collects data in structured format for JSON output
 */
async function collectDataForJson() {
    const data = {
        metadata: {
            environment: ENVIRONMENT,
            parameterStorePrefix: PARAMETER_STORE_PREFIX,
            region: process.env.AWS_REGION || 'us-east-1',
            profile: process.env.AWS_PROFILE || 'cliadmin',
            timestamp: new Date().toISOString()
        },
        lambdaFunctionGroups: [],
        parameterStore: [],
        secretsManager: [],
        s3Buckets: {},
        dynamoDBTables: {},
        lambdaFunctions: []
    };

    // Collect Parameter Store data
    try {
        const command = new GetParametersByPathCommand({
            Path: PARAMETER_STORE_PREFIX,
            Recursive: true,
            WithDecryption: true
        });
        const response = await ssmClient.send(command);
        if (response.Parameters) {
            data.parameterStore = response.Parameters.map(param => ({
                name: param.Name,
                type: param.Type,
                value: param.Value,
                lastModified: param.LastModifiedDate?.toISOString(),
                version: param.Version
            }));
        }
    } catch (error) {
        data.parameterStore = { error: error.message };
    }

    // Collect Secrets Manager data
    try {
        const listCommand = new ListSecretsCommand({});
        const listResponse = await secretsClient.send(listCommand);
        const chatterboxSecrets = listResponse.SecretList?.filter(secret => 
            secret.Name?.includes('chatterbox') || secret.Name?.includes(ENVIRONMENT)
        ) || [];
        
        for (const secret of chatterboxSecrets) {
            const secretData = {
                name: secret.Name,
                description: secret.Description,
                created: secret.CreatedDate?.toISOString(),
                lastModified: secret.LastModifiedDate?.toISOString(),
                versionCount: secret.SecretVersionsToStages ? Object.keys(secret.SecretVersionsToStages).length : null
            };
            
            try {
                const getCommand = new GetSecretValueCommand({ SecretId: secret.Name });
                const secretResponse = await secretsClient.send(getCommand);
                if (secretResponse.SecretString) {
                    const secretContent = JSON.parse(secretResponse.SecretString);
                    secretData.keys = Object.keys(secretContent);
                    secretData.safeKeys = Object.keys(secretContent).filter(key => 
                        !key.toLowerCase().includes('token') && 
                        !key.toLowerCase().includes('secret') && 
                        !key.toLowerCase().includes('password') &&
                        !key.toLowerCase().includes('key')
                    );
                }
            } catch (secretError) {
                secretData.error = secretError.message;
            }
            
            data.secretsManager.push(secretData);
        }
    } catch (error) {
        data.secretsManager = { error: error.message };
    }

    // Collect S3 bucket data
    const chatterboxBuckets = [
        `${ENVIRONMENT}-chatterbox-email-archive`,
        `${ENVIRONMENT}-chatterbox-data-bucket`,
        `${ENVIRONMENT}-chatterbox-backup-bucket`,
        'chatterbox-email-archive',
        'chatterbox-terraform-state-855581761117'
    ];
    
    for (const bucketName of chatterboxBuckets) {
        try {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                MaxKeys: 50
            });
            const response = await s3Client.send(listCommand);
            
            if (response.Contents && response.Contents.length > 0) {
                data.s3Buckets[bucketName] = {
                    status: 'exists',
                    objectCount: response.Contents.length,
                    isTruncated: response.IsTruncated,
                    objects: response.Contents.map(obj => ({
                        key: obj.Key,
                        size: obj.Size,
                        lastModified: obj.LastModified?.toISOString()
                    }))
                };
            } else {
                data.s3Buckets[bucketName] = { status: 'empty' };
            }
        } catch (error) {
            if (error.name === 'NoSuchBucket') {
                data.s3Buckets[bucketName] = { status: 'not_found' };
            } else {
                data.s3Buckets[bucketName] = { status: 'error', error: error.message };
            }
        }
    }

    // Collect DynamoDB table data
    const chatterboxTables = [
        `${ENVIRONMENT}-chatterbox-state-table`,
        'chatterbox-state-table'
    ];
    
    for (const tableName of chatterboxTables) {
        try {
            const describeCommand = new DescribeTableCommand({ TableName: tableName });
            const describeResponse = await dynamoClient.send(describeCommand);
            const table = describeResponse.Table;
            
            const scanCommand = new ScanCommand({
                TableName: tableName,
                Limit: 10
            });
            const scanResponse = await dynamoClient.send(scanCommand);
            
            data.dynamoDBTables[tableName] = {
                status: table.TableStatus,
                itemCount: table.ItemCount,
                sizeBytes: table.TableSizeBytes,
                items: scanResponse.Items || [],
                scannedCount: scanResponse.ScannedCount
            };
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                data.dynamoDBTables[tableName] = { status: 'not_found' };
            } else {
                data.dynamoDBTables[tableName] = { status: 'error', error: error.message };
            }
        }
    }

    // Collect Lambda function data
    try {
        const listCommand = new ListFunctionsCommand({});
        const response = await lambdaClient.send(listCommand);
        
        const chatterboxFunctions = response.Functions?.filter(func => 
            func.FunctionName?.includes('chatterbox') || func.FunctionName?.includes(ENVIRONMENT)
        ) || [];
        
        for (const func of chatterboxFunctions) {
            const funcData = {
                functionName: func.FunctionName,
                runtime: func.Runtime,
                handler: func.Handler,
                memorySize: func.MemorySize,
                timeout: func.Timeout,
                lastModified: func.LastModified,
                state: func.State
            };
            
            try {
                const configCommand = new GetFunctionConfigurationCommand({
                    FunctionName: func.FunctionName
                });
                const configResponse = await lambdaClient.send(configCommand);
                
                if (configResponse.Environment?.Variables) {
                    funcData.environmentVariables = configResponse.Environment.Variables;
                }
            } catch (configError) {
                funcData.configError = configError.message;
            }
            
            data.lambdaFunctions.push(funcData);
        }
    } catch (error) {
        data.lambdaFunctions = { error: error.message };
    }

    // Lambda grouping logic
    if (data.lambdaFunctions && Array.isArray(data.lambdaFunctions)) {
        for (const lambda of data.lambdaFunctions) {
            // Find related parameters
            const relatedParams = (data.parameterStore || []).filter(param => {
                // Match by function name or by env var value
                if (param.value && typeof param.value === 'string' && param.value.includes(lambda.functionName)) return true;
                if (param.name && typeof param.name === 'string' && param.name.includes(lambda.functionName)) return true;
                if (lambda.environmentVariables) {
                    for (const val of Object.values(lambda.environmentVariables)) {
                        if (typeof val === 'string' && (param.value?.includes(val) || param.name?.includes(val))) return true;
                    }
                }
                return false;
            });

            // Find related S3 objects
            let relatedS3 = {};
            if (lambda.environmentVariables) {
                for (const [key, val] of Object.entries(lambda.environmentVariables)) {
                    if (typeof val === 'string') {
                        for (const [bucket, bucketData] of Object.entries(data.s3Buckets)) {
                            if (bucket === val || bucket.includes(val) || val.includes(bucket)) {
                                relatedS3[bucket] = bucketData;
                            }
                        }
                    }
                }
            }

            // Find related DynamoDB items
            let relatedDynamo = {};
            if (lambda.environmentVariables) {
                for (const [key, val] of Object.entries(lambda.environmentVariables)) {
                    if (typeof val === 'string') {
                        for (const [table, tableData] of Object.entries(data.dynamoDBTables)) {
                            if (table === val || table.includes(val) || val.includes(table)) {
                                relatedDynamo[table] = tableData;
                            }
                        }
                    }
                }
            }

            data.lambdaFunctionGroups.push({
                functionName: lambda.functionName,
                lambdaConfig: lambda,
                relatedParameterStore: relatedParams,
                relatedS3Buckets: relatedS3,
                relatedDynamoDBTables: relatedDynamo
            });
        }
    }

    return data;
}

/**
 * Manages file operations with backup functionality
 */
function manageFileOutput(outputPath, content, isJson = false) {
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    
    // Ensure directories exist
    const dumpDir = path.dirname(outputPath);
    const previousDir = path.join(dumpDir, 'previous');
    
    if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir, { recursive: true });
    }
    if (!fs.existsSync(previousDir)) {
        fs.mkdirSync(previousDir, { recursive: true });
    }
    
    // Check if file already exists and move to previous
    if (fs.existsSync(outputPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 14); // YYYYMMDDHHMM
        const ext = isJson ? '.json' : '.txt';
        const backupName = `aws-config-${timestamp}${ext}`;
        const backupPath = path.join(previousDir, backupName);
        
        fs.renameSync(outputPath, backupPath);
        printSuccess(`Moved existing file to: ${backupPath}`);
    }
    
    // Write new file
    fs.writeFileSync(outputPath, content);
    printSuccess(`Configuration dump saved to: ${outputPath}`);
    
    // Open in Chrome browser
    const fileUrl = `file://${path.resolve(outputPath)}`;
    const platform = process.platform;
    
    let command;
    if (platform === 'darwin') {
        command = `open -a "Google Chrome" "${fileUrl}"`;
    } else if (platform === 'win32') {
        command = `start chrome "${fileUrl}"`;
    } else {
        command = `google-chrome "${fileUrl}"`;
    }
    
    exec(command, (error) => {
        if (error) {
            printWarning(`Could not open browser automatically: ${error.message}`);
            printInfo(`Please open manually: ${fileUrl}`);
        } else {
            printSuccess(`Opened configuration dump in Chrome browser`);
        }
    });
}

/**
 * Main function
 */
async function main() {
    // Show help if requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log(`
AWS Configuration Dump Script

Usage: npm run aws:dump-config [options]

Options:
  --json                    Output in JSON format
  --save                    Save output to a file
  --output <filename>       Specify output filename
  --help, -h               Show this help message

Examples:
  npm run aws:dump-config                    # Display output in console
  npm run aws:dump-config --json             # Display JSON in console
  npm run aws:dump-config --save             # Save to data/dump/aws-config.txt
  npm run aws:dump-config --json --save      # Save to data/dump/aws-config.json

This script dumps all Chatterbox-related AWS resources:
- Parameter Store parameters
- Secrets Manager secrets
- S3 bucket contents
- DynamoDB table contents
- Lambda function configurations
`);
        return;
    }
    
    const isJson = process.argv.includes('--json');
    const saveToFile = process.argv.includes('--save');
    const outputFile = process.argv.includes('--output') ? 
        process.argv[process.argv.indexOf('--output') + 1] : 
        (isJson ? 'data/dump/aws-config.json' : 'data/dump/aws-config.txt');
    
    printHeader('AWS Configuration Dump');
    printInfo(`Environment: ${ENVIRONMENT}`);
    printInfo(`Parameter Store Prefix: ${PARAMETER_STORE_PREFIX}`);
    printInfo(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
    printInfo(`Profile: ${process.env.AWS_PROFILE || 'cliadmin'}`);
    printInfo(`Timestamp: ${new Date().toISOString()}`);
    printInfo(`Format: ${isJson ? 'JSON' : 'Text'}`);
    
    if (saveToFile) {
        printInfo(`Output will be saved to: ${outputFile}`);
    }
    
    try {
        if (isJson) {
            // Collect data in structured format
            const data = await collectDataForJson();
            
            if (saveToFile) {
                const jsonContent = JSON.stringify(data, null, 2);
                manageFileOutput(outputFile, jsonContent, true);
            } else {
                console.log(JSON.stringify(data, null, 2));
            }
        } else {
            // Original text output
            let output = '';
            if (saveToFile) {
                const originalLog = console.log;
                console.log = (...args) => {
                    const message = args.join(' ') + '\n';
                    output += message;
                    originalLog(...args);
                };
            }
            
            // Dump all AWS resources
            await dumpParameterStore();
            await dumpSecretsManager();
            await dumpS3Buckets();
            await dumpDynamoDBTables();
            await dumpLambdaFunctions();
            
            printHeader('Dump Complete');
            printSuccess('AWS configuration dump completed successfully');
            printInfo('Check the output above for all Chatterbox-related AWS resources');
            
            // Save to file if requested
            if (saveToFile) {
                manageFileOutput(outputFile, output, false);
            }
        }
        
    } catch (error) {
        printError(`Script failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    dumpParameterStore,
    dumpSecretsManager,
    dumpS3Buckets,
    dumpDynamoDBTables,
    dumpLambdaFunctions
}; 