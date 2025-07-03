#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

// Get function name from command line argument
const FUNCTION_NAME = process.argv[2] || 'development-pull-latest-chatterbox-email';
const LOG_GROUP_NAME = `/aws/lambda/${FUNCTION_NAME}`;

console.log(chalk.blue(`📋 Fetching CloudWatch logs for ${FUNCTION_NAME}...\n`));

try {
  // Get the most recent log stream
  console.log(chalk.yellow('🔍 Finding most recent log stream...'));
  const logStreamsOutput = execSync(`aws logs describe-log-streams --log-group-name "${LOG_GROUP_NAME}" --order-by LastEventTime --descending --max-items 1 --output json`, { encoding: 'utf8' });
  const logStreams = JSON.parse(logStreamsOutput);
  
  if (!logStreams.logStreams || logStreams.logStreams.length === 0) {
    console.log(chalk.red('❌ No log streams found'));
    return;
  }
  
  const latestStream = logStreams.logStreams[0];
  console.log(chalk.green(`✅ Found log stream: ${latestStream.logStreamName}`));
  
  // Get log events from the most recent stream
  console.log(chalk.yellow('\n📄 Fetching log events...'));
  const logEventsOutput = execSync(`aws logs get-log-events --log-group-name "${LOG_GROUP_NAME}" --log-stream-name "${latestStream.logStreamName}" --output json`, { encoding: 'utf8' });
  const logEvents = JSON.parse(logEventsOutput);
  
  if (!logEvents.events || logEvents.events.length === 0) {
    console.log(chalk.red('❌ No log events found'));
    return;
  }
  
  console.log(chalk.green(`✅ Found ${logEvents.events.length} log events\n`));
  console.log(chalk.cyan('📋 Recent Lambda logs:'));
  console.log(chalk.gray('═'.repeat(80)));
  
  logEvents.events.forEach((event, index) => {
    const timestamp = new Date(event.timestamp).toLocaleString();
    console.log(chalk.gray(`[${timestamp}]`));
    console.log(event.message);
    if (index < logEvents.events.length - 1) {
      console.log(chalk.gray('─'.repeat(40)));
    }
  });
  
} catch (error) {
  console.error(chalk.red('❌ Error fetching logs:'), error.message);
  
  // Try alternative approach
  console.log(chalk.yellow('\n🔄 Trying alternative approach...'));
  try {
    const filterOutput = execSync(`aws logs filter-log-events --log-group-name "${LOG_GROUP_NAME}" --query 'events[*].message' --output text`, { encoding: 'utf8' });
    if (filterOutput.trim()) {
      console.log(chalk.green('✅ Found logs using filter approach:'));
      console.log(filterOutput);
    } else {
      console.log(chalk.red('❌ No logs found with filter approach'));
    }
  } catch (filterError) {
    console.error(chalk.red('❌ Filter approach also failed:'), filterError.message);
  }
} 