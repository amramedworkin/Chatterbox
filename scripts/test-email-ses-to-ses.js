#!/usr/bin/env node

/**
 * SES-to-SES Email Round Trip Testing Script
 */

const { runEmailRoundTripTests, TEST_TYPES } = require('./run-email-round-trip-tests');

async function main() {
    console.log('📧 SES-to-SES Email Round Trip Testing');
    console.log('=====================================\n');
    
    await runEmailRoundTripTests([TEST_TYPES.SES_TO_SES], true);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
} 