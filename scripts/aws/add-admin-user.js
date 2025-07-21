#!/usr/bin/env node

const {
    IAMClient,
    CreateUserCommand,
    AddUserToGroupCommand,
    CreateAccessKeyCommand,
    GetUserCommand,
} = require('@aws-sdk/client-iam');
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

async function addAdminUser(username = 'chatteradmin') {
    try {
        console.log(`🔧 Adding user '${username}' to Chatterbox Admin Group...`);

        const accountId = await getAccountId();
        const groupName = 'chatteradmingrp';

        // Check if user already exists
        let userExists = false;
        try {
            const getUserCommand = new GetUserCommand({ UserName: username });
            await iamClient.send(getUserCommand);
            userExists = true;
            console.log(`ℹ️  User '${username}' already exists`);
        } catch (error) {
            if (error.name === 'NoSuchEntityException') {
                userExists = false;
            } else {
                throw error;
            }
        }

        // Create user if it doesn't exist
        if (!userExists) {
            console.log(`👤 Creating user: ${username}`);
            const createUserCommand = new CreateUserCommand({
                UserName: username,
                Path: '/',
            });

            await iamClient.send(createUserCommand);
            console.log(`✅ User '${username}' created successfully`);
        }

        // Add user to the admin group
        console.log(`➕ Adding user '${username}' to group '${groupName}'...`);
        const addUserToGroupCommand = new AddUserToGroupCommand({
            GroupName: groupName,
            UserName: username,
        });

        await iamClient.send(addUserToGroupCommand);
        console.log(`✅ User '${username}' added to group '${groupName}' successfully`);

        // Create access keys for the user
        console.log(`🔑 Creating access keys for user '${username}'...`);
        const createAccessKeyCommand = new CreateAccessKeyCommand({
            UserName: username,
        });

        const accessKeyResponse = await iamClient.send(createAccessKeyCommand);
        const accessKey = accessKeyResponse.AccessKey;

        console.log('\n🎉 User setup completed successfully!');
        console.log(`👤 Username: ${username}`);
        console.log(`🏢 Account ID: ${accountId}`);
        console.log(`🔑 Access Key ID: ${accessKey.AccessKeyId}`);
        console.log(`🔐 Secret Access Key: ${accessKey.SecretAccessKey}`);
        console.log(`📅 Created: ${accessKey.CreateDate}`);

        console.log('\n📝 Next steps:');
        console.log('1. Configure AWS CLI with the new credentials:');
        console.log(`   aws configure --profile ${username}`);
        console.log('2. Test the permissions:');
        console.log(`   npm run aws:admin:test-user ${username}`);
        console.log('3. Update your local configuration to use the new profile');

        console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
        console.log('- Store the Secret Access Key securely');
        console.log('- Never commit credentials to version control');
        console.log('- Consider using AWS SSO for production environments');
        console.log('- Rotate access keys regularly');

        // Save credentials to a file (optional)
        const fs = require('fs');
        const credentialsFile = `./${username}_credentials.txt`;
        const credentialsContent = `AWS Access Key ID: ${accessKey.AccessKeyId}
AWS Secret Access Key: ${accessKey.SecretAccessKey}
Account ID: ${accountId}
Created: ${accessKey.CreateDate}
Profile Name: ${username}

To configure AWS CLI:
aws configure --profile ${username}

To test permissions:
npm run aws:admin:test-user ${username}
`;

        fs.writeFileSync(credentialsFile, credentialsContent);
        console.log(`\n💾 Credentials saved to: ${credentialsFile}`);
        console.log('⚠️  Remember to delete this file after configuring AWS CLI');
    } catch (error) {
        if (error.name === 'EntityAlreadyExistsException') {
            console.log(`ℹ️  User '${username}' is already a member of the admin group`);
        } else if (error.name === 'NoSuchEntityException') {
            console.log(`❌ Group 'chatteradmingrp' does not exist`);
            console.log('💡 Create the admin group first: npm run aws:admin:create-group');
        } else {
            console.error('❌ Error adding user to admin group:', error.message);
            process.exit(1);
        }
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
const username = args[0] || 'chatteradmin';

// Run the script
if (require.main === module) {
    addAdminUser(username);
}

module.exports = { addAdminUser };
