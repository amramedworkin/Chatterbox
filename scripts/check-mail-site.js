#!/usr/bin/env node

/**
 * Check Mail Site Status
 * Checks if the mail site is running and returns UP or DOWN
 */

const { exec } = require('child_process');

function checkMailSite() {
    return new Promise((resolve, reject) => {
        // Check if there's a process running on port 3000 (mail site port)
        exec("lsof -i :3000", (error, stdout, stderr) => {
            if (error) {
                // No process found on port 3000
                resolve('DOWN');
            } else {
                // Process found on port 3000
                resolve('UP');
            }
        });
    });
}

async function main() {
    try {
        const status = await checkMailSite();
        console.log(`Mail Site is ${status}`);
        process.exit(status === 'UP' ? 0 : 1);
    } catch (error) {
        console.error('Error checking mail site status:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { checkMailSite }; 