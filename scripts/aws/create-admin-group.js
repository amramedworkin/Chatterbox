#!/usr/bin/env node

const { IAMClient, CreateGroupCommand, AttachGroupPolicyCommand, PutGroupPolicyCommand } = require('@aws-sdk/client-iam');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const iamClient = new IAMClient({ region: 'us-east-1' });
const stsClient = new STSClient({ region: 'us-east-1' });

async function getAccountId() {
  try {
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    return response.Account;
  } catch (error) {
    console.error('❌ Error getting account ID:', error.message);
    throw error;
  }
}

async function createAdminGroup() {
  try {
    console.log('🔧 Creating Chatterbox Admin Group...');
    
    const accountId = await getAccountId();
    const groupName = 'chatteradmingrp';
    
    // Create the group
    console.log(`📋 Creating group: ${groupName}`);
    const createGroupCommand = new CreateGroupCommand({
      GroupName: groupName,
      Path: '/'
    });
    
    await iamClient.send(createGroupCommand);
    console.log(`✅ Group '${groupName}' created successfully`);
    
    // Define the comprehensive admin policy
    const adminPolicy = {
      Version: '2012-10-17',
      Statement: [
        // S3 Full Access
        {
          Effect: 'Allow',
          Action: [
            's3:*'
          ],
          Resource: [
            'arn:aws:s3:::chatterbox-*',
            'arn:aws:s3:::chatterbox-*/*'
          ]
        },
        // IAM Management
        {
          Effect: 'Allow',
          Action: [
            'iam:CreateRole',
            'iam:DeleteRole',
            'iam:GetRole',
            'iam:ListRoles',
            'iam:AttachRolePolicy',
            'iam:DetachRolePolicy',
            'iam:PutRolePolicy',
            'iam:DeleteRolePolicy',
            'iam:CreatePolicy',
            'iam:DeletePolicy',
            'iam:GetPolicy',
            'iam:ListPolicies',
            'iam:CreateGroup',
            'iam:DeleteGroup',
            'iam:GetGroup',
            'iam:ListGroups',
            'iam:AddUserToGroup',
            'iam:RemoveUserFromGroup',
            'iam:ListGroupUsers',
            'iam:CreateUser',
            'iam:DeleteUser',
            'iam:GetUser',
            'iam:ListUsers',
            'iam:CreateAccessKey',
            'iam:DeleteAccessKey',
            'iam:ListAccessKeys',
            'iam:UpdateAccessKey',
            'iam:CreateInstanceProfile',
            'iam:DeleteInstanceProfile',
            'iam:GetInstanceProfile',
            'iam:ListInstanceProfiles',
            'iam:AddRoleToInstanceProfile',
            'iam:RemoveRoleFromInstanceProfile'
          ],
          Resource: '*'
        },
        // CloudWatch Full Access
        {
          Effect: 'Allow',
          Action: [
            'cloudwatch:*',
            'logs:*'
          ],
          Resource: '*'
        },
        // Secrets Manager Full Access
        {
          Effect: 'Allow',
          Action: [
            'secretsmanager:*'
          ],
          Resource: [
            'arn:aws:secretsmanager:us-east-1:*:secret:chatterbox/*'
          ]
        },
        // Parameter Store Full Access
        {
          Effect: 'Allow',
          Action: [
            'ssm:*'
          ],
          Resource: [
            'arn:aws:ssm:us-east-1:*:parameter/chatterbox/*'
          ]
        },
        // VPC Full Access
        {
          Effect: 'Allow',
          Action: [
            'ec2:*'
          ],
          Resource: '*'
        },
        // Lambda Full Access
        {
          Effect: 'Allow',
          Action: [
            'lambda:*'
          ],
          Resource: '*'
        },
        // DynamoDB Full Access
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:*'
          ],
          Resource: [
            'arn:aws:dynamodb:us-east-1:*:table/chatterbox-*'
          ]
        },
        // EventBridge Full Access
        {
          Effect: 'Allow',
          Action: [
            'events:*'
          ],
          Resource: '*'
        },
        // KMS Access for encryption
        {
          Effect: 'Allow',
          Action: [
            'kms:Decrypt',
            'kms:GenerateDataKey',
            'kms:DescribeKey'
          ],
          Resource: '*'
        },
        // Terraform and deployment permissions
        {
          Effect: 'Allow',
          Action: [
            'cloudformation:*',
            'apigateway:*',
            'route53:*',
            'acm:*',
            'waf:*',
            'wafv2:*',
            'shield:*',
            'guardduty:*',
            'config:*',
            'backup:*',
            'glacier:*',
            'sns:*',
            'sqs:*',
            'stepfunctions:*',
            'xray:*',
            'cloudtrail:*',
            'organizations:*',
            'billing:*',
            'ce:*',
            'budgets:*',
            'support:*',
            'trustedadvisor:*',
            'health:*',
            'servicequotas:*',
            'account:*'
          ],
          Resource: '*'
        },
        // Read-only access for monitoring
        {
          Effect: 'Allow',
          Action: [
            'iam:List*',
            'iam:Get*',
            'sts:GetCallerIdentity',
            'sts:GetSessionToken'
          ],
          Resource: '*'
        }
      ]
    };
    
    // Attach the inline policy to the group
    console.log('📝 Attaching admin policy to group...');
    const putGroupPolicyCommand = new PutGroupPolicyCommand({
      GroupName: groupName,
      PolicyName: 'ChatterboxAdminPolicy',
      PolicyDocument: JSON.stringify(adminPolicy, null, 2)
    });
    
    await iamClient.send(putGroupPolicyCommand);
    console.log('✅ Admin policy attached successfully');
    
    // Attach AWS managed policies for additional permissions
    const managedPolicies = [
      'arn:aws:iam::aws:policy/AdministratorAccess',
      'arn:aws:iam::aws:policy/PowerUserAccess',
      'arn:aws:iam::aws:policy/CloudWatchFullAccess',
      'arn:aws:iam::aws:policy/SecretsManagerReadWrite',
      'arn:aws:iam::aws:policy/AmazonS3FullAccess',
      'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess',
      'arn:aws:iam::aws:policy/AWSLambda_FullAccess',
      'arn:aws:iam::aws:policy/AmazonVPCFullAccess',
      'arn:aws:iam::aws:policy/CloudWatchEventsFullAccess'
    ];
    
    console.log('🔗 Attaching managed policies...');
    for (const policyArn of managedPolicies) {
      try {
        const attachCommand = new AttachGroupPolicyCommand({
          GroupName: groupName,
          PolicyArn: policyArn
        });
        await iamClient.send(attachCommand);
        console.log(`✅ Attached: ${policyArn.split('/').pop()}`);
      } catch (error) {
        if (error.name === 'EntityAlreadyExistsException') {
          console.log(`ℹ️  Already attached: ${policyArn.split('/').pop()}`);
        } else {
          console.log(`⚠️  Could not attach ${policyArn.split('/').pop()}: ${error.message}`);
        }
      }
    }
    
    console.log('\n🎉 Chatterbox Admin Group setup completed successfully!');
    console.log(`📋 Group Name: ${groupName}`);
    console.log(`🏢 Account ID: ${accountId}`);
    console.log('\n📝 Next steps:');
    console.log('1. Add users to this group using: npm run aws:admin:add-user [username]');
    console.log('2. Users will need to create access keys to use AWS CLI');
    console.log('3. Test permissions with: npm run aws:admin:test-permissions');
    
  } catch (error) {
    if (error.name === 'EntityAlreadyExistsException') {
      console.log('ℹ️  Admin group already exists');
      console.log('💡 To recreate, first delete the existing group');
    } else {
      console.error('❌ Error creating admin group:', error.message);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  createAdminGroup();
}

module.exports = { createAdminGroup }; 