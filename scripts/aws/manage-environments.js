#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
// eslint-disable-next-line no-unused-vars
const path = require('path');
const readline = require('readline');

console.log(chalk.blue('🌍 AWS Environment Management for Chatterbox\n'));

// Available environments
const AVAILABLE_ENVIRONMENTS = {
    development: {
        name: 'Development',
        description: 'Development environment for testing and development',
        configFile: 'Cloud/AWS/terraform/environments/development.tfvars',
        backendKey: 'terraform.tfstate',
    },
    staging: {
        name: 'Staging',
        description: 'Staging environment for pre-production testing',
        configFile: 'Cloud/AWS/terraform/environments/staging.tfvars',
        backendKey: 'staging/terraform.tfstate',
    },
    production: {
        name: 'Production',
        description: 'Production environment for live applications',
        configFile: 'Cloud/AWS/terraform/environments/production.tfvars',
        backendKey: 'production/terraform.tfstate',
    },
};

function showUsage() {
    console.log(chalk.blue('Usage:'));
    console.log(chalk.gray('  npm run aws:env:deploy [environment] [options]'));
    console.log(chalk.gray('  npm run aws:env:destroy [environment] [options]'));
    console.log(chalk.gray('  npm run aws:env:list'));
    console.log(chalk.gray('  npm run aws:env:status [environment]'));
    console.log('');
    console.log(chalk.blue('Available environments:'));
    Object.entries(AVAILABLE_ENVIRONMENTS).forEach(([key, env]) => {
        console.log(chalk.gray(`  ${key} - ${env.name}: ${env.description}`));
    });
    console.log('');
    console.log(chalk.blue('Options:'));
    console.log(chalk.gray('  --force          Skip confirmation prompts'));
    console.log(chalk.gray('  --dry-run        Show what would be done without making changes'));
    console.log(chalk.gray('  --help           Show this help message'));
    console.log('');
    console.log(chalk.blue('Examples:'));
    console.log(chalk.gray('  npm run aws:env:deploy development'));
    console.log(chalk.gray('  npm run aws:env:deploy staging --dry-run'));
    console.log(chalk.gray('  npm run aws:env:destroy production --force'));
    console.log(chalk.gray('  npm run aws:env:list'));
}

function getAccountId() {
    try {
        const result = execSync(
            'aws sts get-caller-identity --profile cliadmin --query Account --output text',
            {
                stdio: 'pipe',
                encoding: 'utf8',
            }
        );
        return result.trim();
    } catch (error) {
        console.error(
            chalk.red('❌ Failed to get AWS account ID. Make sure AWS CLI is configured.')
        );
        process.exit(1);
    }
}

function setupBackend(environment) {
    const accountId = getAccountId();
    const bucketName = `chatterbox-terraform-state-${accountId}`;
    const env = AVAILABLE_ENVIRONMENTS[environment];

    console.log(chalk.blue(`🔧 Setting up Terraform backend for ${environment}...`));

    try {
        // Create S3 bucket if it doesn't exist
        execSync(`aws s3 mb s3://${bucketName} --profile cliadmin --region us-east-1`, {
            stdio: 'pipe',
        });
        console.log(chalk.green(`   ✅ S3 bucket: ${bucketName}`));

        // Enable versioning
        execSync(
            `aws s3api put-bucket-versioning --bucket ${bucketName} --versioning-configuration Status=Enabled --profile cliadmin`,
            { stdio: 'pipe' }
        );
        console.log(chalk.green(`   ✅ Versioning enabled`));

        // Update backend configuration
        const backendConfig = `terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "${bucketName}"
    key    = "${env.backendKey}"
    region = "us-east-1"
    profile = "cliadmin"
  }
}`;

        // Update main.tf with new backend config
        const mainTfPath = 'Cloud/AWS/terraform/main.tf';
        let mainTfContent = fs.readFileSync(mainTfPath, 'utf8');
        mainTfContent = mainTfContent.replace(/terraform\s*\{[\s\S]*?\}/, backendConfig);
        fs.writeFileSync(mainTfPath, mainTfContent);

        console.log(chalk.green(`   ✅ Backend configured for ${environment}`));
    } catch (error) {
        console.error(chalk.red(`❌ Failed to setup backend: ${error.message}`));
        process.exit(1);
    }
}

async function selectEnvironment() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log(chalk.blue('\n🌍 Select environment(s) to deploy:'));
    Object.entries(AVAILABLE_ENVIRONMENTS).forEach(([key, env], index) => {
        console.log(chalk.gray(`  ${index + 1}. ${key} - ${env.name}`));
    });
    console.log(chalk.gray('  4. All environments'));
    console.log(chalk.gray('  5. Cancel'));

    const answer = await new Promise((resolve) => {
        rl.question(chalk.yellow('\nEnter your choice (1-5): '), (ans) => {
            rl.close();
            resolve(ans.trim());
        });
    });

    switch (answer) {
        case '1':
            return ['development'];
        case '2':
            return ['staging'];
        case '3':
            return ['production'];
        case '4':
            return Object.keys(AVAILABLE_ENVIRONMENTS);
        case '5':
            return [];
        default:
            console.log(chalk.red('❌ Invalid choice. Please run again.'));
            process.exit(1);
    }
}

async function deployEnvironment(environment, options = {}) {
    const { force = false, dryRun = false } = options;
    const env = AVAILABLE_ENVIRONMENTS[environment];

    if (!env) {
        console.log(chalk.red(`❌ Unknown environment: ${environment}`));
        return false;
    }

    console.log(chalk.blue(`\n🚀 Deploying ${env.name} environment...`));

    if (!fs.existsSync(env.configFile)) {
        console.log(chalk.red(`❌ Configuration file not found: ${env.configFile}`));
        return false;
    }

    try {
        // Setup backend for this environment
        setupBackend(environment);

        // Change to terraform directory
        process.chdir('Cloud/AWS/terraform');

        // Initialize Terraform
        console.log(chalk.yellow('   Initializing Terraform...'));
        execSync('terraform init -reconfigure', { stdio: 'inherit' });

        // Validate configuration
        console.log(chalk.yellow('   Validating configuration...'));
        execSync('terraform validate', { stdio: 'inherit' });

        // Format code
        console.log(chalk.yellow('   Formatting code...'));
        execSync('terraform fmt -recursive', { stdio: 'inherit' });

        // Plan deployment
        console.log(chalk.yellow('   Creating deployment plan...'));
        const planFile = `tfplan-${environment}`;
        execSync(
            `terraform plan -var-file="../environments/${environment}.tfvars" -out=${planFile}`,
            { stdio: 'inherit' }
        );

        if (dryRun) {
            console.log(chalk.blue(`   [DRY RUN] Would apply plan for ${environment}`));
            return true;
        }

        // Ask for confirmation unless forced
        if (!force) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const answer = await new Promise((resolve) => {
                rl.question(
                    chalk.yellow(`\n🤔 Do you want to deploy ${env.name} environment? (y/N): `),
                    (ans) => {
                        rl.close();
                        resolve(ans.toLowerCase());
                    }
                );
            });

            if (answer !== 'y' && answer !== 'yes') {
                console.log(chalk.gray('   Deployment cancelled.'));
                return false;
            }
        }

        // Apply deployment
        console.log(chalk.yellow('   Applying infrastructure...'));
        execSync(`terraform apply ${planFile}`, { stdio: 'inherit' });

        // Clean up plan file
        fs.unlinkSync(planFile);

        console.log(chalk.green(`✅ Successfully deployed ${env.name} environment!`));
        return true;
    } catch (error) {
        console.error(chalk.red(`❌ Failed to deploy ${environment}: ${error.message}`));
        return false;
    } finally {
        // Return to original directory
        process.chdir('../../../');
    }
}

async function destroyEnvironment(environment, options = {}) {
    const { force = false, dryRun = false } = options;
    const env = AVAILABLE_ENVIRONMENTS[environment];

    if (!env) {
        console.log(chalk.red(`❌ Unknown environment: ${environment}`));
        return false;
    }

    console.log(chalk.blue(`\n🗑️  Destroying ${env.name} environment...`));

    try {
        // Change to terraform directory
        process.chdir('Cloud/AWS/terraform');

        // Setup backend for this environment
        setupBackend(environment);

        // Initialize Terraform
        console.log(chalk.yellow('   Initializing Terraform...'));
        execSync('terraform init -reconfigure', { stdio: 'inherit' });

        if (dryRun) {
            console.log(chalk.blue(`   [DRY RUN] Would destroy ${environment} environment`));
            return true;
        }

        // Ask for confirmation unless forced
        if (!force) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const answer = await new Promise((resolve) => {
                rl.question(
                    chalk.red(
                        `\n⚠️  Are you sure you want to destroy ${env.name} environment? This action cannot be undone! (yes/DESTROY): `
                    ),
                    (ans) => {
                        rl.close();
                        resolve(ans.trim());
                    }
                );
            });

            if (answer !== 'yes' && answer !== 'DESTROY') {
                console.log(chalk.gray('   Destruction cancelled.'));
                return false;
            }
        }

        // Destroy infrastructure
        console.log(chalk.yellow('   Destroying infrastructure...'));
        execSync(
            `terraform destroy -var-file="../environments/${environment}.tfvars" -auto-approve`,
            { stdio: 'inherit' }
        );

        console.log(chalk.green(`✅ Successfully destroyed ${env.name} environment!`));
        return true;
    } catch (error) {
        console.error(chalk.red(`❌ Failed to destroy ${environment}: ${error.message}`));
        return false;
    } finally {
        // Return to original directory
        process.chdir('../../../');
    }
}

function listEnvironments() {
    console.log(chalk.blue('\n📋 Available Environments:'));
    Object.entries(AVAILABLE_ENVIRONMENTS).forEach(([key, env]) => {
        console.log(chalk.gray(`\n  ${env.name} (${key}):`));
        console.log(chalk.gray(`    Description: ${env.description}`));
        console.log(chalk.gray(`    Config: ${env.configFile}`));
        console.log(chalk.gray(`    Backend: ${env.backendKey}`));
    });
}

async function showEnvironmentStatus(environment) {
    const env = AVAILABLE_ENVIRONMENTS[environment];

    if (!env) {
        console.log(chalk.red(`❌ Unknown environment: ${environment}`));
        return;
    }

    console.log(chalk.blue(`\n📊 Status for ${env.name} environment:`));

    try {
        // Setup backend for this environment
        setupBackend(environment);

        // Change to terraform directory
        process.chdir('Cloud/AWS/terraform');

        // Initialize Terraform
        execSync('terraform init -reconfigure', { stdio: 'pipe' });

        // Show current state
        console.log(chalk.yellow('   Current state:'));
        execSync('terraform show', { stdio: 'inherit' });

        // Show outputs
        console.log(chalk.yellow('\n   Outputs:'));
        execSync('terraform output', { stdio: 'inherit' });
    } catch (error) {
        console.log(chalk.yellow(`   No infrastructure deployed for ${environment}`));
    } finally {
        // Return to original directory
        process.chdir('../../../');
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const environment = args[1];

// Parse options
const options = {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
};

// Show help if requested
if (args.includes('--help') || args.includes('-h') || !command) {
    showUsage();
    process.exit(0);
}

// Execute commands
async function main() {
    try {
        switch (command) {
            case 'deploy':
                if (environment) {
                    await deployEnvironment(environment, options);
                } else {
                    const selectedEnvs = await selectEnvironment();
                    if (selectedEnvs.length === 0) {
                        console.log(chalk.gray('Operation cancelled.'));
                        return;
                    }

                    for (const env of selectedEnvs) {
                        await deployEnvironment(env, options);
                    }
                }
                break;

            case 'destroy':
                if (!environment) {
                    console.log(chalk.red('❌ Environment must be specified for destroy command'));
                    showUsage();
                    process.exit(1);
                }
                await destroyEnvironment(environment, options);
                break;

            case 'list':
                listEnvironments();
                break;

            case 'status':
                if (!environment) {
                    console.log(chalk.red('❌ Environment must be specified for status command'));
                    showUsage();
                    process.exit(1);
                }
                await showEnvironmentStatus(environment);
                break;

            default:
                console.log(chalk.red(`❌ Unknown command: ${command}`));
                showUsage();
                process.exit(1);
        }
    } catch (error) {
        console.error(chalk.red('❌ Operation failed:'));
        console.error(chalk.red(error.message));
        process.exit(1);
    }
}

main();
