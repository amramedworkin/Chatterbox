#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue('🪣 Setting up Terraform S3 backend...\n'));

try {
    // Get AWS account ID
    console.log(chalk.yellow('Getting AWS account ID...'));
    const accountId = execSync(
        'aws sts get-caller-identity --profile cliadmin --query Account --output text',
        { encoding: 'utf8' }
    ).trim();
    console.log(chalk.green(`✅ Account ID: ${accountId}`));

    const bucketName = `chatterbox-terraform-state-${accountId}`;
    console.log(chalk.yellow(`Creating S3 bucket: ${bucketName}`));

    // Create S3 bucket
    try {
        execSync(`aws s3 mb s3://${bucketName} --profile cliadmin --region us-east-1`, {
            stdio: 'inherit',
        });
        console.log(chalk.green(`✅ S3 bucket created: ${bucketName}`));
    } catch (error) {
        if (error.message.includes('BucketAlreadyOwnedByYou')) {
            console.log(chalk.yellow(`⚠️  S3 bucket already exists: ${bucketName}`));
        } else {
            throw error;
        }
    }

    // Enable versioning
    console.log(chalk.yellow('Enabling bucket versioning...'));
    execSync(
        `aws s3api put-bucket-versioning --bucket ${bucketName} --versioning-configuration Status=Enabled --profile cliadmin`,
        { stdio: 'inherit' }
    );
    console.log(chalk.green('✅ Bucket versioning enabled'));

    // Enable server-side encryption
    console.log(chalk.yellow('Enabling server-side encryption...'));
    const encryptionConfig = {
        Rules: [
            {
                ApplyServerSideEncryptionByDefault: {
                    SSEAlgorithm: 'AES256',
                },
            },
        ],
    };

    fs.writeFileSync('/tmp/encryption.json', JSON.stringify(encryptionConfig));
    execSync(
        `aws s3api put-bucket-encryption --bucket ${bucketName} --server-side-encryption-configuration file:///tmp/encryption.json --profile cliadmin`,
        { stdio: 'inherit' }
    );
    fs.unlinkSync('/tmp/encryption.json');
    console.log(chalk.green('✅ Server-side encryption enabled'));

    // Block public access
    console.log(chalk.yellow('Blocking public access...'));
    execSync(
        `aws s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --profile cliadmin`,
        { stdio: 'inherit' }
    );
    console.log(chalk.green('✅ Public access blocked'));

    // Update main.tf with the bucket name
    console.log(chalk.yellow('Updating Terraform configuration...'));
    const mainTfPath = path.join(__dirname, '../../Cloud/AWS/terraform/main.tf');

    if (fs.existsSync(mainTfPath)) {
        let mainTfContent = fs.readFileSync(mainTfPath, 'utf8');

        // Replace the bucket name in the backend configuration
        const backendRegex = /bucket\s*=\s*"chatterbox-terraform-state-[^"]*"/;
        if (backendRegex.test(mainTfContent)) {
            mainTfContent = mainTfContent.replace(
                backendRegex,
                `bucket = "chatterbox-terraform-state-${accountId}"`
            );
        } else {
            // If no backend configuration exists, add it
            const backendConfig = `  backend "s3" {
    bucket = "chatterbox-terraform-state-${accountId}"
    key    = "terraform.tfstate"
    region = "us-east-1"
    profile = "cliadmin"
  }`;

            const terraformBlockRegex = /terraform\s*\{([^}]*)\}/;
            if (terraformBlockRegex.test(mainTfContent)) {
                mainTfContent = mainTfContent.replace(
                    terraformBlockRegex,
                    `terraform {$1${backendConfig}\n}`
                );
            }
        }

        fs.writeFileSync(mainTfPath, mainTfContent);
        console.log(chalk.green('✅ Terraform configuration updated'));
    }

    console.log(chalk.green('\n🎉 S3 backend setup complete!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray('1. npm run aws:init'));
    console.log(chalk.gray('2. npm run aws:validate'));
    console.log(chalk.gray('3. npm run aws:plan'));
} catch (error) {
    console.error(chalk.red('❌ Error setting up S3 backend:'));
    console.error(chalk.red(error.message));
    process.exit(1);
}
