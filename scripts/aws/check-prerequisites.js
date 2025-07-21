#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Checking AWS infrastructure prerequisites...\n'));

const checks = [
    {
        name: 'AWS CLI',
        command: 'aws --version',
        description: 'AWS Command Line Interface',
    },
    {
        name: 'Terraform',
        command: 'terraform --version',
        description: 'Terraform Infrastructure as Code tool',
    },
    {
        name: 'Node.js',
        command: 'node --version',
        description: 'Node.js runtime',
    },
    {
        name: 'npm',
        command: 'npm --version',
        description: 'Node Package Manager',
    },
];

let allPassed = true;

for (const check of checks) {
    try {
        console.log(chalk.yellow(`Checking ${check.name}...`));
        const output = execSync(check.command, { encoding: 'utf8' });
        console.log(chalk.green(`✅ ${check.name}: ${output.trim()}`));
    } catch (error) {
        console.log(chalk.red(`❌ ${check.name}: Not found or not accessible`));
        console.log(chalk.gray(`   Description: ${check.description}`));
        allPassed = false;
    }
}

console.log('\n' + chalk.blue('🔍 Checking AWS configuration...'));

try {
    const awsIdentity = execSync('aws sts get-caller-identity --profile cliadmin', {
        encoding: 'utf8',
    });
    const identity = JSON.parse(awsIdentity);
    console.log(chalk.green('✅ AWS CLI configured with cliadmin profile'));
    console.log(chalk.gray(`   Account: ${identity.Account}`));
    console.log(chalk.gray(`   User: ${identity.Arn}`));
} catch (error) {
    console.log(chalk.red('❌ AWS CLI not configured with cliadmin profile'));
    console.log(chalk.yellow('   Run: aws configure --profile cliadmin'));
    allPassed = false;
}

console.log('\n' + chalk.blue('🔍 Checking environment variables...'));

const envVars = ['AWS_PROFILE', 'AWS_REGION', 'TF_VAR_environment'];

for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) {
        console.log(chalk.green(`✅ ${envVar}: ${value}`));
    } else {
        console.log(chalk.yellow(`⚠️  ${envVar}: Not set`));
    }
}

console.log('\n' + chalk.blue('📋 Summary:'));

if (allPassed) {
    console.log(
        chalk.green('🎉 All prerequisites are met! You can proceed with AWS infrastructure setup.')
    );
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray('1. npm run aws:setup-backend'));
    console.log(chalk.gray('2. npm run aws:init'));
    console.log(chalk.gray('3. npm run aws:plan'));
    console.log(chalk.gray('4. npm run aws:apply'));
} else {
    console.log(
        chalk.red(
            '❌ Some prerequisites are missing. Please install and configure them before proceeding.'
        )
    );
    console.log(chalk.blue('\nInstallation guides:'));
    console.log(chalk.gray('• AWS CLI: https://docs.aws.amazon.com/cli/'));
    console.log(chalk.gray('• Terraform: https://www.terraform.io/downloads'));
    console.log(chalk.gray('• Node.js: https://nodejs.org/'));
    process.exit(1);
}
