#!/usr/bin/env node

/**
 * AWS Chatterbox Component Discovery Script
 * Finds all AWS components associated with Chatterbox by:
 * - Name contains "chatterbox"
 * - Tags contain "chatterbox" or "Chatterbox"
 * - Membership in Chatterbox resource groups
 *
 * Provides deletion commands and console locations for each component
 */

const chalk = require('chalk');
const {
    LambdaClient,
    ListFunctionsCommand,
    GetFunctionCommand,
} = require('@aws-sdk/client-lambda');

const { S3Client, ListBucketsCommand, GetBucketTaggingCommand } = require('@aws-sdk/client-s3');

const {
    DynamoDBClient,
    ListTablesCommand,
    DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');

const { SQSClient, ListQueuesCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

const {
    SecretsManagerClient,
    GetSecretValueCommand, // eslint-disable-line no-unused-vars
    ListSecretsCommand,
} = require('@aws-sdk/client-secrets-manager');

const {
    SSMClient,
    GetParameterCommand, // eslint-disable-line no-unused-vars
    ListParametersCommand,
} = require('@aws-sdk/client-ssm');

const {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

const {
    IAMClient,
    ListRolesCommand,
    ListPoliciesCommand,
    GetRoleCommand,
    GetPolicyCommand,
} = require('@aws-sdk/client-iam');

const {
    ResourceGroupsClient,
    ListGroupResourcesCommand, // eslint-disable-line no-unused-vars
    GetGroupCommand,
    ListGroupsCommand,
} = require('@aws-sdk/client-resource-groups');

const { ApiGatewayV2Client, GetApisCommand } = require('@aws-sdk/client-apigatewayv2');

const {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeSecurityGroupsCommand,
} = require('@aws-sdk/client-ec2');

const { SESClient, ListIdentitiesCommand } = require('@aws-sdk/client-ses');

const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

// AWS Clients
const lambda = new LambdaClient({ region: 'us-east-1' });
const s3 = new S3Client({ region: 'us-east-1' });
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const sqs = new SQSClient({ region: 'us-east-1' });
const secretsManager = new SecretsManagerClient({ region: 'us-east-1' });
const ssm = new SSMClient({ region: 'us-east-1' });
const cloudwatch = new CloudWatchLogsClient({ region: 'us-east-1' });
const iam = new IAMClient({ region: 'us-east-1' });
const resourceGroups = new ResourceGroupsClient({ region: 'us-east-1' });
const apigateway = new ApiGatewayV2Client({ region: 'us-east-1' });
const ec2 = new EC2Client({ region: 'us-east-1' });
const ses = new SESClient({ region: 'us-east-1' });
const sts = new STSClient({ region: 'us-east-1' });

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

// Global aggregation array to collect all discovered components
const discoveredComponents = [];

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
    console.log(`\n${colors.cyan}${message}${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(40)}${colors.reset}`);
}

function printComponent(name, type, details) {
    console.log(`${colors.green}✅ ${colors.bright}${name}${colors.reset} (${type})`);
    if (details.arn) {
        console.log(`${colors.dim}  ARN: ${details.arn}${colors.reset}`);
    }
    if (details.region) {
        console.log(`${colors.dim}  Region: ${details.region}${colors.reset}`);
    }
    if (details.tags && Object.keys(details.tags).length > 0) {
        console.log(`${colors.dim}  Tags: ${JSON.stringify(details.tags)}${colors.reset}`);
    }
    if (details.deleteCommand) {
        console.log(`${colors.yellow}  Delete: ${details.deleteCommand}${colors.reset}`);
    }
    if (details.consoleUrl) {
        console.log(`${colors.cyan}  Console: ${details.consoleUrl}${colors.reset}`);
    }
    console.log('');

    // Add to aggregation array
    discoveredComponents.push({
        name,
        type,
        arn: details.arn,
        region: details.region,
        tags: details.tags,
        deleteCommand: details.deleteCommand,
        consoleUrl: details.consoleUrl,
        preserved: details.preserved || false // Add preserved flag
    });
}

function hasChatterboxInName(name) {
    return name && name.toLowerCase().includes('chatterbox');
}

function hasChatterboxInTags(tags) {
    if (!tags) return false;
    const tagValues = Object.values(tags).map((v) => v.toString().toLowerCase());
    const tagKeys = Object.keys(tags).map((k) => k.toLowerCase());
    return (
        tagValues.some((v) => v.includes('chatterbox')) ||
        tagKeys.some((k) => k.includes('chatterbox'))
    );
}

async function discoverLambdaFunctions() {
    printSubsection('Lambda Functions');

    try {
        const response = await lambda.send(new ListFunctionsCommand({}));
        const functions = response.Functions || [];

        for (const func of functions) {
            const isChatterbox = hasChatterboxInName(func.FunctionName);

            if (isChatterbox) {
                // Get function details including tags
                try {
                    const funcDetails = await lambda.send(
                        new GetFunctionCommand({
                            FunctionName: func.FunctionName,
                        })
                    );

                    const tags = funcDetails.Tags || {};
                    const hasChatterboxTags = hasChatterboxInTags(tags);

                    if (isChatterbox || hasChatterboxTags) {
                        printComponent(func.FunctionName, 'Lambda Function', {
                            arn: func.FunctionArn,
                            region: func.FunctionArn.split(':')[3],
                            tags: tags,
                            deleteCommand: `aws lambda delete-function --function-name "${func.FunctionName}"`,
                            consoleUrl: `https://console.aws.amazon.com/lambda/home?region=${
                                func.FunctionArn.split(':')[3]
                            }#/functions/${func.FunctionName}`,
                        });
                    }
                } catch (error) {
                    console.log(
                        `${colors.red}Error getting details for ${func.FunctionName}: ${error.message}${colors.reset}`
                    );
                }
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering Lambda functions: ${error.message}${colors.reset}`
        );
    }
}

async function discoverS3Buckets() {
    printSubsection('S3 Buckets');

    try {
        const response = await s3.send(new ListBucketsCommand({}));
        const buckets = response.Buckets || [];

        for (const bucket of buckets) {
            const isChatterbox = hasChatterboxInName(bucket.Name);
            const isTerraformStateBucket = bucket.Name && bucket.Name.includes('terraform-state');

            if (isChatterbox) {
                // Get bucket tags
                try {
                    const tagResponse = await s3.send(
                        new GetBucketTaggingCommand({
                            Bucket: bucket.Name,
                        })
                    );
                    const tags = {};
                    if (tagResponse.TagSet) {
                        tagResponse.TagSet.forEach((tag) => {
                            tags[tag.Key] = tag.Value;
                        });
                    }

                    const hasChatterboxTags = hasChatterboxInTags(tags);

                    if (isChatterbox || hasChatterboxTags) {
                        const details = {
                            arn: `arn:aws:s3:::${bucket.Name}`,
                            region: 'us-east-1',
                            tags: tags,
                            consoleUrl: `https://console.aws.amazon.com/s3/buckets/${bucket.Name}`,
                        };

                        // Don't provide delete command for Terraform state bucket
                        if (isTerraformStateBucket) {
                            details.deleteCommand = `${colors.yellow}⚠️  PRESERVED - Terraform state bucket (DO NOT DELETE)${colors.reset}`;
                            details.preserved = true;
                        } else {
                            details.deleteCommand = `aws s3 rb s3://${bucket.Name} --force`;
                        }

                        printComponent(bucket.Name, 'S3 Bucket', details);
                    }
                } catch (error) {
                    // Bucket might not have tags or might not exist
                    if (isChatterbox) {
                        const details = {
                            arn: `arn:aws:s3:::${bucket.Name}`,
                            region: 'us-east-1',
                            tags: {},
                            consoleUrl: `https://console.aws.amazon.com/s3/buckets/${bucket.Name}`,
                        };

                        // Don't provide delete command for Terraform state bucket
                        if (isTerraformStateBucket) {
                            details.deleteCommand = `${colors.yellow}⚠️  PRESERVED - Terraform state bucket (DO NOT DELETE)${colors.reset}`;
                            details.preserved = true;
                        } else {
                            details.deleteCommand = `aws s3 rb s3://${bucket.Name} --force`;
                        }

                        printComponent(bucket.Name, 'S3 Bucket', details);
                    }
                }
            }
        }
    } catch (error) {
        console.log(`${colors.red}Error discovering S3 buckets: ${error.message}${colors.reset}`);
    }
}

async function discoverDynamoDBTables() {
    printSubsection('DynamoDB Tables');

    try {
        const response = await dynamodb.send(new ListTablesCommand({}));
        const tables = response.TableNames || [];

        for (const tableName of tables) {
            const isChatterbox = hasChatterboxInName(tableName);

            if (isChatterbox) {
                try {
                    const tableDetails = await dynamodb.send(
                        new DescribeTableCommand({
                            TableName: tableName,
                        })
                    );

                    const tags = {};
                    if (tableDetails.Table.Tags) {
                        tableDetails.Table.Tags.forEach((tag) => {
                            tags[tag.Key] = tag.Value;
                        });
                    }

                    const hasChatterboxTags = hasChatterboxInTags(tags);

                    if (isChatterbox || hasChatterboxTags) {
                        printComponent(tableName, 'DynamoDB Table', {
                            arn: tableDetails.Table.TableArn,
                            region: tableDetails.Table.TableArn.split(':')[3],
                            tags: tags,
                            deleteCommand: `aws dynamodb delete-table --table-name "${tableName}"`,
                            consoleUrl: `https://console.aws.amazon.com/dynamodb/home?region=${
                                tableDetails.Table.TableArn.split(':')[3]
                            }#tables:selected=${tableName}`,
                        });
                    }
                } catch (error) {
                    console.log(
                        `${colors.red}Error getting details for table ${tableName}: ${error.message}${colors.reset}`
                    );
                }
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering DynamoDB tables: ${error.message}${colors.reset}`
        );
    }
}

async function discoverSQSQueues() {
    printSubsection('SQS Queues');

    try {
        const response = await sqs.send(new ListQueuesCommand({}));
        const queueUrls = response.QueueUrls || [];

        for (const queueUrl of queueUrls) {
            const queueName = queueUrl.split('/').pop();
            const isChatterbox = hasChatterboxInName(queueName);

            if (isChatterbox) {
                try {
                    const attributes = await sqs.send(
                        new GetQueueAttributesCommand({
                            QueueUrl: queueUrl,
                            AttributeNames: ['All'],
                        })
                    );

                    // SQS doesn't have tags in the same way, but we can check attributes
                    printComponent(queueName, 'SQS Queue', {
                        arn: attributes.Attributes.QueueArn,
                        region: attributes.Attributes.QueueArn.split(':')[3],
                        tags: {},
                        deleteCommand: `aws sqs delete-queue --queue-url "${queueUrl}"`,
                        consoleUrl: `https://console.aws.amazon.com/sqs/v2/home?region=${
                            attributes.Attributes.QueueArn.split(':')[3]
                        }#/queues/${encodeURIComponent(queueUrl)}`,
                    });
                } catch (error) {
                    console.log(
                        `${colors.red}Error getting details for queue ${queueName}: ${error.message}${colors.reset}`
                    );
                }
            }
        }
    } catch (error) {
        console.log(`${colors.red}Error discovering SQS queues: ${error.message}${colors.reset}`);
    }
}

async function discoverSecrets() {
    printSubsection('Secrets Manager Secrets');

    try {
        const response = await secretsManager.send(new ListSecretsCommand({}));
        const secrets = response.SecretList || [];

        for (const secret of secrets) {
            const isChatterbox = hasChatterboxInName(secret.Name);
            const hasChatterboxTags = hasChatterboxInTags(secret.Tags);

            if (isChatterbox || hasChatterboxTags) {
                printComponent(secret.Name, 'Secrets Manager Secret', {
                    arn: secret.ARN,
                    region: secret.ARN.split(':')[3],
                    tags: secret.Tags || {},
                    deleteCommand: `aws secretsmanager delete-secret --secret-id "${secret.Name}" --force-delete-without-recovery`,
                    consoleUrl: `https://console.aws.amazon.com/secretsmanager/home?region=${
                        secret.ARN.split(':')[3]
                    }#/secret?name=${encodeURIComponent(secret.Name)}`,
                });
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering Secrets Manager secrets: ${error.message}${colors.reset}`
        );
    }
}

async function discoverSSMParameters() {
    printSubsection('SSM Parameters');

    try {
        // Search for parameters with chatterbox in the path
        const chatterboxPaths = [
            '/chatterbox',
            '/chatterbox/',
            '/chatterbox-dev',
            '/chatterbox-dev/',
        ];

        for (const path of chatterboxPaths) {
            try {
                const response = await ssm.send(
                    new ListParametersCommand({
                        Path: path,
                        Recursive: true,
                    })
                );

                for (const param of response.Parameters || []) {
                    const isChatterbox = hasChatterboxInName(param.Name);
                    const hasChatterboxTags = hasChatterboxInTags(param.Tags);

                    if (isChatterbox || hasChatterboxTags) {
                        printComponent(param.Name, 'SSM Parameter', {
                            arn: param.ARN,
                            region: param.ARN.split(':')[3],
                            tags: param.Tags || {},
                            deleteCommand: `aws ssm delete-parameter --name "${param.Name}"`,
                            consoleUrl: `https://console.aws.amazon.com/systems-manager/home?region=${
                                param.ARN.split(':')[3]
                            }#/parameter/${encodeURIComponent(param.Name)}`,
                        });
                    }
                }
            } catch (error) {
                // Path might not exist, continue
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering SSM parameters: ${error.message}${colors.reset}`
        );
    }
}

async function discoverCloudWatchLogGroups() {
    printSubsection('CloudWatch Log Groups');

    try {
        const response = await cloudwatch.send(new DescribeLogGroupsCommand({}));
        const logGroups = response.logGroups || [];

        for (const logGroup of logGroups) {
            const isChatterbox = hasChatterboxInName(logGroup.logGroupName);

            if (isChatterbox) {
                printComponent(logGroup.logGroupName, 'CloudWatch Log Group', {
                    arn: logGroup.logGroupArn,
                    region: logGroup.logGroupArn.split(':')[3],
                    tags: logGroup.tags || {},
                    deleteCommand: `aws logs delete-log-group --log-group-name "${logGroup.logGroupName}"`,
                    consoleUrl: `https://console.aws.amazon.com/cloudwatch/home?region=${
                        logGroup.logGroupArn.split(':')[3]
                    }#logsV2:log-groups/log-group/${encodeURIComponent(logGroup.logGroupName)}`,
                });
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering CloudWatch log groups: ${error.message}${colors.reset}`
        );
    }
}

async function discoverIAMRoles() {
    printSubsection('IAM Roles');

    try {
        const response = await iam.send(new ListRolesCommand({}));
        const roles = response.Roles || [];

        for (const role of roles) {
            const isChatterbox = hasChatterboxInName(role.RoleName);

            if (isChatterbox) {
                try {
                    const roleDetails = await iam.send(
                        new GetRoleCommand({
                            RoleName: role.RoleName,
                        })
                    );

                    const tags = {};
                    if (roleDetails.Role.Tags) {
                        roleDetails.Role.Tags.forEach((tag) => {
                            tags[tag.Key] = tag.Value;
                        });
                    }

                    const hasChatterboxTags = hasChatterboxInTags(tags);

                    if (isChatterbox || hasChatterboxTags) {
                        printComponent(role.RoleName, 'IAM Role', {
                            arn: role.Arn,
                            region: 'us-east-1',
                            tags: tags,
                            deleteCommand: `aws iam delete-role --role-name "${role.RoleName}"`,
                            consoleUrl: `https://console.aws.amazon.com/iam/home#/roles/${role.RoleName}`,
                        });
                    }
                } catch (error) {
                    console.log(
                        `${colors.red}Error getting details for role ${role.RoleName}: ${error.message}${colors.reset}`
                    );
                }
            }
        }
    } catch (error) {
        console.log(`${colors.red}Error discovering IAM roles: ${error.message}${colors.reset}`);
    }
}

async function discoverIAMPolicies() {
    printSubsection('IAM Policies');

    try {
        const response = await iam.send(
            new ListPoliciesCommand({
                Scope: 'Local',
            })
        );
        const policies = response.Policies || [];

        for (const policy of policies) {
            const isChatterbox = hasChatterboxInName(policy.PolicyName);

            if (isChatterbox) {
                try {
                    const policyDetails = await iam.send(
                        new GetPolicyCommand({
                            PolicyArn: policy.Arn,
                        })
                    );

                    const tags = {};
                    if (policyDetails.Policy.Tags) {
                        policyDetails.Policy.Tags.forEach((tag) => {
                            tags[tag.Key] = tag.Value;
                        });
                    }

                    const hasChatterboxTags = hasChatterboxInTags(tags);

                    if (isChatterbox || hasChatterboxTags) {
                        printComponent(policy.PolicyName, 'IAM Policy', {
                            arn: policy.Arn,
                            region: 'us-east-1',
                            tags: tags,
                            deleteCommand: `aws iam delete-policy --policy-arn "${policy.Arn}"`,
                            consoleUrl: `https://console.aws.amazon.com/iam/home#/policies/${policy.Arn}`,
                        });
                    }
                } catch (error) {
                    console.log(
                        `${colors.red}Error getting details for policy ${policy.PolicyName}: ${error.message}${colors.reset}`
                    );
                }
            }
        }
    } catch (error) {
        console.log(`${colors.red}Error discovering IAM policies: ${error.message}${colors.reset}`);
    }
}

async function discoverResourceGroups() {
    printSubsection('Resource Groups');

    try {
        const response = await resourceGroups.send(new ListGroupsCommand({}));
        const groups = response.Groups || [];

        for (const group of groups) {
            const isChatterbox = hasChatterboxInName(group.Name);

            if (isChatterbox) {
                try {
                    const groupDetails = await resourceGroups.send(
                        new GetGroupCommand({
                            GroupName: group.Name,
                        })
                    );

                    const tags = groupDetails.Group.Tags || {};
                    const hasChatterboxTags = hasChatterboxInTags(tags);

                    if (isChatterbox || hasChatterboxTags) {
                        printComponent(group.Name, 'Resource Group', {
                            arn: group.GroupArn,
                            region: 'us-east-1',
                            tags: tags,
                            deleteCommand: `aws resource-groups delete-group --group-name "${group.Name}"`,
                            consoleUrl: `https://console.aws.amazon.com/resource-groups/home#/groups/${group.Name}`,
                        });
                    }
                } catch (error) {
                    console.log(
                        `${colors.red}Error getting details for resource group ${group.Name}: ${error.message}${colors.reset}`
                    );
                }
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering resource groups: ${error.message}${colors.reset}`
        );
    }
}

async function discoverAPIGateway() {
    printSubsection('API Gateway APIs');

    try {
        const response = await apigateway.send(new GetApisCommand({}));
        const apis = response.Items || [];

        for (const api of apis) {
            const isChatterbox = hasChatterboxInName(api.Name);

            if (isChatterbox) {
                const tags = api.Tags || {};
                const hasChatterboxTags = hasChatterboxInTags(tags);

                if (isChatterbox || hasChatterboxTags) {
                    printComponent(api.Name, 'API Gateway API', {
                        arn: api.ApiId,
                        region: 'us-east-1',
                        tags: tags,
                        deleteCommand: `aws apigateway delete-rest-api --rest-api-id "${api.ApiId}"`,
                        consoleUrl: `https://console.aws.amazon.com/apigateway/home?region=us-east-1#/apis/${api.ApiId}`,
                    });
                }
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering API Gateway APIs: ${error.message}${colors.reset}`
        );
    }
}

async function discoverEC2Resources() {
    printSubsection('EC2 Resources (VPCs, Subnets, Security Groups)');

    try {
        // VPCs
        const vpcResponse = await ec2.send(new DescribeVpcsCommand({}));
        for (const vpc of vpcResponse.Vpcs || []) {
            const isChatterbox =
                hasChatterboxInName(vpc.VpcId) ||
                hasChatterboxInName(vpc.Tags?.find((t) => t.Key === 'Name')?.Value);
            const hasChatterboxTags = hasChatterboxInTags(
                vpc.Tags?.reduce((acc, tag) => {
                    acc[tag.Key] = tag.Value;
                    return acc;
                }, {})
            );

            if (isChatterbox || hasChatterboxTags) {
                printComponent(vpc.VpcId, 'VPC', {
                    arn: `arn:aws:ec2:us-east-1:${vpc.OwnerId}:vpc/${vpc.VpcId}`,
                    region: 'us-east-1',
                    tags:
                        vpc.Tags?.reduce((acc, tag) => {
                            acc[tag.Key] = tag.Value;
                            return acc;
                        }, {}) || {},
                    deleteCommand: `aws ec2 delete-vpc --vpc-id "${vpc.VpcId}"`,
                    consoleUrl: `https://console.aws.amazon.com/vpc/home?region=us-east-1#vpcs:search=${vpc.VpcId}`,
                });
            }
        }

        // Subnets
        const subnetResponse = await ec2.send(new DescribeSubnetsCommand({}));
        for (const subnet of subnetResponse.Subnets || []) {
            const isChatterbox =
                hasChatterboxInName(subnet.SubnetId) ||
                hasChatterboxInName(subnet.Tags?.find((t) => t.Key === 'Name')?.Value);
            const hasChatterboxTags = hasChatterboxInTags(
                subnet.Tags?.reduce((acc, tag) => {
                    acc[tag.Key] = tag.Value;
                    return acc;
                }, {})
            );

            if (isChatterbox || hasChatterboxTags) {
                printComponent(subnet.SubnetId, 'Subnet', {
                    arn: `arn:aws:ec2:us-east-1:${subnet.OwnerId}:subnet/${subnet.SubnetId}`,
                    region: 'us-east-1',
                    tags:
                        subnet.Tags?.reduce((acc, tag) => {
                            acc[tag.Key] = tag.Value;
                            return acc;
                        }, {}) || {},
                    deleteCommand: `aws ec2 delete-subnet --subnet-id "${subnet.SubnetId}"`,
                    consoleUrl: `https://console.aws.amazon.com/vpc/home?region=us-east-1#subnets:search=${subnet.SubnetId}`,
                });
            }
        }

        // Security Groups
        const sgResponse = await ec2.send(new DescribeSecurityGroupsCommand({}));
        for (const sg of sgResponse.SecurityGroups || []) {
            const isChatterbox =
                hasChatterboxInName(sg.GroupId) || hasChatterboxInName(sg.GroupName);
            const hasChatterboxTags = hasChatterboxInTags(
                sg.Tags?.reduce((acc, tag) => {
                    acc[tag.Key] = tag.Value;
                    return acc;
                }, {})
            );

            if (isChatterbox || hasChatterboxTags) {
                printComponent(sg.GroupId, 'Security Group', {
                    arn: `arn:aws:ec2:us-east-1:${sg.OwnerId}:security-group/${sg.GroupId}`,
                    region: 'us-east-1',
                    tags:
                        sg.Tags?.reduce((acc, tag) => {
                            acc[tag.Key] = tag.Value;
                            return acc;
                        }, {}) || {},
                    deleteCommand: `aws ec2 delete-security-group --group-id "${sg.GroupId}"`,
                    consoleUrl: `https://console.aws.amazon.com/vpc/home?region=us-east-1#SecurityGroups:search=${sg.GroupId}`,
                });
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering EC2 resources: ${error.message}${colors.reset}`
        );
    }
}

async function discoverSESIdentities() {
    printSubsection('SES Identities');

    try {
        const response = await ses.send(new ListIdentitiesCommand({}));
        const identities = response.Identities || [];

        for (const identity of identities) {
            const isChatterbox = hasChatterboxInName(identity);

            if (isChatterbox) {
                printComponent(identity, 'SES Identity', {
                    arn: `arn:aws:ses:us-east-1:${
                        (await sts.send(new GetCallerIdentityCommand({}))).Account
                    }:identity/${identity}`,
                    region: 'us-east-1',
                    tags: {},
                    deleteCommand: `aws ses delete-identity --identity "${identity}"`,
                    consoleUrl: `https://console.aws.amazon.com/ses/home?region=us-east-1#/verified-identities/${encodeURIComponent(
                        identity
                    )}`,
                });
            }
        }
    } catch (error) {
        console.log(
            `${colors.red}Error discovering SES identities: ${error.message}${colors.reset}`
        );
    }
}

async function discoverAllComponents() {
    console.log(
        `${colors.bright}${colors.cyan}🔍 AWS Chatterbox Component Discovery${colors.reset}`
    );
    console.log(
        `${colors.dim}Scanning all AWS services for Chatterbox-related components...${colors.reset}`
    );
    console.log(`${colors.dim}Timestamp: ${new Date().toLocaleString()}${colors.reset}`);

    // Clear aggregation array
    discoveredComponents.length = 0;

    await discoverLambdaFunctions();
    await discoverS3Buckets();
    await discoverDynamoDBTables();
    await discoverSQSQueues();
    await discoverSecrets();
    await discoverSSMParameters();
    await discoverCloudWatchLogGroups();
    await discoverIAMRoles();
    await discoverIAMPolicies();
    await discoverResourceGroups();
    await discoverAPIGateway();
    await discoverEC2Resources();
    await discoverSESIdentities();

    printHeader('Discovery Complete');
    console.log(
        `${colors.green}✅ All AWS services have been scanned for Chatterbox components${colors.reset}`
    );
    console.log(
        `${colors.cyan}📋 Use the delete commands above to remove components as needed${colors.reset}`
    );
    console.log(
        `${colors.yellow}⚠️  Be careful when deleting resources - some may have dependencies${colors.reset}`
    );

    // Print aggregation summary
    printAggregationSummary();
}

function printAggregationSummary() {
    printHeader('Aggregated Chatterbox Components Summary');
    
    if (discoveredComponents.length === 0) {
        console.log(`${colors.yellow}📭 No Chatterbox components found in AWS${colors.reset}`);
        return;
    }

    // Separate preserved and deletable components
    const preservedComponents = discoveredComponents.filter(component => component.preserved);
    const deletableComponents = discoveredComponents.filter(component => !component.preserved);

    // Group by type
    const groupedByType = discoveredComponents.reduce((acc, component) => {
        if (!acc[component.type]) {
            acc[component.type] = [];
        }
        acc[component.type].push(component);
        return acc;
    }, {});

    console.log(`${colors.bright}${colors.green}📊 Total Components Found: ${discoveredComponents.length}${colors.reset}`);
    if (preservedComponents.length > 0) {
        console.log(`${colors.bright}${colors.yellow}🔒 Preserved Components: ${preservedComponents.length}${colors.reset}`);
    }
    if (deletableComponents.length > 0) {
        console.log(`${colors.bright}${colors.cyan}🗑️  Deletable Components: ${deletableComponents.length}${colors.reset}`);
    }
    console.log('');

    // Print summary by type
    Object.entries(groupedByType).forEach(([type, components]) => {
        console.log(`${colors.cyan}${type}: ${components.length} component(s)${colors.reset}`);
        components.forEach(component => {
            const marker = component.preserved ? `${colors.yellow}🔒${colors.reset}` : `${colors.dim}•${colors.reset}`;
            console.log(`  ${marker} ${component.name}${component.preserved ? ` ${colors.yellow}(PRESERVED)${colors.reset}` : ''}`);
        });
        console.log('');
    });

    // Print preserved components warning
    if (preservedComponents.length > 0) {
        console.log(`${colors.bright}${colors.yellow}🔒 Preserved Components (DO NOT DELETE):${colors.reset}`);
        preservedComponents.forEach(component => {
            console.log(`${colors.yellow}• ${component.name} (${component.type})${colors.reset}`);
        });
        console.log('');
    }

    // Print all delete commands (only for deletable components)
    if (deletableComponents.length > 0) {
        console.log(`${colors.bright}${colors.cyan}🗑️  All Delete Commands:${colors.reset}`);
        deletableComponents.forEach(component => {
            if (component.deleteCommand && !component.preserved) {
                console.log(`${colors.cyan}${component.deleteCommand}${colors.reset}`);
            }
        });
        console.log('');
    }

    // Print all console URLs
    console.log(`${colors.bright}${colors.cyan}🌐 All Console URLs:${colors.reset}`);
    discoveredComponents.forEach(component => {
        if (component.consoleUrl) {
            console.log(`${colors.cyan}${component.consoleUrl}${colors.reset}`);
        }
    });
    console.log('');
}

// Run the discovery
if (require.main === module) {
    discoverAllComponents().catch((error) => {
        console.error(`${colors.red}❌ Discovery failed: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}

module.exports = { discoverAllComponents };
