#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Checking and fixing cliadmin user permissions...\n');

// Function to run AWS CLI commands
function runAwsCommand(command) {
    try {
        return execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            env: { ...process.env, AWS_PROFILE: 'cliadmin' },
        });
    } catch (error) {
        return null;
    }
}

// Function to create IAM policy document
function createCliadminPolicy() {
    return {
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: [
                    's3:GetObject',
                    's3:PutObject',
                    's3:DeleteObject',
                    's3:ListBucket',
                    's3:GetBucketLocation',
                    's3:GetBucketPolicy',
                    's3:GetBucketVersioning',
                    's3:GetBucketEncryption',
                    's3:GetBucketPublicAccessBlock',
                ],
                Resource: [
                    'arn:aws:s3:::chatterbox-data',
                    'arn:aws:s3:::chatterbox-data/*',
                    'arn:aws:s3:::chatterbox-backups',
                    'arn:aws:s3:::chatterbox-backups/*',
                ],
            },
            {
                Effect: 'Allow',
                Action: [
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:DeleteItem',
                    'dynamodb:Query',
                    'dynamodb:Scan',
                    'dynamodb:DescribeTable',
                ],
                Resource: [
                    'arn:aws:dynamodb:us-east-1:*:table/chatterbox-state',
                    'arn:aws:dynamodb:us-east-1:*:table/chatterbox-state/index/*',
                ],
            },
            {
                Effect: 'Allow',
                Action: [
                    'secretsmanager:GetSecretValue',
                    'secretsmanager:PutSecretValue',
                    'secretsmanager:UpdateSecret',
                    'secretsmanager:DescribeSecret',
                ],
                Resource: ['arn:aws:secretsmanager:us-east-1:*:secret:chatterbox/*'],
            },
            {
                Effect: 'Allow',
                Action: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                    'ssm:PutParameter',
                    'ssm:DescribeParameters',
                ],
                Resource: ['arn:aws:ssm:us-east-1:*:parameter/chatterbox/*'],
            },
            {
                Effect: 'Allow',
                Action: [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents',
                    'logs:DescribeLogGroups',
                    'logs:DescribeLogStreams',
                ],
                Resource: ['arn:aws:logs:us-east-1:*:log-group:/aws/chatterbox*'],
            },
            {
                Effect: 'Allow',
                Action: [
                    'iam:GetRole',
                    'iam:GetRolePolicy',
                    'iam:ListAttachedRolePolicies',
                    'iam:ListRolePolicies',
                ],
                Resource: ['arn:aws:iam::*:role/development-chatterbox-role'],
            },
            {
                Effect: 'Allow',
                Action: [
                    'ec2:DescribeVpcs',
                    'ec2:DescribeSubnets',
                    'ec2:DescribeRouteTables',
                    'ec2:DescribeSecurityGroups',
                    'ec2:DescribeVpcEndpoints',
                ],
                Resource: '*',
            },
        ],
    };
}

// Check if cliadmin user exists
console.log('1. Checking if cliadmin user exists...');
const userExists = runAwsCommand('aws iam get-user --user-name cliadmin');
if (!userExists) {
    console.log('❌ cliadmin user does not exist. Creating...');
    try {
        execSync('aws iam create-user --user-name cliadmin', {
            stdio: 'inherit',
            env: { ...process.env, AWS_PROFILE: 'cliadmin' },
        });
        console.log('✅ cliadmin user created successfully');
    } catch (error) {
        console.log(
            '❌ Failed to create cliadmin user. You may need to use a different profile with admin permissions.'
        );
        process.exit(1);
    }
} else {
    console.log('✅ cliadmin user exists');
}

// Check if policy exists
console.log('\n2. Checking if cliadmin policy exists...');
const policyExists = runAwsCommand(
    'aws iam get-policy --policy-arn arn:aws:iam::855581761117:policy/cliadmin-chatterbox-policy'
);
if (!policyExists) {
    console.log('❌ cliadmin policy does not exist. Creating...');

    const policyDocument = createCliadminPolicy();
    const policyFile = path.join(__dirname, 'cliadmin-policy.json');
    fs.writeFileSync(policyFile, JSON.stringify(policyDocument, null, 2));

    try {
        execSync(
            `aws iam create-policy --policy-name cliadmin-chatterbox-policy --policy-document file://${policyFile}`,
            {
                stdio: 'inherit',
                env: { ...process.env, AWS_PROFILE: 'cliadmin' },
            }
        );
        console.log('✅ cliadmin policy created successfully');
        fs.unlinkSync(policyFile);
    } catch (error) {
        console.log(
            '❌ Failed to create policy. You may need to use a different profile with admin permissions.'
        );
        if (fs.existsSync(policyFile)) fs.unlinkSync(policyFile);
        process.exit(1);
    }
} else {
    console.log('✅ cliadmin policy exists');
}

// Check if policy is attached to user
console.log('\n3. Checking if policy is attached to cliadmin user...');
const attachedPolicies = runAwsCommand('aws iam list-attached-user-policies --user-name cliadmin');
if (attachedPolicies) {
    const policies = JSON.parse(attachedPolicies);
    const hasPolicy = policies.AttachedPolicies.some(
        (p) => p.PolicyName === 'cliadmin-chatterbox-policy'
    );

    if (!hasPolicy) {
        console.log('❌ Policy not attached to cliadmin user. Attaching...');
        try {
            execSync(
                'aws iam attach-user-policy --user-name cliadmin --policy-arn arn:aws:iam::855581761117:policy/cliadmin-chatterbox-policy',
                {
                    stdio: 'inherit',
                    env: { ...process.env, AWS_PROFILE: 'cliadmin' },
                }
            );
            console.log('✅ Policy attached successfully');
        } catch (error) {
            console.log(
                '❌ Failed to attach policy. You may need to use a different profile with admin permissions.'
            );
            process.exit(1);
        }
    } else {
        console.log('✅ Policy already attached to cliadmin user');
    }
} else {
    console.log('❌ Could not check attached policies');
}

// Test S3 access
console.log('\n4. Testing S3 access...');
const s3Test = runAwsCommand('aws s3api get-bucket-location --bucket chatterbox-data');
if (s3Test) {
    console.log('✅ S3 access working');
} else {
    console.log('❌ S3 access still failing. This may require manual intervention.');
}

// Test DynamoDB access
console.log('\n5. Testing DynamoDB access...');
const dynamoTest = runAwsCommand('aws dynamodb describe-table --table-name chatterbox-state');
if (dynamoTest) {
    console.log('✅ DynamoDB access working');
} else {
    console.log('❌ DynamoDB access failing');
}

// Test Secrets Manager access
console.log('\n6. Testing Secrets Manager access...');
const secretsTest = runAwsCommand('aws secretsmanager list-secrets');
if (secretsTest) {
    console.log('✅ Secrets Manager access working');
} else {
    console.log('❌ Secrets Manager access failing');
}

console.log('\n🎉 cliadmin permissions check complete!');
console.log('\nIf any tests failed, you may need to:');
console.log('1. Use a different AWS profile with admin permissions to create the policy');
console.log('2. Manually attach the policy to the cliadmin user');
console.log('3. Check that the S3 bucket policies allow cliadmin access');
