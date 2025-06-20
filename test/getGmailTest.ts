// test/getGmailTest.ts
// Comprehensive test script for all getGmail functions

import config from '../src/loadConfig';
import { authorizeGmail } from '../src/mail/authorizeGmail';
import {
    getAllGmailIds,
    getChatterboxGmailIds,
    getChatterboxConversationGmailIds,
    getGmailById,
    getGmailsByIds,
    getGmailRange,
    getChatterboxGmailRange,
    getChatterboxConversationGmailRange,
    extractConversationId,
    getEmailSubject,
    getEmailSender,
    getEmailBody,
    GmailMessage,
    DateRange
} from '../src/mail/getGmail';

let authClient: any = null;

/**
 * Initialize authorization for testing
 */
async function initializeAuth(): Promise<void> {
    console.log('🔐 Initializing Gmail authorization...');
    try {
        authClient = await authorizeGmail(config.app.defaultGetGmailUser, config);
        console.log('✅ Authorization successful');
    } catch (error) {
        console.error('❌ Authorization failed:', error);
        throw error;
    }
}

/**
 * Test 1: Get all Gmail IDs in a date range
 */
async function testGetAllGmailIds(): Promise<void> {
    console.log('\n=== Test 1: Get All Gmail IDs ===');
    
    try {
        // Test different date ranges
        const ranges = [
            { name: 'Last 7 days (default)', range: {} },
            { name: 'Last 3 days', range: { startDays: 3 } },
            { name: 'Last 30 days', range: { startDays: 30 } },
            { name: 'Last 2 days', range: { startDays: 2 } }
        ];
        
        for (const { name, range } of ranges) {
            console.log(`\n📅 Testing: ${name}`);
            const ids = await getAllGmailIds(range, undefined, authClient);
            console.log(`   Found ${ids.length} emails`);
            if (ids.length > 0) {
                console.log(`   First 3 IDs: ${ids.slice(0, 3).join(', ')}`);
            }
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 2: Get Chatterbox Gmail IDs
 */
async function testGetChatterboxGmailIds(): Promise<void> {
    console.log('\n=== Test 2: Get Chatterbox Gmail IDs ===');
    
    try {
        const ranges = [
            { name: 'Last 7 days', range: { startDays: 7 } },
            { name: 'Last 30 days', range: { startDays: 30 } },
            { name: 'Last 90 days', range: { startDays: 90 } }
        ];
        
        for (const { name, range } of ranges) {
            console.log(`\n📅 Testing: ${name}`);
            const ids = await getChatterboxGmailIds(range, undefined, authClient);
            console.log(`   Found ${ids.length} Chatterbox emails`);
            if (ids.length > 0) {
                console.log(`   IDs: ${ids.join(', ')}`);
            }
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 3: Get Chatterbox conversation Gmail IDs
 */
async function testGetChatterboxConversationGmailIds(): Promise<void> {
    console.log('\n=== Test 3: Get Chatterbox Conversation Gmail IDs ===');
    
    try {
        const ranges = [
            { name: 'Last 7 days', range: { startDays: 7 } },
            { name: 'Last 30 days', range: { startDays: 30 } },
            { name: 'Last 90 days', range: { startDays: 90 } }
        ];
        
        for (const { name, range } of ranges) {
            console.log(`\n📅 Testing: ${name}`);
            const ids = await getChatterboxConversationGmailIds(range, undefined, authClient);
            console.log(`   Found ${ids.length} Chatterbox conversation emails`);
            if (ids.length > 0) {
                console.log(`   IDs: ${ids.join(', ')}`);
            }
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 4: Get Gmail by ID
 */
async function testGetGmailById(): Promise<void> {
    console.log('\n=== Test 4: Get Gmail by ID ===');
    
    try {
        // First get some IDs to test with
        const ids = await getAllGmailIds({ startDays: 7 }, undefined, authClient);
        
        if (ids.length === 0) {
            console.log('   No emails found to test with');
            return;
        }
        
        const testId = ids[0];
        console.log(`\n📧 Testing with ID: ${testId}`);
        
        const email = await getGmailById(testId, undefined, authClient);
        console.log(`   Subject: ${getEmailSubject(email)}`);
        console.log(`   From: ${getEmailSender(email)}`);
        console.log(`   Snippet: ${email.snippet || 'No snippet'}`);
        console.log(`   Thread ID: ${email.threadId}`);
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 5: Get multiple Gmails by IDs
 */
async function testGetGmailsByIds(): Promise<void> {
    console.log('\n=== Test 5: Get Multiple Gmails by IDs ===');
    
    try {
        // Get some IDs to test with
        const ids = await getAllGmailIds({ startDays: 7 }, undefined, authClient);
        
        if (ids.length === 0) {
            console.log('   No emails found to test with');
            return;
        }
        
        const testIds = ids.slice(0, Math.min(3, ids.length));
        console.log(`\n📧 Testing with ${testIds.length} IDs: ${testIds.join(', ')}`);
        
        const emails = await getGmailsByIds(testIds, undefined, authClient);
        console.log(`   Retrieved ${emails.length} emails`);
        
        emails.forEach((email, index) => {
            console.log(`   ${index + 1}. ${getEmailSubject(email)} (${email.id})`);
        });
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 6: Get Gmail range (messages, not IDs)
 */
async function testGetGmailRange(): Promise<void> {
    console.log('\n=== Test 6: Get Gmail Range (Messages) ===');
    
    try {
        const ranges = [
            { name: 'Last 2 days', range: { startDays: 2 } },
            { name: 'Last 7 days', range: { startDays: 7 } }
        ];
        
        for (const { name, range } of ranges) {
            console.log(`\n📅 Testing: ${name}`);
            const emails = await getGmailRange(range, undefined, authClient);
            console.log(`   Retrieved ${emails.length} email messages`);
            
            if (emails.length > 0) {
                console.log(`   First email subject: ${getEmailSubject(emails[0])}`);
                console.log(`   First email from: ${getEmailSender(emails[0])}`);
            }
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 7: Get Chatterbox Gmail range
 */
async function testGetChatterboxGmailRange(): Promise<void> {
    console.log('\n=== Test 7: Get Chatterbox Gmail Range ===');
    
    try {
        const ranges = [
            { name: 'Last 7 days', range: { startDays: 7 } },
            { name: 'Last 30 days', range: { startDays: 30 } }
        ];
        
        for (const { name, range } of ranges) {
            console.log(`\n📅 Testing: ${name}`);
            const emails = await getChatterboxGmailRange(range, undefined, authClient);
            console.log(`   Retrieved ${emails.length} Chatterbox email messages`);
            
            emails.forEach((email, index) => {
                const subject = getEmailSubject(email);
                const conversationId = extractConversationId(subject);
                console.log(`   ${index + 1}. ${subject}${conversationId ? ` (Conversation: ${conversationId})` : ''}`);
            });
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 8: Get Chatterbox conversation Gmail range
 */
async function testGetChatterboxConversationGmailRange(): Promise<void> {
    console.log('\n=== Test 8: Get Chatterbox Conversation Gmail Range ===');
    
    try {
        const ranges = [
            { name: 'Last 7 days', range: { startDays: 7 } },
            { name: 'Last 30 days', range: { startDays: 30 } }
        ];
        
        for (const { name, range } of ranges) {
            console.log(`\n📅 Testing: ${name}`);
            const emails = await getChatterboxConversationGmailRange(range, undefined, authClient);
            console.log(`   Retrieved ${emails.length} Chatterbox conversation email messages`);
            
            emails.forEach((email, index) => {
                const subject = getEmailSubject(email);
                const conversationId = extractConversationId(subject);
                console.log(`   ${index + 1}. ${subject}${conversationId ? ` (Conversation: ${conversationId})` : ''}`);
            });
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Test 9: Helper functions
 */
async function testHelperFunctions(): Promise<void> {
    console.log('\n=== Test 9: Helper Functions ===');
    
    try {
        // Test conversation ID extraction
        console.log('\n🔍 Testing conversation ID extraction:');
        const testSubjects = [
            'chatterbox: 123e4567-e89b-12d3-a456-426614174000',
            'Chatterbox 987fcdeb-51a2-43b1-9c8d-7e6f5a4b3c2d',
            'chatterbox:abc123-def4-5678-9abc-def123456789',
            'Regular email subject',
            'CHATTERBOX: 11111111-2222-3333-4444-555555555555'
        ];
        
        testSubjects.forEach(subject => {
            const conversationId = extractConversationId(subject);
            console.log(`   "${subject}" -> ${conversationId || 'No conversation ID found'}`);
        });
        
        // Test email content extraction (if we have emails)
        const emails = await getAllGmailIds({ startDays: 1 }, undefined, authClient);
        if (emails.length > 0) {
            console.log('\n📧 Testing email content extraction:');
            const email = await getGmailById(emails[0], undefined, authClient);
            console.log(`   Subject: ${getEmailSubject(email)}`);
            console.log(`   From: ${getEmailSender(email)}`);
            const body = getEmailBody(email);
            console.log(`   Body preview: ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
    console.log('🚀 Starting Gmail Function Tests\n');
    
    try {
        await initializeAuth();
        
        await testGetAllGmailIds();
        await testGetChatterboxGmailIds();
        await testGetChatterboxConversationGmailIds();
        await testGetGmailById();
        await testGetGmailsByIds();
        await testGetGmailRange();
        await testGetChatterboxGmailRange();
        await testGetChatterboxConversationGmailRange();
        await testHelperFunctions();
        
        console.log('\n🎉 All tests completed successfully!');
    } catch (error) {
        console.error('\n💥 Test suite failed:', error);
        process.exit(1);
    }
}

/**
 * Run specific test based on command line argument
 */
async function runSpecificTest(testName: string): Promise<void> {
    console.log(`🚀 Running specific test: ${testName}\n`);
    
    try {
        await initializeAuth();
        
        switch (testName.toLowerCase()) {
            case 'all':
                await runAllTests();
                break;
            case 'ids':
                await testGetAllGmailIds();
                break;
            case 'chatterbox':
                await testGetChatterboxGmailIds();
                break;
            case 'conversations':
                await testGetChatterboxConversationGmailIds();
                break;
            case 'byid':
                await testGetGmailById();
                break;
            case 'byids':
                await testGetGmailsByIds();
                break;
            case 'range':
                await testGetGmailRange();
                break;
            case 'chatterboxrange':
                await testGetChatterboxGmailRange();
                break;
            case 'conversationrange':
                await testGetChatterboxConversationGmailRange();
                break;
            case 'helpers':
                await testHelperFunctions();
                break;
            default:
                console.error(`❌ Unknown test: ${testName}`);
                console.log('Available tests: all, ids, chatterbox, conversations, byid, byids, range, chatterboxrange, conversationrange, helpers');
                process.exit(1);
        }
        
        console.log('\n✅ Test completed successfully!');
    } catch (error) {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const testName = args[0] || 'all';
    
    runSpecificTest(testName)
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Failed to run test:', error);
            process.exit(1);
        });
}

export {
    runAllTests,
    runSpecificTest,
    testGetAllGmailIds,
    testGetChatterboxGmailIds,
    testGetChatterboxConversationGmailIds,
    testGetGmailById,
    testGetGmailsByIds,
    testGetGmailRange,
    testGetChatterboxGmailRange,
    testGetChatterboxConversationGmailRange,
    testHelperFunctions
}; 