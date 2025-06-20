// test/getGmailExample.ts
// Example usage of the new getGmail.ts functionality

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
    extractConversationId,
    getEmailSubject,
    getEmailSender,
    getEmailBody,
    GmailMessage
} from '../src/mail/getGmail';

async function exampleUsage() {
    const userEmail = config.app.defaultPollGmailUser;
    
    console.log(`\n=== Gmail Retrieval Examples for ${userEmail} ===\n`);

    try {
        // Example 1: Get all Gmail IDs from last 7 days
        console.log('1. Getting all Gmail IDs from last 7 days...');
        const allIds = await getAllGmailIds();
        console.log(`   Found ${allIds.length} emails`);
        if (allIds.length > 0) {
            console.log(`   First 5 IDs: ${allIds.slice(0, 5).join(', ')}`);
        }

        // Example 2: Get Chatterbox Gmail IDs from last 3 days
        console.log('\n2. Getting Chatterbox Gmail IDs from last 3 days...');
        const chatterboxIds = await getChatterboxGmailIds({ startDays: 3 });
        console.log(`   Found ${chatterboxIds.length} Chatterbox emails`);
        if (chatterboxIds.length > 0) {
            console.log(`   IDs: ${chatterboxIds.join(', ')}`);
        }

        // Example 3: Get Chatterbox conversation Gmail IDs from last 30 days
        console.log('\n3. Getting Chatterbox conversation Gmail IDs from last 30 days...');
        const conversationIds = await getChatterboxConversationGmailIds({ startDays: 30 });
        console.log(`   Found ${conversationIds.length} Chatterbox conversation emails`);
        if (conversationIds.length > 0) {
            console.log(`   IDs: ${conversationIds.join(', ')}`);
        }

        // Example 4: Get a specific Gmail by ID (if we have any)
        if (allIds.length > 0) {
            console.log('\n4. Getting a specific Gmail by ID...');
            const firstEmail = await getGmailById(allIds[0]);
            console.log(`   Email ID: ${firstEmail.id}`);
            console.log(`   Subject: ${getEmailSubject(firstEmail)}`);
            console.log(`   From: ${getEmailSender(firstEmail)}`);
            console.log(`   Snippet: ${firstEmail.snippet || 'No snippet'}`);
        }

        // Example 5: Get multiple Gmails by IDs
        if (allIds.length > 0) {
            console.log('\n5. Getting multiple Gmails by IDs...');
            const sampleIds = allIds.slice(0, Math.min(3, allIds.length));
            const emails = await getGmailsByIds(sampleIds);
            console.log(`   Retrieved ${emails.length} emails`);
            emails.forEach((email, index) => {
                console.log(`   ${index + 1}. ${getEmailSubject(email)} (${email.id})`);
            });
        }

        // Example 6: Get a range of Gmails (messages, not IDs)
        console.log('\n6. Getting a range of Gmail messages (last 2 days)...');
        const emailRange = await getGmailRange({ startDays: 2 });
        console.log(`   Retrieved ${emailRange.length} email messages`);
        if (emailRange.length > 0) {
            console.log(`   First email subject: ${getEmailSubject(emailRange[0])}`);
        }

        // Example 7: Get a range of Chatterbox Gmails
        console.log('\n7. Getting a range of Chatterbox Gmail messages...');
        const chatterboxEmails = await getChatterboxGmailRange({ startDays: 7 });
        console.log(`   Retrieved ${chatterboxEmails.length} Chatterbox email messages`);
        chatterboxEmails.forEach((email, index) => {
            const subject = getEmailSubject(email);
            const conversationId = extractConversationId(subject);
            console.log(`   ${index + 1}. ${subject}${conversationId ? ` (Conversation: ${conversationId})` : ''}`);
        });

        // Example 8: Get a range of Chatterbox conversation Gmails
        console.log('\n8. Getting a range of Chatterbox conversation Gmail messages...');
        const conversationEmails = await getChatterboxConversationGmailRange({ startDays: 30 });
        console.log(`   Retrieved ${conversationEmails.length} Chatterbox conversation email messages`);
        conversationEmails.forEach((email, index) => {
            const subject = getEmailSubject(email);
            const conversationId = extractConversationId(subject);
            console.log(`   ${index + 1}. ${subject}${conversationId ? ` (Conversation: ${conversationId})` : ''}`);
        });

        // Example 9: Demonstrate conversation ID extraction
        console.log('\n9. Demonstrating conversation ID extraction...');
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

        // Example 10: Demonstrate email content extraction
        if (allIds.length > 0) {
            console.log('\n10. Demonstrating email content extraction...');
            const sampleEmail = await getGmailById(allIds[0]);
            console.log(`   Subject: ${getEmailSubject(sampleEmail)}`);
            console.log(`   From: ${getEmailSender(sampleEmail)}`);
            const body = getEmailBody(sampleEmail);
            console.log(`   Body preview: ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);
        }

    } catch (error) {
        console.error('Error in Gmail retrieval examples:', error);
    }
}

// Run the examples if this file is executed directly
if (require.main === module) {
    exampleUsage()
        .then(() => {
            console.log('\n=== Examples completed ===');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Failed to run examples:', error);
            process.exit(1);
        });
}

export { exampleUsage }; 