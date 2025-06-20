# Gmail Mail Capabilities

This directory contains Gmail-related functionality for the Chatterbox application.

## Files

- `sendGmail.ts` - Abstracted send mail capability
- `pollGmail.ts` - Gmail polling functionality
- `authorizeGmail.ts` - Shared Gmail authorization system

## sendGmail.ts

The `sendGmail.ts` file provides an abstracted send mail capability that integrates with the existing authorization system from `pollGmail.ts`.

### Key Features

1. **Shared Authorization**: Uses the same token files and authorization flow as `pollGmail.ts`
2. **Token Reuse**: If a user has valid authorization tokens from polling, they will be reused for sending
3. **Automatic Authorization**: If no valid tokens exist, the user will be prompted to authorize
4. **Sequential Email Numbering**: Maintains sequential numbering for sent emails
5. **Attachment Support**: Supports sending emails with attachments
6. **Conversation ID Support**: Supports conversation threading via conversation IDs

### Exported Functions

#### `sendEmail(senderEmail: string, options: SendEmailOptions): Promise<SendEmailResult>`

Sends an email using Gmail API with optional attachments.

**Parameters:**
- `senderEmail`: The sender email address
- `options`: Email options (see `SendEmailOptions` interface)

**Returns:**
- `SendEmailResult` with success status and message ID or error

#### `sendTestEmail(senderEmail: string, recipientEmail: string, conversationId?: string, attachCount: number = 0): Promise<SendEmailResult>`

Sends a test email with the same functionality as the original test file.

**Parameters:**
- `senderEmail`: The sender email address
- `recipientEmail`: The recipient email address
- `conversationId`: Optional conversation ID for threading
- `attachCount`: Number of test attachments to include

### Interfaces

#### `SendEmailOptions`
```typescript
interface SendEmailOptions {
    to: string;
    subject: string;
    body: string;
    conversationId?: string;
    attachments?: string[];
    replyTo?: string;
}
```

#### `SendEmailResult`
```typescript
interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
```

### Authorization Integration

The send mail capability uses the same authorization system as `pollGmail.ts`:

1. **Token Path**: Uses `config.google.pollTokenPath` (same as polling)
2. **Credentials**: Uses `config.google.credentialsPath` (same as polling)
3. **Scopes**: Uses `config.google.scopes` (includes both read and send permissions)
4. **Token Storage**: Tokens are stored per email address in the same token file

### Usage Examples

See `test/sendGmailExample.ts` for comprehensive usage examples.

#### Basic Usage
```typescript
import { sendEmail } from '../src/mail/sendGmail';

const result = await sendEmail('sender@example.com', {
    to: 'recipient@example.com',
    subject: 'Test Email',
    body: 'This is a test email.',
});

if (result.success) {
    console.log(`Email sent! Message ID: ${result.messageId}`);
} else {
    console.log(`Failed: ${result.error}`);
}
```

#### With Attachments
```typescript
const result = await sendEmail('sender@example.com', {
    to: 'recipient@example.com',
    subject: 'Email with Attachments',
    body: 'Please see attached files.',
    attachments: ['/path/to/file1.pdf', '/path/to/file2.txt'],
});
```

#### With Conversation ID
```typescript
const result = await sendEmail('sender@example.com', {
    to: 'recipient@example.com',
    subject: 'Threaded Email',
    body: 'This email is part of a conversation.',
    conversationId: '123e4567-e89b-12d3-a456-426614174000',
});
```

### Configuration

The send mail capability uses the following configuration from `config.json`:

- `google.credentialsPath`: Path to Google OAuth credentials
- `google.pollTokenPath`: Path to store authorization tokens
- `google.scopes`: Gmail API scopes (must include `gmail.send`)
- `sendTest.lastSentEmailNumberPath`: Path to store sequential email numbers
- `sendTest.testAttachmentsFolder`: Folder for test attachments

### Error Handling

The functions return structured results with success/error information:

- **Success**: `{ success: true, messageId: "..." }`
- **Failure**: `{ success: false, error: "error message" }`

Common error scenarios:
- **401 Unauthorized**: Invalid or expired tokens (will trigger re-authorization)
- **Missing credentials**: `credentials.json` file not found
- **Invalid attachments**: Attachment files not found or unreadable

### Integration with Existing Code

The send mail capability is designed to work seamlessly with existing code:

1. **Same Authorization**: Uses the same tokens as `pollGmail.ts`
2. **Same Configuration**: Uses the same config structure
3. **Same Error Handling**: Consistent error handling patterns
4. **Backward Compatibility**: Can replace the original test file functionality

### Migration from Test File

To migrate from the original `test/sendGmail.test.ts`:

1. Replace direct Gmail API calls with `sendEmail()` or `sendTestEmail()`
2. Remove authorization code (handled automatically)
3. Use the returned `SendEmailResult` for error handling
4. Update imports to use the new module

The new capability provides the same functionality with better abstraction and integration with the existing authorization system. 