#!/usr/bin/env node
// scripts/reset-email-states.js
// Reset email states with various filtering options

const fs = require('fs').promises;
const path = require('path');

// Valid email states
const VALID_STATES = ['pending', 'processing', 'completed', 'failed'];

// Default values
const DEFAULTS = {
    targetState: 'pending',
    originalState: 'all',
    filterType: 'recent',
    days: 1
};

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {
        emailIds: [],
        days: null,
        date: null,
        targetState: DEFAULTS.targetState,
        originalState: DEFAULTS.originalState,
        filterType: DEFAULTS.filterType
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--state=')) {
            options.targetState = arg.split('=')[1];
        } else if (arg.startsWith('--from-state=')) {
            options.originalState = arg.split('=')[1];
        } else if (arg.startsWith('--days=')) {
            options.days = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--date=')) {
            options.date = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        } else if (!arg.startsWith('--')) {
            // Assume it's an email ID
            options.emailIds.push(arg);
        }
    }

    return options;
}

/**
 * Show help information
 */
function showHelp() {
    console.log(`
Email State Reset Script

Usage: node scripts/reset-email-states.js [options] [emailIds...]

Options:
  --state=<state>        Target state to set (pending, processing, completed, failed)
  --from-state=<state>   Only change emails from this state (pending, processing, completed, failed, all)
  --days=<number>        Reset emails from last N days
  --date=<YYYY-MM-DD>    Reset emails from specific date
  --help, -h             Show this help

Examples:
  # Reset specific email to pending
  node scripts/reset-email-states.js 197d1482d58375c6

  # Reset multiple emails to completed
  node scripts/reset-email-states.js --state=completed 197d1482d58375c6 197c53622650d61a

  # Reset all emails from last 3 days to pending
  node scripts/reset-email-states.js --days=3

  # Reset emails from specific date to failed
  node scripts/reset-email-states.js --date=2025-07-06 --state=failed

  # Only change completed emails to pending
  node scripts/reset-email-states.js --from-state=completed --state=pending

  # Reset most recent email to pending (default behavior)
  node scripts/reset-email-states.js

Filter Priority:
  1. Email IDs (if specified, ignore all other filters)
  2. Date (if specified, ignore days filter)
  3. Days (if specified)
  4. Most recent (default)
`);
}

/**
 * Validate state
 */
function validateState(state, stateName = 'state') {
    if (!VALID_STATES.includes(state) && state !== 'all') {
        throw new Error(`Invalid ${stateName}: "${state}". Valid states are: ${VALID_STATES.join(', ')}, all`);
    }
}

/**
 * Get timestamp for logging
 */
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}:${hour}${minute}${second}:`;
}

/**
 * Log with timestamp
 */
function logWithTimestamp(...args) {
    const timestamp = getTimestamp();
    console.log(timestamp, ...args);
}

/**
 * Parse date string (YYYY-MM-DD)
 */
function parseDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: "${dateStr}". Use YYYY-MM-DD format.`);
    }
    return date;
}

/**
 * Check if email date matches target date
 */
function isEmailOnDate(emailDate, targetDate) {
    const email = new Date(emailDate);
    const target = new Date(targetDate);
    
    return email.getFullYear() === target.getFullYear() &&
           email.getMonth() === target.getMonth() &&
           email.getDate() === target.getDate();
}

/**
 * Check if email is within days range
 */
function isEmailWithinDays(emailDate, days) {
    const email = new Date(emailDate);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return email >= cutoff;
}

/**
 * Get pending emails file path
 */
function getPendingEmailsPath(gmailUser) {
    const dataDir = path.join(process.cwd(), 'data');
    const safeUser = gmailUser.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(dataDir, `pending_emails_${safeUser}.json`);
}

/**
 * Load pending emails
 */
async function loadPendingEmails(gmailUser) {
    const filePath = getPendingEmailsPath(gmailUser);
    
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return { pendingEmails: [], lastUpdated: new Date().toISOString() };
        }
        throw err;
    }
}

/**
 * Save pending emails
 */
async function savePendingEmails(gmailUser, data) {
    const filePath = getPendingEmailsPath(gmailUser);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Determine which filter to use and why
 */
function determineFilter(options) {
    if (options.emailIds.length > 0) {
        return {
            type: 'ids',
            reason: 'Email IDs specified - they trump all other filters',
            filter: options.emailIds
        };
    }
    
    if (options.date) {
        return {
            type: 'date',
            reason: 'Date specified - it trumps days filter',
            filter: options.date
        };
    }
    
    if (options.days) {
        return {
            type: 'days',
            reason: 'Days specified',
            filter: options.days
        };
    }
    
    return {
        type: 'recent',
        reason: 'No filters specified - using default (most recent)',
        filter: 1
    };
}

/**
 * Filter emails based on criteria
 */
function filterEmails(emails, filterInfo, options) {
    let filtered = [...emails];
    
    switch (filterInfo.type) {
        case 'ids':
            filtered = emails.filter(email => filterInfo.filter.includes(email.gmailId));
            break;
            
        case 'date':
            const targetDate = parseDate(filterInfo.filter);
            filtered = emails.filter(email => isEmailOnDate(email.receivedDate, targetDate));
            break;
            
        case 'days':
            filtered = emails.filter(email => isEmailWithinDays(email.receivedDate, filterInfo.filter));
            break;
            
        case 'recent':
            // Get the most recent email
            filtered = emails.length > 0 ? [emails[0]] : [];
            break;
    }
    
    // Apply original state filter
    if (options.originalState !== 'all') {
        filtered = filtered.filter(email => email.status === options.originalState);
    }
    
    // Don't change emails already in target state
    filtered = filtered.filter(email => email.status !== options.targetState);
    
    return filtered;
}

/**
 * Main function
 */
async function main() {
    try {
        // Parse arguments
        const options = parseArguments();
        
        // Log incoming values
        logWithTimestamp('=== Email State Reset Script ===');
        logWithTimestamp('Incoming values:');
        logWithTimestamp(`  Email IDs: ${options.emailIds.length > 0 ? options.emailIds.join(', ') : 'none'}`);
        logWithTimestamp(`  Days: ${options.days || 'none'}`);
        logWithTimestamp(`  Date: ${options.date || 'none'}`);
        logWithTimestamp(`  Target State: ${options.targetState}`);
        logWithTimestamp(`  Original State: ${options.originalState}`);
        
        // Validate states
        validateState(options.targetState, 'target state');
        validateState(options.originalState, 'original state');
        
        // Determine which filter to use
        const filterInfo = determineFilter(options);
        logWithTimestamp(`Filter chosen: ${filterInfo.type}`);
        logWithTimestamp(`Reason: ${filterInfo.reason}`);
        logWithTimestamp(`Filter value: ${filterInfo.filter}`);
        
        // Load pending emails for all users
        const dataDir = path.join(process.cwd(), 'data');
        const files = await fs.readdir(dataDir);
        const pendingFiles = files.filter(file => file.startsWith('pending_emails_') && file.endsWith('.json'));
        
        if (pendingFiles.length === 0) {
            logWithTimestamp('No pending email files found');
            return;
        }
        
        let totalChanged = 0;
        
        for (const file of pendingFiles) {
            const gmailUser = file.replace('pending_emails_', '').replace('.json', '').replace(/_/g, '@');
            logWithTimestamp(`Processing user: ${gmailUser}`);
            
            // Load emails
            const data = await loadPendingEmails(gmailUser);
            const emails = data.pendingEmails || [];
            
            if (emails.length === 0) {
                logWithTimestamp(`  No emails found for ${gmailUser}`);
                continue;
            }
            
            // Filter emails
            const filteredEmails = filterEmails(emails, filterInfo, options);
            
            if (filteredEmails.length === 0) {
                logWithTimestamp(`  No emails match criteria for ${gmailUser}`);
                continue;
            }
            
            // Update emails
            let changed = 0;
            for (const email of filteredEmails) {
                const oldState = email.status;
                email.status = options.targetState;
                email.lastProcessedAt = new Date().toISOString();
                
                logWithTimestamp(`  Reset email ${email.gmailId}: ${oldState} → ${options.targetState}`);
                logWithTimestamp(`    Subject: ${email.subject}`);
                logWithTimestamp(`    From: ${email.fromSender}`);
                logWithTimestamp(`    Date: ${email.receivedDate}`);
                
                changed++;
            }
            
            // Save changes
            if (changed > 0) {
                data.lastUpdated = new Date().toISOString();
                await savePendingEmails(gmailUser, data);
                logWithTimestamp(`  Saved ${changed} changes for ${gmailUser}`);
                totalChanged += changed;
            }
        }
        
        logWithTimestamp('=== Summary ===');
        logWithTimestamp(`Total emails reset: ${totalChanged}`);
        logWithTimestamp(`Target state: ${options.targetState}`);
        logWithTimestamp(`Filter used: ${filterInfo.type}`);
        
        if (totalChanged === 0) {
            logWithTimestamp('No emails were reset. Possible reasons:');
            logWithTimestamp('  - No emails match the filter criteria');
            logWithTimestamp('  - All matching emails are already in the target state');
            logWithTimestamp('  - No emails match the original state filter');
        }
        
    } catch (error) {
        logWithTimestamp('Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, parseArguments, validateState }; 