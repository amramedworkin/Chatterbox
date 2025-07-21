#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Testing DynamoDB configuration...\n'));

try {
    // Get table name from Terraform outputs
    console.log(chalk.yellow('Getting DynamoDB table name from Terraform outputs...'));
    const tableName = execSync(
        'cd Cloud/AWS/terraform && terraform output -raw dynamodb_table_name',
        { encoding: 'utf8' }
    ).trim();
    console.log(chalk.green(`✅ Table Name: ${tableName}`));

    // Describe DynamoDB table
    console.log(chalk.yellow('Describing DynamoDB table...'));
    const tableInfo = execSync(
        `aws dynamodb describe-table --table-name ${tableName} --profile cliadmin`,
        { encoding: 'utf8' }
    );
    const table = JSON.parse(tableInfo).Table;

    console.log(chalk.green('✅ DynamoDB table details:'));
    console.log(chalk.gray(`   Table Status: ${table.TableStatus}`));
    console.log(chalk.gray(`   Billing Mode: ${table.BillingModeSummary.BillingMode}`));
    console.log(chalk.gray(`   Item Count: ${table.ItemCount || 0}`));
    console.log(chalk.gray(`   Table Size: ${table.TableSizeBytes || 0} bytes`));

    // Check encryption
    if (table.SSEDescription) {
        console.log(chalk.green('✅ Server-side encryption enabled:'));
        console.log(chalk.gray(`   Encryption Type: ${table.SSEDescription.SSEType}`));
        console.log(chalk.gray(`   Encryption Status: ${table.SSEDescription.Status}`));
    } else {
        console.log(chalk.yellow('⚠️  Server-side encryption not configured'));
    }

    // Check streams
    if (table.StreamSpecification) {
        console.log(chalk.green('✅ DynamoDB Streams enabled:'));
        console.log(chalk.gray(`   Stream Enabled: ${table.StreamSpecification.StreamEnabled}`));
        console.log(chalk.gray(`   Stream View Type: ${table.StreamSpecification.StreamViewType}`));
    } else {
        console.log(chalk.yellow('⚠️  DynamoDB Streams not enabled'));
    }

    // Check global secondary indexes
    if (table.GlobalSecondaryIndexes && table.GlobalSecondaryIndexes.length > 0) {
        console.log(
            chalk.green(`✅ Found ${table.GlobalSecondaryIndexes.length} global secondary indexes:`)
        );
        table.GlobalSecondaryIndexes.forEach((gsi, index) => {
            console.log(chalk.gray(`   ${index + 1}. ${gsi.IndexName} (${gsi.IndexStatus})`));
        });
    } else {
        console.log(chalk.yellow('⚠️  No global secondary indexes found'));
    }

    // Test table access by listing items (should be empty)
    console.log(chalk.yellow('Testing table access...'));
    try {
        const scanResult = execSync(
            `aws dynamodb scan --table-name ${tableName} --max-items 1 --profile cliadmin`,
            { encoding: 'utf8' }
        );
        const scan = JSON.parse(scanResult);
        console.log(chalk.green('✅ Table access test successful'));
        console.log(chalk.gray(`   Items in table: ${scan.Count || 0}`));
    } catch (error) {
        console.log(chalk.red('❌ Table access test failed'));
        throw error;
    }

    // Check CloudWatch metrics
    console.log(chalk.yellow('Checking CloudWatch metrics...'));
    const metrics = execSync(
        `aws cloudwatch list-metrics --namespace AWS/DynamoDB --dimensions Name=TableName,Value=${tableName} --profile cliadmin`,
        { encoding: 'utf8' }
    );
    const metricList = JSON.parse(metrics).Metrics;

    console.log(chalk.green(`✅ Found ${metricList.length} CloudWatch metrics for table`));
    if (metricList.length > 0) {
        metricList.slice(0, 5).forEach((metric, index) => {
            console.log(chalk.gray(`   ${index + 1}. ${metric.MetricName}`));
        });
    }

    console.log(chalk.green('\n🎉 DynamoDB test completed successfully!'));
} catch (error) {
    console.error(chalk.red('❌ DynamoDB test failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
}
