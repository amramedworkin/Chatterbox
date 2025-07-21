#!/usr/bin/env node

const {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    DescribeLogStreamsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');
const {
    CloudWatchClient,
    ListMetricsCommand,
    DescribeAlarmsCommand,
} = require('@aws-sdk/client-cloudwatch');
const { execSync } = require('child_process');

const cloudWatchLogs = new CloudWatchLogsClient({
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin',
});

const cloudWatch = new CloudWatchClient({
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin',
});

async function testCloudWatch() {
    console.log('🔍 Testing CloudWatch configuration...\n');

    try {
        // Get log group name from Terraform outputs
        console.log('Getting log group name from Terraform outputs...');
        const logGroupName = execSync(
            'cd Cloud/AWS/terraform && terraform output -raw cloudwatch_log_group_name',
            { encoding: 'utf8' }
        ).trim();
        console.log(`✅ Log Group Name: ${logGroupName}`);

        // Test CloudWatch Logs
        console.log('\nTesting CloudWatch Logs...');

        // Describe log group
        const describeLogGroupCommand = new DescribeLogGroupsCommand({
            LogGroupNamePrefix: logGroupName,
        });
        const logGroupResponse = await cloudWatchLogs.send(describeLogGroupCommand);

        if (logGroupResponse.logGroups && logGroupResponse.logGroups.length > 0) {
            const logGroup = logGroupResponse.logGroups[0];
            console.log('✅ Log Group details:');
            console.log(`   Name: ${logGroup.logGroupName}`);
            console.log(`   ARN: ${logGroup.arn}`);
            console.log(`   Creation Time: ${new Date(logGroup.creationTime).toISOString()}`);
            console.log(`   Retention: ${logGroup.retentionInDays || 'Never expire'} days`);
            console.log(`   Stored Bytes: ${logGroup.storedBytes || 0} bytes`);
            console.log(`   Metric Filter Count: ${logGroup.metricFilterCount || 0}`);

            // List log streams
            const describeLogStreamsCommand = new DescribeLogStreamsCommand({
                LogGroupName: logGroup.logGroupName,
                OrderBy: 'LastEventTime',
                Descending: true,
                MaxItems: 5,
            });
            const logStreamsResponse = await cloudWatchLogs.send(describeLogStreamsCommand);

            if (logStreamsResponse.logStreams && logStreamsResponse.logStreams.length > 0) {
                console.log(`\n✅ Found ${logStreamsResponse.logStreams.length} log streams:`);
                logStreamsResponse.logStreams.forEach((stream, index) => {
                    console.log(`   ${index + 1}. ${stream.logStreamName}`);
                    console.log(
                        `      Last Event Time: ${
                            stream.lastEventTimestamp
                                ? new Date(stream.lastEventTimestamp).toISOString()
                                : 'No events'
                        }`
                    );
                    console.log(`      Stored Bytes: ${stream.storedBytes || 0} bytes`);
                });
            } else {
                console.log('\n⚠️  No log streams found');
            }
        } else {
            console.log('⚠️  Log group not found');
        }

        // Test CloudWatch Metrics
        console.log('\nTesting CloudWatch Metrics...');

        // List metrics for DynamoDB
        const listMetricsCommand = new ListMetricsCommand({
            Namespace: 'AWS/DynamoDB',
            MetricName: 'ConsumedReadCapacityUnits',
            Dimensions: [
                {
                    Name: 'TableName',
                    Value: 'chatterbox-state',
                },
            ],
        });
        const metricsResponse = await cloudWatch.send(listMetricsCommand);

        if (metricsResponse.Metrics && metricsResponse.Metrics.length > 0) {
            console.log(`✅ Found ${metricsResponse.Metrics.length} DynamoDB metrics`);
            metricsResponse.Metrics.forEach((metric, index) => {
                console.log(`   ${index + 1}. ${metric.MetricName} (${metric.Namespace})`);
            });
        } else {
            console.log('⚠️  No DynamoDB metrics found');
        }

        // Test CloudWatch Alarms
        console.log('\nTesting CloudWatch Alarms...');

        const describeAlarmsCommand = new DescribeAlarmsCommand({
            AlarmNamePrefix: 'Chatterbox',
        });
        const alarmsResponse = await cloudWatch.send(describeAlarmsCommand);

        if (alarmsResponse.MetricAlarms && alarmsResponse.MetricAlarms.length > 0) {
            console.log(`✅ Found ${alarmsResponse.MetricAlarms.length} alarms:`);
            alarmsResponse.MetricAlarms.forEach((alarm, index) => {
                console.log(`   ${index + 1}. ${alarm.AlarmName}`);
                console.log(`      State: ${alarm.StateValue}`);
                console.log(`      Metric: ${alarm.MetricName}`);
                console.log(`      Threshold: ${alarm.Threshold}`);
            });
        } else {
            console.log('⚠️  No CloudWatch alarms found');
        }

        // Test S3 metrics
        console.log('\nTesting S3 metrics...');
        const s3MetricsCommand = new ListMetricsCommand({
            Namespace: 'AWS/S3',
            MetricName: 'NumberOfObjects',
        });
        const s3MetricsResponse = await cloudWatch.send(s3MetricsCommand);

        if (s3MetricsResponse.Metrics && s3MetricsResponse.Metrics.length > 0) {
            console.log(`✅ Found ${s3MetricsResponse.Metrics.length} S3 metrics`);
        } else {
            console.log('⚠️  No S3 metrics found');
        }

        console.log('\n🎉 CloudWatch test completed successfully!');
    } catch (error) {
        console.error('❌ CloudWatch test failed:');
        console.error(error.message);
        process.exit(1);
    }
}

testCloudWatch();
