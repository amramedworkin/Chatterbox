import { google } from 'googleapis';
import OpenAI from 'openai';
import config from '../loadConfig';
import { authorizeGmail } from '../utils/authorizeGmail';

function decodeBase64(data: string): string {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const buff = Buffer.from(normalized, 'base64');
    return buff.toString('utf8');
}

// Updated interface to match Schema$MessagePart, allowing mimeType to be null
interface GmailMessagePart {
    mimeType?: string | null; // Allow null to match the Google API's Schema$MessagePart
    body?: { data?: string };
    parts?: GmailMessagePart[];
}

function extractMessageBody(payload: GmailMessagePart | undefined): string {
    if (!payload) return '';
    if (payload.parts && Array.isArray(payload.parts)) {
        for (const part of payload.parts) {
            // Check for explicit 'text/plain' first
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return decodeBase64(part.body.data);
            }
        }
        // Recursively search nested parts if 'text/plain' not found directly
        for (const part of payload.parts) {
            const text = extractMessageBody(part);
            if (text) return text;
        }
    }
    // If no parts or no text/plain in parts, check the main body
    if (payload.body && payload.body.data) {
        return decodeBase64(payload.body.data);
    }
    return '';
}

export async function runEmailAgent(messageId: string, userEmail?: string): Promise<string> {
    const gmailUser = userEmail || config.app.defaultPollGmailUser;
    const auth = await authorizeGmail(gmailUser, config);
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.get({
        userId: gmailUser,
        id: messageId,
        format: 'full',
    });

    // The payload from the Gmail API can have a complex structure.
    // Ensure we are correctly extracting and typing it.
    // res.data.payload is of type Schema$MessagePart | undefined from googleapis.
    // We've adjusted GmailMessagePart to be compatible.
    const body = extractMessageBody(res.data.payload as GmailMessagePart | undefined);

    if (!body) {
        throw new Error('No message body found in Gmail message or unable to extract it.');
    }

    const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        organization: config.openai.organizationId,
    });

    // Create a new assistant for each run to ensure a clean state
    // In a production app, you'd likely create and manage assistants outside of this function.
    const assistant = await openai.beta.assistants.create({
        model: config.openai.llmModel,
        instructions: 'Respond to the provided Gmail message body.',
    });

    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, { role: 'user', content: body });

    // Run the assistant and poll for its completion
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistant.id,
    });

    if (run.status !== 'completed') {
        throw new Error(`Assistant run finished with status: ${run.status}`);
    }

    // Retrieve messages from the thread, limiting to the most recent one (the assistant's response)
    const messages = await openai.beta.threads.messages.list(thread.id, { limit: 1 });

    const first = messages.data[0];
    let response = '';

    // Extract the text content from the assistant's response
    if (first && first.content && Array.isArray(first.content)) {
        // Define a more specific type for message content for clarity
        interface MessageContent {
            type: string;
            text?: { value: string }; // 'text' type content has a 'text' property with a 'value'
            // Add other content types if your assistant might return them (e.g., 'image_file')
        }

        response = first.content
            .map(
                (c: MessageContent) => (c.type === 'text' && c.text ? c.text.value : '') // Only get text content
            )
            .join('\n'); // Join multiple text blocks with newlines
    }

    // Optionally, delete the assistant and thread if they are no longer needed
    // This helps in cleaning up resources if not managed externally.
    // await openai.beta.assistants.del(assistant.id);
    // await openai.beta.threads.del(thread.id);

    return response;
}

// This block only runs when the script is executed directly (e.g., node dist/src/openai/emailAgent.js <messageId>)
if (require.main === module) {
    const id = process.argv[2]; // Get messageId from command-line arguments
    if (!id) {
        console.error('Usage: node dist/src/openai/emailAgent.js <messageId>');
        process.exit(1); // Exit with error code if messageId is not provided
    }

    runEmailAgent(id)
        .then((r) => console.log(r)) // Log the response if successful
        .catch((e) => {
            console.error('Error:', e); // Log any errors
            process.exit(1); // Exit with error code on failure
        });
}
