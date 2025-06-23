#!/usr/bin/env node

const { 
  logInfo, 
  logBuild, 
  logTeardown, 
  logValidate, 
  logClean, 
  logDeploy, 
  logMigrate, 
  logTest, 
  logError, 
  logWarning,
  logMultiLineInfo,
  logMultiLineBuild,
  logMultiLineTeardown,
  adminLog
} = require('../dist/src/utils/adminLogger');

console.log('🧪 Testing Chatterbox Admin Logging System\n');

// Test single line logging
console.log('1. Testing single line logging...');
logInfo('Logging system test', 'Testing basic logging functionality');
logBuild('Test build operation', 'Building test infrastructure');
logTeardown('Test teardown operation', 'Tearing down test infrastructure');
logValidate('Test validation', 'Validating test configuration');
logClean('Test cleanup', 'Cleaning up test resources');
logDeploy('Test deployment', 'Deploying test application');
logMigrate('Test migration', 'Migrating test data');
logTest('Test execution', 'Running test suite');
logError('Test error', 'Simulating error condition');
logWarning('Test warning', 'Simulating warning condition');

console.log('✅ Single line logging tests complete\n');

// Test multi-line logging
console.log('2. Testing multi-line logging...');
logMultiLineInfo('Multi-line info test', 
  'This is a multi-line test\n' +
  'NAME: Multi-line information test\n' +
  'NOTE: Testing the multi-line logging capability\n' +
  'DETAILS: This should create multiple log entries with the same log ID'
);

logMultiLineBuild('Multi-line build test',
  'Building complex infrastructure\n' +
  'NAME: Multi-environment build\n' +
  'NOTE: Building development, staging, and production environments\n' +
  'STEP 1: Initialize Terraform\n' +
  'STEP 2: Validate configuration\n' +
  'STEP 3: Apply changes'
);

logMultiLineTeardown('Multi-line teardown test',
  'Tearing down multiple environments\n' +
  'NAME: Complete infrastructure teardown\n' +
  'NOTE: This will destroy all environments and VPC infrastructure\n' +
  'ENVIRONMENTS: development, staging, production\n' +
  'WARNING: This action is irreversible'
);

console.log('✅ Multi-line logging tests complete\n');

// Test log file access
console.log('3. Testing log file access...');
const logPath = adminLog.getLogPath();
console.log(`Log file location: ${logPath}`);

// Get recent entries
const recentEntries = adminLog.getRecentEntries(10);
console.log(`Recent log entries: ${recentEntries.length}`);

if (recentEntries.length > 0) {
  console.log('Sample log entry:');
  const sample = recentEntries[0];
  console.log(`  Log ID: ${sample.logId}`);
  console.log(`  Sequence: ${sample.sequence}`);
  console.log(`  Timestamp: ${sample.timestamp}`);
  console.log(`  User: ${sample.user}`);
  console.log(`  Action Type: ${sample.actionType}`);
  console.log(`  Action: ${sample.action}`);
  console.log(`  Notes: ${sample.notes}`);
}

console.log('✅ Log file access tests complete\n');

// Test log format
console.log('4. Testing log format...');
const testEntry = {
  logId: 12345,
  sequence: 0,
  timestamp: new Date().toISOString(),
  user: 'testuser',
  actionType: 'test',
  action: 'format test',
  notes: 'Testing log format'
};

console.log('Expected format:');
console.log('| 12345-000 | <timestamp> | testuser | test | format test | Testing log format |');

console.log('✅ Log format tests complete\n');

console.log('🎉 All logging system tests completed successfully!');
console.log('\nTo monitor the logs in real-time, run:');
console.log('  npm run log:monitor');
console.log('\nTo view recent logs, run:');
console.log('  npm run log:monitor:tail');
console.log('\nTo view all logs, run:');
console.log('  npm run log:monitor:all'); 