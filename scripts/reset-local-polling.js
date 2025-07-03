#!/usr/bin/env node

/**
 * Reset Local Polling State Script
 * 
 * This script resets the local polling state back to its initial (never polled) state
 * by clearing all local state files related to polling.
 */

const fs = require('fs').promises;
const path = require('path');

// Load configuration
let config;
try {
    config = require('../dist/src/loadConfig.js');
    if (config.default) config = config.default;
} catch (error) {
    console.error('Error loading config. Make sure to run "npm run build" first.');
    process.exit(1);
}

/**
 * Safely deletes a file, ignoring if it doesn't exist
 */
async function safeDeleteFile(filePath) {
    try {
        await fs.unlink(filePath);
        console.log(`✅ Deleted file: ${filePath}`);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`ℹ️  File not found (already deleted): ${filePath}`);
            return true;
        }
        console.error(`❌ Error deleting file ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Gets all token files for different users
 */
async function getTokenFiles() {
    const dataDir = path.dirname(config.google.pollTokenPath);
    const files = await fs.readdir(dataDir);
    
    // Look for token files (google_tokens.json, sendtest_google_tokens.json, etc.)
    const tokenFiles = files.filter(file => 
        file.includes('token') && file.endsWith('.json')
    );
    
    return tokenFiles.map(file => path.join(dataDir, file));
}

/**
 * Resets polling state for a specific Gmail user
 */
async function resetUserPollingState(userEmail) {
    console.log(`\n🔄 Resetting polling state for user: ${userEmail}`);
    // Only clear poll counters and last history ID
    const filesToDelete = [
        config.google.lastHistoryIdPath,
        config.google.totalPollCyclesPath
    ];
    let successCount = 0;
    let totalCount = filesToDelete.length;
    for (const filePath of filesToDelete) {
        const success = await safeDeleteFile(filePath);
        if (success) successCount++;
    }
    console.log(`📊 User ${userEmail}: ${successCount}/${totalCount} files reset`);
    return successCount === totalCount;
}

/**
 * Resets send test state
 */
async function resetSendTestState() {
    console.log('\n🔄 Resetting send test state...');
    
    const sendTestFiles = [
        config.sendTest.tokenPath,
        config.sendTest.lastSentEmailNumberPath,
        config.sendTest.senderEmailPath,
        config.sendTest.recipientEmailPath,
        config.sendTest.sendCountPath
    ];
    
    let successCount = 0;
    let totalCount = sendTestFiles.length;
    
    for (const filePath of sendTestFiles) {
        const success = await safeDeleteFile(filePath);
        if (success) successCount++;
    }
    
    console.log(`📊 Send test state: ${successCount}/${totalCount} files reset`);
    return successCount === totalCount;
}

/**
 * Main function to reset all local polling state
 */
async function resetAllLocalPollingState() {
    console.log('🚀 Starting Local Polling State Reset...\n');
    const defaultUser = config.app.defaultPollGmailUser;
    console.log(`Default Gmail user: ${defaultUser}`);
    const userSuccess = await resetUserPollingState(defaultUser);
    console.log('\n🎉 Local Polling State Reset Complete!');
    console.log('\n📝 Summary:');
    console.log(`   • Reset polling state for user: ${defaultUser}`);
    console.log(`   • Only poll counters and last history ID have been cleared`);
    console.log(`   • Next local poll will start fresh with no history ID`);
    if (!userSuccess) {
        console.log('\n⚠️  Some operations failed. Check the logs above for details.');
        process.exit(1);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || command === '-h') {
    console.log(`
Local Polling State Reset Script

Usage:
  node scripts/reset-local-polling.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be deleted without actually deleting
  --user <email> Reset state for a specific user only
  --send-test    Reset send test state only
  --all          Reset all state (default)

Examples:
  node scripts/reset-local-polling.js                    # Reset all state
  node scripts/reset-local-polling.js --user test@example.com  # Reset specific user
  node scripts/reset-local-polling.js --send-test        # Reset send test state only
  node scripts/reset-local-polling.js --dry-run          # Show what would be reset

Files that will be deleted:
  • ${config.google.pollTokenPath}
  • ${config.google.lastHistoryIdPath}
  • ${config.google.lastPolledEmailPath}
  • ${config.google.totalPollCyclesPath}
  • ${config.sendTest.tokenPath}
  • ${config.sendTest.lastSentEmailNumberPath}
  • ${config.sendTest.senderEmailPath}
  • ${config.sendTest.recipientEmailPath}
  • ${config.sendTest.sendCountPath}
  • Any other token or state files in the data directory
`);
    process.exit(0);
}

if (command === '--dry-run') {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
    console.log('Files that would be deleted:');
    console.log(`  • ${config.google.pollTokenPath}`);
    console.log(`  • ${config.google.lastHistoryIdPath}`);
    console.log(`  • ${config.google.lastPolledEmailPath}`);
    console.log(`  • ${config.google.totalPollCyclesPath}`);
    console.log(`  • ${config.sendTest.tokenPath}`);
    console.log(`  • ${config.sendTest.lastSentEmailNumberPath}`);
    console.log(`  • ${config.sendTest.senderEmailPath}`);
    console.log(`  • ${config.sendTest.recipientEmailPath}`);
    console.log(`  • ${config.sendTest.sendCountPath}`);
    console.log('\nRun without --dry-run to actually delete these files.');
    process.exit(0);
}

if (command === '--user') {
    const userEmail = args[1];
    if (!userEmail) {
        console.error('❌ Error: --user requires an email address');
        process.exit(1);
    }
    console.log(`🔄 Resetting polling state for user: ${userEmail}`);
    resetUserPollingState(userEmail)
        .then(success => {
            if (success) {
                console.log('\n✅ User polling state reset complete!');
            } else {
                console.log('\n❌ Some operations failed. Check the logs above.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Error resetting user polling state:', error);
            process.exit(1);
        });
} else {
    // Reset all local polling state
    resetAllLocalPollingState()
        .catch(error => {
            console.error('❌ Error resetting local polling state:', error);
            process.exit(1);
        });
} 