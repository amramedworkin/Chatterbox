#!/usr/bin/env node

/**
 * Reset local polling state files to mimic "first run" state
 * Clears last_history_id.txt, other polling state files, and pending email IDs
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function printInfo(message) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅${colors.reset} ${message}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}❌${colors.reset} ${message}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${'='.repeat(message.length)}`);
}

/**
 * Get Gmail users from config.json
 */
function getGmailUsers() {
    try {
        const configPath = path.join(process.cwd(), 'config.json');
        if (!fs.existsSync(configPath)) {
            printWarning('config.json not found. Using default user.');
            return ['awsamram@gmail.com'];
        }
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const users = config.gmail?.users || [];
        
        if (users.length === 0) {
            printWarning('No Gmail users found in config.json. Using default user.');
            return ['awsamram@gmail.com'];
        }
        
        return users;
    } catch (error) {
        printWarning(`Error reading config.json: ${error.message}. Using default user.`);
        return ['awsamram@gmail.com'];
    }
}

/**
 * Clear pending email IDs for a specific user
 */
function clearPendingEmails(gmailUser) {
    const dataDir = path.join(process.cwd(), 'data');
    const safeUser = gmailUser.replace(/[^a-zA-Z0-9]/g, '_');
    const pendingEmailsPath = path.join(dataDir, `pending_emails_${safeUser}.json`);
    
    try {
        if (fs.existsSync(pendingEmailsPath)) {
            // Reset to empty pending emails array
            const emptyStorage = {
                pendingEmails: [],
                lastUpdated: new Date().toISOString()
            };
            
            fs.writeFileSync(pendingEmailsPath, JSON.stringify(emptyStorage, null, 2), 'utf8');
            printSuccess(`  Cleared pending emails for ${gmailUser}`);
            return true;
        } else {
            printInfo(`  No pending emails file found for ${gmailUser}`);
            return false;
        }
    } catch (error) {
        printError(`  Failed to clear pending emails for ${gmailUser}: ${error.message}`);
        return false;
    }
}

/**
 * Reset local polling state files
 */
function resetLocalPollingState() {
    const dataDir = path.join(process.cwd(), 'data');
    
    printInfo('Resetting local polling state files...');
    
    // Files to reset
    const filesToReset = [
        'last_history_id.txt',
        'total_poll_cycles.txt'
    ];
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const filename of filesToReset) {
        const filePath = path.join(dataDir, filename);
        
        try {
            // Create data directory if it doesn't exist
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                printInfo(`Created data directory: ${dataDir}`);
            }
            
            // Reset file content based on type
            let content = '';
            if (filename === 'last_history_id.txt') {
                content = ''; // Empty string indicates first run (will be treated as null)
            } else if (filename === 'total_poll_cycles.txt') {
                content = '0'; // Reset poll cycle counter
            }
            
            fs.writeFileSync(filePath, content, 'utf8');
            printSuccess(`  Reset ${filename} to: "${content}"`);
            successCount++;
            
        } catch (error) {
            printError(`  Failed to reset ${filename}: ${error.message}`);
            failureCount++;
        }
    }
    
    // Also reset any user-specific files in data directory
    try {
        const files = fs.readdirSync(dataDir);
        const userFiles = files.filter(file => 
            file.includes('last_polled') || 
            file.includes('sendtest_') ||
            file.endsWith('_last_sent_email_number.txt')
        );
        
        for (const userFile of userFiles) {
            const filePath = path.join(dataDir, userFile);
            try {
                // Reset to current timestamp or appropriate default
                let content = '';
                if (userFile.includes('last_polled_timestamp')) {
                    content = new Date().toISOString();
                } else if (userFile.includes('sendtest_') || userFile.includes('_last_sent_email_number')) {
                    content = '0';
                } else {
                    content = '';
                }
                
                fs.writeFileSync(filePath, content, 'utf8');
                printSuccess(`  Reset ${userFile} to: "${content}"`);
                successCount++;
                
            } catch (error) {
                printError(`  Failed to reset ${userFile}: ${error.message}`);
                failureCount++;
            }
        }
    } catch (error) {
        printWarning(`Could not read data directory for user files: ${error.message}`);
    }
    
    return { successCount, failureCount };
}

/**
 * Clear all pending email IDs for all users
 */
function clearAllPendingEmails(gmailUsers) {
    printInfo('Clearing pending email IDs...');
    
    let clearedCount = 0;
    let totalCount = gmailUsers.length;
    
    for (const gmailUser of gmailUsers) {
        if (clearPendingEmails(gmailUser)) {
            clearedCount++;
        }
    }
    
    return { clearedCount, totalCount };
}

/**
 * Main function
 */
async function main() {
    printHeader('Local Polling State Reset');
    
    try {
        // Get Gmail users from config
        printInfo('Reading Gmail users from config.json...');
        const gmailUsers = getGmailUsers();
        printSuccess(`Found ${gmailUsers.length} Gmail user(s): ${gmailUsers.join(', ')}`);
        
        // Reset local polling state
        const { successCount, failureCount } = resetLocalPollingState();
        
        // Clear pending email IDs
        const { clearedCount, totalCount } = clearAllPendingEmails(gmailUsers);
        
        // Summary
        printHeader('Reset Summary');
        printSuccess(`Successfully reset ${successCount} file(s)`);
        if (failureCount > 0) {
            printError(`Failed to reset ${failureCount} file(s)`);
        }
        
        printSuccess(`Cleared pending emails for ${clearedCount}/${totalCount} user(s)`);
        
        printInfo('\nNext steps:');
        printInfo('1. Local polling will now start fresh on next run');
        printInfo('2. It will search for emails from the last 30 days');
        printInfo('3. All previously stored Gmail IDs have been cleared');
        printInfo('4. Run: npm run mail:poll to test the reset state');
        
    } catch (error) {
        printError(`Script failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        printError(`Unhandled error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { resetLocalPollingState, getGmailUsers, clearAllPendingEmails }; 