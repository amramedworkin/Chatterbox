import OpenAI from 'openai';
import config from '../loadConfig';

export type ResponseFormat = 'text' | 'native';

export interface AskAgentOptions {
    prompt: string;
    files?: string[]; // Note: File support is not implemented in this version
    responseFormat?: ResponseFormat;
    model?: string;
    maxTokens?: number;
}

export interface AskAgentResponse {
    text: string;
    native?: any;
    usage?: any;
}

/**
 * Creates an OpenAI agent and sends a prompt
 * @param options - Configuration options for the agent request
 * @returns Promise resolving to the agent response
 */
export async function askAgent(options: AskAgentOptions): Promise<AskAgentResponse> {
    const { prompt, files = [], responseFormat = 'text', model = config.openai.llmModel } = options;

    // Validate OpenAI API key
    if (!config.openai.apiKey) {
        throw new Error(
            'OpenAI API key not found. Please set OPENAI_API_KEY in your environment or config.'
        );
    }

    // Warn about file support
    if (files.length > 0) {
        console.warn('File support is not implemented in this version. Files will be ignored.');
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        organization: config.openai.organizationId || undefined,
    });

    try {
        // Create a new assistant for this request
        const assistant = await openai.beta.assistants.create({
            model: model,
            instructions:
                "You are a helpful assistant. Respond to the user's request based on the provided prompt.",
        });

        // Create a new thread
        const thread = await openai.beta.threads.create();

        // Add the user's message to the thread
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: prompt,
        });

        // Run the assistant
        const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
            assistant_id: assistant.id,
        });

        // Check if the run completed successfully
        if (run.status !== 'completed') {
            throw new Error(
                `Assistant run failed with status: ${run.status}. ${run.last_error?.message || ''}`
            );
        }

        // Get the messages from the thread
        const messages = await openai.beta.threads.messages.list(thread.id, {
            limit: 1,
        });

        const assistantMessage = messages.data[0];
        if (!assistantMessage || assistantMessage.role !== 'assistant') {
            throw new Error('No assistant response found');
        }

        // Extract text content from the assistant's response
        let responseText = '';
        if (assistantMessage.content && Array.isArray(assistantMessage.content)) {
            responseText = assistantMessage.content
                .map((content: any) => {
                    if (content.type === 'text' && content.text) {
                        return content.text.value;
                    }
                    return '';
                })
                .join('\n');
        }

        // Prepare response based on format
        const response: AskAgentResponse = {
            text: responseText,
        };

        if (responseFormat === 'native') {
            response.native = {
                message: assistantMessage,
                run: run,
                usage: run.usage,
            };
        }

        if (run.usage) {
            response.usage = run.usage;
        }

        // Clean up resources
        try {
            // Delete assistant and thread
            await openai.beta.assistants.del(assistant.id);
            await openai.beta.threads.del(thread.id);
        } catch (cleanupError) {
            console.warn('Failed to clean up resources:', cleanupError);
        }

        return response;
    } catch (error) {
        throw new Error(
            `Failed to process agent request: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

/**
 * Simple wrapper function for text-only responses
 * @param prompt - The prompt to send to the agent
 * @param files - Optional list of file paths to include (not implemented)
 * @returns Promise resolving to the response text
 */
export async function askAgentText(prompt: string, files?: string[]): Promise<string> {
    const response = await askAgent({ prompt, files, responseFormat: 'text' });
    return response.text;
}

/**
 * Simple wrapper function for native responses
 * @param prompt - The prompt to send to the agent
 * @param files - Optional list of file paths to include (not implemented)
 * @returns Promise resolving to the full response object
 */
export async function askAgentNative(prompt: string, files?: string[]): Promise<AskAgentResponse> {
    return await askAgent({ prompt, files, responseFormat: 'native' });
}

// CLI interface for direct execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node dist/src/openai/askAgent.js <prompt> [options]

Options:
  --format <text|native>       Response format (default: text)
  --model <model>              OpenAI model to use (default: from config)
  --max-tokens <number>        Maximum tokens for response (default: from config)

Examples:
  node dist/src/openai/askAgent.js "Explain quantum computing"
  node dist/src/openai/askAgent.js "What is machine learning?" --format native
        `);
        process.exit(0);
    }

    const prompt = args[0];
    const format =
        (args.find((arg) => arg.startsWith('--format='))?.split('=')[1] as ResponseFormat) ||
        'text';
    const model = args.find((arg) => arg.startsWith('--model='))?.split('=')[1];
    const maxTokens = args.find((arg) => arg.startsWith('--max-tokens='))?.split('=')[1];

    const options: AskAgentOptions = {
        prompt,
        responseFormat: format,
        model,
        maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
    };

    askAgent(options)
        .then((response) => {
            if (format === 'text') {
                console.log(response.text);
            } else {
                console.log(JSON.stringify(response, null, 2));
            }
        })
        .catch((error) => {
            console.error('Error:', error.message);
            process.exit(1);
        });
}
