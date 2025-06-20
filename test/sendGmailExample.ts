// test/sendGmailExample.ts
// Example usage of the abstracted sendGmail capability

import { sendEmail, sendTestEmail, SendEmailOptions } from '../src/mail/sendGmail';
import config from '../src/loadConfig';

async function exampleUsage() {
    const senderEmail = config.app.defaultSendGmailUser;
    const recipientEmail = config.sendTest.defaultRecipient;

    console.log('=== Example 1: Send a simple email ===');
    const result1 = await sendEmail(senderEmail, {
        to: recipientEmail,
        subject: 'Test Email from sendGmail',
        body: 'This is a test email sent using the abstracted sendGmail capability.',
    });

    if (result1.success) {
        console.log(`✅ Email sent successfully! Message ID: ${result1.messageId}`);
    } else {
        console.log(`❌ Failed to send email: ${result1.error}`);
    }

    console.log('\n=== Example 2: Send email with conversation ID ===');
    const result2 = await sendEmail(senderEmail, {
        to: recipientEmail,
        subject: 'Email with Conversation ID',
        body: 'This email has a conversation ID for threading.',
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
    });

    if (result2.success) {
        console.log(`✅ Email with conversation ID sent successfully! Message ID: ${result2.messageId}`);
    } else {
        console.log(`❌ Failed to send email: ${result2.error}`);
    }

    console.log('\n=== Example 3: Send test email (like original test file) ===');
    const result3 = await sendTestEmail(
        senderEmail,
        recipientEmail,
        'test-conversation-123',
        2 // 2 attachments
    );

    if (result3.success) {
        console.log(`✅ Test email sent successfully! Message ID: ${result3.messageId}`);
    } else {
        console.log(`❌ Failed to send test email: ${result3.error}`);
    }

    console.log('\n=== Example 4: Send email with custom reply-to ===');
    const result4 = await sendEmail(senderEmail, {
        to: recipientEmail,
        subject: 'Email with Custom Reply-To',
        body: 'This email has a custom reply-to address.',
        replyTo: 'custom-reply@example.com',
    });

    if (result4.success) {
        console.log(`✅ Email with custom reply-to sent successfully! Message ID: ${result4.messageId}`);
    } else {
        console.log(`❌ Failed to send email: ${result4.error}`);
    }
}

// Run the example if this file is executed directly
if (require.main === module) {
    exampleUsage().catch(console.error);
}

export { exampleUsage }; 