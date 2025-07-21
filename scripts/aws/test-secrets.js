#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Testing Secrets Manager configuration...\n'));

try {
    // List secrets with chatterbox prefix
    console.log(chalk.yellow('Listing Secrets Manager secrets...'));
    const secretsList = execSync(
        'aws secretsmanager list-secrets --profile cliadmin --filters Key=name,Values=chatterbox',
        { encoding: 'utf8' }
    );
    const secrets = JSON.parse(secretsList).SecretList;

    console.log(chalk.green(`✅ Found ${secrets.length} secrets:`));

    const expectedSecrets = [
        'chatterbox/gmail-tokens',
        'chatterbox/openai-api-key',
        'chatterbox/google-credentials',
    ];

    for (const secret of secrets) {
        console.log(chalk.gray(`   • ${secret.Name} (${secret.Description || 'No description'})`));

        // Check if secret is in expected list
        const isExpected = expectedSecrets.some((expected) =>
            secret.Name.includes(expected.replace('chatterbox/', ''))
        );
        if (isExpected) {
            console.log(chalk.green(`     ✅ Expected secret`));
        } else {
            console.log(chalk.yellow(`     ⚠️  Unexpected secret`));
        }

        // Check secret metadata
        console.log(chalk.gray(`     Created: ${secret.CreatedDate}`));
        console.log(chalk.gray(`     Last Modified: ${secret.LastModifiedDate}`));

        if (secret.LastAccessedDate) {
            console.log(chalk.gray(`     Last Accessed: ${secret.LastAccessedDate}`));
        }

        // Check if secret is encrypted
        if (secret.EncryptionKeyId) {
            console.log(chalk.green(`     ✅ Encrypted with KMS key: ${secret.EncryptionKeyId}`));
        } else {
            console.log(chalk.yellow(`     ⚠️  Using default encryption`));
        }

        // Test secret access (without retrieving the actual value)
        console.log(chalk.yellow(`     Testing access to ${secret.Name}...`));
        try {
            const secretMetadata = execSync(
                `aws secretsmanager describe-secret --secret-id ${secret.Name} --profile cliadmin`,
                { encoding: 'utf8' }
            );
            const metadata = JSON.parse(secretMetadata);
            console.log(chalk.green(`     ✅ Access successful`));
            console.log(
                chalk.gray(
                    `       Version Count: ${
                        metadata.VersionIdsToStages
                            ? Object.keys(metadata.VersionIdsToStages).length
                            : 0
                    }`
                )
            );
        } catch (error) {
            console.log(chalk.red(`     ❌ Access failed: ${error.message}`));
        }
    }

    // Check for missing expected secrets
    const foundSecretNames = secrets.map((s) => s.Name);
    const missingSecrets = expectedSecrets.filter(
        (expected) =>
            !foundSecretNames.some((found) => found.includes(expected.replace('chatterbox/', '')))
    );

    if (missingSecrets.length > 0) {
        console.log(chalk.yellow('\n⚠️  Missing expected secrets:'));
        missingSecrets.forEach((secret) => {
            console.log(chalk.gray(`   • ${secret}`));
        });
    } else {
        console.log(chalk.green('\n✅ All expected secrets found'));
    }

    // Test creating a temporary secret (for validation purposes)
    console.log(chalk.yellow('\nTesting secret creation and deletion...'));
    const testSecretName = `chatterbox/test-secret-${Date.now()}`;
    const testSecretValue = JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        purpose: 'validation-test',
    });

    try {
        // Create test secret
        execSync(
            `aws secretsmanager create-secret --name ${testSecretName} --secret-string '${testSecretValue}' --profile cliadmin`,
            { stdio: 'inherit' }
        );
        console.log(chalk.green('✅ Test secret created successfully'));

        // Verify secret exists
        const testSecretInfo = execSync(
            `aws secretsmanager describe-secret --secret-id ${testSecretName} --profile cliadmin`,
            { encoding: 'utf8' }
        );
        const testSecret = JSON.parse(testSecretInfo);
        console.log(chalk.green(`✅ Test secret verified: ${testSecret.Name}`));

        // Delete test secret
        execSync(
            `aws secretsmanager delete-secret --secret-id ${testSecretName} --force-delete-without-recovery --profile cliadmin`,
            { stdio: 'inherit' }
        );
        console.log(chalk.green('✅ Test secret deleted successfully'));
    } catch (error) {
        console.log(chalk.red('❌ Test secret creation/deletion failed'));
        console.log(chalk.red(error.message));
    }

    console.log(chalk.green('\n🎉 Secrets Manager test completed successfully!'));
} catch (error) {
    console.error(chalk.red('❌ Secrets Manager test failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
}
