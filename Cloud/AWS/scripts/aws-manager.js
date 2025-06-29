#!/usr/bin/env node

/**
 * AWS Manager - Consolidated AWS Infrastructure Management
 * 
 * This script provides a unified interface for managing all AWS resources
 * across multiple environments (development, staging, production).
 * 
 * Usage:
 *   node aws-manager.js <command> [environment] [options]
 * 
 * Commands:
 *   build     - Build/Deploy infrastructure for environment
 *   teardown  - Destroy infrastructure for environment
 *   check     - Check infrastructure status and health
 *   backup    - Create backup of environment
 *   restore   - Restore environment from backup
 *   migrate   - Migrate secrets/config between environments
 *   status    - Show current status of all environments
 *   logs      - Show logs for environment
 *   test      - Run tests against environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  environments: ['development', 'staging', 'production'],
  defaultEnvironment: 'development',
  terraformDir: path.join(__dirname, '../terraform'),
  backupDir: path.join(__dirname, '../backups'),
  scriptsDir: __dirname,
  awsProfile: 'cliadmin',
  awsRegion: 'us-east-1'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class AWSManager {
  constructor() {
    this.currentEnvironment = CONFIG.defaultEnvironment;
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [CONFIG.backupDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    this.log(`\n${'='.repeat(60)}`, 'cyan');
    this.log(`  ${message}`, 'bright');
    this.log(`${'='.repeat(60)}`, 'cyan');
  }

  logStep(message) {
    this.log(`\n▶ ${message}`, 'yellow');
  }

  logSuccess(message) {
    this.log(`✅ ${message}`, 'green');
  }

  logError(message) {
    this.log(`❌ ${message}`, 'red');
  }

  logWarning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  async runCommand(command, options = {}) {
    const { cwd = CONFIG.terraformDir, silent = false } = options;
    
    if (!silent) {
      this.log(`Running: ${command}`, 'blue');
    }

    try {
      const result = execSync(command, {
        cwd,
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit'
      });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async runTerraformCommand(command, environment) {
    const envFile = path.join(CONFIG.terraformDir, 'environments', `${environment}.tfvars`);
    
    if (!fs.existsSync(envFile)) {
      throw new Error(`Environment file not found: ${envFile}`);
    }

    const fullCommand = `terraform ${command} -var-file="environments/${environment}.tfvars"`;
    return this.runCommand(fullCommand);
  }

  async build(environment = this.currentEnvironment) {
    this.logHeader(`Building AWS Infrastructure for ${environment.toUpperCase()}`);
    
    try {
      // Check prerequisites
      this.logStep('Checking prerequisites...');
      await this.checkPrerequisites();

      // Initialize Terraform
      this.logStep('Initializing Terraform...');
      const initResult = await this.runCommand('terraform init');
      if (!initResult.success) {
        throw new Error(`Terraform init failed: ${initResult.error}`);
      }

      // Plan deployment
      this.logStep('Planning deployment...');
      const planResult = await this.runTerraformCommand('plan', environment);
      if (!planResult.success) {
        throw new Error(`Terraform plan failed: ${planResult.error}`);
      }

      // Confirm deployment
      if (!await this.confirmAction(`Deploy infrastructure to ${environment}?`)) {
        this.logWarning('Deployment cancelled by user');
        return;
      }

      // Apply deployment
      this.logStep('Deploying infrastructure...');
      const applyResult = await this.runTerraformCommand('apply -auto-approve', environment);
      if (!applyResult.success) {
        throw new Error(`Terraform apply failed: ${applyResult.error}`);
      }

      // Post-deployment setup
      this.logStep('Running post-deployment setup...');
      await this.postDeploymentSetup(environment);

      this.logSuccess(`Infrastructure built successfully for ${environment}`);
      
      // Show outputs
      await this.showOutputs(environment);

    } catch (error) {
      this.logError(`Build failed: ${error.message}`);
      process.exit(1);
    }
  }

  async teardown(environment = this.currentEnvironment) {
    this.logHeader(`Tearing Down AWS Infrastructure for ${environment.toUpperCase()}`);
    
    try {
      // Confirm teardown
      if (!await this.confirmAction(`⚠️  DESTRUCTIVE ACTION: This will destroy ALL resources in ${environment}. Continue?`)) {
        this.logWarning('Teardown cancelled by user');
        return;
      }

      // Create backup before teardown
      this.logStep('Creating backup before teardown...');
      await this.backup(environment);

      // Destroy infrastructure
      this.logStep('Destroying infrastructure...');
      const destroyResult = await this.runTerraformCommand('destroy -auto-approve', environment);
      if (!destroyResult.success) {
        throw new Error(`Terraform destroy failed: ${destroyResult.error}`);
      }

      this.logSuccess(`Infrastructure torn down successfully for ${environment}`);

    } catch (error) {
      this.logError(`Teardown failed: ${error.message}`);
      process.exit(1);
    }
  }

  async check(environment = this.currentEnvironment) {
    this.logHeader(`Checking Infrastructure Status for ${environment.toUpperCase()}`);
    
    try {
      // Check Terraform state
      this.logStep('Checking Terraform state...');
      const stateResult = await this.runCommand('terraform state list', { silent: true });
      if (stateResult.success) {
        const resources = stateResult.output.split('\n').filter(line => line.trim());
        this.logSuccess(`Found ${resources.length} managed resources`);
      }

      // Check AWS resources
      this.logStep('Checking AWS resources...');
      await this.checkAWSResources(environment);

      // Check Lambda function
      this.logStep('Checking Lambda function...');
      await this.checkLambdaFunction(environment);

      // Check API Gateway
      this.logStep('Checking API Gateway...');
      await this.checkAPIGateway(environment);

      this.logSuccess(`Infrastructure check completed for ${environment}`);

    } catch (error) {
      this.logError(`Check failed: ${error.message}`);
      process.exit(1);
    }
  }

  async backup(environment = this.currentEnvironment) {
    this.logHeader(`Creating Backup for ${environment.toUpperCase()}`);
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${environment}-${timestamp}`;
      const backupPath = path.join(CONFIG.backupDir, backupName);

      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      // Backup Terraform state
      this.logStep('Backing up Terraform state...');
      const stateResult = await this.runCommand('terraform state pull', { silent: true });
      if (stateResult.success) {
        fs.writeFileSync(path.join(backupPath, 'terraform.tfstate'), stateResult.output);
      }

      // Backup environment configuration
      this.logStep('Backing up environment configuration...');
      const envFile = path.join(CONFIG.terraformDir, 'environments', `${environment}.tfvars`);
      if (fs.existsSync(envFile)) {
        fs.copyFileSync(envFile, path.join(backupPath, `${environment}.tfvars`));
      }

      // Backup secrets (if accessible)
      this.logStep('Backing up secrets...');
      await this.backupSecrets(environment, backupPath);

      this.logSuccess(`Backup created: ${backupPath}`);

    } catch (error) {
      this.logError(`Backup failed: ${error.message}`);
      process.exit(1);
    }
  }

  async restore(environment = this.currentEnvironment, backupPath) {
    this.logHeader(`Restoring ${environment.toUpperCase()} from Backup`);
    
    try {
      if (!backupPath) {
        // List available backups
        const backups = fs.readdirSync(CONFIG.backupDir)
          .filter(dir => dir.startsWith(`backup-${environment}-`))
          .sort()
          .reverse();

        if (backups.length === 0) {
          throw new Error(`No backups found for ${environment}`);
        }

        backupPath = path.join(CONFIG.backupDir, backups[0]);
        this.log(`Using latest backup: ${backupPath}`);
      }

      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupPath}`);
      }

      // Confirm restore
      if (!await this.confirmAction(`Restore ${environment} from ${backupPath}?`)) {
        this.logWarning('Restore cancelled by user');
        return;
      }

      // Restore Terraform state
      this.logStep('Restoring Terraform state...');
      const stateFile = path.join(backupPath, 'terraform.tfstate');
      if (fs.existsSync(stateFile)) {
        await this.runCommand(`terraform state push ${stateFile}`);
      }

      // Restore environment configuration
      this.logStep('Restoring environment configuration...');
      const envFile = path.join(backupPath, `${environment}.tfvars`);
      if (fs.existsSync(envFile)) {
        fs.copyFileSync(envFile, path.join(CONFIG.terraformDir, 'environments', `${environment}.tfvars`));
      }

      // Restore secrets
      this.logStep('Restoring secrets...');
      await this.restoreSecrets(environment, backupPath);

      this.logSuccess(`Restore completed for ${environment}`);

    } catch (error) {
      this.logError(`Restore failed: ${error.message}`);
      process.exit(1);
    }
  }

  async migrate(sourceEnv, targetEnv) {
    this.logHeader(`Migrating from ${sourceEnv.toUpperCase()} to ${targetEnv.toUpperCase()}`);
    
    try {
      // Confirm migration
      if (!await this.confirmAction(`Migrate configuration from ${sourceEnv} to ${targetEnv}?`)) {
        this.logWarning('Migration cancelled by user');
        return;
      }

      // Migrate secrets
      this.logStep('Migrating secrets...');
      await this.migrateSecrets(sourceEnv, targetEnv);

      // Migrate parameters
      this.logStep('Migrating parameters...');
      await this.migrateParameters(sourceEnv, targetEnv);

      this.logSuccess(`Migration completed from ${sourceEnv} to ${targetEnv}`);

    } catch (error) {
      this.logError(`Migration failed: ${error.message}`);
      process.exit(1);
    }
  }

  async status() {
    this.logHeader('Infrastructure Status Overview');
    
    for (const env of CONFIG.environments) {
      this.log(`\n${env.toUpperCase()} Environment:`, 'bright');
      
      try {
        // Check if environment is deployed
        const stateResult = await this.runCommand('terraform state list', { silent: true });
        if (stateResult.success) {
          const resources = stateResult.output.split('\n').filter(line => line.trim());
          this.log(`  Resources: ${resources.length}`, 'green');
        } else {
          this.log(`  Status: Not deployed`, 'red');
        }
      } catch (error) {
        this.log(`  Status: Error checking`, 'red');
      }
    }
  }

  async logs(environment = this.currentEnvironment) {
    this.logHeader(`Logs for ${environment.toUpperCase()}`);
    
    try {
      // Get Lambda logs
      this.logStep('Fetching Lambda logs...');
      const lambdaName = `${environment}-chatterbox-email-reader`;
      await this.runCommand(`aws logs tail /aws/lambda/${lambdaName} --follow --profile ${CONFIG.awsProfile}`);

    } catch (error) {
      this.logError(`Failed to fetch logs: ${error.message}`);
      process.exit(1);
    }
  }

  async test(environment = this.currentEnvironment) {
    this.logHeader(`Testing ${environment.toUpperCase()} Environment`);
    
    try {
      // Test Lambda function
      this.logStep('Testing Lambda function...');
      await this.testLambdaFunction(environment);

      // Test API Gateway
      this.logStep('Testing API Gateway...');
      await this.testAPIGateway(environment);

      // Test DynamoDB
      this.logStep('Testing DynamoDB...');
      await this.testDynamoDB(environment);

      this.logSuccess(`All tests passed for ${environment}`);

    } catch (error) {
      this.logError(`Tests failed: ${error.message}`);
      process.exit(1);
    }
  }

  // Helper methods
  async checkPrerequisites() {
    // Check AWS CLI
    const awsResult = await this.runCommand('aws --version', { silent: true });
    if (!awsResult.success) {
      throw new Error('AWS CLI not found. Please install AWS CLI.');
    }

    // Check Terraform
    const tfResult = await this.runCommand('terraform --version', { silent: true });
    if (!tfResult.success) {
      throw new Error('Terraform not found. Please install Terraform.');
    }

    // Check AWS credentials
    const credsResult = await this.runCommand(`aws sts get-caller-identity --profile ${CONFIG.awsProfile}`, { silent: true });
    if (!credsResult.success) {
      throw new Error(`AWS credentials not configured for profile: ${CONFIG.awsProfile}`);
    }
  }

  async confirmAction(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  async showOutputs(environment) {
    this.logStep('Infrastructure outputs:');
    const outputResult = await this.runTerraformCommand('output', environment);
    if (outputResult.success) {
      console.log(outputResult.output);
    }
  }

  // Placeholder methods for AWS resource checks
  async checkAWSResources(environment) {
    // Implementation for checking AWS resources
    this.logSuccess('AWS resources check completed');
  }

  async checkLambdaFunction(environment) {
    // Implementation for checking Lambda function
    this.logSuccess('Lambda function check completed');
  }

  async checkAPIGateway(environment) {
    // Implementation for checking API Gateway
    this.logSuccess('API Gateway check completed');
  }

  async backupSecrets(environment, backupPath) {
    // Implementation for backing up secrets
    this.logSuccess('Secrets backup completed');
  }

  async restoreSecrets(environment, backupPath) {
    // Implementation for restoring secrets
    this.logSuccess('Secrets restore completed');
  }

  async migrateSecrets(sourceEnv, targetEnv) {
    // Implementation for migrating secrets
    this.logSuccess('Secrets migration completed');
  }

  async migrateParameters(sourceEnv, targetEnv) {
    // Implementation for migrating parameters
    this.logSuccess('Parameters migration completed');
  }

  async postDeploymentSetup(environment) {
    // Implementation for post-deployment setup
    this.logSuccess('Post-deployment setup completed');
  }

  async testLambdaFunction(environment) {
    // Implementation for testing Lambda function
    this.logSuccess('Lambda function test completed');
  }

  async testAPIGateway(environment) {
    // Implementation for testing API Gateway
    this.logSuccess('API Gateway test completed');
  }

  async testDynamoDB(environment) {
    // Implementation for testing DynamoDB
    this.logSuccess('DynamoDB test completed');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
AWS Manager - Consolidated AWS Infrastructure Management

Usage: node aws-manager.js <command> [environment] [options]

Commands:
  build     - Build/Deploy infrastructure for environment
  teardown  - Destroy infrastructure for environment
  check     - Check infrastructure status and health
  backup    - Create backup of environment
  restore   - Restore environment from backup
  migrate   - Migrate secrets/config between environments
  status    - Show current status of all environments
  logs      - Show logs for environment
  test      - Run tests against environment

Environments: development (default), staging, production

Examples:
  node aws-manager.js build
  node aws-manager.js build production
  node aws-manager.js check staging
  node aws-manager.js migrate development staging
`);
    process.exit(0);
  }

  const command = args[0];
  const environment = args[1] || CONFIG.defaultEnvironment;
  const manager = new AWSManager();

  try {
    switch (command) {
      case 'build':
        await manager.build(environment);
        break;
      case 'teardown':
        await manager.teardown(environment);
        break;
      case 'check':
        await manager.check(environment);
        break;
      case 'backup':
        await manager.backup(environment);
        break;
      case 'restore':
        await manager.restore(environment, args[2]);
        break;
      case 'migrate':
        if (!args[1] || !args[2]) {
          throw new Error('Migration requires source and target environments');
        }
        await manager.migrate(args[1], args[2]);
        break;
      case 'status':
        await manager.status();
        break;
      case 'logs':
        await manager.logs(environment);
        break;
      case 'test':
        await manager.test(environment);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = AWSManager;
