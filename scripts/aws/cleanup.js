#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const readline = require('readline');

console.log(chalk.blue('🧹 AWS Infrastructure Cleanup\n'));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function confirmCleanup() {
    return new Promise((resolve) => {
        console.log(chalk.red('⚠️  WARNING: This will destroy ALL AWS infrastructure resources!'));
        console.log(chalk.red('This action cannot be undone and will result in data loss.'));
        console.log(chalk.yellow('\nResources that will be destroyed:'));
        console.log(chalk.gray('• VPC and all networking components'));
        console.log(chalk.gray('• DynamoDB table and all data'));
        console.log(chalk.gray('• S3 buckets and all objects'));
        console.log(chalk.gray('• Secrets Manager secrets'));
        console.log(chalk.gray('• Parameter Store parameters'));
        console.log(chalk.gray('• CloudWatch resources'));
        console.log(chalk.gray('• IAM roles and policies'));

        rl.question(
            chalk.red('\nAre you absolutely sure you want to proceed? Type "DESTROY" to confirm: '),
            (answer) => {
                rl.close();
                resolve(answer === 'DESTROY');
            }
        );
    });
}

async function main() {
    try {
        // Check if we're in the right directory
        console.log(chalk.yellow('Checking current directory...'));
        const currentDir = process.cwd();
        if (!currentDir.includes('Chatterbox')) {
            console.log(
                chalk.red('❌ Please run this script from the Chatterbox project root directory')
            );
            process.exit(1);
        }
        console.log(chalk.green('✅ In correct directory'));

        // Check if Terraform is initialized
        console.log(chalk.yellow('Checking Terraform state...'));
        try {
            execSync('cd Cloud/AWS/terraform && terraform state list', { stdio: 'pipe' });
            console.log(chalk.green('✅ Terraform state found'));
        } catch (error) {
            console.log(chalk.yellow('⚠️  No Terraform state found - nothing to clean up'));
            process.exit(0);
        }

        // Show what will be destroyed
        console.log(chalk.yellow('\nPlanning destruction...'));
        try {
            execSync('cd Cloud/AWS/terraform && terraform plan -destroy', { stdio: 'inherit' });
        } catch (error) {
            console.log(chalk.red('❌ Failed to plan destruction'));
            process.exit(1);
        }

        // Get user confirmation
        const confirmed = await confirmCleanup();

        if (!confirmed) {
            console.log(chalk.yellow('❌ Cleanup cancelled by user'));
            process.exit(0);
        }

        // Proceed with destruction
        console.log(chalk.red('\n🗑️  Destroying infrastructure...'));

        try {
            execSync('cd Cloud/AWS/terraform && terraform destroy -auto-approve', {
                stdio: 'inherit',
            });
            console.log(chalk.green('\n✅ Infrastructure destruction completed successfully!'));
        } catch (error) {
            console.log(chalk.red('\n❌ Infrastructure destruction failed'));
            console.log(chalk.red('Some resources may still exist. Please check manually.'));
            process.exit(1);
        }

        // Clean up local files
        console.log(chalk.yellow('\nCleaning up local files...'));

        const filesToClean = [
            'Cloud/AWS/terraform/.terraform',
            'Cloud/AWS/terraform/.terraform.lock.hcl',
            'Cloud/AWS/terraform/tfplan',
            'Cloud/AWS/terraform/terraform.tfstate',
            'Cloud/AWS/terraform/terraform.tfstate.backup',
        ];

        const fs = require('fs');
        // eslint-disable-next-line no-unused-vars
        const path = require('path');

        for (const file of filesToClean) {
            try {
                if (fs.existsSync(file)) {
                    if (fs.lstatSync(file).isDirectory()) {
                        fs.rmSync(file, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(file);
                    }
                    console.log(chalk.green(`✅ Removed: ${file}`));
                }
            } catch (error) {
                console.log(chalk.yellow(`⚠️  Could not remove: ${file}`));
            }
        }

        // Optional: Clean up S3 backend bucket
        console.log(chalk.yellow('\nCleaning up S3 backend bucket...'));

        try {
            const accountId = execSync(
                'aws sts get-caller-identity --profile cliadmin --query Account --output text',
                { encoding: 'utf8' }
            ).trim();
            const bucketName = `chatterbox-terraform-state-${accountId}`;

            rl.question(
                chalk.yellow(
                    `Do you want to delete the S3 backend bucket (${bucketName})? (y/N): `
                ),
                (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        try {
                            // Empty the bucket first
                            execSync(
                                `aws s3 rm s3://${bucketName} --recursive --profile cliadmin`,
                                { stdio: 'inherit' }
                            );
                            // Delete the bucket
                            execSync(`aws s3 rb s3://${bucketName} --profile cliadmin`, {
                                stdio: 'inherit',
                            });
                            console.log(chalk.green('✅ S3 backend bucket deleted'));
                        } catch (error) {
                            console.log(chalk.yellow('⚠️  Could not delete S3 backend bucket'));
                            console.log(
                                chalk.gray(
                                    'You may need to delete it manually from the AWS console'
                                )
                            );
                        }
                    } else {
                        console.log(chalk.yellow('⚠️  S3 backend bucket preserved'));
                    }

                    console.log(chalk.green('\n🎉 Cleanup completed!'));
                    console.log(chalk.blue('\nNext steps:'));
                    console.log(chalk.gray('• If you want to redeploy, run: npm run aws:setup'));
                    console.log(
                        chalk.gray(
                            '• If you want to remove the cliadmin user, run: npm run aws:cleanup:user'
                        )
                    );
                }
            );
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not access AWS account for S3 cleanup'));
            console.log(chalk.green('\n🎉 Cleanup completed!'));
        }
    } catch (error) {
        console.error(chalk.red('❌ Cleanup failed:'));
        console.error(chalk.red(error.message));
        process.exit(1);
    }
}

main();
