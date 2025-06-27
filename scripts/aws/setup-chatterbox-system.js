#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue('🚀 Chatterbox System Setup Orchestrator\n'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const CONFIG = {
  AWS_REGION: 'us-east-1',
  CHATTER_GROUP_NAME: 'chatteradmingrp',
  CHATTER_USER_NAME: 'chatteradmin',
  SYSTEM_PREFIX: 'chatterbox'
};

// Prerequisites checklist
const PREREQUISITES = [
  {
    name: 'AWS Admin User',
    description: 'Existing AWS user with permissions to create IAM users and groups',
    check: () => checkAwsAdminUser(),
    required: true
  },
  {
    name: 'GCP Account',
    description: 'Google Cloud Platform account for Gmail API access',
    check: () => checkGcpAccount(),
    required: true
  },
  {
    name: 'Gmail API Credentials',
    description: 'Gmail API OAuth2 credentials (client_id, client_secret)',
    check: () => checkGmailCredentials(),
    required: true
  },
  {
    name: 'Email Addresses',
    description: 'Email addresses for polling, sending, and testing',
    check: () => checkEmailAddresses(),
    required: true
  },
  {
    name: 'OpenAI API Account',
    description: 'OpenAI account with API access',
    check: () => checkOpenAIAccount(),
    required: true
  },
  {
    name: 'OpenAI API Key',
    description: 'Valid OpenAI API key',
    check: () => checkOpenAIKey(),
    required: true
  },
  {
    name: 'Terraform',
    description: 'Terraform CLI tool',
    check: () => checkTool('terraform --version'),
    required: true
  },
  {
    name: 'AWS CLI',
    description: 'AWS Command Line Interface',
    check: () => checkTool('aws --version'),
    required: true
  }
];

// Utility functions
function checkTool(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function checkAwsAdminUser() {
  try {
    const identity = execSync('aws sts get-caller-identity --profile cliadmin', { encoding: 'utf8' });
    const parsed = JSON.parse(identity);
    return { 
      success: true, 
      details: `Account: ${parsed.Account}, User: ${parsed.Arn}` 
    };
  } catch (error) {
    return { success: false, error: 'AWS admin user not configured. Run: aws configure --profile cliadmin' };
  }
}

function checkGcpAccount() {
  return new Promise((resolve) => {
    rl.question(chalk.yellow('Do you have a GCP account with Gmail API enabled? (y/N): '), (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        resolve({ success: true });
      } else {
        resolve({ 
          success: false, 
          error: 'GCP account required. Visit: https://console.cloud.google.com/' 
        });
      }
    });
  });
}

function checkGmailCredentials() {
  return new Promise((resolve) => {
    rl.question(chalk.yellow('Do you have Gmail API OAuth2 credentials (client_id, client_secret)? (y/N): '), (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        resolve({ success: true });
      } else {
        resolve({ 
          success: false, 
          error: 'Gmail API credentials required. Visit: https://console.developers.google.com/' 
        });
      }
    });
  });
}

function checkEmailAddresses() {
  return new Promise((resolve) => {
    rl.question(chalk.yellow('Do you have email addresses for polling, sending, and testing? (y/N): '), (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        resolve({ success: true });
      } else {
        resolve({ 
          success: false, 
          error: 'Email addresses required for system operation' 
        });
      }
    });
  });
}

function checkOpenAIAccount() {
  return new Promise((resolve) => {
    rl.question(chalk.yellow('Do you have an OpenAI account with API access? (y/N): '), (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        resolve({ success: true });
      } else {
        resolve({ 
          success: false, 
          error: 'OpenAI account required. Visit: https://platform.openai.com/' 
        });
      }
    });
  });
}

function checkOpenAIKey() {
  return new Promise((resolve) => {
    rl.question(chalk.yellow('Do you have a valid OpenAI API key? (y/N): '), (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        resolve({ success: true });
      } else {
        resolve({ 
          success: false, 
          error: 'OpenAI API key required. Visit: https://platform.openai.com/api-keys' 
        });
      }
    });
  });
}

async function checkPrerequisites() {
  console.log(chalk.blue('🔍 Checking Prerequisites...\n'));
  
  let allPassed = true;
  const results = [];
  
  for (const prereq of PREREQUISITES) {
    console.log(chalk.yellow(`Checking ${prereq.name}...`));
    
    const result = await prereq.check();
    results.push({ ...prereq, result });
    
    if (result.success) {
      console.log(chalk.green(`✅ ${prereq.name}: ${result.details || 'Available'}`));
    } else {
      console.log(chalk.red(`❌ ${prereq.name}: ${result.error}`));
      if (prereq.required) {
        allPassed = false;
      }
    }
    console.log('');
  }
  
  return { allPassed, results };
}

function checkExistingChatterSystem() {
  console.log(chalk.blue('🔍 Checking for existing Chatterbox system...\n'));
  
  try {
    // Check if chatteradmin user exists
    const userExists = execSync('aws iam get-user --user-name chatteradmin --profile cliadmin', { stdio: 'pipe' });
    console.log(chalk.green('✅ chatteradmin user exists'));
    
    // Check if chatteradmingrp group exists
    const groupExists = execSync('aws iam get-group --group-name chatteradmingrp --profile cliadmin', { stdio: 'pipe' });
    console.log(chalk.green('✅ chatteradmingrp group exists'));
    
    // Check if user is in group
    const userGroups = execSync('aws iam list-groups-for-user --user-name chatteradmin --profile cliadmin', { encoding: 'utf8' });
    const groups = JSON.parse(userGroups);
    const inGroup = groups.Groups.some(g => g.GroupName === 'chatteradmingrp');
    
    if (inGroup) {
      console.log(chalk.green('✅ chatteradmin user is member of chatteradmingrp group'));
      return { exists: true, complete: true };
    } else {
      console.log(chalk.yellow('⚠️  chatteradmin user exists but is not in chatteradmingrp group'));
      return { exists: true, complete: false };
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Chatterbox system does not exist or is incomplete'));
    return { exists: false, complete: false };
  }
}

function createChatterSystem() {
  console.log(chalk.blue('🔧 Creating Chatterbox system...\n'));
  
  try {
    // Step 1: Create admin group
    console.log(chalk.yellow('1. Creating chatteradmingrp group...'));
    execSync('node scripts/aws/create-admin-group.js', { stdio: 'inherit' });
    console.log(chalk.green('✅ Admin group created'));
    
    // Step 2: Create admin user
    console.log(chalk.yellow('\n2. Creating chatteradmin user...'));
    execSync('node scripts/aws/add-admin-user.js', { stdio: 'inherit' });
    console.log(chalk.green('✅ Admin user created'));
    
    // Step 3: Fix permissions
    console.log(chalk.yellow('\n3. Setting up permissions...'));
    execSync('node scripts/aws/fix-cliadmin-permissions.js', { stdio: 'inherit' });
    console.log(chalk.green('✅ Permissions configured'));
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to create Chatterbox system: ${error.message}`));
    return false;
  }
}

function deployInfrastructure() {
  console.log(chalk.blue('🏗️  Deploying AWS Infrastructure...\n'));
  
  try {
    // Step 1: Setup backend
    console.log(chalk.yellow('1. Setting up Terraform backend...'));
    execSync('node scripts/aws/setup-backend.js', { stdio: 'inherit' });
    console.log(chalk.green('✅ Backend configured'));
    
    // Step 2: Initialize Terraform
    console.log(chalk.yellow('\n2. Initializing Terraform...'));
    execSync('cd Cloud/AWS/terraform && terraform init', { stdio: 'inherit' });
    console.log(chalk.green('✅ Terraform initialized'));
    
    // Step 3: Plan deployment
    console.log(chalk.yellow('\n3. Planning deployment...'));
    execSync('cd Cloud/AWS/terraform && terraform plan -out=tfplan', { stdio: 'inherit' });
    console.log(chalk.green('✅ Deployment planned'));
    
    // Step 4: Apply deployment
    console.log(chalk.yellow('\n4. Applying deployment...'));
    execSync('cd Cloud/AWS/terraform && terraform apply tfplan', { stdio: 'inherit' });
    console.log(chalk.green('✅ Infrastructure deployed'));
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Failed to deploy infrastructure: ${error.message}`));
    return false;
  }
}

function testSystem() {
  console.log(chalk.blue('🧪 Testing Chatterbox system...\n'));
  
  try {
    // Set environment variables for chatteradmin
    const credentials = execSync('aws configure export-credentials --profile cliadmin --format env', { encoding: 'utf8' });
    const lines = credentials.split('\n');
    const accessKey = lines[0].split('=')[1];
    const secretKey = lines[1].split('=')[1];
    
    process.env.AWS_ACCESS_KEY_ID = accessKey;
    process.env.AWS_SECRET_ACCESS_KEY = secretKey;
    
    // Run admin permissions test
    console.log(chalk.yellow('Testing admin permissions...'));
    execSync('node scripts/aws/test-admin-permissions.js', { stdio: 'inherit' });
    console.log(chalk.green('✅ System tests passed'));
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ System tests failed: ${error.message}`));
    return false;
  }
}

async function main() {
  try {
    // Step 1: Check prerequisites
    const prereqResult = await checkPrerequisites();
    if (!prereqResult.allPassed) {
      console.log(chalk.red('\n❌ Prerequisites not met. Please address the issues above before proceeding.'));
      process.exit(1);
    }
    
    console.log(chalk.green('\n🎉 All prerequisites are met!\n'));
    
    // Step 2: Check existing system
    const existingSystem = checkExistingChatterSystem();
    
    if (existingSystem.exists && existingSystem.complete) {
      console.log(chalk.green('\n✅ Chatterbox system already exists and is complete!'));
      console.log(chalk.blue('\nNext steps:'));
      console.log(chalk.gray('• Test the system: npm run aws:admin:test-user'));
      console.log(chalk.gray('• Deploy infrastructure: npm run aws:deploy'));
      return;
    }
    
    if (existingSystem.exists && !existingSystem.complete) {
      console.log(chalk.yellow('\n⚠️  Chatterbox system exists but is incomplete. Completing setup...'));
    } else {
      console.log(chalk.blue('\n🔧 Creating new Chatterbox system...'));
    }
    
    // Step 3: Create/complete Chatterbox system
    const systemCreated = createChatterSystem();
    if (!systemCreated) {
      console.log(chalk.red('\n❌ Failed to create Chatterbox system.'));
      process.exit(1);
    }
    
    console.log(chalk.green('\n✅ Chatterbox system created successfully!'));
    
    // Step 4: Deploy infrastructure (optional)
    console.log(chalk.blue('\n🏗️  Infrastructure Deployment'));
    console.log(chalk.yellow('Do you want to deploy the AWS infrastructure now? (y/N): '));
    
    const deployNow = await new Promise((resolve) => {
      rl.question('', (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    if (deployNow) {
      const infrastructureDeployed = deployInfrastructure();
      if (!infrastructureDeployed) {
        console.log(chalk.red('\n❌ Failed to deploy infrastructure.'));
        console.log(chalk.yellow('You can deploy later with: npm run aws:deploy'));
      } else {
        // Step 5: Test system
        const systemTested = testSystem();
        if (!systemTested) {
          console.log(chalk.red('\n❌ System tests failed.'));
        } else {
          console.log(chalk.green('\n🎉 Chatterbox system setup completed successfully!'));
        }
      }
    } else {
      console.log(chalk.blue('\n📋 Setup Summary:'));
      console.log(chalk.green('✅ Chatterbox system created'));
      console.log(chalk.yellow('⏳ Infrastructure deployment pending'));
      console.log(chalk.blue('\nNext steps:'));
      console.log(chalk.gray('• Deploy infrastructure: npm run aws:deploy'));
      console.log(chalk.gray('• Test system: npm run aws:admin:test-user'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  } finally {
    rl.close();
  }
}

main(); 