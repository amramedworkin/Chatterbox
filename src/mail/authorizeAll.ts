// src/mail/authorizeAll.ts
// Centralized Gmail authorization for all Chatterbox subsystems

import config from '../loadConfig';
import { authorizeGmail } from './authorizeGmail';
import { OAuth2Client } from 'googleapis-common';

// Helper function to generate timestamp in yyyymmdd_hhmmss format
function generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

interface EmailPurpose {
    email: string;
    purpose: string;
    scopes: string[];
    source: string; // Where the email came from in config
    required: boolean; // Whether this email is required or optional
}

interface AuthResult {
    email: string;
    purpose: string;
    source: string;
    required: boolean;
    success: boolean;
    authenticated: boolean;
    timestamp: string;
    error?: string;
}

/**
 * Gets all unique Gmail users from the config and their purposes
 * @returns Array of email purposes
 */
function getGmailUsersFromConfig(): EmailPurpose[] {
    const users: EmailPurpose[] = [];
    const seenEmails = new Set<string>();

    // Add poll Gmail user (required)
    if (config.app.defaultPollGmailUser && !seenEmails.has(config.app.defaultPollGmailUser)) {
        users.push({
            email: config.app.defaultPollGmailUser,
            purpose: 'Gmail polling (monitoring incoming emails)',
            scopes: config.google.scopes,
            source: 'app.defaultPollGmailUser',
            required: true,
        });
        seenEmails.add(config.app.defaultPollGmailUser);
    }

    // Add send Gmail user (required)
    if (config.app.defaultSendGmailUser && !seenEmails.has(config.app.defaultSendGmailUser)) {
        users.push({
            email: config.app.defaultSendGmailUser,
            purpose: 'Gmail sending (outgoing emails)',
            scopes: config.sendTest.scopes,
            source: 'app.defaultSendGmailUser',
            required: true,
        });
        seenEmails.add(config.app.defaultSendGmailUser);
    }

    // Add get Gmail user (required)
    if (config.app.defaultGetGmailUser && !seenEmails.has(config.app.defaultGetGmailUser)) {
        users.push({
            email: config.app.defaultGetGmailUser,
            purpose: 'Gmail retrieval (reading emails)',
            scopes: config.google.scopes,
            source: 'app.defaultGetGmailUser',
            required: true,
        });
        seenEmails.add(config.app.defaultGetGmailUser);
    }

    // Add optional emails
    if (config.google.optionalEmails) {
        for (const email of config.google.optionalEmails) {
            if (!seenEmails.has(email)) {
                users.push({
                    email: email,
                    purpose: 'Optional Gmail access',
                    scopes: config.google.scopes,
                    source: 'google.optionalEmails',
                    required: false,
                });
                seenEmails.add(email);
            }
        }
    }

    return users;
}

/**
 * Authorizes all Gmail users defined in the config
 * @param forceReauthorize If true, forces re-authorization for all users
 * @returns Promise resolving to a map of email to OAuth2Client and auth results
 */
export async function authorizeAllGmailUsers(
    forceReauthorize = false
): Promise<{ clients: Map<string, OAuth2Client>; results: AuthResult[] }> {
    const users = getGmailUsersFromConfig();
    const authorizedClients = new Map<string, OAuth2Client>();
    const authResults: AuthResult[] = [];

    console.log('\n=== Gmail Authorization for Chatterbox ===\n');

    if (users.length === 0) {
        console.log('No Gmail users found in configuration.');
        return { clients: authorizedClients, results: authResults };
    }

    console.log(`Found ${users.length} Gmail user(s) to authorize:\n`);

    for (const user of users) {
        console.log(`📧 Email: ${user.email}`);
        console.log(`🎯 Purpose: ${user.purpose}`);
        console.log(`🔑 Scopes: ${user.scopes.join(', ')}`);
        console.log(`📋 Source: ${user.source}`);
        console.log(`⚡ Required: ${user.required ? 'Yes' : 'No'}`);
        console.log('');

        const timestamp = generateTimestamp();
        let authResult: AuthResult;

        try {
            console.log(`🔄 Authorizing ${user.email}...`);
            const authClient = await authorizeGmail(user.email, config, forceReauthorize);
            authorizedClients.set(user.email, authClient);
            console.log(`✅ Successfully authorized ${user.email}\n`);
            
            authResult = {
                email: user.email,
                purpose: user.purpose,
                source: user.source,
                required: user.required,
                success: true,
                authenticated: true,
                timestamp: timestamp,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to authorize ${user.email}: ${errorMsg}\n`);
            
            authResult = {
                email: user.email,
                purpose: user.purpose,
                source: user.source,
                required: user.required,
                success: false,
                authenticated: false,
                timestamp: timestamp,
                error: errorMsg,
            };

            // If this is a required email, throw the error
            if (user.required) {
                throw new Error(`Authorization failed for required email ${user.email}: ${errorMsg}`);
            }
            // For optional emails, continue with other authentications
        }

        authResults.push(authResult);
    }

    // Print state summary
    printAuthStateSummary(authResults);

    console.log('=== Gmail Authorization Summary ===\n');
    return { clients: authorizedClients, results: authResults };
}

/**
 * Prints a comprehensive state summary of all authentication attempts
 */
function printAuthStateSummary(results: AuthResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 AUTHENTICATION STATE SUMMARY');
    console.log('='.repeat(80));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const required = results.filter(r => r.required);
    const optional = results.filter(r => !r.required);

    console.log(`\n📊 OVERVIEW:`);
    console.log(`   Total emails processed: ${results.length}`);
    console.log(`   Successful authentications: ${successful.length}`);
    console.log(`   Failed authentications: ${failed.length}`);
    console.log(`   Required emails: ${required.length}`);
    console.log(`   Optional emails: ${optional.length}`);

    if (successful.length > 0) {
        console.log(`\n✅ SUCCESSFULLY AUTHENTICATED:`);
        successful.forEach(result => {
            console.log(`   📧 ${result.email}`);
            console.log(`      Source: ${result.source}`);
            console.log(`      Purpose: ${result.purpose}`);
            console.log(`      Required: ${result.required ? 'Yes' : 'No'}`);
            console.log(`      Timestamp: ${result.timestamp}`);
            console.log('');
        });
    }

    if (failed.length > 0) {
        console.log(`\n❌ FAILED AUTHENTICATIONS:`);
        failed.forEach(result => {
            console.log(`   📧 ${result.email}`);
            console.log(`      Source: ${result.source}`);
            console.log(`      Purpose: ${result.purpose}`);
            console.log(`      Required: ${result.required ? 'Yes' : 'No'}`);
            console.log(`      Timestamp: ${result.timestamp}`);
            console.log(`      Error: ${result.error}`);
            console.log('');
        });
    }

    // Check for optional authentication failures
    const failedOptional = failed.filter(r => !r.required);
    if (failedOptional.length > 0) {
        console.log(`\n⚠️  WARNING: ${failedOptional.length} optional email(s) were not authenticated:`);
        failedOptional.forEach(result => {
            console.log(`   - ${result.email} (${result.source})`);
        });
        console.log(`   These failures do not prevent the system from functioning.`);
    }

    console.log('\n' + '='.repeat(80));
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
