// src/mail/authorizeAll.ts
// Centralized Gmail authorization for all Chatterbox subsystems

import config from '../loadConfig';
import { authorizeGmail } from './authorizeGmail';
import { OAuth2Client } from 'googleapis-common';

interface EmailPurpose {
    email: string;
    purpose: string;
    scopes: string[];
}

/**
 * Gets all unique Gmail users from the config and their purposes
 * @returns Array of email purposes
 */
function getGmailUsersFromConfig(): EmailPurpose[] {
    const users: EmailPurpose[] = [];
    const seenEmails = new Set<string>();

    // Add poll Gmail user
    if (config.app.defaultPollGmailUser && !seenEmails.has(config.app.defaultPollGmailUser)) {
        users.push({
            email: config.app.defaultPollGmailUser,
            purpose: 'Gmail polling (monitoring incoming emails)',
            scopes: config.google.scopes,
        });
        seenEmails.add(config.app.defaultPollGmailUser);
    }

    // Add send Gmail user
    if (config.app.defaultSendGmailUser && !seenEmails.has(config.app.defaultSendGmailUser)) {
        users.push({
            email: config.app.defaultSendGmailUser,
            purpose: 'Gmail sending (outgoing emails)',
            scopes: config.sendTest.scopes,
        });
        seenEmails.add(config.app.defaultSendGmailUser);
    }

    // Add get Gmail user
    if (config.app.defaultGetGmailUser && !seenEmails.has(config.app.defaultGetGmailUser)) {
        users.push({
            email: config.app.defaultGetGmailUser,
            purpose: 'Gmail retrieval (reading emails)',
            scopes: config.google.scopes,
        });
        seenEmails.add(config.app.defaultGetGmailUser);
    }

    return users;
}

/**
 * Authorizes all Gmail users defined in the config
 * @param forceReauthorize If true, forces re-authorization for all users
 * @returns Promise resolving to a map of email to OAuth2Client
 */
export async function authorizeAllGmailUsers(
    forceReauthorize = false
): Promise<Map<string, OAuth2Client>> {
    const users = getGmailUsersFromConfig();
    const authorizedClients = new Map<string, OAuth2Client>();

    console.log('\n=== Gmail Authorization for Chatterbox ===\n');

    if (users.length === 0) {
        console.log('No Gmail users found in configuration.');
        return authorizedClients;
    }

    console.log(`Found ${users.length} Gmail user(s) to authorize:\n`);

    for (const user of users) {
        console.log(`📧 Email: ${user.email}`);
        console.log(`🎯 Purpose: ${user.purpose}`);
        console.log(`🔑 Scopes: ${user.scopes.join(', ')}`);
        console.log('');

        try {
            console.log(`🔄 Authorizing ${user.email}...`);
            const authClient = await authorizeGmail(user.email, config, forceReauthorize);
            authorizedClients.set(user.email, authClient);
            console.log(`✅ Successfully authorized ${user.email}\n`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to authorize ${user.email}: ${errorMsg}`);
            throw new Error(`Authorization failed for ${user.email}: ${errorMsg}`);
        }
    }

    console.log('=== All Gmail users authorized successfully ===\n');
    return authorizedClients;
}

/**
 * Checks if all Gmail users are authorized without prompting for new authorization
 * @returns Promise resolving to true if all users are authorized, false otherwise
 */
export async function checkAllGmailUsersAuthorized(): Promise<boolean> {
    const users = getGmailUsersFromConfig();

    for (const user of users) {
        try {
            // Try to authorize without forcing (this will only refresh existing tokens)
            await authorizeGmail(user.email, config, false);
        } catch (error) {
            console.error(`❌ User ${user.email} is not properly authorized:`, error);
            return false;
        }
    }

    return true;
}

/**
 * Main function for running authorization as a script
 */
async function main(): Promise<{ success: boolean; errors: string[] }> {
    const args = process.argv.slice(2);
    const forceReauthorize = args.includes('--force') || args.includes('-f');

    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: npm run mail:authorize [--force]');
        console.log('');
        console.log('Options:');
        console.log('  --force, -f    Force re-authorization for all users');
        console.log('  --help, -h     Show this help message');
        console.log('');
        console.log('This script will authorize all Gmail users defined in the config:');
        const users = getGmailUsersFromConfig();
        users.forEach((user) => {
            console.log(`  - ${user.email} (${user.purpose})`);
        });
        return { success: true, errors: [] };
    }

    try {
        await authorizeAllGmailUsers(forceReauthorize);
        console.log('🎉 All Gmail users are now authorized and ready for Chatterbox!');
        return { success: true, errors: [] };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('💥 Authorization failed:', errorMsg);
        console.log('\n💡 To fix authorization issues:');
        console.log('   1. Run: npm run mail:authorize --force');
        console.log('   2. Follow the authorization prompts for each user');
        console.log('   3. Make sure your google_credentials.json file is valid');
        return { success: false, errors: [errorMsg] };
    }
}

// Run as a script if this file is executed directly
if (require.main === module) {
    main().then(result => {
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export { getGmailUsersFromConfig };
