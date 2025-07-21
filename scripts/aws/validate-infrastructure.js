#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Validating AWS infrastructure...\n'));

const tests = [
    {
        name: 'VPC',
        command: 'npm run aws:test:vpc',
        description: 'Virtual Private Cloud',
    },
    {
        name: 'DynamoDB',
        command: 'npm run aws:test:dynamodb',
        description: 'NoSQL Database',
    },
    {
        name: 'S3',
        command: 'npm run aws:test:s3',
        description: 'Object Storage',
    },
    {
        name: 'Secrets Manager',
        command: 'npm run aws:test:secrets',
        description: 'Secret Storage',
    },
    {
        name: 'Parameter Store',
        command: 'npm run aws:test:parameters',
        description: 'Configuration Management',
    },
    {
        name: 'IAM',
        command: 'npm run aws:test:iam',
        description: 'Identity and Access Management',
    },
    {
        name: 'CloudWatch',
        command: 'npm run aws:test:cloudwatch',
        description: 'Monitoring and Logging',
    },
];

let passedTests = 0;
let totalTests = tests.length;

console.log(chalk.blue('📊 Running infrastructure validation tests...\n'));

for (const test of tests) {
    try {
        console.log(chalk.yellow(`Testing ${test.name}...`));
        execSync(test.command, { stdio: 'inherit' });
        console.log(chalk.green(`✅ ${test.name}: PASSED`));
        passedTests++;
    } catch (error) {
        console.log(chalk.red(`❌ ${test.name}: FAILED`));
        console.log(chalk.gray(`   Description: ${test.description}`));
    }
}

console.log('\n' + chalk.blue('📋 Validation Summary:'));
console.log(chalk.blue(`Tests Passed: ${passedTests}/${totalTests}`));

if (passedTests === totalTests) {
    console.log(chalk.green('🎉 All infrastructure validation tests passed!'));
    console.log(chalk.blue('\nYour AWS infrastructure is ready for use.'));
} else {
    console.log(chalk.red(`❌ ${totalTests - passedTests} test(s) failed.`));
    console.log(chalk.yellow('\nPlease check the failed tests and fix any issues.'));
    process.exit(1);
}
