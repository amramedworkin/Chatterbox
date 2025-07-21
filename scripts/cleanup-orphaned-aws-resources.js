#!/usr/bin/env node

/**
 * Cleanup Orphaned AWS Resources Script
 * Removes AWS resources that may be left behind after Terraform teardown
 * This script specifically targets IAM policies and API Gateway resources
 */

const chalk = require('chalk');
const {
    IAMClient,
    ListPoliciesCommand,
    DeletePolicyCommand,
    ListPolicyVersionsCommand,
    DeletePolicyVersionCommand,
} = require('@aws-sdk/client-iam');

const { ApiGatewayV2Client, GetApisCommand, DeleteApiCommand } = require('@aws-sdk/client-apigatewayv2');

const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

// AWS Clients
const iam = new IAMClient({ region: 'us-east-1' });
const apigateway = new ApiGatewayV2Client({ region: 'us-east-1' });
const sts = new STSClient({ region: 'us-east-1' });

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
};

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
}

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

async function cleanupOrphanedIAMPolicies() {
    printInfo('Cleaning up orphaned IAM policies...');
    
    try {
        const response = await iam.send(new ListPoliciesCommand({ Scope: 'Local' }));
        const policies = response.Policies || [];
        
        const chatterboxPolicies = policies.filter(policy => 
            policy.PolicyName && (
                policy.PolicyName.includes('chatterbox') ||
                policy.PolicyName.includes('Chatterbox')
            )
        );

        if (chatterboxPolicies.length === 0) {
            printWarning('No orphaned Chatterbox IAM policies found');
            return;
        }

        printInfo(`Found ${chatterboxPolicies.length} orphaned Chatterbox IAM policies`);

        for (const policy of chatterboxPolicies) {
            try {
                printInfo(`Removing IAM policy: ${policy.PolicyName}`);
                
                // List and delete policy versions (except default)
                const versionsResponse = await iam.send(new ListPolicyVersionsCommand({
                    PolicyArn: policy.Arn
                }));
                
                const nonDefaultVersions = versionsResponse.Versions?.filter(v => !v.IsDefaultVersion) || [];
                
                for (const version of nonDefaultVersions) {
                    printInfo(`  Deleting policy version: ${version.VersionId}`);
                    await iam.send(new DeletePolicyVersionCommand({
                        PolicyArn: policy.Arn,
                        VersionId: version.VersionId
                    }));
                }
                
                // Delete the policy
                await iam.send(new DeletePolicyCommand({
                    PolicyArn: policy.Arn
                }));
                
                printStatus(`Removed IAM policy: ${policy.PolicyName}`);
            } catch (error) {
                printError(`Failed to remove IAM policy ${policy.PolicyName}: ${error.message}`);
            }
        }
    } catch (error) {
        printError(`Error listing IAM policies: ${error.message}`);
    }
}

async function cleanupOrphanedAPIGateway() {
    printInfo('Cleaning up orphaned API Gateway resources...');
    
    try {
        const response = await apigateway.send(new GetApisCommand({}));
        const apis = response.Items || [];
        
        const chatterboxApis = apis.filter(api => 
            api.Name && (
                api.Name.includes('chatterbox') ||
                api.Name.includes('Chatterbox')
            )
        );

        if (chatterboxApis.length === 0) {
            printWarning('No orphaned Chatterbox API Gateway APIs found');
            return;
        }

        printInfo(`Found ${chatterboxApis.length} orphaned Chatterbox API Gateway APIs`);

        for (const api of chatterboxApis) {
            try {
                printInfo(`Removing API Gateway API: ${api.Name} (ID: ${api.ApiId})`);
                
                await apigateway.send(new DeleteApiCommand({
                    ApiId: api.ApiId
                }));
                
                printStatus(`Removed API Gateway API: ${api.Name}`);
            } catch (error) {
                printError(`Failed to remove API Gateway API ${api.Name}: ${error.message}`);
            }
        }
    } catch (error) {
        printError(`Error listing API Gateway APIs: ${error.message}`);
    }
}

async function main() {
    printHeader('AWS Orphaned Resources Cleanup');
    printInfo('This script will remove orphaned AWS resources that may be left after Terraform teardown');
    printInfo('Targeting IAM policies and API Gateway resources with "chatterbox" in the name');
    
    // Get AWS account info
    try {
        const identity = await sts.send(new GetCallerIdentityCommand({}));
        printInfo(`AWS Account: ${identity.Account}`);
        printInfo(`User: ${identity.Arn}`);
    } catch (error) {
        printError(`Failed to get AWS account info: ${error.message}`);
        process.exit(1);
    }

    await cleanupOrphanedIAMPolicies();
    await cleanupOrphanedAPIGateway();

    printHeader('Cleanup Complete');
    printStatus('Orphaned AWS resources cleanup finished');
    printInfo('Run npm run aws:has:chatterbox to verify all resources are removed');
}

// Run the cleanup
if (require.main === module) {
    main().catch((error) => {
        printError(`Cleanup failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { cleanupOrphanedIAMPolicies, cleanupOrphanedAPIGateway }; 