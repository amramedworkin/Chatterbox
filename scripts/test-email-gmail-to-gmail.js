#!/usr/bin/env node

/**
 * Gmail-to-Gmail Email Round Trip Testing Script
 */

const { runEmailRoundTripTests, TEST_TYPES } = require('./run-email-round-trip-tests');

async function main() {
    console.log('📧 Gmail-to-Gmail Email Round Trip Testing');
    console.log('=========================================\n');
    
    await runEmailRoundTripTests([TEST_TYPES.GMAIL_TO_GMAIL], true);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
} 