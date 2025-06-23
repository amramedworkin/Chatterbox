#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');

console.log(chalk.red('🗑️  AWS Infrastructure Teardown for Chatterbox\n'));

// Configuration
const AWS_DIR = path.join(__dirname, '../Cloud/AWS');
const TERRAFORM_DIR = path.join(AWS_DIR, 'terraform');
const ENVIRONMENTS_DIR = path.join(TERRAFORM_DIR, 'environments');

// Available environments
const ENVIRONMENTS = ['development', 'staging', 'production'];

// VPC infrastructure (shared across environments)
const VPC_INFRASTRUCTURE = {
  name: 'VPC Infrastructure',
  description: 'Shared VPC, networking, and core infrastructure',
  resources: [
    'VPC and Subnets',
    'Internet Gateway',
    'Route Tables',
    'Security Groups',
    'Network ACLs',
    'VPC Endpoints'
  ]
};

// Environment-specific resources
const ENVIRONMENT_RESOURCES = {
  development: {
    name: 'Development Environment',
    resources: [
      'DynamoDB Tables',
      'S3 Buckets',
      'Secrets Manager Secrets',
      'Parameter Store Parameters',
      'CloudWatch Log Groups',
      'IAM Roles and Policies'
    ]
  },
  staging: {
    name: 'Staging Environment',
    resources: [
      'DynamoDB Tables',
      'S3 Buckets',
      'Secrets Manager Secrets',
      'Parameter Store Parameters',
      'CloudWatch Log Groups',
      'IAM Roles and Policies'
    ]
  },
  production: {
    name: 'Production Environment',
    resources: [
      'DynamoDB Tables',
      'S3 Buckets',
      'Secrets Manager Secrets',
      'Parameter Store Parameters',
      'CloudWatch Log Groups',
      'IAM Roles and Policies'
    ]
  }
};

function checkPrerequisites() {
  try {
    // Check if AWS CLI is installed
    execSync('aws --version', { stdio: 'ignore' });
  } catch (error) {
    console.error(chalk.red('❌ AWS CLI is not installed or not in PATH'));
    process.exit(1);
  }

  try {
    // Check if Terraform is installed
    execSync('terraform --version', { stdio: 'ignore' });
  } catch (error) {
    console.error(chalk.red('❌ Terraform is not installed or not in PATH'));
    process.exit(1);
  }

  try {
    // Check if AWS credentials are configured
    execSync('aws sts get-caller-identity --profile cliadmin', { stdio: 'ignore' });
  } catch (error) {
    console.error(chalk.red('❌ AWS credentials not configured or invalid'));
    console.error(chalk.yellow('Please run: npm run aws:configure'));
    process.exit(1);
  }
}

function getEnvironmentStatus(environment) {
  try {
    const stateFile = path.join(TERRAFORM_DIR, 'environments', `${environment}.tfstate`);
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      return state.resources && state.resources.length > 0 ? 'Deployed' : 'Empty';
    }
    return 'Not Deployed';
  } catch (error) {
    return 'Unknown';
  }
}

function getVPCStatus() {
  try {
    const stateFile = path.join(TERRAFORM_DIR, 'terraform.tfstate');
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      return state.resources && state.resources.length > 0 ? 'Deployed' : 'Empty';
    }
    return 'Not Deployed';
  } catch (error) {
    return 'Unknown';
  }
}

function showWarning() {
  console.log(chalk.red('⚠️  CRITICAL WARNING: INFRASTRUCTURE DESTRUCTION'));
  console.log(chalk.red('='.repeat(60)));
  console.log(chalk.red('This operation will PERMANENTLY DELETE AWS resources.'));
  console.log(chalk.red('This action is IRREVERSIBLE and will result in:'));
  console.log('');
  console.log(chalk.yellow('• Complete loss of all data in DynamoDB tables'));
  console.log(chalk.yellow('• Permanent deletion of all S3 bucket contents'));
  console.log(chalk.yellow('• Removal of all secrets from Secrets Manager'));
  console.log(chalk.yellow('• Deletion of all configuration parameters'));
  console.log(chalk.yellow('• Loss of all CloudWatch logs and metrics'));
  console.log(chalk.yellow('• Removal of IAM roles and policies'));
  console.log(chalk.yellow('• Destruction of VPC and networking infrastructure'));
  console.log('');
  console.log(chalk.red('• NO BACKUP will be created automatically'));
  console.log(chalk.red('• NO RECOVERY is possible after deletion'));
  console.log(chalk.red('• All application data will be lost permanently'));
  console.log('');
  console.log(chalk.red('='.repeat(60)));
}

async function selectEnvironments() {
  const vpcStatus = getVPCStatus();
  
  // Get status for each environment
  const environmentChoices = ENVIRONMENTS.map(env => ({
    name: `${env.charAt(0).toUpperCase() + env.slice(1)} Environment (${getEnvironmentStatus(env)})`,
    value: env,
    checked: false
  }));

  // Add VPC infrastructure option
  const vpcChoice = {
    name: `${VPC_INFRASTRUCTURE.name} (${vpcStatus})`,
    value: 'vpc',
    checked: false
  };

  const questions = [
    {
      type: 'checkbox',
      name: 'selectedEnvironments',
      message: 'Select environments to teardown:',
      choices: [
        { name: 'Environments:', disabled: true },
        ...environmentChoices,
        { name: '', disabled: true },
        { name: 'Infrastructure:', disabled: true },
        vpcChoice
      ],
      validate: (input) => {
        if (input.length === 0) {
          return 'Please select at least one environment or infrastructure component to teardown.';
        }
        return true;
      }
    }
  ];

  const answers = await inquirer.default.prompt(questions);
  return answers.selectedEnvironments;
}

async function confirmTeardown(selectedEnvironments) {
  const environments = selectedEnvironments.filter(env => env !== 'vpc');
  const includeVPC = selectedEnvironments.includes('vpc');

  console.log(chalk.red('\n🗑️  TEARDOWN SUMMARY'));
  console.log(chalk.red('='.repeat(40)));

  if (environments.length > 0) {
    console.log(chalk.yellow('\nEnvironments to destroy:'));
    environments.forEach(env => {
      const envConfig = ENVIRONMENT_RESOURCES[env];
      console.log(chalk.yellow(`  • ${envConfig.name}`));
      envConfig.resources.forEach(resource => {
        console.log(chalk.gray(`    - ${resource}`));
      });
    });
  }

  if (includeVPC) {
    console.log(chalk.yellow('\nInfrastructure to destroy:'));
    console.log(chalk.yellow(`  • ${VPC_INFRASTRUCTURE.name}`));
    VPC_INFRASTRUCTURE.resources.forEach(resource => {
      console.log(chalk.gray(`    - ${resource}`));
    });
  }

  console.log(chalk.red('\n⚠️  FINAL CONFIRMATION'));
  console.log(chalk.red('This action cannot be undone. All data will be permanently lost.'));

  const confirmQuestions = [
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Are you absolutely sure you want to proceed with the teardown?',
      default: false
    }
  ];

  const confirmAnswers = await inquirer.default.prompt(confirmQuestions);

  if (!confirmAnswers.confirmed) {
    console.log(chalk.green('Teardown cancelled.'));
    process.exit(0);
  }

  // Final warning
  const finalQuestions = [
    {
      type: 'input',
      name: 'finalConfirm',
      message: 'Type "I WISH TO DELETE" to confirm permanent deletion:',
      validate: (input) => {
        if (input.toLowerCase() !== 'i wish to delete') {
          return 'Please type "I WISH TO DELETE" exactly to confirm.';
        }
        return true;
      }
    }
  ];

  await inquirer.default.prompt(finalQuestions);
  return true;
}

function teardownEnvironment(environment) {
  console.log(chalk.blue(`\n🗑️  Teardown ${environment} environment...`));
  
  try {
    // Change to terraform directory
    process.chdir(TERRAFORM_DIR);

    // Initialize Terraform if needed
    console.log(chalk.gray('  Initializing Terraform...'));
    execSync('terraform init', { stdio: 'pipe' });

    // Set environment variables
    const envFile = path.join(ENVIRONMENTS_DIR, `${environment}.tfvars`);
    if (!fs.existsSync(envFile)) {
      throw new Error(`Environment file not found: ${envFile}`);
    }

    // Plan destruction
    console.log(chalk.gray('  Planning destruction...'));
    execSync(`terraform plan -var-file="environments/${environment}.tfvars" -destroy`, { stdio: 'pipe' });

    // Apply destruction
    console.log(chalk.red('  Destroying infrastructure...'));
    execSync(`terraform apply -var-file="environments/${environment}.tfvars" -auto-approve`, { stdio: 'inherit' });

    console.log(chalk.green(`  ✅ ${environment} environment destroyed successfully`));
    return true;
  } catch (error) {
    console.error(chalk.red(`  ❌ Failed to destroy ${environment} environment: ${error.message}`));
    return false;
  }
}

function teardownVPC() {
  console.log(chalk.blue(`\n🗑️  Teardown VPC infrastructure...`));
  
  try {
    // Change to terraform directory
    process.chdir(TERRAFORM_DIR);

    // Initialize Terraform if needed
    console.log(chalk.gray('  Initializing Terraform...'));
    execSync('terraform init', { stdio: 'pipe' });

    // Plan destruction
    console.log(chalk.gray('  Planning VPC destruction...'));
    execSync('terraform plan -destroy', { stdio: 'pipe' });

    // Apply destruction
    console.log(chalk.red('  Destroying VPC infrastructure...'));
    execSync('terraform apply -auto-approve', { stdio: 'inherit' });

    console.log(chalk.green('  ✅ VPC infrastructure destroyed successfully'));
    return true;
  } catch (error) {
    console.error(chalk.red(`  ❌ Failed to destroy VPC infrastructure: ${error.message}`));
    return false;
  }
}

function cleanupStateFiles(selectedEnvironments) {
  console.log(chalk.blue('\n🧹 Cleaning up state files...'));
  
  const environments = selectedEnvironments.filter(env => env !== 'vpc');
  
  environments.forEach(environment => {
    const stateFile = path.join(TERRAFORM_DIR, 'environments', `${environment}.tfstate`);
    if (fs.existsSync(stateFile)) {
      try {
        fs.unlinkSync(stateFile);
        console.log(chalk.gray(`  Removed state file: ${environment}.tfstate`));
      } catch (error) {
        console.log(chalk.yellow(`  Warning: Could not remove state file: ${environment}.tfstate`));
      }
    }
  });

  if (selectedEnvironments.includes('vpc')) {
    const vpcStateFile = path.join(TERRAFORM_DIR, 'terraform.tfstate');
    if (fs.existsSync(vpcStateFile)) {
      try {
        fs.unlinkSync(vpcStateFile);
        console.log(chalk.gray('  Removed VPC state file: terraform.tfstate'));
      } catch (error) {
        console.log(chalk.yellow('  Warning: Could not remove VPC state file: terraform.tfstate'));
      }
    }
  }
}

async function main() {
  try {
    // Check prerequisites
    console.log(chalk.blue('🔍 Checking prerequisites...'));
    checkPrerequisites();
    console.log(chalk.green('✅ Prerequisites satisfied'));

    // Show warning
    showWarning();

    // Select environments
    const selectedEnvironments = await selectEnvironments();

    // Confirm teardown
    await confirmTeardown(selectedEnvironments);

    // Perform teardown
    console.log(chalk.red('\n🚨 STARTING INFRASTRUCTURE TEARDOWN'));
    console.log(chalk.red('='.repeat(50)));

    let successCount = 0;
    let totalCount = selectedEnvironments.length;

    // Teardown environments
    const environments = selectedEnvironments.filter(env => env !== 'vpc');
    for (const environment of environments) {
      if (teardownEnvironment(environment)) {
        successCount++;
      }
    }

    // Teardown VPC if selected
    if (selectedEnvironments.includes('vpc')) {
      if (teardownVPC()) {
        successCount++;
      }
    }

    // Cleanup state files
    cleanupStateFiles(selectedEnvironments);

    // Summary
    console.log(chalk.blue('\n📊 TEARDOWN SUMMARY'));
    console.log(chalk.blue('='.repeat(30)));
    console.log(chalk.green(`✅ Successfully destroyed: ${successCount}/${totalCount} components`));
    
    if (successCount === totalCount) {
      console.log(chalk.green('\n🎉 All selected infrastructure has been successfully destroyed.'));
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log(chalk.yellow('  • Verify resources are removed in AWS Console'));
      console.log(chalk.yellow('  • Consider removing AWS user if no longer needed'));
      console.log(chalk.yellow('  • Update documentation to reflect current state'));
    } else {
      console.log(chalk.red('\n⚠️  Some components failed to destroy.'));
      console.log(chalk.yellow('Please check the AWS Console and manually clean up if needed.'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Teardown operation failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(chalk.blue('AWS Infrastructure Teardown for Chatterbox'));
  console.log(chalk.gray('\nUsage:'));
  console.log(chalk.gray('  npm run aws:teardown'));
  console.log(chalk.gray('  node scripts/aws-teardown.js'));
  console.log('');
  console.log(chalk.blue('Description:'));
  console.log(chalk.gray('  Interactive teardown of AWS infrastructure with environment selection.'));
  console.log(chalk.gray('  Allows selective removal of environments and VPC infrastructure.'));
  console.log('');
  console.log(chalk.blue('Features:'));
  console.log(chalk.gray('  • Interactive environment selection with checkboxes'));
  console.log(chalk.gray('  • Comprehensive warnings and confirmations'));
  console.log(chalk.gray('  • Multiple confirmation levels including "I WISH TO DELETE"'));
  console.log(chalk.gray('  • Automatic VPC teardown when all environments selected'));
  console.log(chalk.gray('  • State file cleanup'));
  console.log(chalk.gray('  • Detailed progress reporting'));
  console.log('');
  console.log(chalk.red('⚠️  WARNING: This operation is irreversible and will destroy all data.'));
  process.exit(0);
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red('❌ Unexpected error:'));
  console.error(chalk.red(error.message));
  process.exit(1);
}); 