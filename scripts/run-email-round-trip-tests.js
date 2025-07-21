#!/usr/bin/env node

/**
 * Email Round Trip Testing Script
 * Runs comprehensive email round trip tests via AWS Lambda
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const config = require('../config.json');

// AWS Lambda client
const lambda = new LambdaClient({ 
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'cliadmin'
});

// Test types
const TEST_TYPES = {
    SES_TO_SES: 'SES-to-SES',
    GMAIL_TO_GMAIL: 'Gmail-to-Gmail',
    SES_TO_GMAIL: 'SES-to-Gmail',
    GMAIL_TO_SES: 'Gmail-to-SES',
    ALL: 'ALL'
};

/**
 * Runs email round trip tests
 * @param {string|string[]} testTypes - Test types to run
 * @param {boolean} verbose - Include detailed test information
 * @param {boolean} help - Show help information
 */
async function runEmailRoundTripTests(testTypes = 'ALL', verbose = false, help = false) {
    try {
        console.log('🚀 Email Round Trip Testing');
        console.log('==========================\n');

        // Prepare payload
        let payload;
        if (help) {
            payload = { help: true };
            console.log('📖 Requesting help information...\n');
        } else {
            const tests = Array.isArray(testTypes) ? testTypes : [testTypes];
            payload = { tests, verbose };
            console.log(`🧪 Running tests: ${tests.join(', ')}`);
            console.log(`📊 Verbose mode: ${verbose ? 'enabled' : 'disabled'}\n`);
        }

        // Invoke Lambda function
        console.log('📡 Invoking Lambda function...');
        const command = new InvokeCommand({
            FunctionName: 'chatterbox-email-round-trip-tester',
            Payload: JSON.stringify(payload)
        });

        const response = await lambda.send(command);
        
        if (response.StatusCode !== 200) {
            throw new Error(`Lambda invocation failed with status: ${response.StatusCode}`);
        }

        // Parse response
        const result = JSON.parse(Buffer.from(response.Payload).toString());
        
        if (result.errorMessage) {
            throw new Error(`Lambda execution error: ${result.errorMessage}`);
        }

        const responseBody = JSON.parse(result.body || '{}');

        // Display results
        if (help || responseBody.help) {
            displayHelp(responseBody.help);
        } else {
            displayResults(responseBody);
        }

        return responseBody;

    } catch (error) {
        console.error('❌ Error running email round trip tests:', error.message);
        
        if (error.name === 'ResourceNotFoundException') {
            console.error('💡 Make sure the Lambda function is deployed: npm run aws:deploy');
        } else if (error.name === 'AccessDeniedException') {
            console.error('💡 Check AWS credentials and permissions');
        }
        
        process.exit(1);
    }
}

/**
 * Displays help information
 */
function displayHelp(helpInfo) {
    console.log('📖 Email Round Trip Tester Help');
    console.log('================================\n');
    
    console.log(`Function: ${helpInfo.function}`);
    console.log(`Description: ${helpInfo.description}`);
    console.log(`Version: ${helpInfo.version}\n`);
    
    console.log('Usage:');
    console.log('------');
    
    // GET usage
    console.log('GET Request:');
    console.log('  Query parameters:');
    Object.entries(helpInfo.usage.get.parameters).forEach(([param, desc]) => {
        console.log(`    ${param}: ${desc}`);
    });
    console.log('\n  Examples:');
    helpInfo.usage.get.examples.forEach(example => {
        console.log(`    ${example}`);
    });
    
    console.log('\nPOST Request:');
    console.log('  JSON body:');
    Object.entries(helpInfo.usage.post.body).forEach(([param, desc]) => {
        console.log(`    ${param}: ${desc}`);
    });
    console.log('\n  Examples:');
    helpInfo.usage.post.examples.forEach(example => {
        console.log(`    ${example}`);
    });
    
    console.log('\nTest Types:');
    console.log('-----------');
    Object.entries(helpInfo.testTypes).forEach(([type, desc]) => {
        console.log(`  ${type}: ${desc}`);
    });
    
    console.log('\nCapabilities:');
    console.log('-------------');
    Object.entries(helpInfo.capabilities).forEach(([service, desc]) => {
        console.log(`  ${service}: ${desc}`);
    });
}

/**
 * Displays test results
 */
function displayResults(result) {
    console.log('📊 Test Results');
    console.log('===============\n');
    
    // Overall status
    const status = result.success ? '✅ SUCCESS' : '❌ FAILURE';
    console.log(`Overall Status: ${status}`);
    console.log(`Duration: ${result.duration}`);
    console.log(`Timestamp: ${result.timestamp}\n`);
    
    // Test summary
    if (result.testSuite && result.testSuite.summary) {
        const summary = result.testSuite.summary;
        console.log('Test Summary:');
        console.log(`  Total Tests: ${summary.total}`);
        console.log(`  Passed: ${summary.passed}`);
        console.log(`  Failed: ${summary.failed}`);
        console.log(`  Success Rate: ${summary.successRate}%\n`);
    }
    
    // Email capabilities
    if (result.capabilities && result.capabilities.length > 0) {
        console.log('Email Capabilities:');
        result.capabilities.forEach(cap => {
            const sesStatus = cap.sesVerified ? '✅' : '❌';
            const gmailStatus = cap.canSendViaGmail ? '✅' : '❌';
            console.log(`  ${cap.email}:`);
            console.log(`    SES Verified: ${sesStatus}`);
            console.log(`    Gmail Send: ${gmailStatus}`);
            if (cap.gmailScopes.length > 0) {
                console.log(`    Gmail Scopes: ${cap.gmailScopes.join(', ')}`);
            }
        });
        console.log('');
    }
    
    // Detailed test results (if verbose)
    if (result.tests && result.tests.length > 0) {
        console.log('Detailed Test Results:');
        console.log('=====================\n');
        
        const testGroups = {};
        result.tests.forEach(test => {
            if (!testGroups[test.testType]) {
                testGroups[test.testType] = [];
            }
            testGroups[test.testType].push(test);
        });
        
        Object.entries(testGroups).forEach(([testType, tests]) => {
            console.log(`${testType}:`);
            tests.forEach(test => {
                const status = test.success ? '✅' : '❌';
                console.log(`  ${status} ${test.fromEmail} → ${test.toEmail}`);
                if (!test.success && test.error) {
                    console.log(`    Error: ${test.error}`);
                }
                if (test.messageId) {
                    console.log(`    Message ID: ${test.messageId}`);
                }
            });
            console.log('');
        });
    }
    
    // Final status
    if (result.success) {
        console.log('🎉 All email round trip tests completed successfully!');
    } else {
        console.log('⚠️ Some tests failed. Check the detailed results above.');
        process.exit(1);
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    
    // Parse command line arguments
    let testTypes = 'ALL';
    let verbose = false;
    let help = false;
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--help':
            case '-h':
                help = true;
                break;
            case '--verbose':
            case '-v':
                verbose = true;
                break;
            case '--tests':
            case '-t':
                if (i + 1 < args.length) {
                    testTypes = args[i + 1].split(',');
                    i++;
                } else {
                    console.error('❌ Error: --tests requires a value');
                    process.exit(1);
                }
                break;
            case '--ses-to-ses':
                testTypes = [TEST_TYPES.SES_TO_SES];
                break;
            case '--gmail-to-gmail':
                testTypes = [TEST_TYPES.GMAIL_TO_GMAIL];
                break;
            case '--ses-to-gmail':
                testTypes = [TEST_TYPES.SES_TO_GMAIL];
                break;
            case '--gmail-to-ses':
                testTypes = [TEST_TYPES.GMAIL_TO_SES];
                break;
            case '--all':
                testTypes = 'ALL';
                break;
            default:
                if (arg.startsWith('-')) {
                    console.error(`❌ Error: Unknown option ${arg}`);
                    console.error('Use --help for usage information');
                    process.exit(1);
                }
                break;
        }
    }
    
    // Run tests
    await runEmailRoundTripTests(testTypes, verbose, help);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { runEmailRoundTripTests, TEST_TYPES }; 