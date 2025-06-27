#!/usr/bin/env node

const { IAMClient, GetUserCommand, ListGroupsForUserCommand } = require('@aws-sdk/client-iam');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { CloudWatchLogsClient, DescribeLogGroupsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

async function testAdminPermissions(username = 'chatteradmin') {
  try {
    console.log(`🔍 Testing admin permissions for user: ${username}`);
    
    // Create clients with the cliadmin profile
    const config = { 
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    };
    
    // If environment variables are not set, try to use the profile
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('⚠️  AWS credentials not found in environment variables. Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set.');
      console.log('   You can set them by running: export AWS_PROFILE=cliadmin');
      return;
    }
    
    const iamClient = new IAMClient(config);
    const s3Client = new S3Client(config);
    const secretsClient = new SecretsManagerClient(config);
    const ssmClient = new SSMClient(config);
    const dynamodbClient = new DynamoDBClient(config);
    const cloudwatchClient = new CloudWatchLogsClient(config);
    const stsClient = new STSClient(config);
    
    const tests = [];
    
    // Test 1: Get user identity
    try {
      console.log('\n1️⃣ Testing user identity...');
      const stsCommand = new GetCallerIdentityCommand({});
      const stsResponse = await stsClient.send(stsCommand);
      console.log(`✅ Identity verified: ${stsResponse.Arn}`);
      console.log(`   Account: ${stsResponse.Account}`);
      console.log(`   User ID: ${stsResponse.UserId}`);
      tests.push({ name: 'User Identity', status: 'PASS' });
    } catch (error) {
      console.log(`❌ Identity test failed: ${error.message}`);
      tests.push({ name: 'User Identity', status: 'FAIL', error: error.message });
    }
    
    // Test 2: Check IAM permissions
    try {
      console.log('\n2️⃣ Testing IAM permissions...');
      const getUserCommand = new GetUserCommand({ UserName: username });
      const userResponse = await iamClient.send(getUserCommand);
      console.log(`✅ IAM user access: ${userResponse.User.UserName}`);
      
      const groupsCommand = new ListGroupsForUserCommand({ UserName: username });
      const groupsResponse = await iamClient.send(groupsCommand);
      const adminGroup = groupsResponse.Groups.find(g => g.GroupName === 'chatteradmingrp');
      
      if (adminGroup) {
        console.log(`✅ Member of admin group: ${adminGroup.GroupName}`);
        tests.push({ name: 'IAM Permissions', status: 'PASS' });
      } else {
        console.log(`❌ Not a member of chatteradmingrp group`);
        tests.push({ name: 'IAM Permissions', status: 'FAIL', error: 'Not in admin group' });
      }
    } catch (error) {
      console.log(`❌ IAM test failed: ${error.message}`);
      tests.push({ name: 'IAM Permissions', status: 'FAIL', error: error.message });
    }
    
    // Test 3: Check S3 permissions
    try {
      console.log('\n3️⃣ Testing S3 permissions...');
      const listBucketsCommand = new ListBucketsCommand({});
      const bucketsResponse = await s3Client.send(listBucketsCommand);
      const chatterboxBuckets = bucketsResponse.Buckets.filter(b => 
        b.Name.startsWith('chatterbox')
      );
      
      console.log(`✅ S3 access: Found ${bucketsResponse.Buckets.length} buckets`);
      if (chatterboxBuckets.length > 0) {
        console.log(`   Chatterbox buckets: ${chatterboxBuckets.map(b => b.Name).join(', ')}`);
        tests.push({ name: 'S3 Permissions', status: 'PASS' });
      } else {
        console.log(`   No chatterbox buckets found`);
        tests.push({ name: 'S3 Permissions', status: 'WARN', error: 'No chatterbox buckets' });
      }
    } catch (error) {
      console.log(`❌ S3 test failed: ${error.message}`);
      tests.push({ name: 'S3 Permissions', status: 'FAIL', error: error.message });
    }
    
    // Test 4: Check Secrets Manager permissions
    try {
      console.log('\n4️⃣ Testing Secrets Manager permissions...');
      const listSecretsCommand = new ListSecretsCommand({});
      const secretsResponse = await secretsClient.send(listSecretsCommand);
      const chatterboxSecrets = secretsResponse.SecretList.filter(s => 
        s.Name.startsWith('chatterbox')
      );
      
      console.log(`✅ Secrets Manager access: Found ${secretsResponse.SecretList.length} secrets`);
      if (chatterboxSecrets.length > 0) {
        console.log(`   Chatterbox secrets: ${chatterboxSecrets.map(s => s.Name).join(', ')}`);
        tests.push({ name: 'Secrets Manager', status: 'PASS' });
      } else {
        console.log(`   No chatterbox secrets found`);
        tests.push({ name: 'Secrets Manager', status: 'WARN', error: 'No chatterbox secrets' });
      }
    } catch (error) {
      console.log(`❌ Secrets Manager test failed: ${error.message}`);
      tests.push({ name: 'Secrets Manager', status: 'FAIL', error: error.message });
    }
    
    // Test 5: Check Parameter Store permissions
    try {
      console.log('\n5️⃣ Testing Parameter Store permissions...');
      const getParamsCommand = new GetParametersByPathCommand({
        Path: '/chatterbox',
        Recursive: true
      });
      const paramsResponse = await ssmClient.send(getParamsCommand);
      
      console.log(`✅ Parameter Store access: Found ${paramsResponse.Parameters.length} parameters`);
      if (paramsResponse.Parameters.length > 0) {
        console.log(`   Parameters: ${paramsResponse.Parameters.map(p => p.Name).join(', ')}`);
        tests.push({ name: 'Parameter Store', status: 'PASS' });
      } else {
        console.log(`   No chatterbox parameters found`);
        tests.push({ name: 'Parameter Store', status: 'WARN', error: 'No chatterbox parameters' });
      }
    } catch (error) {
      console.log(`❌ Parameter Store test failed: ${error.message}`);
      tests.push({ name: 'Parameter Store', status: 'FAIL', error: error.message });
    }
    
    // Test 6: Check DynamoDB permissions
    try {
      console.log('\n6️⃣ Testing DynamoDB permissions...');
      const listTablesCommand = new ListTablesCommand({});
      const tablesResponse = await dynamodbClient.send(listTablesCommand);
      const chatterboxTables = tablesResponse.TableNames.filter(t => 
        t.startsWith('chatterbox')
      );
      
      console.log(`✅ DynamoDB access: Found ${tablesResponse.TableNames.length} tables`);
      if (chatterboxTables.length > 0) {
        console.log(`   Chatterbox tables: ${chatterboxTables.join(', ')}`);
        tests.push({ name: 'DynamoDB Permissions', status: 'PASS' });
      } else {
        console.log(`   No chatterbox tables found`);
        tests.push({ name: 'DynamoDB Permissions', status: 'WARN', error: 'No chatterbox tables' });
      }
    } catch (error) {
      console.log(`❌ DynamoDB test failed: ${error.message}`);
      tests.push({ name: 'DynamoDB Permissions', status: 'FAIL', error: error.message });
    }
    
    // Test 7: Check CloudWatch permissions
    try {
      console.log('\n7️⃣ Testing CloudWatch permissions...');
      const logGroupsCommand = new DescribeLogGroupsCommand({
        logGroupNamePrefix: '/aws/chatterbox'
      });
      const logsResponse = await cloudwatchClient.send(logGroupsCommand);
      
      console.log(`✅ CloudWatch access: Found ${logsResponse.logGroups.length} log groups`);
      if (logsResponse.logGroups.length > 0) {
        console.log(`   Log groups: ${logsResponse.logGroups.map(lg => lg.logGroupName).join(', ')}`);
        tests.push({ name: 'CloudWatch Permissions', status: 'PASS' });
      } else {
        console.log(`   No chatterbox log groups found`);
        tests.push({ name: 'CloudWatch Permissions', status: 'WARN', error: 'No chatterbox log groups' });
      }
    } catch (error) {
      console.log(`❌ CloudWatch test failed: ${error.message}`);
      tests.push({ name: 'CloudWatch Permissions', status: 'FAIL', error: error.message });
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('='.repeat(50));
    
    const passed = tests.filter(t => t.status === 'PASS').length;
    const failed = tests.filter(t => t.status === 'FAIL').length;
    const warned = tests.filter(t => t.status === 'WARN').length;
    
    tests.forEach(test => {
      const status = test.status === 'PASS' ? '✅' : test.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${status} ${test.name}: ${test.status}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`📈 Results: ${passed} passed, ${warned} warnings, ${failed} failed`);
    
    if (failed === 0) {
      console.log('\n🎉 All critical tests passed! User has proper admin permissions.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the permissions.');
    }
    
    return { tests, passed, failed, warned };
    
  } catch (error) {
    console.error('❌ Error testing admin permissions:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const username = args[0] || 'chatteradmin';

// Run the script
if (require.main === module) {
  testAdminPermissions(username);
}

module.exports = { testAdminPermissions }; 