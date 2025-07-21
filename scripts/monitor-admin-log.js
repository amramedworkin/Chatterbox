#!/usr/bin/env node

const fs = require('fs');
// eslint-disable-next-line no-unused-vars
const path = require('path');
const { AdminLogger } = require('../dist/src/utils/adminLogger');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};

function getActionColor(actionType) {
    switch (actionType.toLowerCase()) {
        case 'build':
            return colors.green;
        case 'teardown':
            return colors.red;
        case 'validate':
        case 'test':
            return colors.yellow;
        case 'info':
            return colors.white;
        default:
            return colors.cyan;
    }
}

function formatLogEntry(entry) {
    const actionColor = getActionColor(entry.actionType);
    const timestamp = new Date(entry.timestamp).toLocaleString();

    return `${colors.bright}| ${entry.logId.toString().padStart(5, '0')}-${entry.sequence
        .toString()
        .padStart(3, '0')} |${colors.reset} ${timestamp} | ${entry.user} | ${actionColor}${
        entry.actionType
    }${colors.reset} | ${entry.action} | ${entry.notes} |`;
}

function clearScreen() {
    process.stdout.write('\x1b[2J\x1b[0f');
}

function displayHeader() {
    console.log(
        `${colors.bright}${colors.cyan}=== Chatterbox Admin Log Monitor ===${colors.reset}`
    );
    console.log(`${colors.cyan}Log file: ${AdminLogger.getInstance().getLogPath()}${colors.reset}`);
    console.log(`${colors.cyan}Press Ctrl+C to exit${colors.reset}\n`);
}

function displayLogEntries(entries) {
    if (entries.length === 0) {
        console.log(`${colors.yellow}No log entries found.${colors.reset}`);
        return;
    }

    entries.forEach((entry) => {
        console.log(formatLogEntry(entry));
    });
}

function monitorLog() {
    const logger = AdminLogger.getInstance();
    const logPath = logger.getLogPath();

    if (!fs.existsSync(logPath)) {
        console.log(`${colors.red}Log file not found: ${logPath}${colors.reset}`);
        process.exit(1);
    }

    clearScreen();
    displayHeader();

    // Display initial entries
    const initialEntries = logger.getRecentEntries(20);
    displayLogEntries(initialEntries);

    // Set up file watcher
    let lastSize = fs.statSync(logPath).size;

    const watcher = fs.watch(logPath, (eventType) => {
        // eslint-disable-next-line no-unused-vars
        if (eventType === 'change') {
            try {
                const currentSize = fs.statSync(logPath).size;

                if (currentSize > lastSize) {
                    // New content added, read and display new entries
                    const newEntries = logger.getRecentEntries(5);
                    if (newEntries.length > 0) {
                        console.log('\n' + '='.repeat(80));
                        displayLogEntries(newEntries);
                    }
                    lastSize = currentSize;
                }
            } catch (error) {
                console.error(
                    `${colors.red}Error reading log file: ${error.message}${colors.reset}`
                );
            }
        }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(`\n${colors.cyan}Stopping log monitor...${colors.reset}`);
        watcher.close();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log(`\n${colors.cyan}Stopping log monitor...${colors.reset}`);
        watcher.close();
        process.exit(0);
    });
}

// Command line options
const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || command === '-h') {
    console.log(`
${colors.bright}Chatterbox Admin Log Monitor${colors.reset}

Usage: node scripts/monitor-admin-log.js [options]

Options:
  --help, -h     Show this help message
  --tail, -t     Show last 50 entries and exit
  --all, -a      Show all entries and exit
  --lines, -n    Show last N entries (default: 50)

Examples:
  node scripts/monitor-admin-log.js          # Start real-time monitor
  node scripts/monitor-admin-log.js --tail   # Show last 50 entries
  node scripts/monitor-admin-log.js --lines 20  # Show last 20 entries
  node scripts/monitor-admin-log.js --all    # Show all entries
`);
    process.exit(0);
}

if (command === '--tail' || command === '-t') {
    const logger = AdminLogger.getInstance();
    const entries = logger.getRecentEntries(50);
    displayHeader();
    displayLogEntries(entries);
    process.exit(0);
}

if (command === '--all' || command === '-a') {
    const logger = AdminLogger.getInstance();
    const entries = logger.getRecentEntries(10000); // Large number to get all
    displayHeader();
    displayLogEntries(entries);
    process.exit(0);
}

if (command === '--lines' || command === '-n') {
    const lineCount = parseInt(args[1]) || 50;
    const logger = AdminLogger.getInstance();
    const entries = logger.getRecentEntries(lineCount);
    displayHeader();
    displayLogEntries(entries);
    process.exit(0);
}

// Default: start real-time monitor
monitorLog();
