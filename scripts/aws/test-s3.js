#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Testing S3 configuration...\n'));

try {
    // Get bucket names from Terraform outputs
    console.log(chalk.yellow('Getting S3 bucket names from Terraform outputs...'));
    const dataBucket = execSync('cd Cloud/AWS/terraform && terraform output -raw s3_bucket_name', {
        encoding: 'utf8',
    }).trim();
    const backupBucket = execSync(
        'cd Cloud/AWS/terraform && terraform output -raw s3_backup_bucket_name',
        { encoding: 'utf8' }
    ).trim();

    console.log(chalk.green(`✅ Data Bucket: ${dataBucket}`));
    console.log(chalk.green(`✅ Backup Bucket: ${backupBucket}`));

    const buckets = [
        { name: 'Data Bucket', bucket: dataBucket },
        { name: 'Backup Bucket', bucket: backupBucket },
    ];

    for (const bucketInfo of buckets) {
        console.log(chalk.yellow(`\nTesting ${bucketInfo.name} (${bucketInfo.bucket})...`));

        // Check if bucket exists and is accessible
        console.log(chalk.yellow('Checking bucket access...'));
        const bucketLocation = execSync(
            `aws s3api get-bucket-location --bucket ${bucketInfo.bucket} --profile cliadmin`,
            { encoding: 'utf8' }
        );
        const location = JSON.parse(bucketLocation);
        console.log(
            chalk.green(`✅ Bucket location: ${location.LocationConstraint || 'us-east-1'}`)
        );

        // Get bucket versioning
        console.log(chalk.yellow('Checking bucket versioning...'));
        const versioning = execSync(
            `aws s3api get-bucket-versioning --bucket ${bucketInfo.bucket} --profile cliadmin`,
            { encoding: 'utf8' }
        );
        const versioningInfo = JSON.parse(versioning);
        if (versioningInfo.Status === 'Enabled') {
            console.log(chalk.green('✅ Versioning enabled'));
        } else {
            console.log(chalk.yellow('⚠️  Versioning not enabled'));
        }

        // Get bucket encryption
        console.log(chalk.yellow('Checking bucket encryption...'));
        try {
            const encryption = execSync(
                `aws s3api get-bucket-encryption --bucket ${bucketInfo.bucket} --profile cliadmin`,
                { encoding: 'utf8' }
            );
            const encryptionInfo = JSON.parse(encryption);
            console.log(chalk.green('✅ Server-side encryption configured:'));
            console.log(
                chalk.gray(
                    `   Algorithm: ${encryptionInfo.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm}`
                )
            );
        } catch (error) {
            console.log(chalk.yellow('⚠️  Server-side encryption not configured'));
        }

        // Get bucket public access block
        console.log(chalk.yellow('Checking public access block...'));
        const publicAccess = execSync(
            `aws s3api get-public-access-block --bucket ${bucketInfo.bucket} --profile cliadmin`,
            { encoding: 'utf8' }
        );
        const publicAccessInfo = JSON.parse(publicAccess);
        const config = publicAccessInfo.PublicAccessBlockConfiguration;

        if (
            config.BlockPublicAcls &&
            config.IgnorePublicAcls &&
            config.BlockPublicPolicy &&
            config.RestrictPublicBuckets
        ) {
            console.log(chalk.green('✅ Public access blocked'));
        } else {
            console.log(chalk.yellow('⚠️  Public access not fully blocked'));
        }

        // List bucket contents
        console.log(chalk.yellow('Listing bucket contents...'));
        try {
            const listResult = execSync(`aws s3 ls s3://${bucketInfo.bucket} --profile cliadmin`, {
                encoding: 'utf8',
            });
            if (listResult.trim()) {
                console.log(chalk.green('✅ Bucket contains objects:'));
                console.log(chalk.gray(listResult));
            } else {
                console.log(chalk.green('✅ Bucket is empty (expected for new deployment)'));
            }
        } catch (error) {
            console.log(chalk.red('❌ Failed to list bucket contents'));
            throw error;
        }

        // Test bucket access by uploading a test file
        console.log(chalk.yellow('Testing bucket write access...'));
        const testContent = 'This is a test file for bucket access validation.';
        const testFileName = `test-${Date.now()}.txt`;

        try {
            // Create temporary test file
            const fs = require('fs');
            fs.writeFileSync(`/tmp/${testFileName}`, testContent);

            // Upload test file
            execSync(
                `aws s3 cp /tmp/${testFileName} s3://${bucketInfo.bucket}/test/ --profile cliadmin`,
                { stdio: 'inherit' }
            );
            console.log(chalk.green('✅ Write access test successful'));

            // Download test file to verify
            execSync(
                `aws s3 cp s3://${bucketInfo.bucket}/test/${testFileName} /tmp/${testFileName}-download --profile cliadmin`,
                { stdio: 'inherit' }
            );
            console.log(chalk.green('✅ Read access test successful'));

            // Clean up test files
            execSync(
                `aws s3 rm s3://${bucketInfo.bucket}/test/${testFileName} --profile cliadmin`,
                { stdio: 'inherit' }
            );
            fs.unlinkSync(`/tmp/${testFileName}`);
            fs.unlinkSync(`/tmp/${testFileName}-download`);
            console.log(chalk.green('✅ Cleanup successful'));
        } catch (error) {
            console.log(chalk.red('❌ Bucket access test failed'));
            throw error;
        }
    }

    console.log(chalk.green('\n🎉 S3 test completed successfully!'));
} catch (error) {
    console.error(chalk.red('❌ S3 test failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
}
