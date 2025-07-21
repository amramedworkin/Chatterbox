#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building Lambda function...');

const lambdaDir = path.join(__dirname, '../../Cloud/AWS/terraform/modules/lambda/lambda');
const distDir = path.join(lambdaDir, 'dist');

// Clean previous build
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}

// Install dependencies if package.json exists
if (fs.existsSync(path.join(lambdaDir, 'package.json'))) {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { cwd: lambdaDir, stdio: 'inherit' });
}

// Compile TypeScript
console.log('⚙️  Compiling TypeScript...');
execSync('npm run build', { cwd: lambdaDir, stdio: 'inherit' });

// Create deployment package
console.log('📦 Creating deployment package...');
execSync('npm run package', { cwd: lambdaDir, stdio: 'inherit' });

console.log('✅ Lambda function built successfully!');
console.log('📁 Deployment package: Cloud/AWS/terraform/modules/lambda/lambda.zip');
