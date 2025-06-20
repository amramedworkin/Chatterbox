# OpenAI Agent Module

This module provides a simple interface to interact with OpenAI's Agents API, allowing you to send prompts and receive responses using OpenAI's assistant capabilities.

## Features

- **Simple API**: Easy-to-use functions for sending prompts to OpenAI agents
- **Multiple Response Formats**: Choose between text-only or full native response objects
- **Configurable**: Use custom models, token limits, and other parameters
- **CLI Interface**: Run directly from command line for quick testing
- **Resource Management**: Automatically cleans up assistants and threads after use

## Usage

### Basic Usage

```typescript
import { askAgentText, askAgentNative } from '../src/openai/askAgent';

// Get text response only
const response = await askAgentText('Explain quantum computing in simple terms.');
console.log(response);

// Get full response object with metadata
const fullResponse = await askAgentNative('What is machine learning?');
console.log(fullResponse.text); // The response text
console.log(fullResponse.usage); // Token usage information
console.log(fullResponse.native); // Full OpenAI response object
```

### Advanced Usage

```typescript
import { askAgent, AskAgentOptions } from '../src/openai/askAgent';

const options: AskAgentOptions = {
    prompt: 'Write a short poem about coding.',
    responseFormat: 'text', // or 'native'
    model: 'gpt-4o-mini', // Use a specific model
    maxTokens: 500, // Limit response length
};

const response = await askAgent(options);
console.log(response.text);
```

### Command Line Usage

```bash
# Basic usage
node dist/src/openai/askAgent.js "Explain quantum computing"

# Get native response format
node dist/src/openai/askAgent.js "What is machine learning?" --format=native

# Use custom model
node dist/src/openai/askAgent.js "Write a haiku about coding" --model=gpt-4o-mini

# Set max tokens
node dist/src/openai/askAgent.js "Summarize this" --max-tokens=200
```

## Configuration

The module uses the configuration from `loadConfig.ts`. Make sure you have:

1. **OpenAI API Key**: Set `OPENAI_API_KEY` in your environment or `.env` file
2. **Model Configuration**: Default model is `gpt-4o` (configurable in config.json)
3. **Organization ID**: Optional, set `OPENAI_ORGANIZATION_ID` if needed

## API Reference

### `askAgent(options: AskAgentOptions): Promise<AskAgentResponse>`

Main function that creates an OpenAI agent and processes a prompt.

**Parameters:**
- `options.prompt` (string): The prompt to send to the agent
- `options.files` (string[]): File paths to include (not implemented in current version)
- `options.responseFormat` ('text' | 'native'): Response format (default: 'text')
- `options.model` (string): OpenAI model to use (default: from config)
- `options.maxTokens` (number): Maximum tokens for response (default: from config)

**Returns:** Promise resolving to `AskAgentResponse`

### `askAgentText(prompt: string, files?: string[]): Promise<string>`

Convenience function for text-only responses.

### `askAgentNative(prompt: string, files?: string[]): Promise<AskAgentResponse>`

Convenience function for full response objects.

## Response Format

### Text Format
Returns just the response text as a string.

### Native Format
Returns an object with:
- `text`: The response text
- `native`: Full OpenAI response object including message, run, and usage data
- `usage`: Token usage information

## Testing

Use the provided npm scripts to test the module:

```bash
# Run the test suite
npm run test:agent

# Test basic functionality
npm run test:agent:basic

# Test native response format
npm run test:agent:native

# Test custom parameters
npm run test:agent:custom
```

## Notes

- **File Support**: File attachment functionality is planned but not yet implemented
- **Resource Cleanup**: The module automatically deletes assistants and threads after each request
- **Error Handling**: Comprehensive error handling with descriptive messages
- **Rate Limiting**: Respects OpenAI's rate limits and handles API errors gracefully

## Dependencies

- `openai`: OpenAI Node.js SDK
- `dotenv`: Environment variable loading
- Configuration from `loadConfig.ts` 