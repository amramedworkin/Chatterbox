#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LAMBDA_DIR = path.join(__dirname, '../../Cloud/AWS/terraform/modules/lambda/lambda');
const LAMBDA_ZIP_PATH = path.join(__dirname, '../../Cloud/AWS/terraform/modules/lambda/lambda.zip');

console.log('🔨 Building Lambda function...');

try {
    // Check if Lambda directory exists
    if (!fs.existsSync(LAMBDA_DIR)) {
        console.error('❌ Lambda directory not found:', LAMBDA_DIR);
        process.exit(1);
    }

    // Change to Lambda directory
    process.chdir(LAMBDA_DIR);
    console.log('📁 Changed to Lambda directory:', LAMBDA_DIR);

    // Install dependencies
    console.log('📦 Installing dependencies...');
    execSync('npm install --production', { stdio: 'inherit' });

    // Go back to project root
    process.chdir(path.join(__dirname, '../..'));

    // Create deployment package
    console.log('📦 Creating deployment package...');
    execSync(`cd "${LAMBDA_DIR}" && zip -r "${LAMBDA_ZIP_PATH}" . -x "*.git*" "node_modules/.cache/*"`, { 
        stdio: 'inherit',
        shell: true 
    });

    // Check if zip was created
    if (fs.existsSync(LAMBDA_ZIP_PATH)) {
        const stats = fs.statSync(LAMBDA_ZIP_PATH);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`✅ Lambda deployment package created: ${LAMBDA_ZIP_PATH} (${sizeInMB} MB)`);
    } else {
        console.error('❌ Failed to create Lambda deployment package');
        process.exit(1);
    }

    console.log('🎉 Lambda build completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: npm run aws:plan');
    console.log('2. Run: npm run aws:apply:auto');
    console.log('3. Test the API: curl <api-gateway-url>/email/<gmail-id>');

} catch (error) {
    console.error('❌ Error building Lambda function:', error.message);
    process.exit(1);
} 