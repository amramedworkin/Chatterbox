#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');

// Configuration
const CURRENT_DIR = process.cwd();
const PACKAGE_JSON_PATH = path.join(CURRENT_DIR, 'package.json');

// Excluded directories and files for copying
const excludeDirs = ['node_modules', '.git', 'dist', 'backups', 'logs'];
const excludeFiles = ['.env', 'cliadmin_accessKeys.csv'];

/**
 * Validates if the target directory is safe to use
 */
function validateTargetDirectory(targetPath) {
    const absolutePath = path.resolve(targetPath);

    // Check if directory already exists
    if (fs.existsSync(absolutePath)) {
        throw new Error(`Target directory already exists: ${absolutePath}`);
    }

    // Check if parent directory exists and is writable
    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
        throw new Error(`Parent directory does not exist: ${parentDir}`);
    }

    try {
        fs.accessSync(parentDir, fs.constants.W_OK);
    } catch (error) {
        throw new Error(`Parent directory is not writable: ${parentDir}`);
    }

    return absolutePath;
}

/**
 * Gets the git repository URL from package.json or prompts user
 */
function getRepositoryUrl() {
    try {
        const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
        if (packageJson.repository && packageJson.repository.url) {
            return packageJson.repository.url;
        }
    } catch (error) {
        console.warn(chalk.yellow('Could not read repository URL from package.json'));
    }

    return null;
}

/**
 * Creates installation using git clone
 */
async function createWithGitClone(targetPath, repoUrl) {
    console.log(chalk.blue(`\n🔗 Cloning repository from ${repoUrl}...`));

    try {
        execSync(`git clone ${repoUrl} "${targetPath}"`, {
            stdio: 'inherit',
            cwd: path.dirname(targetPath),
        });

        console.log(chalk.green('✅ Repository cloned successfully'));
        return true;
    } catch (error) {
        console.error(chalk.red('❌ Git clone failed:'), error.message);
        return false;
    }
}

/**
 * Copy directory function
 */
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);

    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);

        // Skip excluded directories and files
        if (excludeDirs.includes(item) || excludeFiles.includes(item)) {
            console.log(chalk.gray(`⏭️  Skipping ${item}`));
            continue;
        }

        if (stat.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Creates installation by copying current repository
 */
async function createWithCopy(targetPath) {
    console.log(chalk.blue('\n📁 Creating installation by copying repository...'));

    try {
        copyDirectory(CURRENT_DIR, targetPath);

        // Remove package-lock.json and node_modules if they exist in target
        const targetPackageLock = path.join(targetPath, 'package-lock.json');
        const targetNodeModules = path.join(targetPath, 'node_modules');

        if (fs.existsSync(targetPackageLock)) {
            fs.unlinkSync(targetPackageLock);
        }

        if (fs.existsSync(targetNodeModules)) {
            fs.rmSync(targetNodeModules, { recursive: true, force: true });
        }

        console.log(chalk.green('✅ Repository copied successfully'));
        return true;
    } catch (error) {
        console.error(chalk.red('❌ Copy failed:'), error.message);
        return false;
    }
}

/**
 * Generates unique identifiers for AWS resources
 */
function generateUniqueIdentifiers() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const uniqueSuffix = `${timestamp}-${random}`;

    return {
        s3BucketName: `chatterbox-data-${uniqueSuffix}`,
        s3BackupBucketName: `chatterbox-backups-${uniqueSuffix}`,
        dynamodbTableName: `chatterbox-state-${uniqueSuffix}`,
        terraformStateBucket: `chatterbox-terraform-state-${uniqueSuffix}`,
        logGroupName: `/aws/chatterbox-${uniqueSuffix}`,
        vpcCidrBlock: `10.${Math.floor(Math.random() * 255)}.0.0/16`,
    };
}

/**
 * Updates Terraform configuration with unique identifiers
 */
function updateTerraformConfig(targetPath, identifiers) {
    console.log(chalk.blue('\n🔧 Updating Terraform configuration...'));

    try {
        // Update main variables.tf
        const variablesPath = path.join(targetPath, 'Cloud/AWS/terraform/variables.tf');
        if (fs.existsSync(variablesPath)) {
            let content = fs.readFileSync(variablesPath, 'utf8');

            // Update default values with unique identifiers
            content = content.replace(
                /default\s*=\s*"chatterbox-data"/g,
                `default = "${identifiers.s3BucketName}"`
            );
            content = content.replace(
                /default\s*=\s*"chatterbox-backups"/g,
                `default = "${identifiers.s3BackupBucketName}"`
            );
            content = content.replace(
                /default\s*=\s*"chatterbox-state"/g,
                `default = "${identifiers.dynamodbTableName}"`
            );
            content = content.replace(
                /default\s*=\s*"\/aws\/chatterbox"/g,
                `default = "${identifiers.logGroupName}"`
            );
            content = content.replace(
                /default\s*=\s*"10\.0\.0\.0\/16"/g,
                `default = "${identifiers.vpcCidrBlock}"`
            );

            fs.writeFileSync(variablesPath, content);
        }

        // Update main.tf backend configuration
        const mainTfPath = path.join(targetPath, 'Cloud/AWS/terraform/main.tf');
        if (fs.existsSync(mainTfPath)) {
            let content = fs.readFileSync(mainTfPath, 'utf8');

            content = content.replace(
                /bucket\s*=\s*"[^"]*"/g,
                `bucket = "${identifiers.terraformStateBucket}"`
            );

            fs.writeFileSync(mainTfPath, content);
        }

        console.log(chalk.green('✅ Terraform configuration updated'));
    } catch (error) {
        console.error(chalk.red('❌ Failed to update Terraform configuration:'), error.message);
    }
}

/**
 * Creates installation configuration file
 */
function createInstallationConfig(targetPath, identifiers, installationMethod) {
    const config = {
        installationDate: new Date().toISOString(),
        installationMethod,
        sourcePath: CURRENT_DIR,
        targetPath,
        uniqueIdentifiers: identifiers,
        status: 'created',
    };

    const configPath = path.join(targetPath, '.installation-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green('✅ Installation configuration saved'));
}

/**
 * Main installation creation function
 */
async function createInstallation() {
    console.log(chalk.blue.bold('\n🚀 Chatterbox Installation Creator\n'));

    try {
        // Get target directory
        const { targetDirectory } = await inquirer.default.prompt([
            {
                type: 'input',
                name: 'targetDirectory',
                message: 'Enter the path for the new installation:',
                validate: (input) => {
                    try {
                        validateTargetDirectory(input);
                        return true;
                    } catch (error) {
                        return error.message;
                    }
                },
            },
        ]);

        const targetPath = validateTargetDirectory(targetDirectory);

        // Choose installation method
        const repoUrl = getRepositoryUrl();
        let installationMethod = 'copy';

        if (repoUrl) {
            const { method } = await inquirer.default.prompt([
                {
                    type: 'list',
                    name: 'method',
                    message: 'Choose installation method:',
                    choices: [
                        {
                            name: `Copy current repository (${path.basename(CURRENT_DIR)})`,
                            value: 'copy',
                        },
                        {
                            name: `Git clone from repository (${repoUrl})`,
                            value: 'git',
                        },
                    ],
                },
            ]);
            installationMethod = method;
        }

        // Generate unique identifiers
        const identifiers = generateUniqueIdentifiers();

        // Create installation
        let success = false;
        if (installationMethod === 'git') {
            success = await createWithGitClone(targetPath, repoUrl);
        } else {
            success = await createWithCopy(targetPath);
        }

        if (!success) {
            console.error(chalk.red('\n❌ Installation creation failed'));
            process.exit(1);
        }

        // Update Terraform configuration
        updateTerraformConfig(targetPath, identifiers);

        // Create installation configuration
        createInstallationConfig(targetPath, identifiers, installationMethod);

        // Final instructions
        console.log(chalk.green.bold('\n🎉 Installation created successfully!'));
        console.log(chalk.blue(`\n📁 Location: ${targetPath}`));
        console.log(chalk.blue('\n📋 Next steps:'));
        console.log(chalk.white('1. Navigate to the new installation:'));
        console.log(chalk.gray(`   cd "${targetPath}"`));
        console.log(chalk.white('2. Run the initialization script:'));
        console.log(chalk.gray('   npm run install:init'));
        console.log(chalk.white('3. Follow the setup wizard to configure your system'));

        console.log(chalk.yellow('\n⚠️  Important:'));
        console.log(
            chalk.white('• All subsequent work should be performed in the new installation')
        );
        console.log(chalk.white('• The original repository remains unchanged'));
        console.log(chalk.white('• Unique AWS resource names have been generated'));
    } catch (error) {
        console.error(chalk.red('\n❌ Installation creation failed:'), error.message);
        process.exit(1);
    }
}

// Run the installation creator
if (require.main === module) {
    createInstallation();
}

module.exports = { createInstallation };
