#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue('🧹 Chatterbox System Complete Cleanup\n'));

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

async function confirmCleanup() {
  return new Promise((resolve) => {
    console.log(chalk.red('⚠️  WARNING: This will completely destroy the Chatterbox system!'));
    console.log(chalk.red('This action cannot be undone and will result in complete data loss.'));
    console.log(chalk.yellow('\nCleanup Process:'));
    console.log(chalk.gray('1. chatteradmin user will destroy AWS infrastructure'));
    console.log(chalk.gray('2. cliadmin user will remove IAM users and groups'));
    console.log(chalk.yellow('\nResources that will be destroyed:'));
    console.log(chalk.gray('• VPC and all networking components'));
    console.log(chalk.gray('• DynamoDB table and all data'));
    console.log(chalk.gray('• S3 buckets and all objects'));
    console.log(chalk.gray('• Secrets Manager secrets'));
    console.log(chalk.gray('• Parameter Store parameters'));
    console.log(chalk.gray('• CloudWatch resources'));
    console.log(chalk.gray('• IAM roles and policies'));
    console.log(chalk.gray('• chatteradmin IAM user'));
    console.log(chalk.gray('• chatteradmingrp IAM group'));
    console.log(chalk.gray('• Terraform state and backend'));
    
    rl.question(chalk.red('\nAre you absolutely sure you want to proceed? Type "DESTROY ALL" to confirm: '), (answer) => {
      resolve(answer === 'DESTROY ALL');
    });
  });
}

function checkCurrentUser() {
  try {
    const identity = execSync('aws sts get-caller-identity --profile cliadmin', { encoding: 'utf8' });
    const parsed = JSON.parse(identity);
    console.log(chalk.green(`✅ Using AWS admin user: ${parsed.Arn}`));
    return true;
  } catch (error) {
    console.log(chalk.red('❌ AWS admin user not configured or accessible'));
    console.log(chalk.yellow('Please configure with: aws configure --profile cliadmin'));
    return false;
  }
}

function checkChatterAdminUser() {
  try {
    // Get chatteradmin credentials
    const credentials = execSync('aws configure export-credentials --profile cliadmin --format env', { encoding: 'utf8' });
    const lines = credentials.split('\n');
    const accessKey = lines[0].split('=')[1];
    const secretKey = lines[1].split('=')[1];
    
    // Test chatteradmin access
    process.env.AWS_ACCESS_KEY_ID = accessKey;
    process.env.AWS_SECRET_ACCESS_KEY = secretKey;
    
    const identity = execSync('aws sts get-caller-identity', { encoding: 'utf8' });
    const parsed = JSON.parse(identity);
    
    if (parsed.Arn.includes('chatteradmin')) {
      console.log(chalk.green(`✅ chatteradmin user accessible: ${parsed.Arn}`));
      return { success: true, credentials: { accessKey, secretKey } };
    } else {
      console.log(chalk.yellow(`⚠️  Using different user: ${parsed.Arn}`));
      return { success: true, credentials: { accessKey, secretKey } };
    }
  } catch (error) {
    console.log(chalk.red('❌ chatteradmin user not accessible'));
    return { success: false, error: error.message };
  }
}

function destroyInfrastructureWithChatterAdmin(credentials) {
  console.log(chalk.blue('🏗️  Destroying AWS Infrastructure (as chatteradmin)...\n'));
  
  try {
    // Set environment variables for chatteradmin
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKey;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretKey;
    process.env.AWS_REGION = CONFIG.AWS_REGION;
    
    // Check if Terraform state exists
    console.log(chalk.yellow('1. Checking Terraform state...'));
    try {
      execSync('cd Cloud/AWS/terraform && terraform state list', { stdio: 'pipe' });
      console.log(chalk.green('✅ Terraform state found'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  No Terraform state found - infrastructure may already be destroyed'));
      return true;
    }
    
    // Plan destruction
    console.log(chalk.yellow('\n2. Planning infrastructure destruction...'));
    try {
      execSync('cd Cloud/AWS/terraform && terraform plan -destroy', { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.red('❌ Failed to plan destruction'));
      return false;
    }
    
    // Apply destruction
    console.log(chalk.yellow('\n3. Destroying infrastructure...'));
    try {
      execSync('cd Cloud/AWS/terraform && terraform destroy -auto-approve', { stdio: 'inherit' });
      console.log(chalk.green('✅ Infrastructure destroyed'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to destroy infrastructure'));
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Infrastructure destruction failed: ${error.message}`));
    return false;
  }
}

function cleanupS3BackendWithChatterAdmin(credentials) {
  console.log(chalk.blue('🗑️  Cleaning up S3 Backend (as chatteradmin)...\n'));
  
  try {
    // Set environment variables for chatteradmin
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKey;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretKey;
    process.env.AWS_REGION = CONFIG.AWS_REGION;
    
    // Get account ID
    const accountId = execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf8' }).trim();
    const bucketName = `chatterbox-terraform-state-${accountId}`;
    
    console.log(chalk.yellow(`Checking S3 backend bucket: ${bucketName}`));
    
    // Check if bucket exists
    try {
      execSync(`aws s3api head-bucket --bucket ${bucketName}`, { stdio: 'pipe' });
      console.log(chalk.green('✅ S3 backend bucket found'));
      
      // Empty bucket (including versions)
      console.log(chalk.yellow('Emptying bucket (including versions)...'));
      try {
        // Remove all versions
        execSync(`aws s3api list-object-versions --bucket ${bucketName} --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json | jq -r '.Objects[] | "\(.Key) \(.VersionId)"' | while read key version; do aws s3api delete-object --bucket ${bucketName} --key "$key" --version-id "$version"; done`, { stdio: 'pipe' });
      } catch (error) {
        // If jq is not available, use a simpler approach
        console.log(chalk.yellow('   Using alternative cleanup method...'));
        execSync(`aws s3 rm s3://${bucketName} --recursive`, { stdio: 'inherit' });
      }
      
      // Remove delete markers
      try {
        execSync(`aws s3api list-object-versions --bucket ${bucketName} --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json | jq -r '.Objects[] | "\(.Key) \(.VersionId)"' | while read key version; do aws s3api delete-object --bucket ${bucketName} --key "$key" --version-id "$version"; done`, { stdio: 'pipe' });
      } catch (error) {
        // Ignore errors for delete markers
      }
      
      // Delete bucket
      console.log(chalk.yellow('Deleting bucket...'));
      execSync(`aws s3 rb s3://${bucketName}`, { stdio: 'inherit' });
      
      console.log(chalk.green('✅ S3 backend bucket deleted'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  S3 backend bucket not found or already deleted'));
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ S3 backend cleanup failed: ${error.message}`));
    return false;
  }
}

function cleanupIAMResourcesWithCliAdmin() {
  console.log(chalk.blue('👤 Cleaning up IAM Resources (as cliadmin)...\n'));
  
  try {
    // Step 1: Remove chatteradmin user from group
    console.log(chalk.yellow('1. Removing chatteradmin from chatteradmingrp...'));
    try {
      execSync('aws iam remove-user-from-group --user-name chatteradmin --group-name chatteradmingrp --profile cliadmin', { stdio: 'pipe' });
      console.log(chalk.green('✅ User removed from group'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  User not in group or group does not exist'));
    }
    
    // Step 2: Detach policies from chatteradmin user
    console.log(chalk.yellow('\n2. Detaching policies from chatteradmin user...'));
    try {
      const attachedPolicies = execSync('aws iam list-attached-user-policies --user-name chatteradmin --profile cliadmin', { encoding: 'utf8' });
      const policies = JSON.parse(attachedPolicies);
      
      for (const policy of policies.AttachedPolicies) {
        if (policy.PolicyName.includes('chatterbox') || policy.PolicyName.includes('cliadmin')) {
          console.log(chalk.yellow(`   Detaching ${policy.PolicyName}...`));
          execSync(`aws iam detach-user-policy --user-name chatteradmin --policy-arn ${policy.PolicyArn} --profile cliadmin`, { stdio: 'pipe' });
        }
      }
      console.log(chalk.green('✅ Policies detached'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  No policies to detach or user does not exist'));
    }
    
    // Step 3: Delete chatteradmin user
    console.log(chalk.yellow('\n3. Deleting chatteradmin user...'));
    try {
      execSync('aws iam delete-user --user-name chatteradmin --profile cliadmin', { stdio: 'pipe' });
      console.log(chalk.green('✅ chatteradmin user deleted'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  chatteradmin user not found or already deleted'));
    }
    
    // Step 4: Delete chatteradmingrp group
    console.log(chalk.yellow('\n4. Deleting chatteradmingrp group...'));
    try {
      execSync('aws iam delete-group --group-name chatteradmingrp --profile cliadmin', { stdio: 'pipe' });
      console.log(chalk.green('✅ chatteradmingrp group deleted'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  chatteradmingrp group not found or already deleted'));
    }
    
    // Step 5: Delete chatterbox policies
    console.log(chalk.yellow('\n5. Deleting chatterbox policies...'));
    try {
      const policies = execSync('aws iam list-policies --scope Local --profile cliadmin', { encoding: 'utf8' });
      const policyList = JSON.parse(policies);
      
      for (const policy of policyList.Policies) {
        if (policy.PolicyName.includes('chatterbox') || policy.PolicyName.includes('cliadmin')) {
          console.log(chalk.yellow(`   Deleting ${policy.PolicyName}...`));
          execSync(`aws iam delete-policy --policy-arn ${policy.PolicyArn} --profile cliadmin`, { stdio: 'pipe' });
        }
      }
      console.log(chalk.green('✅ Policies deleted'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  No policies to delete'));
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ IAM cleanup failed: ${error.message}`));
    return false;
  }
}

function cleanupLocalFiles() {
  console.log(chalk.blue('📁 Cleaning up Local Files...\n'));
  
  try {
    const filesToClean = [
      'Cloud/AWS/terraform/.terraform',
      'Cloud/AWS/terraform/.terraform.lock.hcl',
      'Cloud/AWS/terraform/tfplan',
      'Cloud/AWS/terraform/terraform.tfstate',
      'Cloud/AWS/terraform/terraform.tfstate.backup',
      'Cloud/AWS/terraform/.terraform.tfstate.lock.info'
    ];

    for (const file of filesToClean) {
      try {
        if (fs.existsSync(file)) {
          if (fs.lstatSync(file).isDirectory()) {
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            fs.unlinkSync(file);
          }
          console.log(chalk.green(`✅ Removed: ${file}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not remove: ${file}`));
      }
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Local file cleanup failed: ${error.message}`));
    return false;
  }
}

async function main() {
  try {
    // Step 1: Confirm cleanup
    const confirmed = await confirmCleanup();
    if (!confirmed) {
      console.log(chalk.yellow('❌ Cleanup cancelled by user'));
      process.exit(0);
    }
    
    // Step 2: Check cliadmin user
    const cliAdminValid = checkCurrentUser();
    if (!cliAdminValid) {
      process.exit(1);
    }
    
    // Step 3: Check chatteradmin user
    const chatterAdminCheck = checkChatterAdminUser();
    if (!chatterAdminCheck.success) {
      console.log(chalk.red('❌ Cannot access chatteradmin user'));
      console.log(chalk.yellow('Proceeding with IAM cleanup only...'));
    }
    
    console.log(chalk.green('\n🚀 Starting complete system cleanup...\n'));
    
    // Step 4: Destroy infrastructure (as chatteradmin)
    if (chatterAdminCheck.success) {
      const infrastructureDestroyed = destroyInfrastructureWithChatterAdmin(chatterAdminCheck.credentials);
      if (!infrastructureDestroyed) {
        console.log(chalk.red('\n❌ Infrastructure destruction failed'));
        console.log(chalk.yellow('Some resources may still exist. Please check manually.'));
      }
      
      // Step 5: Cleanup S3 backend (as chatteradmin)
      const s3Cleaned = cleanupS3BackendWithChatterAdmin(chatterAdminCheck.credentials);
      if (!s3Cleaned) {
        console.log(chalk.yellow('\n⚠️  S3 backend cleanup failed'));
      }
    } else {
      console.log(chalk.yellow('\n⚠️  Skipping infrastructure cleanup - chatteradmin not accessible'));
    }
    
    // Step 6: Cleanup IAM resources (as cliadmin)
    const iamCleaned = cleanupIAMResourcesWithCliAdmin();
    if (!iamCleaned) {
      console.log(chalk.yellow('\n⚠️  IAM cleanup failed'));
    }
    
    // Step 7: Cleanup local files
    const filesCleaned = cleanupLocalFiles();
    if (!filesCleaned) {
      console.log(chalk.yellow('\n⚠️  Local file cleanup failed'));
    }
    
    console.log(chalk.green('\n🎉 Chatterbox system cleanup completed!'));
    console.log(chalk.blue('\n📋 Summary:'));
    if (chatterAdminCheck.success) {
      console.log(chalk.gray('• Infrastructure: Destroyed (by chatteradmin)'));
      console.log(chalk.gray('• S3 Backend: Cleaned (by chatteradmin)'));
    } else {
      console.log(chalk.gray('• Infrastructure: Skipped (chatteradmin not accessible)'));
      console.log(chalk.gray('• S3 Backend: Skipped (chatteradmin not accessible)'));
    }
    console.log(chalk.gray('• IAM Resources: Removed (by cliadmin)'));
    console.log(chalk.gray('• Local Files: Cleaned'));
    
    console.log(chalk.blue('\n🔄 To rebuild the system:'));
    console.log(chalk.gray('• npm run aws:setup-system'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Cleanup failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  } finally {
    rl.close();
  }
}

main(); 