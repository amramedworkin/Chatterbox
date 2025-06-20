# Dialog Console Interface

A beautiful, interactive console interface for the Chatterbox Dialog Agent with colors, formatting, and a rich user experience.

## Features

- **🎨 Beautiful UI**: Colorful, formatted interface with ASCII art banner
- **⚡ Interactive Commands**: Built-in commands for configuration and control
- **🔄 Real-time Loading**: Animated loading indicator during AI processing
- **📊 Usage Statistics**: Display token usage information
- **🎯 Easy Configuration**: Change models and instructions on the fly
- **🛡️ Error Handling**: Graceful error display and recovery
- **⌨️ Keyboard Shortcuts**: Ctrl+C for graceful exit

## Quick Start

### Run with TypeScript (Development)
```bash
npm run console:dialog
```

### Run with JavaScript (Production)
```bash
npm run console:dialog:build
```

## Interface Overview

When you start the console, you'll see:

```
╔══════════════════════════════════════════════════════════════╗
║  🤖 CHATTERBOX DIALOG AGENT  ║
║  Powered by OpenAI GPT  ║
╚══════════════════════════════════════════════════════════════╝

📖 Available Commands:
• Type your question and press Enter
• Type /help to show this help
• Type /clear to clear the screen
• Type /model <model> to change model
• Type /instructions <text> to set custom instructions
• Type /info to show current settings
• Type /quit or /exit to exit

🔧 Current Settings:
Model: gpt-4o
Instructions: You are a helpful assistant. Provide clear, concise, and accurate responses to user questions.
API Key: ✓ Configured
Organization: org-jtUOS2ket5MKPTVgmcbv5mIP

💬 Start chatting with the AI assistant!

❯ 
```

## Available Commands

### `/help`
Display the help information and available commands.

### `/clear`
Clear the console screen and show the banner again.

### `/model <model>`
Change the OpenAI model being used.
```bash
❯ /model gpt-4o-mini
✓ Model changed to: gpt-4o-mini
```

### `/instructions <text>`
Set custom instructions for the AI assistant.
```bash
❯ /instructions You are a creative poet who writes beautiful haikus
✓ Instructions updated
```

### `/info`
Display current settings and configuration.
```bash
❯ /info
🔧 Current Settings:
Model: gpt-4o-mini
Instructions: You are a creative poet who writes beautiful haikus
API Key: ✓ Configured
Organization: org-jtUOS2ket5MKPTVgmcbv5mIP
```

### `/quit` or `/exit`
Gracefully exit the console application.

## Example Conversation

```
❯ What is machine learning?

💭 You: What is machine learning?

⠋ Thinking...

🤖 Assistant:
────────────────────────────────────────────────────────────
Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It involves algorithms that can identify patterns in data and make predictions or decisions based on those patterns.

The key concept is that instead of following pre-programmed rules, the system learns from examples and data to develop its own understanding of the task at hand.

────────────────────────────────────────────────────────────
📊 Usage: Prompt: 8 tokens, Completion: 89 tokens, Total: 97 tokens

❯ /instructions You are a coding expert who explains concepts in simple terms

✓ Instructions updated

❯ Explain recursion

💭 You: Explain recursion

⠙ Thinking...

🤖 Assistant:
────────────────────────────────────────────────────────────
Recursion is like a function that calls itself! Think of it as a Russian nesting doll - you open one doll, and inside is a smaller version of the same doll.

In programming, recursion happens when a function solves a problem by breaking it down into smaller, identical problems. It keeps calling itself until it reaches a "base case" - the smallest version of the problem that can be solved directly.

A classic example is calculating factorial: 5! = 5 × 4! = 5 × 4 × 3! = 5 × 4 × 3 × 2! = 5 × 4 × 3 × 2 × 1 = 120

The function keeps calling itself with smaller numbers until it reaches 1, then multiplies all the results together.

────────────────────────────────────────────────────────────
📊 Usage: Prompt: 12 tokens, Completion: 156 tokens, Total: 168 tokens

❯ /quit

👋 Goodbye! Thanks for using Chatterbox Dialog Agent.
```

## Configuration

The console uses the same configuration as the dialog agent:

- **OpenAI API Key**: From `.env` file or environment
- **Default Model**: From `config.json` (default: `gpt-4o`)
- **Organization ID**: From `config.json` (optional)

## Keyboard Shortcuts

- **Ctrl+C**: Gracefully exit the application
- **Enter**: Send your message/question
- **Up/Down Arrows**: Navigate command history (if supported by terminal)

## Error Handling

The console gracefully handles various error scenarios:

- **Network Issues**: Displays connection errors with helpful messages
- **API Errors**: Shows specific OpenAI API error details
- **Invalid Commands**: Provides helpful feedback for unknown commands
- **Missing Parameters**: Guides users on proper command usage

## Visual Features

### Colors Used
- **Cyan**: Banner, separators, and primary UI elements
- **Blue**: User input and loading indicators
- **Green**: Success messages and assistant responses
- **Yellow**: Warnings and usage statistics
- **Red**: Errors and error messages
- **Gray**: Secondary information and help text
- **White**: Main text content

### Animations
- **Loading Spinner**: Rotating Unicode characters during AI processing
- **Smooth Transitions**: Clean screen clearing and formatting

## Development

### Running in Development Mode
```bash
npm run console:dialog
```

### Building for Production
```bash
npm run build
npm run console:dialog:build
```

### Customization
You can modify the console by editing `src/openai/dialogConsole.ts`:

- **Banner**: Change the ASCII art in the `BANNER` constant
- **Colors**: Modify chalk color schemes
- **Commands**: Add new commands in the `processInput` function
- **Formatting**: Adjust the `displayResponse` function for different output styles

## Dependencies

- `chalk`: Terminal color and formatting
- `readline`: Interactive command-line interface
- `dialogAgent`: Core dialog functionality
- `loadConfig`: Configuration management

## Notes

- **Terminal Compatibility**: Works best in terminals that support Unicode and colors
- **Memory Management**: Automatically cleans up resources after each interaction
- **Rate Limiting**: Respects OpenAI's rate limits
- **Graceful Exit**: Properly closes readline interface and handles signals 