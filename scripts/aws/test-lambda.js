#!/usr/bin/env node

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sts = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getCurrentAccount() {
    try {
        const command = new GetCallerIdentityCommand({});
        const response = await sts.send(command);
        return response.Account;
    } catch (error) {
        console.error('Error getting current account:', error);
        return null;
    }
}

async function testLambdaFunction(gmailId) {
    try {
        const accountId = await getCurrentAccount();
        if (!accountId) {
            console.error('❌ Could not determine AWS account ID');
            process.exit(1);
        }

        const functionName = `development-chatterbox-email-reader`;
        console.log(`🧪 Testing Lambda function: ${functionName}`);
        console.log(`📧 Gmail ID: ${gmailId}`);

        const payload = {
            pathParameters: {
                gmailId: gmailId
            },
            httpMethod: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const command = new InvokeCommand({
            FunctionName: functionName,
            Payload: JSON.stringify(payload),
            LogType: 'Tail'
        });

        console.log('🚀 Invoking Lambda function...');
        const response = await lambda.send(command);

        // Decode the response
        const responsePayload = JSON.parse(Buffer.from(response.Payload).toString());
        const logs = Buffer.from(response.LogResult, 'base64').toString();

        console.log('\n📋 Lambda Logs:');
        console.log(logs);

        console.log('\n📤 Response:');
        console.log(JSON.stringify(responsePayload, null, 2));

        if (responsePayload.statusCode === 200) {
            console.log('\n✅ Lambda function executed successfully!');
            console.log('📧 Email data retrieved:', {
                id: responsePayload.body?.data?.id,
                subject: responsePayload.body?.data?.subject,
                sender: responsePayload.body?.data?.sender
            });
        } else {
            console.log('\n❌ Lambda function returned an error');
            console.log('Status Code:', responsePayload.statusCode);
            console.log('Error:', responsePayload.body);
        }

    } catch (error) {
        console.error('❌ Error testing Lambda function:', error);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const gmailId = args[0];

if (!gmailId) {
    console.log('Usage: node scripts/aws/test-lambda.js <gmail-id>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/aws/test-lambda.js 18c1234567890abcd');
    console.log('');
    console.log('Note: Make sure you have:');
    console.log('  1. AWS credentials configured');
    console.log('  2. Lambda function deployed');
    console.log('  3. Gmail tokens stored in Secrets Manager');
    process.exit(1);
}

testLambdaFunction(gmailId); 