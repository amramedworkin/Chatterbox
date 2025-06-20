# Dialog Agent Module

A simple dialog-style agent implementation based on OpenAI's Agents SDK concepts, designed for straightforward question-and-answer interactions.

## Features

- **Simple Dialog**: Easy-to-use interface for question-and-answer interactions
- **Custom Instructions**: Configure agent behavior with custom instructions
- **Flexible Configuration**: Use different models, token limits, and conversation turns
- **CLI Interface**: Run directly from command line for quick testing
- **Resource Management**: Automatically cleans up assistants and threads after use

## Usage

### Basic Usage

```typescript
import { askDialog } from '../src/openai/dialogAgent';

// Simple question and answer
const response = await askDialog('What is machine learning?');
console.log(response);
```

### Advanced Usage

```typescript
import { dialogAgent, askDialogWithInstructions } from '../src/openai/dialogAgent';

// With custom instructions
const response = await askDialogWithInstructions(
    'Write a story',
    'You are a creative storyteller. Write engaging, imaginative stories.'
);

// Full configuration
const result = await dialogAgent({
    question: 'Explain quantum computing',
    model: 'gpt-4o-mini',
    instructions: 'You are a physics expert. Provide clear explanations.',
    maxTurns: 1,
    maxTokens: 500,
});

console.log(result.text);
console.log(result.usage);
console.log(result.turns);
```

### Command Line Usage

```bash
# Basic usage
node dist/src/openai/dialogAgent.js "What is artificial intelligence?"

# With custom instructions
node dist/src/openai/dialogAgent.js "Write a poem" --instructions="You are a creative poet"

# Use different model
node dist/src/openai/dialogAgent.js "Explain quantum computing" --model=gpt-4o-mini

# Set max tokens
node dist/src/openai/dialogAgent.js "Summarize this" --max-tokens=200
```

## API Reference

### `dialogAgent(options: DialogAgentOptions): Promise<DialogAgentResponse>`

Main function that creates an OpenAI dialog agent and processes a question.

**Parameters:**
- `options.question` (string): The question to ask the agent
- `options.model` (string): OpenAI model to use (default: from config)
- `options.maxTokens` (number): Maximum tokens for response (default: from config)
- `options.instructions` (string): Custom instructions for the agent
- `options.maxTurns` (number): Maximum conversation turns (default: 1)

**Returns:** Promise resolving to `DialogAgentResponse`

### `askDialog(question: string): Promise<string>`

Simple wrapper function for basic dialog responses.

### `askDialogWithInstructions(question: string, instructions: string): Promise<string>`

Dialog agent with custom instructions.

### `askDialogFull(question: string): Promise<DialogAgentResponse>`

Dialog agent returning full response object with metadata.

## Response Format

The `DialogAgentResponse` object contains:
- `text`: The response text from the agent
- `usage`: Token usage information (if available)
- `turns`: Number of conversation turns used

## Configuration

The module uses the configuration from `loadConfig.ts`. Make sure you have:

1. **OpenAI API Key**: Set `OPENAI_API_KEY` in your environment or `.env` file
2. **Model Configuration**: Default model is `gpt-4o` (configurable in config.json)
3. **Organization ID**: Optional, set `OPENAI_ORGANIZATION_ID` if needed

## Testing

Use the provided npm scripts to test the module:

```bash
# Run the test suite
npm run test:dialog

# Test basic functionality
npm run test:dialog:basic

# Test custom instructions
npm run test:dialog:custom

# Test different model
npm run test:dialog:model
```

## Key Differences from askAgent

- **Simpler Interface**: Focused on dialog-style Q&A rather than complex agent workflows
- **No File Support**: Designed for text-only interactions
- **Single Turn**: Optimized for one-shot questions and answers
- **Custom Instructions**: Easy way to configure agent personality and behavior
- **Streamlined API**: Fewer options for simpler use cases

## Notes

- **Single Turn**: By default, the agent runs for only one turn (question → answer)
- **Resource Cleanup**: Automatically deletes assistants and threads after each request
- **Error Handling**: Comprehensive error handling with descriptive messages
- **Rate Limiting**: Respects OpenAI's rate limits and handles API errors gracefully

## Dependencies

- `openai`: OpenAI Node.js SDK
- `dotenv`: Environment variable loading
- Configuration from `loadConfig.ts` 