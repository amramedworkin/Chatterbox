// test/getMail.test.ts
// Jest test suite for all getGmail functions

import config from '../src/loadConfig';
import {
    getAllGmailIds,
    getChatterboxGmailIds,
    getChatterboxConversationGmailIds,
    getGmailById,
    getGmailsByIds,
    getGmailRange,
    getChatterboxGmailRange,
    getChatterboxConversationGmailRange,
    getGmailIdsBySender,
    getChatterboxGmailIdsBySender,
    getGmailRangeBySender,
    getChatterboxGmailRangeBySender,
    extractConversationId,
    getEmailSubject,
    getEmailSender,
    getEmailBody,
    GmailMessage,
    DateRange
} from '../src/mail/getGmail';
import { authorizeGmail } from '../src/mail/authorizeGmail';

describe('Gmail Get Functions', () => {
    let authClient: any;
    const gmailUser = config.app.defaultGetGmailUser;

    beforeAll(async () => {
        authClient = await authorizeGmail(gmailUser, config);
    });

    // Jest passes arguments after -- to process.argv
    const specificTest = process.argv.includes('--') 
        ? process.argv[process.argv.indexOf('--') + 1] 
        : null;

    describe('getAllGmailIds (test:get:ids)', () => {
        it('should get all Gmail IDs in different date ranges', async () => {
            if (specificTest && specificTest !== 'ids' && specificTest !== 'all') {
                console.log('⏭️  Skipping getAllGmailIds test (not requested)');
                return;
            }

            console.log('\n=== Test: Get All Gmail IDs ===');
            
            const ranges = [
                { name: 'Last 7 days (default)', range: {} },
                { name: 'Last 3 days', range: { startDays: 3 } },
                { name: 'Last 30 days', range: { startDays: 30 } },
                { name: 'Last 2 days', range: { startDays: 2 } }
            ];
            
            for (const { name, range } of ranges) {
                console.log(`\n📅 Testing: ${name}`);
                const ids = await getAllGmailIds(range, gmailUser, authClient);
                console.log(`   Found ${ids.length} emails`);
                
                // Verify result structure
                expect(Array.isArray(ids)).toBe(true);
                
                if (ids.length > 0) {
                    console.log(`   First 3 IDs: ${ids.slice(0, 3).join(', ')}`);
                    // Verify IDs are strings
                    expect(typeof ids[0]).toBe('string');
                }
            }
        });
    });

    describe('getChatterboxGmailIds (test:get:chatterbox)', () => {
        it('should get Chatterbox Gmail IDs in different date ranges', async () => {
            if (specificTest && specificTest !== 'chatterbox' && specificTest !== 'all') {
                console.log('⏭️  Skipping getChatterboxGmailIds test (not requested)');
                return;
            }

            console.log('\n=== Test: Get Chatterbox Gmail IDs ===');
            
            const ranges = [
                { name: 'Last 7 days', range: { startDays: 7 } },
                { name: 'Last 30 days', range: { startDays: 30 } },
                { name: 'Last 90 days', range: { startDays: 90 } }
            ];
            
            for (const { name, range } of ranges) {
                console.log(`\n📅 Testing: ${name}`);
                const ids = await getChatterboxGmailIds(range, gmailUser, authClient);
                console.log(`   Found ${ids.length} Chatterbox emails`);
                
                // Verify result structure
                expect(Array.isArray(ids)).toBe(true);
                
                if (ids.length > 0) {
                    console.log(`   IDs: ${ids.join(', ')}`);
                    expect(typeof ids[0]).toBe('string');
                }
            }
        });
    });

    describe('getChatterboxConversationGmailIds (test:get:conversations)', () => {
        it('should get Chatterbox conversation Gmail IDs in different date ranges', async () => {
            if (specificTest && specificTest !== 'conversations' && specificTest !== 'all') {
                console.log('⏭️  Skipping getChatterboxConversationGmailIds test (not requested)');
                return;
            }

            console.log('\n=== Test: Get Chatterbox Conversation Gmail IDs ===');
            
            const ranges = [
                { name: 'Last 7 days', range: { startDays: 7 } },
                { name: 'Last 30 days', range: { startDays: 30 } },
                { name: 'Last 90 days', range: { startDays: 90 } }
            ];
            
            for (const { name, range } of ranges) {
                console.log(`\n📅 Testing: ${name}`);
                const ids = await getChatterboxConversationGmailIds(range, gmailUser, authClient);
                console.log(`   Found ${ids.length} Chatterbox conversation emails`);
                
                // Verify result structure
                expect(Array.isArray(ids)).toBe(true);
                
                if (ids.length > 0) {
                    console.log(`   IDs: ${ids.join(', ')}`);
                    expect(typeof ids[0]).toBe('string');
                }
            }
        });
    });

    describe('getGmailById (test:get:byid)', () => {
        it('should get Gmail by ID', async () => {
            if (specificTest && specificTest !== 'byid' && specificTest !== 'all') {
                console.log('⏭️  Skipping getGmailById test (not requested)');
                return;
            }

            console.log('\n=== Test: Get Gmail by ID ===');
            
            // First get some IDs to test with
            const ids = await getAllGmailIds({ startDays: 7 }, gmailUser, authClient);
            
            if (ids.length === 0) {
                console.log('   No emails found to test with');
                return;
            }
            
            const testId = ids[0];
            console.log(`\n📧 Testing with ID: ${testId}`);
            
            const email = await getGmailById(testId, gmailUser, authClient);
            
            // Verify email structure
            expect(email).toHaveProperty('id', testId);
            expect(email).toHaveProperty('threadId');
            expect(email).toHaveProperty('labelIds');
            expect(Array.isArray(email.labelIds)).toBe(true);
            
            console.log(`   Subject: ${getEmailSubject(email)}`);
            console.log(`   From: ${getEmailSender(email)}`);
            console.log(`   Snippet: ${email.snippet || 'No snippet'}`);
            console.log(`   Thread ID: ${email.threadId}`);
        });
    });

    describe('getGmailsByIds (test:get:byids)', () => {
        it('should get multiple Gmails by IDs', async () => {
            if (specificTest && specificTest !== 'byids' && specificTest !== 'all') {
                console.log('⏭️  Skipping getGmailsByIds test (not requested)');
                return;
            }

            console.log('\n=== Test: Get Multiple Gmails by IDs ===');
            
            // Get some IDs to test with
            const ids = await getAllGmailIds({ startDays: 7 }, gmailUser, authClient);
            
            if (ids.length === 0) {
                console.log('   No emails found to test with');
                return;
            }
            
            const testIds = ids.slice(0, Math.min(3, ids.length));
            console.log(`\n📧 Testing with ${testIds.length} IDs: ${testIds.join(', ')}`);
            
            const emails = await getGmailsByIds(testIds, gmailUser, authClient);
            console.log(`   Retrieved ${emails.length} emails`);
            
            // Verify result structure
            expect(Array.isArray(emails)).toBe(true);
            expect(emails.length).toBeLessThanOrEqual(testIds.length);
            
            emails.forEach((email, index) => {
                expect(email).toHaveProperty('id');
                expect(testIds).toContain(email.id);
                console.log(`   ${index + 1}. ${getEmailSubject(email)} (${email.id})`);
            });
        });
    });

    describe('getGmailRange (test:get:range)', () => {
        it('should get Gmail range (messages, not IDs)', async () => {
            if (specificTest && specificTest !== 'range' && specificTest !== 'all') {
                console.log('⏭️  Skipping getGmailRange test (not requested)');
                return;
            }

            console.log('\n=== Test: Get Gmail Range (Messages) ===');
            
            const ranges = [
                { name: 'Last 2 days', range: { startDays: 2 } },
                { name: 'Last 7 days', range: { startDays: 7 } }
            ];
            
            for (const { name, range } of ranges) {
                console.log(`\n📅 Testing: ${name}`);
                const emails = await getGmailRange(range, gmailUser, authClient);
                console.log(`   Retrieved ${emails.length} email messages`);
                
                // Verify result structure
                expect(Array.isArray(emails)).toBe(true);
                
                if (emails.length > 0) {
                    const firstEmail = emails[0];
                    expect(firstEmail).toHaveProperty('id');
                    expect(firstEmail).toHaveProperty('threadId');
                    expect(firstEmail).toHaveProperty('labelIds');
                    
                    console.log(`   First email subject: ${getEmailSubject(firstEmail)}`);
                    console.log(`   First email from: ${getEmailSender(firstEmail)}`);
                }
            }
        });
    });

    describe('getChatterboxGmailRange (test:get:chatterboxrange)', () => {
        it('should get Chatterbox Gmail range', async () => {
            if (specificTest && specificTest !== 'chatterboxrange' && specificTest !== 'all') {
                console.log('⏭️  Skipping getChatterboxGmailRange test (not requested)');
                return;
            }

            console.log('\n=== Test: Get Chatterbox Gmail Range ===');
            
            const ranges = [
                { name: 'Last 7 days', range: { startDays: 7 } },
                { name: 'Last 30 days', range: { startDays: 30 } }
            ];
            
            for (const { name, range } of ranges) {
                console.log(`\n📅 Testing: ${name}`);
                const emails = await getChatterboxGmailRange(range, gmailUser, authClient);
                console.log(`   Retrieved ${emails.length} Chatterbox email messages`);
                
                // Verify result structure
                expect(Array.isArray(emails)).toBe(true);
                
                emails.forEach((email, index) => {
                    expect(email).toHaveProperty('id');
                    expect(email).toHaveProperty('threadId');
                    
                    const subject = getEmailSubject(email);
                    const conversationId = extractConversationId(subject);
                    console.log(`   ${index + 1}. ${subject}${conversationId ? ` (Conversation: ${conversationId})` : ''}`);
                });
            }
        });
    });

    describe('getChatterboxConversationGmailRange (test:get:conversationrange)', () => {
        it('should get Chatterbox conversation Gmail range', async () => {
            if (specificTest && specificTest !== 'conversationrange' && specificTest !== 'all') {
                console.log('⏭️  Skipping getChatterboxConversationGmailRange test (not requested)');
                return;
            }

            console.log('\n=== Test: Get Chatterbox Conversation Gmail Range ===');
            
            const ranges = [
                { name: 'Last 7 days', range: { startDays: 7 } },
                { name: 'Last 30 days', range: { startDays: 30 } }
            ];
            
            for (const { name, range } of ranges) {
                console.log(`\n📅 Testing: ${name}`);
                const emails = await getChatterboxConversationGmailRange(range, gmailUser, authClient);
                console.log(`   Retrieved ${emails.length} Chatterbox conversation email messages`);
                
                // Verify result structure
                expect(Array.isArray(emails)).toBe(true);
                
                emails.forEach((email, index) => {
                    expect(email).toHaveProperty('id');
                    expect(email).toHaveProperty('threadId');
                    
                    const subject = getEmailSubject(email);
                    const conversationId = extractConversationId(subject);
                    console.log(`   ${index + 1}. ${subject}${conversationId ? ` (Conversation: ${conversationId})` : ''}`);
                });
            }
        });
    });

    describe('Helper Functions (test:get:helpers)', () => {
        it('should test helper functions', async () => {
            if (specificTest && specificTest !== 'helpers' && specificTest !== 'all') {
                console.log('⏭️  Skipping helper functions test (not requested)');
                return;
            }

            console.log('\n=== Test: Helper Functions ===');
            
            // Test conversation ID extraction
            console.log('\n🔍 Testing conversation ID extraction:');
            const testSubjects = [
                'chatterbox: 123e4567-e89b-12d3-a456-426614174000',
                'Chatterbox 987fcdeb-51a2-43b1-9c8d-7e6f5a4b3c2d',
                'chatterbox:abc12345-def4-5678-9abc-def123456789',
                'Regular email subject',
                'CHATTERBOX: 11111111-2222-3333-4444-555555555555'
            ];
            
            testSubjects.forEach(subject => {
                const conversationId = extractConversationId(subject);
                console.log(`   "${subject}" -> ${conversationId || 'No conversation ID found'}`);
                
                // Verify extraction logic
                if (subject.toLowerCase().includes('chatterbox')) {
                    if (subject.includes('123e4567-e89b-12d3-a456-426614174000')) {
                        expect(conversationId).toBe('123e4567-e89b-12d3-a456-426614174000');
                    } else if (subject.includes('987fcdeb-51a2-43b1-9c8d-7e6f5a4b3c2d')) {
                        expect(conversationId).toBe('987fcdeb-51a2-43b1-9c8d-7e6f5a4b3c2d');
                    } else if (subject.includes('abc12345-def4-5678-9abc-def123456789')) {
                        expect(conversationId).toBe('abc12345-def4-5678-9abc-def123456789');
                    } else if (subject.includes('11111111-2222-3333-4444-555555555555')) {
                        expect(conversationId).toBe('11111111-2222-3333-4444-555555555555');
                    }
                } else {
                    expect(conversationId).toBeNull();
                }
            });
            
            // Test email content extraction (if we have emails)
            const emails = await getAllGmailIds({ startDays: 1 }, gmailUser, authClient);
            if (emails.length > 0) {
                console.log('\n📧 Testing email content extraction:');
                const email = await getGmailById(emails[0], gmailUser, authClient);
                
                const subject = getEmailSubject(email);
                const sender = getEmailSender(email);
                const body = getEmailBody(email);
                
                console.log(`   Subject: ${subject}`);
                console.log(`   From: ${sender}`);
                console.log(`   Body preview: ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);
                
                // Verify helper functions return strings
                expect(typeof subject).toBe('string');
                expect(typeof sender).toBe('string');
                expect(typeof body).toBe('string');
            }
        });
    });

    describe('Sender-based Functions', () => {
        const testSender = 'amram.dworkin@gmail.com';

        describe('getGmailIdsBySender (test:get:bysender)', () => {
            it('should get Gmail IDs from a specific sender in different date ranges', async () => {
                if (specificTest && specificTest !== 'bysender' && specificTest !== 'all') {
                    console.log('⏭️  Skipping getGmailIdsBySender test (not requested)');
                    return;
                }

                console.log('\n=== Test: Get Gmail IDs by Sender ===');
                
                const ranges = [
                    { name: 'Last 7 days', range: { startDays: 7 } },
                    { name: 'Last 30 days', range: { startDays: 30 } },
                    { name: 'Last 90 days', range: { startDays: 90 } }
                ];
                
                for (const { name, range } of ranges) {
                    console.log(`\n📅 Testing: ${name} from ${testSender}`);
                    const ids = await getGmailIdsBySender(testSender, range, gmailUser, authClient);
                    console.log(`   Found ${ids.length} emails from ${testSender}`);
                    
                    // Verify result structure
                    expect(Array.isArray(ids)).toBe(true);
                    
                    if (ids.length > 0) {
                        console.log(`   First 3 IDs: ${ids.slice(0, 3).join(', ')}`);
                        expect(typeof ids[0]).toBe('string');
                    }
                }
            });
        });

        describe('getChatterboxGmailIdsBySender (test:get:chatterboxbysender)', () => {
            it('should get Chatterbox Gmail IDs from a specific sender in different date ranges', async () => {
                if (specificTest && specificTest !== 'chatterboxbysender' && specificTest !== 'all') {
                    console.log('⏭️  Skipping getChatterboxGmailIdsBySender test (not requested)');
                    return;
                }

                console.log('\n=== Test: Get Chatterbox Gmail IDs by Sender ===');
                
                const ranges = [
                    { name: 'Last 7 days', range: { startDays: 7 } },
                    { name: 'Last 30 days', range: { startDays: 30 } },
                    { name: 'Last 90 days', range: { startDays: 90 } }
                ];
                
                for (const { name, range } of ranges) {
                    console.log(`\n📅 Testing: ${name} Chatterbox emails from ${testSender}`);
                    const ids = await getChatterboxGmailIdsBySender(testSender, range, gmailUser, authClient);
                    console.log(`   Found ${ids.length} Chatterbox emails from ${testSender}`);
                    
                    // Verify result structure
                    expect(Array.isArray(ids)).toBe(true);
                    
                    if (ids.length > 0) {
                        console.log(`   IDs: ${ids.join(', ')}`);
                        expect(typeof ids[0]).toBe('string');
                    }
                }
            });
        });

        describe('getGmailRangeBySender (test:get:rangebysender)', () => {
            it('should get Gmail messages from a specific sender in different date ranges', async () => {
                if (specificTest && specificTest !== 'rangebysender' && specificTest !== 'all') {
                    console.log('⏭️  Skipping getGmailRangeBySender test (not requested)');
                    return;
                }

                console.log('\n=== Test: Get Gmail Range by Sender ===');
                
                const ranges = [
                    { name: 'Last 7 days', range: { startDays: 7 } },
                    { name: 'Last 30 days', range: { startDays: 30 } }
                ];
                
                for (const { name, range } of ranges) {
                    console.log(`\n📅 Testing: ${name} messages from ${testSender}`);
                    const emails = await getGmailRangeBySender(testSender, range, gmailUser, authClient);
                    console.log(`   Retrieved ${emails.length} email messages from ${testSender}`);
                    
                    // Verify result structure
                    expect(Array.isArray(emails)).toBe(true);
                    
                    if (emails.length > 0) {
                        const firstEmail = emails[0];
                        expect(firstEmail).toHaveProperty('id');
                        expect(firstEmail).toHaveProperty('threadId');
                        expect(firstEmail).toHaveProperty('labelIds');
                        
                        console.log(`   First email subject: ${getEmailSubject(firstEmail)}`);
                        console.log(`   First email from: ${getEmailSender(firstEmail)}`);
                        
                        // Verify all emails are from the expected sender
                        emails.forEach((email: GmailMessage) => {
                            const sender = getEmailSender(email);
                            expect(sender.toLowerCase()).toContain(testSender.toLowerCase());
                        });
                    }
                }
            });
        });

        describe('getChatterboxGmailRangeBySender (test:get:chatterboxrangebysender)', () => {
            it('should get Chatterbox Gmail messages from a specific sender in different date ranges', async () => {
                if (specificTest && specificTest !== 'chatterboxrangebysender' && specificTest !== 'all') {
                    console.log('⏭️  Skipping getChatterboxGmailRangeBySender test (not requested)');
                    return;
                }

                console.log('\n=== Test: Get Chatterbox Gmail Range by Sender ===');
                
                const ranges = [
                    { name: 'Last 7 days', range: { startDays: 7 } },
                    { name: 'Last 30 days', range: { startDays: 30 } }
                ];
                
                for (const { name, range } of ranges) {
                    console.log(`\n📅 Testing: ${name} Chatterbox messages from ${testSender}`);
                    const emails = await getChatterboxGmailRangeBySender(testSender, range, gmailUser, authClient);
                    console.log(`   Retrieved ${emails.length} Chatterbox email messages from ${testSender}`);
                    
                    // Verify result structure
                    expect(Array.isArray(emails)).toBe(true);
                    
                    emails.forEach((email: GmailMessage, index: number) => {
                        expect(email).toHaveProperty('id');
                        expect(email).toHaveProperty('threadId');
                        
                        const subject = getEmailSubject(email);
                        const sender = getEmailSender(email);
                        const conversationId = extractConversationId(subject);
                        
                        console.log(`   ${index + 1}. ${subject}${conversationId ? ` (Conversation: ${conversationId})` : ''}`);
                        
                        // Verify all emails are from the expected sender
                        expect(sender.toLowerCase()).toContain(testSender.toLowerCase());
                        
                        // Verify all emails have chatterbox in the subject
                        expect(subject.toLowerCase()).toContain('chatterbox');
                    });
                }
            });
        });
    });

    describe('Integration Tests', () => {
        it('should have consistent results between ID and message functions', async () => {
            if (specificTest && specificTest !== 'all') {
                console.log('⏭️  Skipping integration test (not requested)');
                return;
            }

            console.log('\n=== Integration Test: Consistency Check ===');
            
            // Test that getting IDs and then messages gives consistent results
            const ids = await getAllGmailIds({ startDays: 7 }, gmailUser, authClient);
            if (ids.length > 0) {
                const testIds = ids.slice(0, Math.min(2, ids.length));
                const messages = await getGmailsByIds(testIds, gmailUser, authClient);
                
                expect(messages.length).toBeLessThanOrEqual(testIds.length);
                messages.forEach(message => {
                    expect(testIds).toContain(message.id);
                });
                
                console.log(`   ✅ Consistency check passed: ${messages.length}/${testIds.length} messages retrieved`);
            }
        });
    });
}); 