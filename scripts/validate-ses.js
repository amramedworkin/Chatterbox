#!/usr/bin/env node

/**
 * SES Validation Script
 * Validates AWS SES setup and email verification status
 *
 * Usage:
 *   npm run aws:validate:ses          # Check SES setup and verification
 *   npm run aws:validate:ses --clean  # Check if SES is properly cleaned up
 */

const {
    SESClient,
    GetSendQuotaCommand,
    ListIdentitiesCommand,
    GetIdentityVerificationAttributesCommand,
} = require('@aws-sdk/client-ses');
const fs = require('fs');
const path = require('path');

// Configure AWS client
const config = { region: 'us-east-1' };
const ses = new SESClient(config);

const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const isCleanMode = process.argv.includes('--clean');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

function printStatus(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printInfo(message) {
    console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function printSection(message) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${message}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
}

function printSubsection(message) {
    console.log(`\n${colors.magenta}${'-'.repeat(40)}${colors.reset}`);
    console.log(`${colors.magenta}${message}${colors.reset}`);
    console.log(`${colors.magenta}${'-'.repeat(40)}${colors.reset}`);
}

// Function to get email addresses from config.json
function getConfigEmails() {
    const configPath = path.join(process.cwd(), 'config.json');
    
    if (!fs.existsSync(configPath)) {
        printWarning('config.json not found - cannot check expected email addresses');
        return [];
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const emails = [];

        // Extract email addresses from config
        if (config.app?.defaultPollGmailUser) {
            emails.push(config.app.defaultPollGmailUser);
        }
        if (config.app?.defaultSendGmailUser) {
            emails.push(config.app.defaultSendGmailUser);
        }
        if (config.app?.defaultGetGmailUser) {
            emails.push(config.app.defaultGetGmailUser);
        }
        if (config.sendTest?.defaultRecipient) {
            emails.push(config.sendTest.defaultRecipient);
        }

        // Remove duplicates
        return [...new Set(emails)];
    } catch (error) {
        printError(`Failed to parse config.json: ${error.message}`);
        return [];
    }
}

// Function to validate SES account status
async function validateSESAccount() {
    printSubsection('SES Account Status');
    
    try {
        const quota = await ses.send(new GetSendQuotaCommand({}));
        
        if (isCleanMode) {
            if (quota.SendingEnabled) {
                printError('SES account sending is still enabled');
                printInfo('Run: aws ses put-account-sending-enabled --enabled false');
                return false;
            } else {
                printStatus('SES account sending is properly disabled');
                printInfo('SES is in "Get Started" state');
                return true;
            }
        } else {
            if (quota.SendingEnabled) {
                printStatus(`SES account sending is enabled`);
                printInfo(`Daily limit: ${quota.Max24HourSend} emails`);
                printInfo(`Sent today: ${quota.SentLast24Hours} emails`);
                printInfo(`Sending rate: ${quota.MaxSendRate} emails/second`);
                return true;
            } else {
                printWarning('SES account sending is disabled');
                printInfo('SES is in "Get Started" state - needs setup');
                return false;
            }
        }
    } catch (error) {
        if (isCleanMode) {
            printStatus('SES not set up (properly cleaned up)');
            return true;
        } else {
            printError(`SES account validation failed: ${error.message}`);
            return false;
        }
    }
}

// Function to validate email verification
async function validateEmailVerification() {
    printSubsection('Email Verification Status');
    
    try {
        const identities = await ses.send(new ListIdentitiesCommand({ IdentityType: 'EmailAddress' }));
        
        if (!identities.Identities || identities.Identities.length === 0) {
            if (isCleanMode) {
                printStatus('No email identities found (properly cleaned up)');
                return true;
            } else {
                printWarning('No email identities found');
                printInfo('Run: npm run aws:setup:ses');
                return false;
            }
        }

        const verificationAttributes = await ses.send(
            new GetIdentityVerificationAttributesCommand({ Identities: identities.Identities })
        );

        const verifiedEmails = [];
        const unverifiedEmails = [];
        const pendingEmails = [];

        for (const email of identities.Identities) {
            const status = verificationAttributes.VerificationAttributes[email]?.VerificationStatus;
            if (status === 'Success') {
                verifiedEmails.push(email);
            } else if (status === 'Pending') {
                pendingEmails.push(email);
            } else {
                unverifiedEmails.push(email);
            }
        }

        if (isCleanMode) {
            if (verifiedEmails.length > 0) {
                printError(`${verifiedEmails.length} verified email addresses still exist`);
                for (const email of verifiedEmails) {
                    printInfo(`Remove: aws ses delete-identity --identity ${email}`);
                }
                return false;
            } else {
                printStatus('All verified email addresses properly removed');
                return true;
            }
        } else {
            // Check against config.json
            const configEmails = getConfigEmails();
            
            if (verifiedEmails.length > 0) {
                printStatus(`${verifiedEmails.length} verified email addresses found:`);
                for (const email of verifiedEmails) {
                    const isConfigEmail = configEmails.includes(email);
                    const status = isConfigEmail ? '✅' : '⚠️';
                    printInfo(`  ${status} ${email} ${isConfigEmail ? '(in config)' : '(not in config)'}`);
                }
            } else {
                printWarning('No verified email addresses found');
            }

            if (pendingEmails.length > 0) {
                printWarning(`${pendingEmails.length} pending verification emails:`);
                for (const email of pendingEmails) {
                    printInfo(`  ⏳ ${email} (check email for verification link)`);
                }
            }

            if (unverifiedEmails.length > 0) {
                printWarning(`${unverifiedEmails.length} unverified email addresses:`);
                for (const email of unverifiedEmails) {
                    printInfo(`  ❌ ${email}`);
                }
            }

            // Check if all config emails are verified
            const missingConfigEmails = configEmails.filter(email => !verifiedEmails.includes(email));
            if (missingConfigEmails.length > 0) {
                printWarning(`${missingConfigEmails.length} config emails not verified:`);
                for (const email of missingConfigEmails) {
                    printInfo(`  ❌ ${email}`);
                }
                printInfo('Run: npm run aws:setup:ses');
                return false;
            }

            return verifiedEmails.length > 0;
        }
    } catch (error) {
        printError(`Email verification validation failed: ${error.message}`);
        return false;
    }
}

// Function to validate SES production status
async function validateSESProductionStatus() {
    printSubsection('SES Production Status');
    
    try {
        const quota = await ses.send(new GetSendQuotaCommand({}));
        
        if (quota.SendingEnabled) {
            if (quota.Max24HourSend >= 50000) {
                printStatus('SES is in production mode');
                printInfo('Can send to any email address');
                printInfo('No email verification required for recipients');
                return true;
            } else {
                printWarning('SES is in sandbox mode');
                printInfo('Only verified email addresses can receive messages');
                printInfo('Request production access for higher limits');
                return false;
            }
        } else {
            printWarning('SES account sending is disabled');
            printInfo('Complete SES setup first');
            return false;
        }
    } catch (error) {
        printError(`SES production status validation failed: ${error.message}`);
        return false;
    }
}

// Main validation function
async function validateSES() {
    console.log(`🔍 SES Validation`);
    console.log(`Environment: ${ENVIRONMENT}`);
    console.log(`Mode: ${isCleanMode ? 'Clean' : 'Setup'}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    printSection('SES Validation');

    // Check AWS credentials
    printInfo('Checking AWS credentials...');
    try {
        await ses.send(new GetSendQuotaCommand({}));
        printStatus('AWS credentials verified');
    } catch (error) {
        printError('AWS credentials not configured or invalid');
        process.exit(1);
    }

    // Validate SES components
    const accountValid = await validateSESAccount();
    const emailValid = await validateEmailVerification();
    const productionValid = await validateSESProductionStatus();

    // Summary
    printSection('Validation Summary');
    
    if (isCleanMode) {
        if (accountValid && emailValid) {
            printStatus('SES cleanup validation passed');
            printInfo('All SES resources properly removed');
        } else {
            printError('SES cleanup validation failed');
            printInfo('Some SES resources still exist');
            process.exit(1);
        }
    } else {
        if (accountValid && emailValid) {
            printStatus('SES setup validation passed');
            if (productionValid) {
                printInfo('SES is ready for production use');
            } else {
                printInfo('SES is ready for sandbox use');
            }
        } else {
            printError('SES setup validation failed');
            printInfo('Run: npm run aws:setup:ses');
            process.exit(1);
        }
    }

    console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}📋 SES Validation Complete${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
}

if (require.main === module) {
    validateSES().catch((error) => {
        printError(`Validation failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { validateSES }; 