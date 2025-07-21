#!/usr/bin/env node

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const lambda = new LambdaClient({ region: 'us-east-1' });
const sts = new STSClient({ region: 'us-east-1' });

async function testLambda() {
    try {
        // Get account ID
        const identity = await sts.send(new GetCallerIdentityCommand({}));
        const accountId = identity.Account;

        console.log('🧪 Testing Lambda function...');
        console.log(`📋 Account ID: ${accountId}`);

        // Get environment from command line or default to development
        const environment = process.argv[2] || 'development';
        const functionName = `${environment}-pull-latest-chatterbox-email`;

        console.log(`🔧 Function: ${functionName}`);

        // Test payload
        const payload = {
            gmailUniqueId: process.argv[3] || null, // Optional Gmail unique ID
            testMode: true,
        };

        console.log('📤 Invoking Lambda function...');
        console.log(`📦 Payload: ${JSON.stringify(payload, null, 2)}`);

        const command = new InvokeCommand({
            FunctionName: functionName,
            Payload: JSON.stringify(payload),
            LogType: 'Tail',
        });

        const response = await lambda.send(command);

        console.log('📥 Lambda response received!');
        console.log(`📊 Status Code: ${response.StatusCode}`);

        if (response.LogResult) {
            console.log('📋 Logs:');
            const logs = Buffer.from(response.LogResult, 'base64').toString();
            console.log(logs);
        }

        if (response.Payload) {
            const result = JSON.parse(Buffer.from(response.Payload).toString());
            console.log('📄 Response:');
            console.log(JSON.stringify(result, null, 2));
        }

        console.log('✅ Lambda test completed successfully!');
    } catch (error) {
        console.error('❌ Lambda test failed:');
        console.error(error.message);

        if (error.name === 'ResourceNotFoundException') {
            console.log('\n💡 The Lambda function may not be deployed yet.');
            console.log('   Run: npm run aws:lambda:deploy');
        }
    }
}

testLambda();
