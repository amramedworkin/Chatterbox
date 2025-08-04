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

// Parse command line arguments
const SHOW_SCRIPTS = process.argv.includes('SCRIPTS') || process.env.SCRIPTS === 'true';

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
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
};

// Menu structure with hierarchical categories
const MENU_STRUCTURE = {
    'build-teardown': {
        name: 'Build / Teardown',
        description: 'AWS infrastructure build and teardown operations',
        items: [
            {
                id: 'aws-build',
                name: 'AWS Build (6 items)',
                description: 'Build and deploy AWS infrastructure',
                type: 'category',
                submenu: [
                    {
                        id: 'deploy-complete',
                        name: 'Deploy Complete System',
                        description: `Deploy all AWS infrastructure and setup SES${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:deploy (bash Cloud/AWS/scripts/deploy-complete.sh)${colors.reset}` : ''}`,
                        command: 'aws:deploy',
                        type: 'script'
                    },
                    {
                        id: 'deploy-init',
                        name: 'Deploy Infrastructure Only',
                        description: `Deploy AWS infrastructure without secrets/population${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:deploy:init -- <init-folder> (bash Cloud/AWS/scripts/deploy-infrastructure.sh)${colors.reset}` : ''}`,
                        command: 'aws:deploy:init',
                        type: 'script'
                    },
                    {
                        id: 'setup-ses',
                        name: 'Setup SES (Complete)',
                        description: `Complete SES setup and email verification${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:setup:ses (bash Cloud/AWS/scripts/setup-ses.sh)${colors.reset}` : ''}`,
                        command: 'aws:setup:ses',
                        type: 'script'
                    },
                    {
                        id: 'verify-ses-emails',
                        name: 'Verify SES Emails',
                        description: `Send verification emails for SES addresses${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:verify:emails (bash Cloud/AWS/scripts/verify-ses-emails.sh)${colors.reset}` : ''}`,
                        command: 'aws:verify:emails',
                        type: 'script'
                    },
                    {
                        id: 'populate-secrets',
                        name: 'Populate Secrets',
                        description: `Populate AWS secrets and parameters${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:populate:secrets (node scripts/populate-secrets.js)${colors.reset}` : ''}`,
                        command: 'aws:populate:secrets',
                        type: 'script'
                    },
                    {
                        id: 'build-lambda',
                        name: 'Build Lambda Functions',
                        description: `Build and package Lambda functions${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:build:lambda (node scripts/aws-build.js)${colors.reset}` : ''}`,
                        command: 'aws:build:lambda',
                        type: 'script'
                    }
                ]
            },
            {
                id: 'aws-teardown',
                name: 'AWS Teardown (3 items)',
                description: 'Teardown and cleanup AWS infrastructure',
                type: 'category',
                submenu: [
                    {
                        id: 'teardown-complete',
                        name: 'Teardown Complete System',
                        description: `Complete teardown of all AWS infrastructure and resources${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:teardown (bash Cloud/AWS/terraform-simple/teardown.sh)${colors.reset}` : ''}`,
                        command: 'aws:teardown',
                        type: 'script'
                    },
                    {
                        id: 'cleanup-ses',
                        name: 'Cleanup SES',
                        description: `Remove verified email addresses and disable SES (return to 'Get Started' state)${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:cleanup:ses (bash Cloud/AWS/scripts/cleanup-ses.sh)${colors.reset}` : ''}`,
                        command: 'aws:cleanup:ses',
                        type: 'script'
                    },
                    {
                        id: 'cleanup-vpcs',
                        name: 'Cleanup Orphaned VPCs',
                        description: `Delete orphaned VPCs and all their resources${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:cleanup:vpcs (node scripts/cleanup-orphaned-vpcs.js)${colors.reset}` : ''}`,
                        command: 'aws:cleanup:vpcs',
                        type: 'script'
                    }
                ]
            },
            {
                id: 'standalone-actions',
                name: 'Standalone Actions (3 items)',
                description: 'Independent operations for authentication and token management',
                type: 'category',
                submenu: [
                    {
                        id: 'auth-and-migrate',
                        name: 'Authenticate & Migrate Tokens',
                        description: `Authenticate all Gmail users and migrate tokens to AWS${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:auth-and-migrate (node scripts/authenticate-and-migrate.js)${colors.reset}` : ''}`,
                        command: 'mail:auth-and-migrate',
                        type: 'script'
                    },
                    {
                        id: 'auth-and-migrate-force',
                        name: 'Force Re-authenticate & Migrate',
                        description: `Force re-authentication of all Gmail users and migrate tokens to AWS${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:auth-and-migrate:force (node scripts/authenticate-and-migrate.js --force)${colors.reset}` : ''}`,
                        command: 'mail:auth-and-migrate:force',
                        type: 'script'
                    },
                    {
                        id: 'auth-only',
                        name: 'Authenticate Only (No Migration)',
                        description: `Authenticate all Gmail users without migrating tokens to AWS${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:auth-only (node scripts/authenticate-and-migrate.js --no-migrate)${colors.reset}` : ''}`,
                        command: 'mail:auth-only',
                        type: 'script'
                    }
                ]
            }
        ]
    },
    'execute-functionality': {
        name: 'Execute Functionality',
        description: 'Execute system functions and operations',
        items: [
            {
                id: 'lambda-functions',
                name: 'Lambda Functions (6 items)',
                description: 'AWS Lambda function operations',
                type: 'category',
                submenu: [
                    {
                        id: 'lambda-poll',
                        name: 'Poll Gmail',
                        description: `Poll Gmail for new emails and process them${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:lambda:poll (node scripts/run-lambda-poll.js)${colors.reset}` : ''}`,
                        command: 'aws:lambda:poll',
                        type: 'script'
                    },
                    {
                        id: 'lambda-process',
                        name: 'Process Email',
                        description: `Process incoming email through AI system${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:lambda:process (node scripts/run-lambda-processor.js)${colors.reset}` : ''}`,
                        command: 'aws:lambda:process',
                        type: 'script'
                    },
                    {
                        id: 'lambda-generate',
                        name: 'Generate Response',
                        description: `Generate AI response for processed email${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:lambda:generate (node scripts/run-lambda-generator.js)${colors.reset}` : ''}`,
                        command: 'aws:lambda:generate',
                        type: 'script'
                    },
                    {
                        id: 'lambda-reset-poll',
                        name: 'Reset Poll',
                        description: `Reset AWS Lambda polling state${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:poll:reset:aws (node scripts/reset-aws-polling.js)${colors.reset}` : ''}`,
                        command: 'mail:poll:reset:aws',
                        type: 'script'
                    },
                    {
                        id: 'lambda-state',
                        name: 'AWS State',
                        description: `Show complete AWS system state and statistics${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:state (node scripts/aws-state.js)${colors.reset}` : ''}`,
                        command: 'aws:state',
                        type: 'script'
                    },
                    {
                        id: 'pull-latest-email',
                        name: 'Pull Latest Chatterbox Email',
                        description: `Retrieve and process the latest email from the archive${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:lambda:run (node scripts/run-lambda.js)${colors.reset}` : ''}`,
                        functionName: `${ENVIRONMENT}-pull-latest-chatterbox-email`,
                        payload: {},
                        command: 'lambda:run',
                        type: 'script'
                    }
                ]
            },
            {
                id: 'system-reset',
                name: 'System Reset (4 items)',
                description: 'Reset polling systems and email states',
                type: 'category',
                submenu: [
                    {
                        id: 'reset-lambda-polling',
                        name: 'Reset Lambda Polling',
                        description: `Reset AWS Lambda polling state${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:poll:reset:aws (node scripts/reset-aws-polling.js)${colors.reset}` : ''}`,
                        command: 'mail:poll:reset:aws',
                        type: 'script'
                    },
                    {
                        id: 'reset-local-polling',
                        name: 'Reset Local Polling',
                        description: `Reset local polling state${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:poll:reset:local (node scripts/reset-local-polling.js)${colors.reset}` : ''}`,
                        command: 'mail:poll:reset:local',
                        type: 'script'
                    },
                    {
                        id: 'reset-pending-emails',
                        name: 'Reset Pending Emails',
                        description: `Reset pending emails in the Lambda function state${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:reset:states (node scripts/reset-email-states.js)${colors.reset}` : ''}`,
                        command: 'mail:reset:states',
                        type: 'script'
                    },
                    {
                        id: 'clear-aws-interactive',
                        name: 'Clear AWS Data (Interactive)',
                        description: `Interactive AWS data clearing with Quiet/Prompt options${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:clear:interactive (interactive menu)${colors.reset}` : ''}`,
                        command: 'aws:clear:interactive',
                        type: 'script'
                    }
                ]
            },
            {
                id: 'mail-test',
                name: 'Mail Testing (2 items)',
                description: 'Test email functionality',
                type: 'category',
                submenu: [
                    {
                        id: 'test-send-mail',
                        name: 'Test Send Mail',
                        description: `Send a test email with optional attachments${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run test:mail:send (interactive test)${colors.reset}` : ''}`,
                        command: 'test:mail:send',
                        type: 'script'
                    },
                    {
                        id: 'test-send-mail-clean',
                        name: 'Test Send Mail (Clean)',
                        description: `Reset test mail state and send a test email${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run test:mail:send:clean (reset + send)${colors.reset}` : ''}`,
                        command: 'test:mail:send:clean',
                        type: 'script'
                    }
                ]
            }
        ]
    },
    'mail-related': {
        name: 'Mail Related',
        description: 'Mail site and email operations',
        items: [
            {
                id: 'mail-site',
                name: 'Mail Site (4 items)',
                description: 'Start/Stop mail site',
                type: 'category',
                submenu: [
                    {
                        id: 'check-mail-site',
                        name: 'Check Mail Site Status',
                        description: `Check if mail site is running (UP/DOWN)${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:site:check (node scripts/check-mail-site.js)${colors.reset}` : ''}`,
                        command: 'mail:site:check',
                        type: 'script'
                    },
                    {
                        id: 'start-mail-site',
                        name: 'Start Mail Site',
                        description: `Start the mail site server${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:site:start (bin/serve-tokensite.zsh &)${colors.reset}` : ''}`,
                        command: 'mail:site:start',
                        type: 'script'
                    },
                    {
                        id: 'stop-mail-site',
                        name: 'Stop Mail Site',
                        description: `Stop the mail site server${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:site:stop (pkill -f 'http-server.*3000')${colors.reset}` : ''}`,
                        command: 'mail:site:stop',
                        type: 'script'
                    },
                    {
                        id: 'bounce-mail-site',
                        name: 'Bounce Mail Site',
                        description: `Stop and restart the mail site${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run mail:site:bounce (node scripts/bounce-mail-site.js)${colors.reset}` : ''}`,
                        command: 'mail:site:bounce',
                        type: 'script'
                    }
                ]
            },
            {
                id: 'email-round-trip-tests',
                name: 'Email Round Trip Tests (5 items)',
                description: 'Comprehensive email round trip testing',
                type: 'category',
                submenu: [
                    {
                        id: 'test-email-all',
                        name: 'Run All Email Tests',
                        description: `Run all email round trip tests (SES and Gmail)${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:test:email:roundtrip (node scripts/run-email-round-trip-tests.js)${colors.reset}` : ''}`,
                        command: 'aws:test:email:roundtrip',
                        type: 'script'
                    },
                    {
                        id: 'test-email-ses-to-ses',
                        name: 'SES-to-SES Tests',
                        description: `Test email delivery between SES verified addresses${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:test:email:ses-to-ses (node scripts/test-email-ses-to-ses.js)${colors.reset}` : ''}`,
                        command: 'aws:test:email:ses-to-ses',
                        type: 'script'
                    },
                    {
                        id: 'test-email-gmail-to-gmail',
                        name: 'Gmail-to-Gmail Tests',
                        description: `Test email delivery between Gmail API authorized addresses${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:test:email:gmail-to-gmail (node scripts/test-email-gmail-to-gmail.js)${colors.reset}` : ''}`,
                        command: 'aws:test:email:gmail-to-gmail',
                        type: 'script'
                    },
                    {
                        id: 'test-email-ses-to-gmail',
                        name: 'SES-to-Gmail Tests',
                        description: `Test email delivery from SES to Gmail addresses${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:test:email:ses-to-gmail (node scripts/test-email-ses-to-gmail.js)${colors.reset}` : ''}`,
                        command: 'aws:test:email:ses-to-gmail',
                        type: 'script'
                    },
                    {
                        id: 'test-email-gmail-to-ses',
                        name: 'Gmail-to-SES Tests',
                        description: `Test email delivery from Gmail to SES addresses${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:test:email:gmail-to-ses (node scripts/test-email-gmail-to-ses.js)${colors.reset}` : ''}`,
                        command: 'aws:test:email:gmail-to-ses',
                        type: 'script'
                    }
                ]
            }
        ]
    },
    'validation-state': {
        name: 'Validation and State',
        description: 'System validation and state checking',
        items: [
            {
                id: 'aws-validation',
                name: 'AWS Validation (4 items)',
                description: 'Validate AWS infrastructure and configuration',
                type: 'category',
                submenu: [
                    {
                        id: 'validate-aws',
                        name: 'Validate AWS System',
                        description: `Validate all AWS resources are properly deployed${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:validate (node scripts/validate-aws-system.js)${colors.reset}` : ''}`,
                        command: 'aws:validate',
                        type: 'script'
                    },
                    {
                        id: 'validate-aws-clean',
                        name: 'Validate AWS Clean',
                        description: `Validate AWS system is clean (teardown validation)${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:validate:clean (node scripts/validate-aws-system.js --clean)${colors.reset}` : ''}`,
                        command: 'aws:validate:clean',
                        type: 'script'
                    },
                    {
                        id: 'validate-ses',
                        name: 'Validate SES',
                        description: `Validate SES setup and email verification${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:validate:ses (node scripts/validate-ses.js)${colors.reset}` : ''}`,
                        command: 'aws:validate:ses',
                        type: 'script'
                    },
                    {
                        id: 'validate-ses-clean',
                        name: 'Validate SES Clean',
                        description: `Validate SES is properly cleaned up${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:validate:ses --clean (node scripts/validate-ses.js --clean)${colors.reset}` : ''}`,
                        command: 'aws:validate:ses --clean',
                        type: 'script'
                    }
                ]
            },
            {
                id: 'aws-state',
                name: 'AWS State (3 items)',
                description: 'Check AWS system state and status',
                type: 'category',
                submenu: [
                    {
                        id: 'check-ses',
                        name: 'Check SES Status',
                        description: `Check verification status of email addresses in AWS SES${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:check:ses (bash Cloud/AWS/scripts/check-ses-status.sh)${colors.reset}` : ''}`,
                        command: 'aws:check:ses',
                        type: 'script'
                    },
                    {
                        id: 'aws-state',
                        name: 'AWS System State',
                        description: `Check overall AWS system state${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:state (node scripts/aws-state.js)${colors.reset}` : ''}`,
                        command: 'aws:state',
                        type: 'script'
                    },
                    {
                        id: 'aws-backup',
                        name: 'Backup AWS System',
                        description: `Backup AWS system configuration and data${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:backup (node scripts/backup-aws-system.js)${colors.reset}` : ''}`,
                        command: 'aws:backup',
                        type: 'script'
                    }
                ]
            },
            {
                id: 'validation',
                name: 'System Validation (4 items)',
                description: 'System validation and prerequisite checks',
                type: 'category',
                submenu: [
                    {
                        id: 'check-prerequisites',
                        name: 'Check Prerequisites',
                        description: `Check local system prerequisites${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:init:check-prerequisites (node scripts/check-prerequisites.js)${colors.reset}` : ''}`,
                        command: 'aws:init:check-prerequisites',
                        type: 'script'
                    },
                    {
                        id: 'validate-aws',
                        name: 'Validate AWS',
                        description: `Validate AWS system setup${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:validate (node scripts/validate-aws-system.js)${colors.reset}` : ''}`,
                        command: 'aws:validate',
                        type: 'script'
                    },
                    {
                        id: 'lambda-state',
                        name: 'AWS State',
                        description: `Show complete AWS system state and statistics${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:state (node scripts/aws-state.js)${colors.reset}` : ''}`,
                        command: 'aws:state',
                        type: 'script'
                    },
                    {
                        id: 'dump-config-json',
                        name: 'Dump Config (JSON)',
                        description: `Dump AWS configuration to JSON file${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run aws:dump:config (node scripts/dump-aws-config.js --json --save)${colors.reset}` : ''}`,
                        command: 'aws:dump:config',
                        type: 'script'
                    }
                ]
            }
        ]
    },
    'help': {
        name: 'Help',
        description: 'Help and documentation',
        items: [
            {
                id: 'help',
                name: 'Help & Documentation (1 item)',
                description: 'Open help documentation',
                type: 'category',
                submenu: [
                    {
                        id: 'open-help',
                        name: 'Open Help in Chrome',
                        description: `Open README.md in Chrome browser${SHOW_SCRIPTS ? `\n${colors.yellow}Script: npm run help (opens /docs/SYSTEM_SETUP_AND_TEARDOWN.md)${colors.reset}` : ''}`,
                        command: 'help:chrome',
                        type: 'script'
                    }
                ]
            }
        ]
    }
};

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

    // Get main categories from MENU_STRUCTURE
    const mainCategories = Object.values(MENU_STRUCTURE);
    
    mainCategories.forEach((category, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? `${colors.bgBlue}${colors.bright} > ` : '   ';
        const suffix = isSelected ? colors.reset : '';
        
        // Categories are displayed in yellow
        const nameColor = colors.yellow;
        
        console.log(`${prefix}${nameColor}${category.name}${suffix}`);
        console.log(`    ${colors.magenta}${category.description}${colors.reset}`);
        console.log();
    });
}

function printSubMenu(category, selectedIndex) {
    clearScreen();
    printHeader(`${category.name} - ${category.description}`);
    console.log();

    console.log('Use arrow keys to navigate, Enter to select, Esc to go back\n');

    category.items.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? `${colors.bgBlue}${colors.bright} > ` : '   ';
        const suffix = isSelected ? colors.reset : '';
        
        // Categories are displayed in yellow, scripts in white
        const nameColor = item.type === 'category' ? colors.yellow : colors.white;
        
        console.log(`${prefix}${nameColor}${item.name}${suffix}`);
        console.log(`    ${colors.magenta}${item.description}${colors.reset}`);
        console.log();
    });
}

function printSubSubMenu(category, selectedIndex) {
    clearScreen();
    printHeader(`${category.name} - ${category.description}`);
    console.log();

    console.log('Use arrow keys to navigate, Enter to select, Esc to go back\n');

    category.submenu.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? `${colors.bgBlue}${colors.bright} > ` : '   ';
        const suffix = isSelected ? colors.reset : '';
        
        // Scripts are displayed in white
        const nameColor = colors.white;
        
        console.log(`${prefix}${nameColor}${item.name}${suffix}`);
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
                shell: true,
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
                shell: true,
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

async function executeResponseQueryCommand() {
    clearScreen();
    printHeader('Query Details - Email Query Lookup');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        printInfo('Enter the Query ID to look up:');
        printInfo('(You can get Query IDs from the "List Email Queries" option)');
        console.log();

        const queryId = await new Promise((resolve) => {
            rl.question('Query ID: ', (answer) => {
                resolve(answer.trim());
            });
        });

        if (!queryId) {
            printWarning('No Query ID provided. Returning to menu.');
            rl.close();
            return;
        }

        printInfo(`Looking up query: ${queryId}`);
        console.log();

        await executeCommand(`aws:response:pull query ${queryId}`, `Query Details for ${queryId}`);

    } catch (error) {
        printError(`Failed to execute query command: ${error.message}`);
    } finally {
        rl.close();
    }
}

async function executeResponseConversationCommand() {
    clearScreen();
    printHeader('Conversation History - Conversation Lookup');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        printInfo('Enter the Conversation ID to look up:');
        printInfo('(You can get Conversation IDs from query details)');
        console.log();

        const conversationId = await new Promise((resolve) => {
            rl.question('Conversation ID: ', (answer) => {
                resolve(answer.trim());
            });
        });

        if (!conversationId) {
            printWarning('No Conversation ID provided. Returning to menu.');
            rl.close();
            return;
        }

        printInfo(`Looking up conversation: ${conversationId}`);
        console.log();

        await executeCommand(`aws:response:pull conversation ${conversationId}`, `Conversation History for ${conversationId}`);

    } catch (error) {
        printError(`Failed to execute conversation command: ${error.message}`);
    } finally {
        rl.close();
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

async function executeInteractiveClearAWS() {
    clearScreen();
    printHeader('Interactive AWS Data Clearing');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        // Step 1: Select operation type (What-If or Clear)
        console.log('Select Operation Type:');
        console.log('1. What-If Mode (show what would be deleted)');
        console.log('2. Clear Mode (actually delete data)');
        console.log();

        const operationType = await new Promise((resolve) => {
            rl.question('Enter choice (1-2): ', (answer) => {
                resolve(answer.trim());
            });
        });

        let isWhatIf = false;
        let quietFlag = '';
        let whatIfFlag = '';

        switch (operationType) {
            case '1':
                isWhatIf = true;
                whatIfFlag = '--what-if';
                quietFlag = '--quiet'; // What-if always uses quiet mode
                break;
            case '2':
                isWhatIf = false;
                whatIfFlag = '';
                break;
            default:
                printWarning('Invalid choice. Returning to menu.');
                rl.close();
                return;
        }

        // Step 2: If Clear mode, select Quiet or Prompt
        if (!isWhatIf) {
            console.log();
            console.log('Select Clear Mode:');
            console.log('1. Quiet Mode (no prompts, minimal output)');
            console.log('2. Prompt Mode (interactive with confirmations)');
            console.log();

            const clearMode = await new Promise((resolve) => {
                rl.question('Enter choice (1-2): ', (answer) => {
                    resolve(answer.trim());
                });
            });

            switch (clearMode) {
                case '1':
                    quietFlag = '--quiet';
                    break;
                case '2':
                    quietFlag = '';
                    break;
                default:
                    printWarning('Invalid choice. Returning to menu.');
                    rl.close();
                    return;
            }
        }

        // Step 3: Select specific operation
        console.log();
        if (isWhatIf) {
            console.log('Select What-If Operation:');
            console.log('1. What-If All AWS Data');
            console.log('2. What-If Pending Queries');
            console.log('3. What-If Processing Queries');
            console.log('4. What-If Sent Queries');
            console.log('5. What-If Failed Queries');
            console.log('6. What-If Email Queries Table');
            console.log('7. What-If Conversations Table');
            console.log('8. What-If Generated Responses Table');
            console.log('9. What-If Query Records Table');
            console.log('10. What-If User Profiles Table');
        } else {
            console.log('Select Clear Operation:');
            console.log('1. Clear All AWS Data');
            console.log('2. Clear Pending Queries');
            console.log('3. Clear Processing Queries');
            console.log('4. Clear Sent Queries');
            console.log('5. Clear Failed Queries');
            console.log('6. Clear Email Queries Table');
            console.log('7. Clear Conversations Table');
            console.log('8. Clear Generated Responses Table');
            console.log('9. Clear Query Records Table');
            console.log('10. Clear User Profiles Table');
        }
        console.log();

        const operationChoice = await new Promise((resolve) => {
            rl.question('Enter choice (1-10): ', (answer) => {
                resolve(answer.trim());
            });
        });

        let command;
        switch (operationChoice) {
            case '1':
                command = isWhatIf ? 'aws:clear:whatif:all' : `aws:clear:all ${quietFlag}`;
                break;
            case '2':
                command = isWhatIf ? 'aws:clear:whatif:pending' : `aws:clear:pending ${quietFlag}`;
                break;
            case '3':
                command = isWhatIf ? 'aws:clear:whatif:processing' : `aws:clear:processing ${quietFlag}`;
                break;
            case '4':
                command = isWhatIf ? 'aws:clear:whatif:sent' : `aws:clear:sent ${quietFlag}`;
                break;
            case '5':
                command = isWhatIf ? 'aws:clear:whatif:failed' : `aws:clear:failed ${quietFlag}`;
                break;
            case '6':
                command = isWhatIf ? 'aws:clear:whatif:email-queries' : `aws:clear:email-queries ${quietFlag}`;
                break;
            case '7':
                command = isWhatIf ? 'aws:clear:whatif:conversations' : `aws:clear:conversations ${quietFlag}`;
                break;
            case '8':
                command = isWhatIf ? 'aws:clear:whatif:generated-responses' : `aws:clear:generated-responses ${quietFlag}`;
                break;
            case '9':
                command = isWhatIf ? 'aws:clear:whatif:query-records' : `aws:clear:query-records ${quietFlag}`;
                break;
            case '10':
                command = isWhatIf ? 'aws:clear:whatif:user-profiles' : `aws:clear:user-profiles ${quietFlag}`;
                break;
            default:
                printWarning('Invalid choice. Returning to menu.');
                rl.close();
                return;
        }

        // Step 4: Execute the command
        console.log();
        const modeText = isWhatIf ? 'What-If Mode' : (quietFlag ? 'Quiet Mode' : 'Prompt Mode');
        printInfo(`Executing: ${modeText} - ${command}`);
        console.log();

        await executeCommand(command, `AWS Data ${isWhatIf ? 'What-If' : 'Clear'} - ${modeText}`);

    } catch (error) {
        printError(`Failed to execute interactive clear: ${error.message}`);
    } finally {
        rl.close();
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
    let currentLevel = 'main'; // 'main', 'sub', 'subsub'
    let currentCategory = null;
    let currentSubCategory = null;
    let inAction = false;

    function printCurrentMenu() {
        if (currentLevel === 'subsub') {
            printSubSubMenu(currentSubCategory, selectedIndex);
        } else if (currentLevel === 'sub') {
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
        } else if (item.command === 'aws:response:pull query') {
            await executeResponseQueryCommand();
        } else if (item.command === 'aws:response:pull conversation') {
            await executeResponseConversationCommand();
        } else if (item.command === 'aws:clear:interactive') {
            await executeInteractiveClearAWS();
        } else {
            await executeCommand(item.command, item.description);
        }

        // Wait for Enter to continue, then return to submenu
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
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
        if (key === '\u0003') {
            // Ctrl+C
            cleanup();
            process.exit(0);
        } else if (key === '\u001b') {
            // Escape
            if (currentLevel === 'subsub') {
                currentLevel = 'sub';
                currentSubCategory = null;
                selectedIndex = 0;
                printSubMenu(currentCategory, selectedIndex);
            } else if (currentLevel === 'sub') {
                currentLevel = 'main';
                currentCategory = null;
                selectedIndex = 0;
                printMainMenu(selectedIndex);
            }
        } else if (key === '\u001b[A') {
            // Up arrow
            selectedIndex = Math.max(0, selectedIndex - 1);
            printCurrentMenu();
        } else if (key === '\u001b[B') {
            // Down arrow
            let maxIndex;
            if (currentLevel === 'subsub') {
                maxIndex = currentSubCategory.submenu.length - 1;
            } else if (currentLevel === 'sub') {
                maxIndex = currentCategory.items.length - 1;
            } else {
                maxIndex = Object.keys(MENU_STRUCTURE).length - 1;
            }
            selectedIndex = Math.min(maxIndex, selectedIndex + 1);
            printCurrentMenu();
        } else if (key === '\r' || key === '\n') {
            // Enter
            if (currentLevel === 'subsub') {
                const selectedItem = currentSubCategory.submenu[selectedIndex];
                handleItemSelection(selectedItem);
            } else if (currentLevel === 'sub') {
                const selectedItem = currentCategory.items[selectedIndex];
                if (selectedItem.type === 'category') {
                    currentLevel = 'subsub';
                    currentSubCategory = selectedItem;
                    selectedIndex = 0;
                    printSubSubMenu(selectedItem, selectedIndex);
                } else {
                    handleItemSelection(selectedItem);
                }
            } else {
                const mainCategoryKeys = Object.keys(MENU_STRUCTURE);
                const selectedCategoryKey = mainCategoryKeys[selectedIndex];
                const selectedCategory = MENU_STRUCTURE[selectedCategoryKey];
                currentLevel = 'sub';
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
    MENU_STRUCTURE,
    executeCommand,
    runLambdaFunction,
};