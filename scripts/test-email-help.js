#!/usr/bin/env node

/**
 * Email Round Trip Testing Help Script
 */

const { runEmailRoundTripTests } = require('./run-email-round-trip-tests');

async function main() {
    await runEmailRoundTripTests('ALL', false, true);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
} 