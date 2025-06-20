// test/validateTokens.ts
// Test script for token validation functionality

import config from '../src/loadConfig';
import { validateAllGmailTokens, validateGmailToken } from '../src/mail/authorizeGmail';

async function testTokenValidation() {
    console.log('\n=== Gmail Token Validation Test ===\n');
    
    try {
        // Test validation for all configured Gmail users
        const results = await validateAllGmailTokens(config);
        
        console.log('Token Validation Results:');
        console.log('========================');
        
        for (const result of results) {
            console.log(`\n📧 Email: ${result.email}`);
            console.log(`   Token exists: ${result.hasToken ? '✅ Yes' : '❌ No'}`);
            console.log(`   Token valid: ${result.isValid ? '✅ Yes' : '❌ No'}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }
        
        // Summary
        const validTokens = results.filter(r => r.isValid).length;
        const totalTokens = results.length;
        
        console.log(`\n📊 Summary: ${validTokens}/${totalTokens} tokens are valid`);
        
        if (validTokens === totalTokens) {
            console.log('🎉 All tokens are valid and ready to use!');
        } else {
            console.log('⚠️  Some tokens need attention. Run: npm run mail:authorize');
        }
        
    } catch (error) {
        console.error('❌ Error during token validation:', error);
    }
}

// Test individual token validation
async function testIndividualToken(email: string) {
    console.log(`\n=== Individual Token Test for ${email} ===\n`);
    
    try {
        const result = await validateGmailToken(email, config);
        
        console.log(`📧 Email: ${result.email}`);
        console.log(`   Token exists: ${result.hasToken ? '✅ Yes' : '❌ No'}`);
        console.log(`   Token valid: ${result.isValid ? '✅ Yes' : '❌ No'}`);
        
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        
    } catch (error) {
        console.error('❌ Error during individual token validation:', error);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        // Test specific email
        await testIndividualToken(args[0]);
    } else {
        // Test all tokens
        await testTokenValidation();
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n=== Token validation test completed ===');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Failed to run token validation test:', error);
            process.exit(1);
        });
}

export { testTokenValidation, testIndividualToken }; 