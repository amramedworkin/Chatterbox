#!/usr/bin/env node

/**
 * Chatterbox System Menu
 * Comprehensive menu-driven interface for all system operations
 */

const { spawn, exec } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m'
};

// Menu categories and items
const MENU_ITEMS = [
    {
        id: 'lambda-functions',
        name: 'Lambda Functions',
        description: 'Run Lambda functions',
        category: 'AWS Lambda',
        submenu: [
            {
                id: 'poll-gmail',
                name: 'Poll Gmail',
                description: 'Poll Gmail for new emails and process them',
                functionName: `${ENVIRONMENT}-poll-gmail`,
                payload: {},
                command: 'lambda:run'
            },
            {
                id: 'pull-latest-email',
                name: 'Pull Latest Chatterbox Email',
                description: 'Retrieve and process the latest email from the archive',
                functionName: `${ENVIRONMENT}-pull-latest-chatterbox-email`,
                payload: {},
                command: 'lambda:run'
            }
        ]
    },
    {
        id: 'system-reset',
        name: 'Reset Polling',
        description: 'Reset polling systems',
        category: 'System Management',
        submenu: [
            {
                id: 'reset-lambda-polling',
                name: 'Reset Lambda Polling',
                description: 'Reset AWS Lambda polling state',
                command: 'mail:poll:reset:aws'
            },
            {
                id: 'reset-local-polling',
                name: 'Reset Local Polling',
                description: 'Reset local polling state',
                command: 'mail:poll:reset:local'
            }
        ]
    },
    {
        id: 'mail-site',
        name: 'Mail Site',
        description: 'Start/Stop mail site',
        category: 'System Management',
        submenu: [
            {
                id: 'check-mail-site',
                name: 'Check Mail Site Status',
                description: 'Check if mail site is running (UP/DOWN)',
                command: 'mail:site:check'
            },
            {
                id: 'start-mail-site',
                name: 'Start Mail Site',
                description: 'Start the mail site server',
                command: 'mail:site:start'
            },
            {
                id: 'stop-mail-site',
                name: 'Stop Mail Site',
                description: 'Stop the mail site server',
                command: 'mail:site:stop'
            },
            {
                id: 'bounce-mail-site',
                name: 'Bounce Mail Site',
                description: 'Stop and restart the mail site',
                command: 'mail:site:bounce'
            }
        ]
    },
    {
        id: 'mail-test',
        name: 'Mail Testing',
        description: 'Test email functionality',
        category: 'System Management',
        submenu: [
            {
                id: 'test-send-mail',
                name: 'Test Send Mail',
                description: 'Send a test email with optional attachments',
                command: 'test:mail:send'
            },
            {
                id: 'test-send-mail-clean',
                name: 'Test Send Mail (Clean)',
                description: 'Reset test mail state and send a test email',
                command: 'test:mail:send:clean'
            }
        ]
    },
    {
        id: 'validation',
        name: 'Validation & Checks',
        description: 'System validation and prerequisite checks',
        category: 'System Management',
        submenu: [
            {
                id: 'check-prerequisites',
                name: 'Check Prerequisites',
                description: 'Check local system prerequisites',
                command: 'aws:init:prepare'
            },
            {
                id: 'validate-aws',
                name: 'Validate AWS',
                description: 'Validate AWS system setup',
                command: 'aws:validate'
            },
            {
                id: 'validate-aws-clean',
                name: 'Validate AWS Clean',
                description: 'Validate AWS system is clean',
                command: 'aws:validate:clean'
            },
            {
                id: 'cleanup-vpcs',
                name: 'Cleanup Orphaned VPCs',
                description: 'Delete orphaned VPCs and all their resources',
                command: 'aws:cleanup:vpcs'
            }
        ]
    },
    {
        id: 'config-dump',
        name: 'Configuration Dump',
        description: 'Dump system configuration',
        category: 'System Management',
        submenu: [
            {
                id: 'dump-config-json',
                name: 'Dump Config (JSON)',
                description: 'Dump AWS configuration to JSON file',
                command: 'aws:dump:config:json'
            },
            {
                id: 'dump-config-text',
                name: 'Dump Config (Text)',
                description: 'Dump AWS configuration to text file',
                command: 'aws:dump:config:text'
            }
        ]
    },
    {
        id: 'help',
        name: 'Help & Documentation',
        description: 'Open help documentation',
        category: 'System Management',
        submenu: [
            {
                id: 'open-help',
                name: 'Open Help in Chrome',
                description: 'Open README.md in Chrome browser',
                command: 'help:chrome'
            }
        ]
    }
];

function printInfo(message) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${'='.repeat(message.length)}`);
}

function clearScreen() {
    console.clear();
}

function printMainMenu(selectedIndex) {
    clearScreen();
    printHeader('Chatterbox System Menu');
    printInfo(`Environment: ${ENVIRONMENT}`);
    printInfo(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
    printInfo(`Profile: ${process.env.AWS_PROFILE || 'cliadmin'}`);
    console.log();
    
    console.log('Use arrow keys to navigate, Enter to select, Ctrl+C to exit\n');
    
    MENU_ITEMS.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? `${colors.bgBlue}${colors.bright} > ` : '   ';
        const suffix = isSelected ? colors.reset : '';
        
        console.log(`${prefix}${item.name}${suffix}`);
        console.log(`    ${colors.magenta}${item.description}${colors.reset}`);
        console.log(`    ${colors.cyan}Category: ${item.category}${colors.reset}`);
        console.log();
    });
}

function printSubMenu(category, selectedIndex) {
    clearScreen();
    printHeader(`${category.name} - ${category.description}`);
    console.log();
    
    console.log('Use arrow keys to navigate, Enter to select, Esc to go back\n');
    
    category.submenu.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? `${colors.bgBlue}${colors.bright} > ` : '   ';
        const suffix = isSelected ? colors.reset : '';
        
        console.log(`${prefix}${item.name}${suffix}`);
        console.log(`    ${colors.magenta}${item.description}${colors.reset}`);
        console.log();
    });
}

async function executeCommand(command, description) {
    clearScreen();
    printHeader(`Executing: ${description}`);
    
    try {
        printInfo(`Running command: npm run ${command}`);
        console.log();
        
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const child = spawn('npm', ['run', command], {
                stdio: 'inherit',
                shell: true
            });
            
            child.on('close', (code) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                console.log();
                if (code === 0) {
                    printSuccess(`Command completed successfully in ${duration}ms`);
                } else {
                    printError(`Command failed with exit code ${code}`);
                }
                
                console.log('\nPress Enter to continue...');
                resolve(code === 0);
            });
            
            child.on('error', (error) => {
                printError(`Failed to execute command: ${error.message}`);
                console.log('\nPress Enter to continue...');
                reject(error);
            });
        });
        
    } catch (error) {
        printError(`Failed to execute command: ${error.message}`);
        console.log('\nPress Enter to continue...');
        return false;
    }
}

async function runLambdaFunction(func) {
    clearScreen();
    printHeader(`Running Lambda: ${func.name}`);
    
    try {
        printInfo(`Invoking function: ${func.functionName}`);
        printInfo(`Payload: ${JSON.stringify(func.payload)}`);
        console.log();
        
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const child = spawn('npm', ['run', 'aws:lambda:run'], {
                stdio: 'inherit',
                shell: true
            });
            
            child.on('close', (code) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                console.log();
                if (code === 0) {
                    printSuccess(`Lambda function executed successfully in ${duration}ms`);
                } else {
                    printError(`Lambda function failed with exit code ${code}`);
                }
                
                console.log('\nPress Enter to continue...');
                resolve(code === 0);
            });
            
            child.on('error', (error) => {
                printError(`Failed to execute Lambda function: ${error.message}`);
                console.log('\nPress Enter to continue...');
                reject(error);
            });
        });
        
    } catch (error) {
        printError(`Failed to execute Lambda function: ${error.message}`);
        console.log('\nPress Enter to continue...');
        return false;
    }
}

async function openHelpInChrome() {
    clearScreen();
    printHeader('Opening Help Documentation');
    
    try {
        const readmePath = path.join(process.cwd(), 'README.md');
        
        if (!fs.existsSync(readmePath)) {
            printError('README.md not found');
            console.log('\nPress Enter to continue...');
            return false;
        }
        
        printInfo('Opening README.md in Chrome browser...');
        
        const platform = process.platform;
        let command;
        
        if (platform === 'darwin') {
            command = `open -a "Google Chrome" "${readmePath}"`;
        } else if (platform === 'win32') {
            command = `start chrome "${readmePath}"`;
        } else {
            command = `google-chrome "${readmePath}"`;
        }
        
        exec(command, (error) => {
            if (error) {
                printWarning(`Could not open browser automatically: ${error.message}`);
                printInfo(`Please open manually: ${readmePath}`);
            } else {
                printSuccess('Opened README.md in Chrome browser');
            }
            
            console.log('\nPress Enter to continue...');
        });
        
    } catch (error) {
        printError(`Failed to open help: ${error.message}`);
        console.log('\nPress Enter to continue...');
        return false;
    }
}

function setupInputHandling() {
    // Disable canonical mode (line buffering) and echo
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    // Hide cursor
    process.stdout.write('\x1b[?25l');

    let selectedIndex = 0;
    let currentCategory = null;
    let inAction = false;

    function printCurrentMenu() {
        if (currentCategory) {
            printSubMenu(currentCategory, selectedIndex);
        } else {
            printMainMenu(selectedIndex);
        }
    }

    function cleanup() {
        process.stdout.write('\x1b[?25h'); // Show cursor
        process.stdin.setRawMode(false);
        process.stdin.pause();
    }

    async function handleItemSelection(item) {
        inAction = true;
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\x1b[?25h'); // Show cursor

        if (item.command === 'help:chrome') {
            await openHelpInChrome();
        } else if (item.command === 'lambda:run') {
            await runLambdaFunction(item);
        } else {
            await executeCommand(item.command, item.description);
        }

        // Wait for Enter to continue, then return to submenu
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('', () => {
            rl.close();
            inAction = false;
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            process.stdout.write('\x1b[?25l');
            selectedIndex = 0;
            printCurrentMenu();
        });
    }

    function handleInput(data) {
        if (inAction) return; // Ignore input while in action
        const key = data.toString();
        if (key === '\u0003') { // Ctrl+C
            cleanup();
            process.exit(0);
        } else if (key === '\u001b') { // Escape
            if (currentCategory) {
                currentCategory = null;
                selectedIndex = 0;
                printMainMenu(selectedIndex);
            }
        } else if (key === '\u001b[A') { // Up arrow
            if (currentCategory) {
                selectedIndex = Math.max(0, selectedIndex - 1);
                printSubMenu(currentCategory, selectedIndex);
            } else {
                selectedIndex = Math.max(0, selectedIndex - 1);
                printMainMenu(selectedIndex);
            }
        } else if (key === '\u001b[B') { // Down arrow
            if (currentCategory) {
                selectedIndex = Math.min(currentCategory.submenu.length - 1, selectedIndex + 1);
                printSubMenu(currentCategory, selectedIndex);
            } else {
                selectedIndex = Math.min(MENU_ITEMS.length - 1, selectedIndex + 1);
                printMainMenu(selectedIndex);
            }
        } else if (key === '\r' || key === '\n') { // Enter
            if (currentCategory) {
                const selectedItem = currentCategory.submenu[selectedIndex];
                handleItemSelection(selectedItem);
            } else {
                const selectedCategory = MENU_ITEMS[selectedIndex];
                currentCategory = selectedCategory;
                selectedIndex = 0;
                printSubMenu(selectedCategory, selectedIndex);
            }
        }
    }

    process.stdin.on('data', handleInput);
    printMainMenu(selectedIndex);
}

async function main() {
    try {
        printInfo('Starting Chatterbox System Menu...');
        await setupInputHandling();
    } catch (error) {
        printError(`Script failed: ${error.message}`);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.exit(0);
});

process.on('SIGTERM', () => {
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = {
    MENU_ITEMS,
    executeCommand,
    runLambdaFunction
}; 