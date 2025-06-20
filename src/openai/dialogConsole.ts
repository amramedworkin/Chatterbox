import readline from 'readline';
import chalk from 'chalk';
import { askDialog, askDialogWithInstructions, dialogAgent, DialogAgentOptions } from './dialogAgent';
import config from '../loadConfig';

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// ASCII art banner
const BANNER = `
${chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗')}
${chalk.cyan.bold('║')}  ${chalk.white.bold('🤖 CHATTERBOX DIALOG AGENT')}  ${chalk.cyan.bold('║')}
${chalk.cyan.bold('║')}  ${chalk.gray('Powered by OpenAI GPT')}  ${chalk.cyan.bold('║')}
${chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝')}
`;

// Help text
const HELP_TEXT = `
${chalk.yellow.bold('📖 Available Commands:')}
${chalk.white('• Type your question and press Enter')}
${chalk.white('• Type')} ${chalk.cyan('/help')} ${chalk.white('to show this help')}
${chalk.white('• Type')} ${chalk.cyan('/clear')} ${chalk.white('to clear the screen')}
${chalk.white('• Type')} ${chalk.cyan('/model <model>')} ${chalk.white('to change model')}
${chalk.white('• Type')} ${chalk.cyan('/instructions <text>')} ${chalk.white('to set custom instructions')}
${chalk.white('• Type')} ${chalk.cyan('/info')} ${chalk.white('to show current settings')}
${chalk.white('• Type')} ${chalk.cyan('/quit')} ${chalk.white('or')} ${chalk.cyan('/exit')} ${chalk.white('to exit')}
`;

// Current settings
let currentModel = config.openai.llmModel;
let customInstructions = 'You are a helpful assistant. Provide clear, concise, and accurate responses to user questions.';

/**
 * Clear the console screen
 */
function clearScreen(): void {
    console.clear();
    console.log(BANNER);
}

/**
 * Display current settings
 */
function showInfo(): void {
    console.log(`\n${chalk.blue.bold('🔧 Current Settings:')}`);
    console.log(`${chalk.white('Model:')} ${chalk.green(currentModel)}`);
    console.log(`${chalk.white('Instructions:')} ${chalk.gray(customInstructions)}`);
    console.log(`${chalk.white('API Key:')} ${chalk.green('✓ Configured')}`);
    console.log(`${chalk.white('Organization:')} ${chalk.gray(config.openai.organizationId || 'Not set')}\n`);
}

/**
 * Format and display the agent response
 */
function displayResponse(response: string, usage?: any): void {
    console.log(`\n${chalk.green.bold('🤖 Assistant:')}`);
    console.log(`${chalk.cyan('─'.repeat(60))}`);
    
    // Split response into paragraphs and format
    const paragraphs = response.split('\n\n');
    paragraphs.forEach((paragraph, index) => {
        if (paragraph.trim()) {
            console.log(`${chalk.white(paragraph.trim())}\n`);
        }
    });
    
    console.log(`${chalk.cyan('─'.repeat(60))}`);
    
    // Display usage information if available
    if (usage) {
        console.log(`${chalk.gray('📊 Usage:')} ${chalk.white('Prompt:')} ${chalk.yellow(usage.prompt_tokens || 0)} tokens, ${chalk.white('Completion:')} ${chalk.yellow(usage.completion_tokens || 0)} tokens, ${chalk.white('Total:')} ${chalk.yellow(usage.total_tokens || 0)} tokens`);
    }
    
    console.log(''); // Empty line for spacing
}

/**
 * Display error message
 */
function displayError(error: string): void {
    console.log(`\n${chalk.red.bold('❌ Error:')}`);
    console.log(`${chalk.red(error)}\n`);
}

/**
 * Display loading animation
 */
function showLoading(): NodeJS.Timeout {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const interval = setInterval(() => {
        process.stdout.write(`\r${chalk.blue(frames[i])} ${chalk.gray('Thinking...')}`);
        i = (i + 1) % frames.length;
    }, 80);
    
    return interval;
}

/**
 * Process user input
 */
async function processInput(input: string): Promise<void> {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
        return;
    }
    
    // Handle commands
    if (trimmedInput.startsWith('/')) {
        const [command, ...args] = trimmedInput.slice(1).split(' ');
        
        switch (command.toLowerCase()) {
            case 'help':
                console.log(HELP_TEXT);
                break;
                
            case 'clear':
                clearScreen();
                break;
                
            case 'model':
                if (args.length > 0) {
                    currentModel = args.join(' ');
                    console.log(`${chalk.green('✓')} Model changed to: ${chalk.cyan(currentModel)}\n`);
                } else {
                    console.log(`${chalk.yellow('⚠')} Please specify a model. Example: /model gpt-4o-mini\n`);
                }
                break;
                
            case 'instructions':
                if (args.length > 0) {
                    customInstructions = args.join(' ');
                    console.log(`${chalk.green('✓')} Instructions updated\n`);
                } else {
                    console.log(`${chalk.yellow('⚠')} Please specify instructions. Example: /instructions You are a creative poet\n`);
                }
                break;
                
            case 'info':
                showInfo();
                break;
                
            case 'quit':
            case 'exit':
                console.log(`\n${chalk.cyan('👋 Goodbye! Thanks for using Chatterbox Dialog Agent.\n')}`);
                rl.close();
                process.exit(0);
                break;
                
            default:
                console.log(`${chalk.yellow('⚠')} Unknown command: ${chalk.cyan(command)}. Type ${chalk.cyan('/help')} for available commands.\n`);
        }
        return;
    }
    
    // Process as a question
    try {
        console.log(`\n${chalk.blue.bold('💭 You:')} ${chalk.white(trimmedInput)}`);
        
        // Show loading animation
        const loadingInterval = showLoading();
        
        // Execute the dialog agent
        const options: DialogAgentOptions = {
            question: trimmedInput,
            model: currentModel,
            instructions: customInstructions,
        };
        
        const response = await dialogAgent(options);
        
        // Clear loading animation
        clearInterval(loadingInterval);
        process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the loading line
        
        // Display the response
        displayResponse(response.text, response.usage);
        
    } catch (error) {
        // Clear loading animation
        process.stdout.write('\r' + ' '.repeat(50) + '\r');
        
        displayError(error instanceof Error ? error.message : String(error));
    }
}

/**
 * Start the interactive console
 */
async function startConsole(): Promise<void> {
    clearScreen();
    console.log(HELP_TEXT);
    showInfo();
    
    console.log(`${chalk.cyan.bold('💬 Start chatting with the AI assistant!')}\n`);
    
    // Set up the prompt
    const askQuestion = () => {
        rl.question(`${chalk.blue('❯')} ${chalk.white('')}`, async (input) => {
            await processInput(input);
            askQuestion(); // Continue the loop
        });
    };
    
    askQuestion();
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown(): void {
    const cleanup = () => {
        console.log(`\n${chalk.cyan('👋 Goodbye! Thanks for using Chatterbox Dialog Agent.\n')}`);
        rl.close();
        process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

// CLI interface for direct execution
if (require.main === module) {
    setupGracefulShutdown();
    startConsole().catch((error) => {
        console.error(`${chalk.red('❌ Fatal error:')} ${error.message}`);
        process.exit(1);
    });
}

export { startConsole, processInput, displayResponse, displayError }; 