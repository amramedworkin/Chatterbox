// src/aws/emailRoundTripTester.ts
// AWS Lambda function for comprehensive round-trip email testing

import { SESClient, SendEmailCommand, GetIdentityVerificationAttributesCommand, ListIdentitiesCommand } from '@aws-sdk/client-ses';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import { v4 as uuidv4 } from 'uuid';

// AWS Clients
const sesClient = new SESClient({});
const secretsClient = new SecretsManagerClient({});
const ssmClient = new SSMClient({});

// Interfaces
interface TestResult {
    testType: string;
    fromEmail: string;
    toEmail: string;
    success: boolean;
    messageId?: string;
    error?: string;
    timestamp: string;
    details?: any;
}

interface TestSuite {
    testId: string;
    timestamp: string;
    tests: TestResult[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        successRate: number;
    };
}

interface EmailCapability {
    email: string;
    sesVerified: boolean;
    gmailScopes: string[];
    canSendViaSES: boolean;
    canSendViaGmail: boolean;
    canReceiveViaSES: boolean;
    canReceiveViaGmail: boolean;
}

interface TestRequest {
    tests?: string[];
    help?: boolean;
    verbose?: boolean;
}

// Test types
const TEST_TYPES = {
    SES_TO_SES: 'SES-to-SES',
    GMAIL_TO_GMAIL: 'Gmail-to-Gmail',
    SES_TO_GMAIL: 'SES-to-Gmail',
    GMAIL_TO_SES: 'Gmail-to-SES',
    ALL: 'ALL'
} as const;

type TestType = typeof TEST_TYPES[keyof typeof TEST_TYPES];

/**
 * Gets SES verified email addresses
 */
async function getSESVerifiedEmails(): Promise<string[]> {
    try {
        console.log('🔍 Getting SES verified email addresses...');
        
        const identities = await sesClient.send(new ListIdentitiesCommand({ IdentityType: 'EmailAddress' }));
        
        if (!identities.Identities || identities.Identities.length === 0) {
            console.log('⚠️ No SES email identities found');
            return [];
        }

        const verificationAttributes = await sesClient.send(
            new GetIdentityVerificationAttributesCommand({ Identities: identities.Identities })
        );

        const verifiedEmails: string[] = [];
        for (const email of identities.Identities) {
            const status = verificationAttributes.VerificationAttributes?.[email]?.VerificationStatus;
            if (status === 'Success') {
                verifiedEmails.push(email);
            }
        }

        console.log(`✅ Found ${verifiedEmails.length} SES verified emails: ${verifiedEmails.join(', ')}`);
        return verifiedEmails;
    } catch (error) {
        console.error('❌ Error getting SES verified emails:', error);
        throw error;
    }
}

/**
 * Gets Gmail API credentials and tokens
 */
async function getGmailCredentials(): Promise<{ credentials: any; tokens: any }> {
    try {
        console.log('🔍 Getting Gmail credentials from Secrets Manager...');
        
        // Get Google credentials
        const credentialsSecret = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: 'chatterbox/google-credentials' })
        );
        const credentials = JSON.parse(credentialsSecret.SecretString || '{}');

        // Get Gmail tokens
        const tokensSecret = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: 'chatterbox/gmail-tokens' })
        );
        const tokens = JSON.parse(tokensSecret.SecretString || '{}');

        console.log('✅ Gmail credentials retrieved successfully');
        return { credentials, tokens };
    } catch (error) {
        console.error('❌ Error getting Gmail credentials:', error);
        throw error;
    }
}

/**
 * Creates Gmail OAuth2 client for a specific email
 */
async function createGmailAuthClient(email: string): Promise<OAuth2Client> {
    try {
        console.log(`🔍 Creating Gmail auth client for: ${email}`);
        
        const { credentials, tokens } = await getGmailCredentials();
        
        if (!tokens[email]) {
            throw new Error(`No tokens found for email: ${email}`);
        }

        const oauth2Client = new google.auth.OAuth2(
            credentials.client_id,
            credentials.client_secret,
            credentials.redirect_uris?.[0]
        );

        oauth2Client.setCredentials(tokens[email]);

        // Test the credentials
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        
        console.log(`✅ Gmail auth client created for: ${profile.data.emailAddress}`);
        return oauth2Client;
    } catch (error) {
        console.error(`❌ Error creating Gmail auth client for ${email}:`, error);
        throw error;
    }
}

/**
 * Gets Gmail API scopes for an email address
 */
async function getGmailScopes(email: string): Promise<string[]> {
    try {
        const { tokens } = await getGmailCredentials();
        const tokenData = tokens[email];
        
        if (!tokenData || !tokenData.scope) {
            return [];
        }

        return tokenData.scope.split(' ');
    } catch (error) {
        console.error(`❌ Error getting Gmail scopes for ${email}:`, error);
        return [];
    }
}

/**
 * Determines email capabilities for all addresses
 */
async function determineEmailCapabilities(): Promise<EmailCapability[]> {
    console.log('🔍 Determining email capabilities...');
    
    const sesEmails = await getSESVerifiedEmails();
    const { tokens } = await getGmailCredentials();
    
    const capabilities: EmailCapability[] = [];
    const allEmails = new Set([...sesEmails, ...Object.keys(tokens)]);
    
    for (const email of allEmails) {
        const sesVerified = sesEmails.includes(email);
        const gmailScopes = await getGmailScopes(email);
        
        const capability: EmailCapability = {
            email,
            sesVerified,
            gmailScopes,
            canSendViaSES: sesVerified,
            canSendViaGmail: gmailScopes.includes('https://www.googleapis.com/auth/gmail.send'),
            canReceiveViaSES: sesVerified,
            canReceiveViaGmail: gmailScopes.includes('https://www.googleapis.com/auth/gmail.readonly')
        };
        
        capabilities.push(capability);
        console.log(`📧 ${email}: SES=${sesVerified}, Gmail=${gmailScopes.join(',')}`);
    }
    
    return capabilities;
}

/**
 * Sends email via SES
 */
async function sendEmailViaSES(fromEmail: string, toEmail: string, subject: string, body: string): Promise<{ messageId: string }> {
    try {
        console.log(`📤 Sending SES email from ${fromEmail} to ${toEmail}`);
        
        const command = new SendEmailCommand({
            Source: fromEmail,
            Destination: {
                ToAddresses: [toEmail]
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8'
                },
                Body: {
                    Text: {
                        Data: body,
                        Charset: 'UTF-8'
                    }
                }
            }
        });

        const result = await sesClient.send(command);
        
        console.log(`✅ SES email sent successfully: ${result.MessageId}`);
        return { messageId: result.MessageId! };
    } catch (error) {
        console.error(`❌ SES email send failed:`, error);
        throw error;
    }
}

/**
 * Sends email via Gmail API
 */
async function sendEmailViaGmail(fromEmail: string, toEmail: string, subject: string, body: string): Promise<{ messageId: string }> {
    try {
        console.log(`📤 Sending Gmail email from ${fromEmail} to ${toEmail}`);
        
        const authClient = await createGmailAuthClient(fromEmail);
        const gmail = google.gmail({ version: 'v1', auth: authClient });

        // Create email message
        const message = [
            `From: ${fromEmail}`,
            `To: ${toEmail}`,
            `Subject: ${subject}`,
            '',
            body
        ].join('\r\n');

        const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        console.log(`✅ Gmail email sent successfully: ${result.data.id}`);
        return { messageId: result.data.id! };
    } catch (error) {
        console.error(`❌ Gmail email send failed:`, error);
        throw error;
    }
}

/**
 * Performs SES-to-SES round trip test
 */
async function testSESToSES(capabilities: EmailCapability[]): Promise<TestResult[]> {
    console.log('🧪 Starting SES-to-SES tests...');
    
    const results: TestResult[] = [];
    const sesEmails = capabilities.filter(c => c.canSendViaSES && c.canReceiveViaSES);
    
    if (sesEmails.length < 1) {
        console.log('⚠️ No SES emails available for testing');
        return results;
    }

    // Test 1: Send email to self
    for (const email of sesEmails) {
        const testId = uuidv4();
        const subject = `SES Round Trip Test - Self ${testId}`;
        const body = `This is a SES-to-SES round trip test email sent to self.\nTest ID: ${testId}\nTimestamp: ${new Date().toISOString()}`;
        
        try {
            const result = await sendEmailViaSES(email.email, email.email, subject, body);
            
            results.push({
                testType: TEST_TYPES.SES_TO_SES,
                fromEmail: email.email,
                toEmail: email.email,
                success: true,
                messageId: result.messageId,
                timestamp: new Date().toISOString(),
                details: { testId, testType: 'self' }
            });
            
            console.log(`✅ SES-to-SES self test passed for ${email.email}`);
        } catch (error) {
            results.push({
                testType: TEST_TYPES.SES_TO_SES,
                fromEmail: email.email,
                toEmail: email.email,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
                details: { testId, testType: 'self' }
            });
            
            console.log(`❌ SES-to-SES self test failed for ${email.email}: ${error}`);
        }
    }

    // Test 2: Send email to other SES emails
    for (const fromEmail of sesEmails) {
        for (const toEmail of sesEmails) {
            if (fromEmail.email === toEmail.email) continue; // Skip self
            
            const testId = uuidv4();
            const subject = `SES Round Trip Test - Cross ${testId}`;
            const body = `This is a SES-to-SES round trip test email.\nFrom: ${fromEmail.email}\nTo: ${toEmail.email}\nTest ID: ${testId}\nTimestamp: ${new Date().toISOString()}`;
            
            try {
                const result = await sendEmailViaSES(fromEmail.email, toEmail.email, subject, body);
                
                results.push({
                    testType: TEST_TYPES.SES_TO_SES,
                    fromEmail: fromEmail.email,
                    toEmail: toEmail.email,
                    success: true,
                    messageId: result.messageId,
                    timestamp: new Date().toISOString(),
                    details: { testId, testType: 'cross' }
                });
                
                console.log(`✅ SES-to-SES cross test passed: ${fromEmail.email} -> ${toEmail.email}`);
            } catch (error) {
                results.push({
                    testType: TEST_TYPES.SES_TO_SES,
                    fromEmail: fromEmail.email,
                    toEmail: toEmail.email,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                    details: { testId, testType: 'cross' }
                });
                
                console.log(`❌ SES-to-SES cross test failed: ${fromEmail.email} -> ${toEmail.email}: ${error}`);
            }
        }
    }

    return results;
}

/**
 * Performs Gmail-to-Gmail round trip test
 */
async function testGmailToGmail(capabilities: EmailCapability[]): Promise<TestResult[]> {
    console.log('🧪 Starting Gmail-to-Gmail tests...');
    
    const results: TestResult[] = [];
    const gmailEmails = capabilities.filter(c => c.canSendViaGmail && c.canReceiveViaGmail);
    
    if (gmailEmails.length < 1) {
        console.log('⚠️ No Gmail emails available for testing');
        return results;
    }

    // Test 1: Send email to self
    for (const email of gmailEmails) {
        const testId = uuidv4();
        const subject = `Gmail Round Trip Test - Self ${testId}`;
        const body = `This is a Gmail-to-Gmail round trip test email sent to self.\nTest ID: ${testId}\nTimestamp: ${new Date().toISOString()}`;
        
        try {
            const result = await sendEmailViaGmail(email.email, email.email, subject, body);
            
            results.push({
                testType: TEST_TYPES.GMAIL_TO_GMAIL,
                fromEmail: email.email,
                toEmail: email.email,
                success: true,
                messageId: result.messageId,
                timestamp: new Date().toISOString(),
                details: { testId, testType: 'self' }
            });
            
            console.log(`✅ Gmail-to-Gmail self test passed for ${email.email}`);
        } catch (error) {
            results.push({
                testType: TEST_TYPES.GMAIL_TO_GMAIL,
                fromEmail: email.email,
                toEmail: email.email,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
                details: { testId, testType: 'self' }
            });
            
            console.log(`❌ Gmail-to-Gmail self test failed for ${email.email}: ${error}`);
        }
    }

    // Test 2: Send email to other Gmail emails
    for (const fromEmail of gmailEmails) {
        for (const toEmail of gmailEmails) {
            if (fromEmail.email === toEmail.email) continue; // Skip self
            
            const testId = uuidv4();
            const subject = `Gmail Round Trip Test - Cross ${testId}`;
            const body = `This is a Gmail-to-Gmail round trip test email.\nFrom: ${fromEmail.email}\nTo: ${toEmail.email}\nTest ID: ${testId}\nTimestamp: ${new Date().toISOString()}`;
            
            try {
                const result = await sendEmailViaGmail(fromEmail.email, toEmail.email, subject, body);
                
                results.push({
                    testType: TEST_TYPES.GMAIL_TO_GMAIL,
                    fromEmail: fromEmail.email,
                    toEmail: toEmail.email,
                    success: true,
                    messageId: result.messageId,
                    timestamp: new Date().toISOString(),
                    details: { testId, testType: 'cross' }
                });
                
                console.log(`✅ Gmail-to-Gmail cross test passed: ${fromEmail.email} -> ${toEmail.email}`);
            } catch (error) {
                results.push({
                    testType: TEST_TYPES.GMAIL_TO_GMAIL,
                    fromEmail: fromEmail.email,
                    toEmail: toEmail.email,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                    details: { testId, testType: 'cross' }
                });
                
                console.log(`❌ Gmail-to-Gmail cross test failed: ${fromEmail.email} -> ${toEmail.email}: ${error}`);
            }
        }
    }

    return results;
}

/**
 * Performs SES-to-Gmail round trip test
 */
async function testSESToGmail(capabilities: EmailCapability[]): Promise<TestResult[]> {
    console.log('🧪 Starting SES-to-Gmail tests...');
    
    const results: TestResult[] = [];
    const sesEmails = capabilities.filter(c => c.canSendViaSES);
    const gmailEmails = capabilities.filter(c => c.canReceiveViaGmail);
    
    if (sesEmails.length === 0 || gmailEmails.length === 0) {
        console.log('⚠️ No SES senders or Gmail receivers available for testing');
        return results;
    }

    for (const sesEmail of sesEmails) {
        for (const gmailEmail of gmailEmails) {
            const testId = uuidv4();
            const subject = `SES-to-Gmail Round Trip Test ${testId}`;
            const body = `This is a SES-to-Gmail round trip test email.\nFrom (SES): ${sesEmail.email}\nTo (Gmail): ${gmailEmail.email}\nTest ID: ${testId}\nTimestamp: ${new Date().toISOString()}`;
            
            try {
                const result = await sendEmailViaSES(sesEmail.email, gmailEmail.email, subject, body);
                
                results.push({
                    testType: TEST_TYPES.SES_TO_GMAIL,
                    fromEmail: sesEmail.email,
                    toEmail: gmailEmail.email,
                    success: true,
                    messageId: result.messageId,
                    timestamp: new Date().toISOString(),
                    details: { testId }
                });
                
                console.log(`✅ SES-to-Gmail test passed: ${sesEmail.email} -> ${gmailEmail.email}`);
            } catch (error) {
                results.push({
                    testType: TEST_TYPES.SES_TO_GMAIL,
                    fromEmail: sesEmail.email,
                    toEmail: gmailEmail.email,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                    details: { testId }
                });
                
                console.log(`❌ SES-to-Gmail test failed: ${sesEmail.email} -> ${gmailEmail.email}: ${error}`);
            }
        }
    }

    return results;
}

/**
 * Performs Gmail-to-SES round trip test
 */
async function testGmailToSES(capabilities: EmailCapability[]): Promise<TestResult[]> {
    console.log('🧪 Starting Gmail-to-SES tests...');
    
    const results: TestResult[] = [];
    const gmailEmails = capabilities.filter(c => c.canSendViaGmail);
    const sesEmails = capabilities.filter(c => c.canReceiveViaSES);
    
    if (gmailEmails.length === 0 || sesEmails.length === 0) {
        console.log('⚠️ No Gmail senders or SES receivers available for testing');
        return results;
    }

    for (const gmailEmail of gmailEmails) {
        for (const sesEmail of sesEmails) {
            const testId = uuidv4();
            const subject = `Gmail-to-SES Round Trip Test ${testId}`;
            const body = `This is a Gmail-to-SES round trip test email.\nFrom (Gmail): ${gmailEmail.email}\nTo (SES): ${sesEmail.email}\nTest ID: ${testId}\nTimestamp: ${new Date().toISOString()}`;
            
            try {
                const result = await sendEmailViaGmail(gmailEmail.email, sesEmail.email, subject, body);
                
                results.push({
                    testType: TEST_TYPES.GMAIL_TO_SES,
                    fromEmail: gmailEmail.email,
                    toEmail: sesEmail.email,
                    success: true,
                    messageId: result.messageId,
                    timestamp: new Date().toISOString(),
                    details: { testId }
                });
                
                console.log(`✅ Gmail-to-SES test passed: ${gmailEmail.email} -> ${sesEmail.email}`);
            } catch (error) {
                results.push({
                    testType: TEST_TYPES.GMAIL_TO_SES,
                    fromEmail: gmailEmail.email,
                    toEmail: sesEmail.email,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                    details: { testId }
                });
                
                console.log(`❌ Gmail-to-SES test failed: ${gmailEmail.email} -> ${sesEmail.email}: ${error}`);
            }
        }
    }

    return results;
}

/**
 * Runs all tests
 */
async function runAllTests(capabilities: EmailCapability[]): Promise<TestResult[]> {
    console.log('🧪 Running all email round trip tests...');
    
    const allResults: TestResult[] = [];
    
    // Run each test type
    const testFunctions = [
        { name: TEST_TYPES.SES_TO_SES, func: testSESToSES },
        { name: TEST_TYPES.GMAIL_TO_GMAIL, func: testGmailToGmail },
        { name: TEST_TYPES.SES_TO_GMAIL, func: testSESToGmail },
        { name: TEST_TYPES.GMAIL_TO_SES, func: testGmailToSES }
    ];

    for (const test of testFunctions) {
        try {
            console.log(`\n=== Running ${test.name} tests ===`);
            const results = await test.func(capabilities);
            allResults.push(...results);
        } catch (error) {
            console.error(`❌ Error running ${test.name} tests:`, error);
            allResults.push({
                testType: test.name,
                fromEmail: 'N/A',
                toEmail: 'N/A',
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
                details: { error: 'Test suite failed' }
            });
        }
    }

    return allResults;
}

/**
 * Creates test summary
 */
function createTestSummary(results: TestResult[]): TestSuite {
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    return {
        testId: uuidv4(),
        timestamp: new Date().toISOString(),
        tests: results,
        summary: {
            total,
            passed,
            failed,
            successRate: Math.round(successRate * 100) / 100
        }
    };
}

/**
 * Returns help information
 */
function getHelpInfo(): any {
    return {
        function: 'Email Round Trip Tester',
        description: 'Comprehensive email round trip testing for SES and Gmail API',
        version: '1.0.0',
        usage: {
            get: {
                description: 'Use query parameters to specify tests',
                parameters: {
                    tests: 'Comma-separated list of test types (SES-to-SES, Gmail-to-Gmail, SES-to-Gmail, Gmail-to-SES, ALL)',
                    help: 'Show this help information',
                    verbose: 'Include detailed test information'
                },
                examples: [
                    '?tests=SES-to-SES',
                    '?tests=ALL',
                    '?tests=SES-to-SES,Gmail-to-Gmail&verbose=true',
                    '?help=true'
                ]
            },
            post: {
                description: 'Use JSON body to specify tests',
                body: {
                    tests: 'Array of test types',
                    help: 'Show help information',
                    verbose: 'Include detailed test information'
                },
                examples: [
                    '{"tests": ["SES-to-SES"]}',
                    '{"tests": ["ALL"]}',
                    '{"tests": ["SES-to-SES", "Gmail-to-Gmail"], "verbose": true}',
                    '{"help": true}'
                ]
            }
        },
        testTypes: {
            'SES-to-SES': 'Tests sending emails between SES verified addresses',
            'Gmail-to-Gmail': 'Tests sending emails between Gmail API authorized addresses',
            'SES-to-Gmail': 'Tests sending emails from SES to Gmail addresses',
            'Gmail-to-SES': 'Tests sending emails from Gmail to SES addresses',
            'ALL': 'Runs all test types'
        },
        capabilities: {
            ses: 'Requires verified email addresses in AWS SES',
            gmail: 'Requires OAuth2 authorization with gmail.send scope'
        },
        response: {
            success: 'Boolean indicating overall test success',
            testSuite: 'Complete test results and summary',
            capabilities: 'Email capabilities analysis',
            timestamp: 'Test execution timestamp'
        }
    };
}

/**
 * Main Lambda handler
 */
export async function handler(event: any): Promise<any> {
    const startTime = new Date();
    console.log('🚀 Email Round Trip Tester Lambda started');
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Parse request
        let testRequest: TestRequest = {};
        
        if (event.httpMethod === 'GET') {
            // Parse query parameters
            const queryParams = event.queryStringParameters || {};
            testRequest = {
                tests: queryParams.tests ? queryParams.tests.split(',') : undefined,
                help: queryParams.help === 'true',
                verbose: queryParams.verbose === 'true'
            };
        } else if (event.httpMethod === 'POST') {
            // Parse JSON body
            testRequest = JSON.parse(event.body || '{}');
        } else {
            throw new Error(`Unsupported HTTP method: ${event.httpMethod}`);
        }

        // Check for help request
        if (testRequest.help) {
            console.log('📖 Returning help information');
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                body: JSON.stringify({
                    success: true,
                    help: getHelpInfo(),
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Determine which tests to run
        let testsToRun: TestType[] = [];
        if (testRequest.tests) {
            testsToRun = testRequest.tests as TestType[];
            if (testsToRun.includes(TEST_TYPES.ALL)) {
                testsToRun = Object.values(TEST_TYPES).filter(t => t !== TEST_TYPES.ALL);
            }
        } else {
            // Default to all tests
            testsToRun = Object.values(TEST_TYPES).filter(t => t !== TEST_TYPES.ALL);
        }

        console.log(`🧪 Tests to run: ${testsToRun.join(', ')}`);

        // Determine email capabilities
        console.log('🔍 Analyzing email capabilities...');
        const capabilities = await determineEmailCapabilities();
        
        console.log('📊 Email capabilities summary:');
        capabilities.forEach(cap => {
            console.log(`  ${cap.email}: SES=${cap.sesVerified}, Gmail=${cap.gmailScopes.join(',')}`);
        });

        // Run tests
        let allResults: TestResult[] = [];
        
        for (const testType of testsToRun) {
            console.log(`\n=== Running ${testType} tests ===`);
            
            let results: TestResult[] = [];
            switch (testType) {
                case TEST_TYPES.SES_TO_SES:
                    results = await testSESToSES(capabilities);
                    break;
                case TEST_TYPES.GMAIL_TO_GMAIL:
                    results = await testGmailToGmail(capabilities);
                    break;
                case TEST_TYPES.SES_TO_GMAIL:
                    results = await testSESToGmail(capabilities);
                    break;
                case TEST_TYPES.GMAIL_TO_SES:
                    results = await testGmailToSES(capabilities);
                    break;
                default:
                    console.warn(`⚠️ Unknown test type: ${testType}`);
                    continue;
            }
            
            allResults.push(...results);
        }

        // Create test summary
        const testSuite = createTestSummary(allResults);
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        console.log('\n📊 Test Summary:');
        console.log(`  Total tests: ${testSuite.summary.total}`);
        console.log(`  Passed: ${testSuite.summary.passed}`);
        console.log(`  Failed: ${testSuite.summary.failed}`);
        console.log(`  Success rate: ${testSuite.summary.successRate}%`);
        console.log(`  Duration: ${duration}ms`);

        // Prepare response
        const response: any = {
            success: testSuite.summary.failed === 0,
            testSuite: testRequest.verbose ? testSuite : {
                testId: testSuite.testId,
                timestamp: testSuite.timestamp,
                summary: testSuite.summary
            },
            capabilities: capabilities.map(cap => ({
                email: cap.email,
                sesVerified: cap.sesVerified,
                gmailScopes: cap.gmailScopes,
                canSendViaSES: cap.canSendViaSES,
                canSendViaGmail: cap.canSendViaGmail
            })),
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`
        };

        if (testRequest.verbose) {
            response.tests = allResults;
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify(response, null, 2)
        };

    } catch (error) {
        console.error('❌ Lambda function error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                timestamp: new Date().toISOString()
            })
        };
    }
} 