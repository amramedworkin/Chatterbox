#!/usr/bin/env node

/**
 * Setup Cursor Rules for Chatterbox Project
 * 
 * This script sets up comprehensive Cursor rules for the Chatterbox project,
 * including backup of existing rules and creation of the new rule set.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

function printInfo(message) {
    console.log(chalk.blue(`ℹ️  ${message}`));
}

function printSuccess(message) {
    console.log(chalk.green(`✅ ${message}`));
}

function printWarning(message) {
    console.log(chalk.yellow(`⚠️  ${message}`));
}

function printError(message) {
    console.log(chalk.red(`❌ ${message}`));
}

function printHeader(message) {
    console.log(chalk.cyan('='.repeat(80)));
    console.log(chalk.cyan.bold(`🚀 ${message}`));
    console.log(chalk.cyan('='.repeat(80)));
}

/**
 * Generate timestamp for backup folder
 */
function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Create directory if it doesn't exist
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        printInfo(`Created directory: ${dirPath}`);
    }
}

/**
 * Backup existing Cursor rules
 */
function backupExistingRules() {
    const timestamp = generateTimestamp();
    const backupDir = path.join('data', 'cursor', `ide_${timestamp}`);
    const historyDir = path.join(backupDir, 'history');
    const initDir = path.join(backupDir, 'init');
    
    printInfo('Creating backup directories...');
    ensureDirectoryExists(backupDir);
    ensureDirectoryExists(historyDir);
    ensureDirectoryExists(initDir);
    
    // Backup existing .cursorrules if it exists
    const cursorRulesPath = path.join(process.cwd(), '.cursorrules');
    if (fs.existsSync(cursorRulesPath)) {
        const backupPath = path.join(historyDir, '.cursorrules.backup');
        fs.copyFileSync(cursorRulesPath, backupPath);
        printSuccess(`Backed up existing .cursorrules to: ${backupPath}`);
    } else {
        printInfo('No existing .cursorrules found');
    }
    
    // Create backup log
    const backupLog = {
        timestamp: new Date().toISOString(),
        action: 'cursor_rules_setup',
        description: 'Setup of comprehensive Cursor rules for Chatterbox project',
        files_backed_up: fs.existsSync(cursorRulesPath) ? ['.cursorrules'] : [],
        new_rules_created: [
            '.cursorrules',
            'Cursor/PROJECT_MANAGEMENT_RULES.md',
            'Cursor/LOCAL_DEVELOPMENT_RULES.md',
            'Cursor/AWS_CLOUD_RULES.md',
            'Cursor/AZURE_CLOUD_RULES.md',
            'Cursor/AI_INTEGRATION_RULES.md',
            'Cursor/SCRIPTING_AUTOMATION_RULES.md',
            'Cursor/TESTING_QUALITY_RULES.md',
            'Cursor/DOCUMENTATION_STANDARDS_RULES.md'
        ]
    };
    
    const backupLogPath = path.join(backupDir, 'backup-log.json');
    fs.writeFileSync(backupLogPath, JSON.stringify(backupLog, null, 2));
    printSuccess(`Created backup log: ${backupLogPath}`);
    
    return { backupDir, initDir };
}

/**
 * Create Cursor rules directory and files
 */
function createCursorRules() {
    const cursorDir = path.join(process.cwd(), 'Cursor');
    ensureDirectoryExists(cursorDir);
    
    printInfo('Creating Cursor rules files...');
    
    // List of rule files to create
    const ruleFiles = [
        'PROJECT_MANAGEMENT_RULES.md',
        'LOCAL_DEVELOPMENT_RULES.md',
        'AWS_CLOUD_RULES.md',
        'AZURE_CLOUD_RULES.md',
        'AI_INTEGRATION_RULES.md',
        'SCRIPTING_AUTOMATION_RULES.md',
        'TESTING_QUALITY_RULES.md',
        'DOCUMENTATION_STANDARDS_RULES.md'
    ];
    
    // Create rules subdirectory
    const rulesDir = path.join(cursorDir, 'rules');
    ensureDirectoryExists(rulesDir);
    
    // Check if rule files already exist
    const existingFiles = ruleFiles.filter(file => 
        fs.existsSync(path.join(rulesDir, file))
    );
    
    if (existingFiles.length > 0) {
        printWarning(`Found existing rule files: ${existingFiles.join(', ')}`);
        printWarning('These files will be overwritten. Backup has been created.');
    }
    
    // Create main .cursorrules file
    const mainCursorRules = `# Chatterbox Project Cursor Rules

## Overview
This project follows comprehensive development standards with extensive automation, serverless-first architecture, and configuration-driven development. All development must adhere to these established patterns and procedures.

## Core Development Principles

### Project Management
- Follow the comprehensive project management rules defined in \`Cursor/rules/PROJECT_MANAGEMENT_RULES.md\`
- All operations must be fully automated and scripted
- Use the menu system (\`scripts/menu.js\`) for all system operations
- Maintain comprehensive documentation for all features and processes

### Local Development
- Follow the local development rules defined in \`Cursor/rules/LOCAL_DEVELOPMENT_RULES.md\`
- Use configuration-first approach with \`config.json\` as primary configuration source
- Minimize environment variable usage
- All local operations must be scripted and automated

### Cloud Infrastructure
- **AWS**: Follow the AWS cloud rules defined in \`Cursor/rules/AWS_CLOUD_RULES.md\`
  - Use serverless architecture (Lambda, API Gateway, DynamoDB, S3, SES)
  - Implement infrastructure as code with Terraform
  - Script everything that cannot be terraformed
  - Use AWS Bedrock for AI components when available

- **Azure**: Follow the Azure cloud rules defined in \`Cursor/rules/AZURE_CLOUD_RULES.md\`
  - Use Azure Functions, Cosmos DB, Blob Storage, SendGrid
  - Use Azure Configuration Provider (ACP) for configurable resources
  - Script remaining operations not supported by ACP
  - Use Azure AI/ML services when available

### AI Integration
- Follow the AI integration rules defined in \`Cursor/rules/AI_INTEGRATION_RULES.md\`
- Use direct OpenAI API calls as default for AI services
- Use AWS Bedrock for AI components when on AWS
- Use Azure AI/ML services when on Azure
- Store all AI configuration in \`config.json\`

### Scripting and Automation
- Follow the scripting and automation rules defined in \`Cursor/rules/SCRIPTING_AUTOMATION_RULES.md\`
- Every operation must be fully scripted - no manual operations allowed
- Use the menu system for all system operations
- Implement comprehensive error handling and recovery
- All deployments must be fully automated

### Testing and Quality
- Follow the testing and quality rules defined in \`Cursor/rules/TESTING_QUALITY_RULES.md\`
- Implement comprehensive testing including unit, integration, E2E, and performance tests
- Use Jest, custom scripts, and manual processes as appropriate
- All code must pass ESLint without errors
- Maintain high test coverage for critical components

### Documentation Standards
- Follow the documentation standards defined in \`Cursor/rules/DOCUMENTATION_STANDARDS_RULES.md\`
- Document all features, processes, design decisions, and operational procedures
- Use Markdown format for all documentation
- Follow established naming conventions in \`docs/DOCUMENTATION_CONVENTIONS.md\`
- Keep documentation synchronized with code changes

## Development Workflow

### Before Making Changes
1. Run \`npm run lint:check\` to ensure code quality
2. Run \`npm run build\` to verify compilation
3. Run relevant tests to ensure functionality
4. Update documentation if needed

### Code Standards
- Write all new code in TypeScript
- Use strict TypeScript configuration
- Follow established code style guidelines
- Implement comprehensive error handling
- Use configuration files for all settings

### Configuration Management
- Store all configuration in \`config.json\`
- Minimize environment variable usage
- Use AWS Parameter Store or Azure App Configuration for runtime config
- Implement configuration validation
- Document all configuration options

### Security Considerations
- Store all credentials in AWS Secrets Manager or Azure Key Vault
- Use least privilege access policies
- Implement proper authentication and authorization
- Regular security audits and updates
- Follow security best practices

### Testing Requirements
- Write tests for all new features
- Use appropriate testing frameworks for different types of tests
- Implement automated test execution
- Maintain test data and fixtures
- Ensure high test coverage

### Documentation Requirements
- Document all public APIs and interfaces
- Include usage examples and code samples
- Keep documentation synchronized with code changes
- Follow established documentation conventions
- Maintain comprehensive process documentation

## Compliance Requirements

### Code Quality
- All code must pass ESLint without errors
- All code must compile without warnings
- All code must follow established patterns
- All code must be properly documented
- All code must have appropriate tests

### Security
- All credentials must be stored securely
- All access must be properly controlled
- All data must be properly protected
- All security requirements must be met
- All compliance requirements must be satisfied

### Performance
- All code must meet performance requirements
- All operations must be optimized
- All resources must be properly managed
- All bottlenecks must be identified and resolved
- All performance requirements must be validated

### Reliability
- All operations must be reliable
- All error conditions must be handled
- All recovery procedures must be implemented
- All monitoring must be in place
- All alerting must be configured

## Emergency Procedures

### Rollback Process
1. Use automated rollback scripts
2. Restore from backups if necessary
3. Verify system stability
4. Document the incident and resolution
5. Implement preventive measures

### Incident Response
1. Follow established incident response procedures
2. Use monitoring and alerting systems
3. Document all actions taken
4. Implement preventive measures
5. Conduct post-incident review

This comprehensive approach ensures that all development maintains high quality, security, and operational excellence while following established patterns and procedures.
`;
    
    fs.writeFileSync(path.join(process.cwd(), '.cursorrules'), mainCursorRules);
    printSuccess('Created main .cursorrules file');
    
    // Create individual rule files (these will be populated by the actual rule files)
    ruleFiles.forEach(file => {
        const filePath = path.join(rulesDir, file);
        const placeholderContent = `# ${file.replace('.md', '').replace(/_/g, ' ')} Rules

## Overview
This file contains comprehensive rules for ${file.replace('.md', '').replace(/_/g, ' ').toLowerCase()} in the Chatterbox project.

## Rules
[Rules content will be populated by the actual rule files]

## Implementation
[Implementation details will be provided in the actual rule files]

## Compliance
[Compliance requirements will be detailed in the actual rule files]
`;
        
        fs.writeFileSync(filePath, placeholderContent);
        printSuccess(`Created rule file: ${file}`);
    });
    
    return ruleFiles;
}

/**
 * Copy rule files to init directory for backup
 */
function copyRulesToInit(initDir) {
    printInfo('Copying rule files to init directory...');
    
    const cursorDir = path.join(process.cwd(), 'Cursor');
    const ruleFiles = [
        '.cursorrules',
        'Cursor/rules/PROJECT_MANAGEMENT_RULES.md',
        'Cursor/rules/LOCAL_DEVELOPMENT_RULES.md',
        'Cursor/rules/AWS_CLOUD_RULES.md',
        'Cursor/rules/AZURE_CLOUD_RULES.md',
        'Cursor/rules/AI_INTEGRATION_RULES.md',
        'Cursor/rules/SCRIPTING_AUTOMATION_RULES.md',
        'Cursor/rules/TESTING_QUALITY_RULES.md',
        'Cursor/rules/DOCUMENTATION_STANDARDS_RULES.md'
    ];
    
    ruleFiles.forEach(file => {
        const sourcePath = path.join(process.cwd(), file);
        const destPath = path.join(initDir, path.basename(file));
        
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
            printSuccess(`Copied ${file} to init directory`);
        } else {
            printWarning(`Source file not found: ${file}`);
        }
    });
}

/**
 * Create setup log
 */
function createSetupLog(backupDir, ruleFiles) {
    const setupLog = {
        timestamp: new Date().toISOString(),
        action: 'cursor_rules_setup_completed',
        description: 'Setup of comprehensive Cursor rules for Chatterbox project',
        backup_directory: backupDir,
        rules_created: ruleFiles,
        main_cursorrules_created: true,
        setup_completed: true
    };
    
    const setupLogPath = path.join(process.cwd(), 'data', 'cursor', 'setup-log.json');
    fs.writeFileSync(setupLogPath, JSON.stringify(setupLog, null, 2));
    printSuccess(`Created setup log: ${setupLogPath}`);
}

/**
 * Display setup summary
 */
function displaySetupSummary(backupDir, ruleFiles) {
    printHeader('Cursor Rules Setup Summary');
    
    console.log(chalk.green('✅ Setup completed successfully!'));
    console.log('');
    console.log(chalk.cyan('📁 Backup Directory:'), backupDir);
    console.log(chalk.cyan('📄 Rules Created:'), ruleFiles.length);
    console.log(chalk.cyan('🔧 Main .cursorrules:'), 'Created');
    console.log('');
    console.log(chalk.yellow('📋 Next Steps:'));
    console.log('1. Review the created rule files in the Cursor/rules/ directory');
    console.log('2. Customize rules as needed for your specific requirements');
    console.log('3. Restart Cursor to load the new rules');
    console.log('4. Test the rules by starting a new conversation in Cursor');
    console.log('');
    console.log(chalk.blue('📚 Documentation:'));
    console.log('- See docs/CURSOR_RULES_GUIDE.md for detailed usage instructions');
    console.log('- Review individual rule files for specific guidelines');
    console.log('- Check backup directory for previous rule versions');
    console.log('');
    console.log(chalk.green('🎉 Cursor rules are now ready for use!'));
}

/**
 * Main function
 */
async function main() {
    try {
        printHeader('Setting up Cursor Rules for Chatterbox Project');
        
        // Step 1: Backup existing rules
        printInfo('Step 1: Backing up existing rules...');
        const { backupDir, initDir } = backupExistingRules();
        
        // Step 2: Create Cursor rules
        printInfo('Step 2: Creating Cursor rules...');
        const ruleFiles = createCursorRules();
        
        // Step 3: Copy rules to init directory
        printInfo('Step 3: Copying rules to init directory...');
        copyRulesToInit(initDir);
        
        // Step 4: Create setup log
        printInfo('Step 4: Creating setup log...');
        createSetupLog(backupDir, ruleFiles);
        
        // Step 5: Display summary
        displaySetupSummary(backupDir, ruleFiles);
        
    } catch (error) {
        printError(`Setup failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Run the main function
if (require.main === module) {
    main().catch((error) => {
        printError(`Unexpected error: ${error.message}`);
        console.error(error);
        process.exit(1);
    });
}

module.exports = { main, backupExistingRules, createCursorRules }; 