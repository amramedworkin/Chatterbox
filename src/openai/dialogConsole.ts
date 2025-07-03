import readline from 'readline';
import chalk from 'chalk';
import { dialogAgent, DialogAgentOptions } from './dialogAgent';
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
let customInstructions =
    'You are a helpful assistant. Provide clear, concise, and accurate responses to user questions.';

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
    console.log(
        `${chalk.white('Organization:')} ${chalk.gray(config.openai.organizationId || 'Not set')}\n`
    );
}

/**
 * Format and display the agent response
 */
function displayResponse(response: string, usage?: any): void {
    console.log(`\n${chalk.green.bold('🤖 Assistant:')}`);
    console.log(`${chalk.cyan('─'.repeat(60))}`);

    // Split response into paragraphs and format
    const paragraphs = response.split('\n\n');
    paragraphs.forEach((paragraph) => {
        if (paragraph.trim()) {
            console.log(`${chalk.white(paragraph.trim())}\n`);
        }
    });

    console.log(`${chalk.cyan('─'.repeat(60))}`);

    // Display usage information if available
    if (usage) {
        console.log(
            `${chalk.gray('📊 Usage:')} ${chalk.white('Prompt:')} ${chalk.yellow(usage.prompt_tokens || 0)} tokens, ${chalk.white('Completion:')} ${chalk.yellow(usage.completion_tokens || 0)} tokens, ${chalk.white('Total:')} ${chalk.yellow(usage.total_tokens || 0)} tokens`
        );
    }

    console.log(''); // Empty line for spacing
}

/**
 * Display expressive error message with detailed guidance
 */
function displayError(error: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown Error';

    console.log(`\n${chalk.red.bold('🚨 CONNECTION ERROR DETECTED')}`);
    console.log(`${chalk.red('═'.repeat(60))}`);

    // Analyze error type and provide specific guidance
    if (errorMessage.includes('Connection error') || errorMessage.includes('fetch failed')) {
        console.log(
            `${chalk.yellow.bold('🔍 DIAGNOSIS:')} ${chalk.white('Network connectivity issue detected')}`
        );
        console.log(`${chalk.yellow.bold('💡 LIKELY CAUSES:')}`);
        console.log(`   ${chalk.gray('•')} Corporate firewall or proxy blocking OpenAI API`);
        console.log(`   ${chalk.gray('•')} VPN or network security software interfering`);
        console.log(`   ${chalk.gray('•')} Internet connection temporarily unavailable`);
        console.log(`   ${chalk.gray('•')} DNS resolution issues`);
        console.log(`   ${chalk.gray('•')} SSL/TLS certificate validation problems`);

        console.log(`\n${chalk.blue.bold('🛠️  TROUBLESHOOTING STEPS:')}`);
        console.log(`   ${chalk.cyan('1.')} ${chalk.white('Check your internet connection')}`);
        console.log(`   ${chalk.cyan('2.')} ${chalk.white('Try disabling VPN if active')}`);
        console.log(
            `   ${chalk.cyan('3.')} ${chalk.white('Contact your IT department about OpenAI API access')}`
        );
        console.log(
            `   ${chalk.cyan('4.')} ${chalk.white('Try using a different network (mobile hotspot)')}`
        );
        console.log(
            `   ${chalk.cyan('5.')} ${chalk.white('Check if you can access https://api.openai.com in your browser')}`
        );
    } else if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        console.log(
            `${chalk.yellow.bold('🔍 DIAGNOSIS:')} ${chalk.white('Authentication or API key issue')}`
        );
        console.log(`${chalk.yellow.bold('💡 LIKELY CAUSES:')}`);
        console.log(`   ${chalk.gray('•')} Invalid or expired OpenAI API key`);
        console.log(`   ${chalk.gray('•')} API key not properly configured in .env file`);
        console.log(`   ${chalk.gray('•')} Insufficient API credits or quota exceeded`);
        console.log(`   ${chalk.gray('•')} Organization ID mismatch`);

        console.log(`\n${chalk.blue.bold('🛠️  TROUBLESHOOTING STEPS:')}`);
        console.log(
            `   ${chalk.cyan('1.')} ${chalk.white('Verify your OpenAI API key in .env file')}`
        );
        console.log(
            `   ${chalk.cyan('2.')} ${chalk.white('Check your OpenAI account for remaining credits')}`
        );
        console.log(
            `   ${chalk.cyan('3.')} ${chalk.white('Ensure the API key starts with "sk-"')}`
        );
        console.log(
            `   ${chalk.cyan('4.')} ${chalk.white('Try regenerating your API key on OpenAI platform')}`
        );
        console.log(
            `   ${chalk.cyan('5.')} ${chalk.white('Verify organization ID if using team account')}`
        );
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        console.log(
            `${chalk.yellow.bold('🔍 DIAGNOSIS:')} ${chalk.white('Rate limiting or quota exceeded')}`
        );
        console.log(`${chalk.yellow.bold('💡 LIKELY CAUSES:')}`);
        console.log(`   ${chalk.gray('•')} OpenAI API rate limit exceeded`);
        console.log(`   ${chalk.gray('•')} Monthly quota reached`);
        console.log(`   ${chalk.gray('•')} Too many requests in a short time period`);
        console.log(`   ${chalk.gray('•')} Account billing issues`);

        console.log(`\n${chalk.blue.bold('🛠️  TROUBLESHOOTING STEPS:')}`);
        console.log(`   ${chalk.cyan('1.')} ${chalk.white('Wait a few minutes and try again')}`);
        console.log(`   ${chalk.cyan('2.')} ${chalk.white('Check your OpenAI billing status')}`);
        console.log(`   ${chalk.cyan('3.')} ${chalk.white('Upgrade your OpenAI plan if needed')}`);
        console.log(`   ${chalk.cyan('4.')} ${chalk.white('Reduce request frequency')}`);
        console.log(`   ${chalk.cyan('5.')} ${chalk.white('Monitor usage in OpenAI dashboard')}`);
    } else if (errorMessage.includes('model') || errorMessage.includes('gpt-')) {
        console.log(`${chalk.yellow.bold('🔍 DIAGNOSIS:')} ${chalk.white('Model-related error')}`);
        console.log(`${chalk.yellow.bold('💡 LIKELY CAUSES:')}`);
        console.log(`   ${chalk.gray('•')} Specified model not available`);
        console.log(`   ${chalk.gray('•')} Model name typo or incorrect format`);
        console.log(`   ${chalk.gray('•')} Model access not enabled for your account`);
        console.log(`   ${chalk.gray('•')} Model deprecated or no longer available`);

        console.log(`\n${chalk.blue.bold('🛠️  TROUBLESHOOTING STEPS:')}`);
        console.log(
            `   ${chalk.cyan('1.')} ${chalk.white('Try using a different model: /model gpt-4o-mini')}`
        );
        console.log(
            `   ${chalk.cyan('2.')} ${chalk.white('Check available models in OpenAI dashboard')}`
        );
        console.log(`   ${chalk.cyan('3.')} ${chalk.white('Verify model name spelling')}`);
        console.log(
            `   ${chalk.cyan('4.')} ${chalk.white('Ensure your account has access to the model')}`
        );
        console.log(
            `   ${chalk.cyan('5.')} ${chalk.white('Use /info to see current model setting')}`
        );
    } else {
        console.log(
            `${chalk.yellow.bold('🔍 DIAGNOSIS:')} ${chalk.white('Unexpected error occurred')}`
        );
        console.log(`${chalk.yellow.bold('💡 ERROR DETAILS:')}`);
        console.log(`   ${chalk.gray('•')} Error Type: ${chalk.red(errorName)}`);
        console.log(`   ${chalk.gray('•')} Error Message: ${chalk.red(errorMessage)}`);

        console.log(`\n${chalk.blue.bold('🛠️  GENERAL TROUBLESHOOTING:')}`);
        console.log(`   ${chalk.cyan('1.')} ${chalk.white('Check your internet connection')}`);
        console.log(`   ${chalk.cyan('2.')} ${chalk.white('Verify OpenAI API key configuration')}`);
        console.log(`   ${chalk.cyan('3.')} ${chalk.white('Try restarting the application')}`);
        console.log(`   ${chalk.cyan('4.')} ${chalk.white('Check OpenAI service status')}`);
        console.log(`   ${chalk.cyan('5.')} ${chalk.white('Contact support if issue persists')}`);
    }

    console.log(`\n${chalk.green.bold('💪 NEXT STEPS:')}`);
    console.log(`   ${chalk.white('•')} Try your question again in a few moments`);
    console.log(`   ${chalk.white('•')} Use ${chalk.cyan('/info')} to check your current settings`);
    console.log(
        `   ${chalk.white('•')} Use ${chalk.cyan('/model gpt-4o-mini')} to try a different model`
    );
    console.log(`   ${chalk.white('•')} Check the troubleshooting steps above`);

    console.log(`\n${chalk.magenta.bold('📞 NEED HELP?')}`);
    console.log(`   ${chalk.white('•')} OpenAI Status: ${chalk.cyan('https://status.openai.com')}`);
    console.log(
        `   ${chalk.white('•')} OpenAI Documentation: ${chalk.cyan('https://platform.openai.com/docs')}`
    );
    console.log(
        `   ${chalk.white('•')} Chatterbox Issues: ${chalk.cyan('https://github.com/amramedworkin/Chatterbox/issues')}`
    );

    console.log(`${chalk.red('═'.repeat(60))}\n`);
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
                    console.log(
                        `${chalk.green('✓')} Model changed to: ${chalk.cyan(currentModel)}\n`
                    );
                } else {
                    console.log(
                        `${chalk.yellow('⚠')} Please specify a model. Example: /model gpt-4o-mini\n`
                    );
                }
                break;

            case 'instructions':
                if (args.length > 0) {
                    customInstructions = args.join(' ');
                    console.log(`${chalk.green('✓')} Instructions updated\n`);
                } else {
                    console.log(
                        `${chalk.yellow('⚠')} Please specify instructions. Example: /instructions You are a creative poet\n`
                    );
                }
                break;

            case 'info':
                showInfo();
                break;

            case 'quit':
            case 'exit':
                console.log(
                    `\n${chalk.cyan('👋 Goodbye! Thanks for using Chatterbox Dialog Agent.\n')}`
                );
                rl.close();
                process.exit(0);
                break;

            default:
                console.log(
                    `${chalk.yellow('⚠')} Unknown command: ${chalk.cyan(command)}. Type ${chalk.cyan('/help')} for available commands.\n`
                );
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

        displayError(error);
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
        console.log(`\n${chalk.red.bold('💥 FATAL STARTUP ERROR')}`);
        console.log(`${chalk.red('═'.repeat(60))}`);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'Unknown Error';

        console.log(
            `${chalk.yellow.bold('🔍 DIAGNOSIS:')} ${chalk.white('Application failed to start')}`
        );
        console.log(`${chalk.yellow.bold('💡 ERROR DETAILS:')}`);
        console.log(`   ${chalk.gray('•')} Error Type: ${chalk.red(errorName)}`);
        console.log(`   ${chalk.gray('•')} Error Message: ${chalk.red(errorMessage)}`);

        if (errorMessage.includes('API key') || errorMessage.includes('OPENAI_API_KEY')) {
            console.log(`\n${chalk.blue.bold('🛠️  IMMEDIATE FIX:')}`);
            console.log(
                `   ${chalk.cyan('1.')} ${chalk.white('Create or update your .env file in the project root')}`
            );
            console.log(
                `   ${chalk.cyan('2.')} ${chalk.white('Add your OpenAI API key: OPENAI_API_KEY=sk-your-key-here')}`
            );
            console.log(`   ${chalk.cyan('3.')} ${chalk.white('Restart the application')}`);
            console.log(`\n${chalk.gray('Example .env file:')}`);
            console.log(`${chalk.cyan('OPENAI_API_KEY=sk-proj-your-actual-key-here')}`);
            console.log(`${chalk.cyan('OPENAI_ORGANIZATION_ID=org-your-org-id')}`);
        } else if (errorMessage.includes('config') || errorMessage.includes('config.json')) {
            console.log(`\n${chalk.blue.bold('🛠️  IMMEDIATE FIX:')}`);
            console.log(
                `   ${chalk.cyan('1.')} ${chalk.white('Ensure config.json exists in the project root')}`
            );
            console.log(
                `   ${chalk.cyan('2.')} ${chalk.white('Verify config.json is valid JSON format')}`
            );
            console.log(
                `   ${chalk.cyan('3.')} ${chalk.white('Check file permissions on config.json')}`
            );
        } else if (errorMessage.includes('module') || errorMessage.includes('import')) {
            console.log(`\n${chalk.blue.bold('🛠️  IMMEDIATE FIX:')}`);
            console.log(`   ${chalk.cyan('1.')} ${chalk.white('Run: npm install')}`);
            console.log(`   ${chalk.cyan('2.')} ${chalk.white('Run: npm run build')}`);
            console.log(
                `   ${chalk.cyan('3.')} ${chalk.white('Try again: npm run console:dialog')}`
            );
        } else {
            console.log(`\n${chalk.blue.bold('🛠️  GENERAL TROUBLESHOOTING:')}`);
            console.log(
                `   ${chalk.cyan('1.')} ${chalk.white('Check your .env file configuration')}`
            );
            console.log(
                `   ${chalk.cyan('2.')} ${chalk.white('Ensure all dependencies are installed: npm install')}`
            );
            console.log(
                `   ${chalk.cyan('3.')} ${chalk.white('Build the project: npm run build')}`
            );
            console.log(
                `   ${chalk.cyan('4.')} ${chalk.white('Check Node.js version (requires >= 18.0.0)')}`
            );
            console.log(
                `   ${chalk.cyan('5.')} ${chalk.white('Verify file permissions and access')}`
            );
        }

        console.log(`\n${chalk.green.bold('💪 QUICK START:')}`);
        console.log(`   ${chalk.white('1.')} ${chalk.cyan('npm install')} - Install dependencies`);
        console.log(`   ${chalk.white('2.')} ${chalk.cyan('npm run build')} - Build the project`);
        console.log(
            `   ${chalk.white('3.')} ${chalk.cyan('npm run console:dialog')} - Start the console`
        );

        console.log(`\n${chalk.magenta.bold('📞 NEED HELP?')}`);
        console.log(`   ${chalk.white('•')} Check the project README for setup instructions`);
        console.log(`   ${chalk.white('•')} Review error details above for specific guidance`);
        console.log(`   ${chalk.white('•')} Open an issue on GitHub if problem persists`);

        console.log(`${chalk.red('═'.repeat(60))}\n`);
        process.exit(1);
    });
}

export { startConsole, processInput, displayResponse, displayError };
