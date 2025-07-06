import OpenAI from 'openai';
import config from '../loadConfig';

export interface DialogAgentOptions {
    question: string;
    model?: string;
    maxTokens?: number;
    instructions?: string;
    maxTurns?: number;
}

export interface DialogAgentResponse {
    text: string;
    usage?: any;
    turns?: number;
}

/**
 * Simple dialog agent that processes a question and returns a response
 * @param options - Configuration options for the dialog agent
 * @returns Promise resolving to the dialog response
 */
export async function dialogAgent(options: DialogAgentOptions): Promise<DialogAgentResponse> {
    const {
        question,
        model = config.openai.llmModel,
        instructions = 'You are a helpful assistant. Provide clear, concise, and accurate responses to user questions.',
        maxTurns = 1,
    } = options;

    // Validate OpenAI API key
    if (!config.openai.apiKey) {
        throw new Error(
            'OpenAI API key not found. Please set OPENAI_API_KEY in your environment or config.'
        );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        organization: config.openai.organizationId || undefined,
    });

    try {
        // Create a new assistant for this dialog
        const assistant = await openai.beta.assistants.create({
            model: model,
            instructions: instructions,
            // No tools needed for simple dialog
        });

        // Create a new thread for the conversation
        const thread = await openai.beta.threads.create();

        // Add the user's question to the thread
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: question,
        });

        let turns = 0;
        let finalResponse = '';
        let usage = null;

        // Run the agent loop (simplified version of the Agents SDK loop)
        while (turns < maxTurns) {
            turns++;

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

            // Store usage information
            if (run.usage) {
                usage = run.usage;
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

            finalResponse = responseText;

            // For simple dialog, we only need one turn
            // In a more complex implementation, you could check for tool calls or handoffs here
            break;
        }

        // Clean up resources
        try {
            await openai.beta.assistants.del(assistant.id);
            await openai.beta.threads.del(thread.id);
        } catch (cleanupError) {
            console.warn('Failed to clean up resources:', cleanupError);
        }

        return {
            text: finalResponse,
            usage: usage,
            turns: turns,
        };
    } catch (error) {
        throw new Error(
            `Failed to process dialog request: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Simple wrapper function for basic dialog responses
 * @param question - The question to ask the agent
 * @returns Promise resolving to the response text
 */
export async function askDialog(question: string): Promise<string> {
    const response = await dialogAgent({ question });
    return response.text;
}

/**
 * Dialog agent with custom instructions
 * @param question - The question to ask the agent
 * @param instructions - Custom instructions for the agent
 * @returns Promise resolving to the response text
 */
export async function askDialogWithInstructions(
    question: string,
    instructions: string
): Promise<string> {
    const response = await dialogAgent({ question, instructions });
    return response.text;
}

/**
 * Dialog agent with full response object
 * @param question - The question to ask the agent
 * @returns Promise resolving to the full response object
 */
export async function askDialogFull(question: string): Promise<DialogAgentResponse> {
    return await dialogAgent({ question });
}

// CLI interface for direct execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node dist/src/openai/dialogAgent.js <question> [options]

Options:
  --model <model>              OpenAI model to use (default: from config)
  --max-tokens <number>        Maximum tokens for response (default: from config)
  --instructions <text>        Custom instructions for the agent
  --max-turns <number>         Maximum conversation turns (default: 1)

Examples:
  node dist/src/openai/dialogAgent.js "What is machine learning?"
  node dist/src/openai/dialogAgent.js "Explain quantum computing" --model=gpt-4o-mini
  node dist/src/openai/dialogAgent.js "Write a poem" --instructions="You are a creative poet"
        `);
        process.exit(0);
    }

    const question = args[0];
    const model = args.find((arg) => arg.startsWith('--model='))?.split('=')[1];
    const maxTokens = args.find((arg) => arg.startsWith('--max-tokens='))?.split('=')[1];
    const instructions = args.find((arg) => arg.startsWith('--instructions='))?.split('=')[1];
    const maxTurns = args.find((arg) => arg.startsWith('--max-turns='))?.split('=')[1];

    const options: DialogAgentOptions = {
        question,
        model,
        maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
        instructions,
        maxTurns: maxTurns ? parseInt(maxTurns) : undefined,
    };

    dialogAgent(options)
        .then((response) => {
            console.log(response.text);
        })
        .catch((error) => {
            console.error('Error:', error.message);
            process.exit(1);
        });
}
