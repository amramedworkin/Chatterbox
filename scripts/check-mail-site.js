#!/usr/bin/env node

/**
 * Check Mail Site Status
 * Checks if the mail site is running and returns UP or DOWN
 */

const { exec } = require('child_process');

function checkMailSite() {
    return new Promise((resolve) => {
        exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000', (error, stdout) => {
            if (error) {
                resolve('DOWN');
            } else {
                resolve(stdout === '200' ? 'UP' : 'DOWN');
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
