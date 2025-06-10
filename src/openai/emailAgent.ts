import { google } from 'googleapis';
import OpenAI from 'openai';
import config from '../loadConfig';
import { authorizeGmail } from '../utils/authorizeGmail';

function decodeBase64(data: string): string {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const buff = Buffer.from(normalized, 'base64');
    return buff.toString('utf8');
}

interface GmailMessagePart {
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessagePart[];
}

function extractMessageBody(payload: GmailMessagePart | undefined): string {
    if (!payload) return '';
    if (payload.parts && Array.isArray(payload.parts)) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return decodeBase64(part.body.data);
            }
        }
        for (const part of payload.parts) {
            const text = extractMessageBody(part);
            if (text) return text;
        }
    }
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
    const body = extractMessageBody(res.data.payload);
    if (!body) {
        throw new Error('No message body found in Gmail message');
    }

    const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        organization: config.openai.organizationId,
    });

    const assistant = await openai.beta.assistants.create({
        model: config.openai.llmModel,
        instructions: 'Respond to the provided Gmail message body.',
    });
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, { role: 'user', content: body });
    await openai.beta.threads.runs.createAndPoll(thread.id, { assistant_id: assistant.id });
    const messages = await openai.beta.threads.messages.list(thread.id, { limit: 1 });
    const first = messages.data[0];
    let response = '';
    if (first && Array.isArray(first.content)) {
        interface MessageContent {
            type: string;
            text?: { value: string };
        }
        response = first.content
            .map((c: MessageContent) =>
                c.type === 'text' && c.text ? c.text.value : ''
            )
            .join('\n');
    }
    return response;
}

if (require.main === module) {
    const id = process.argv[2];
    if (!id) {
        console.error('Usage: node dist/src/openai/emailAgent.js <messageId>');
        process.exit(1);
    }
    runEmailAgent(id)
        .then((r) => console.log(r))
        .catch((e) => {
            console.error('Error:', e);
            process.exit(1);
        });
}
