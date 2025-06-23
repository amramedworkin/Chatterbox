#!/usr/bin/env node

const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
const { execSync } = require('child_process');

const ssm = new SSMClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin'
});

async function testParameters() {
    console.log('🔍 Testing Parameter Store configuration...\n');

    try {
        // Get parameter prefix from Terraform outputs
        console.log('Getting parameter prefix from Terraform outputs...');
        const prefix = execSync('cd Cloud/AWS/terraform && terraform output -raw parameter_store_prefix', { encoding: 'utf8' }).trim();
        console.log(`✅ Parameter Prefix: ${prefix}`);

        // Get parameters by path
        console.log('Getting parameters by path...');
        const command = new GetParametersByPathCommand({
            Path: prefix,
            Recursive: true,
            WithDecryption: true
        });

        const response = await ssm.send(command);
        
        if (response.Parameters && response.Parameters.length > 0) {
            console.log(`✅ Found ${response.Parameters.length} parameters:`);
            response.Parameters.forEach((param, index) => {
                console.log(`   ${index + 1}. ${param.Name} = ${param.Value}`);
            });
        } else {
            console.log('⚠️  No parameters found in Parameter Store');
        }

        // Test parameter access
        console.log('\nTesting parameter access...');
        const testParams = [
            `${prefix}/environment`,
            `${prefix}/aws_region`,
            `${prefix}/application_version`
        ];

        for (const paramName of testParams) {
            try {
                const getCommand = new GetParametersByPathCommand({
                    Path: paramName,
                    WithDecryption: true
                });
                await ssm.send(getCommand);
                console.log(`   ✅ ${paramName} - Accessible`);
            } catch (error) {
                console.log(`   ⚠️  ${paramName} - Not found or not accessible`);
            }
        }

        console.log('\n🎉 Parameter Store test completed successfully!');

    } catch (error) {
        console.error('❌ Parameter Store test failed:');
        console.error(error.message);
        process.exit(1);
    }
}

testParameters(); 