#!/usr/bin/env node

/**
 * Bounce Mail Site
 * Stops the mail site if running, then starts it
 */

const { exec } = require('child_process');
const { checkMailSite } = require('./check-mail-site.js');

function stopMailSite() {
    return new Promise((resolve) => {
        exec("pkill -f 'http-server.*3000' || pkill -f 'python3.*http-server.3000'", () => {
            // Don't treat error as failure since the process might not be running
            resolve();
        });
    });
}

function startMailSite() {
    return new Promise((resolve, reject) => {
        exec('bin/serve-tokensite.zsh', (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

async function bounceMailSite() {
    try {
        console.log('Checking mail site status...');
        const status = await checkMailSite();

        if (status === 'UP') {
            console.log('Mail site is running. Stopping...');
            await stopMailSite();
            // Wait a moment for the process to fully stop
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
            console.log('Mail site is not running.');
        }

        console.log('Starting mail site...');
        await startMailSite();

        // Wait a moment and check if it started successfully
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const newStatus = await checkMailSite();

        if (newStatus === 'UP') {
            console.log('Mail site bounced successfully and is now UP');
        } else {
            console.log('Mail site bounce completed but status check shows DOWN');
        }
    } catch (error) {
        // eslint-disable-next-line no-unused-vars
        console.error('Error bouncing mail site:', error.message);
        throw error;
    }
}

async function main() {
    try {
        await bounceMailSite();
        process.exit(0);
    } catch (error) {
        console.error('Failed to bounce mail site:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { bounceMailSite };
