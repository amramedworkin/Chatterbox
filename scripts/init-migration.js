#!/usr/bin/env node

/**
 * Chatterbox Migration Initialization Script
 * 
 * This script walks users through the migration process by:
 * 1. Creating an init folder under data/
 * 2. Walking through each file/API key that needs migration
 * 3. Asking user for data location (with defaults)
 * 4. Creating timestamped folder
 * 5. Copying files to the timestamped folder
 * 6. Preparing for new migration script
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for output
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

function printStatus(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printInfo(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function printHeader(message) {
    console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log('='.repeat(message.length));
}

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

// Migration items configuration
const migrationItems = [
    {
        name: 'Google OAuth Credentials',
        description: 'Google API credentials file for Gmail integration',
        defaultPath: './google_credentials.json',
        required: true,
        type: 'file',
        instructions: 'To get Google OAuth credentials:\n1. Follow the detailed guide in docs/Cloud/GCP/GCP_GET_CREDENTIALS.md\n2. Create a Google Cloud project and enable Gmail API\n3. Create OAuth 2.0 credentials and download as google_credentials.json\n4. Place the file in the project root (./google_credentials.json)'
    },
    {
        name: 'Gmail OAuth tokens',
        key: 'gmail_tokens',
        defaultPath: './data/google_tokens.json',
        instructions:
            'This file contains the Gmail OAuth tokens for all authorized users.\n' +
            'If you have previously authorized Chatterbox, this file will be in data/google_tokens.json.\n' +
            'If you have not authorized yet, run: npm run mail:authorize\n' +
            'and follow the prompts in your browser\n4. Tokens will be saved to data/google_tokens.json',
    },
    {
        name: 'OpenAI API Key',
        description: 'OpenAI API key for LLM interactions (from .env file)',
        defaultPath: './.env',
        required: true,
        type: 'env_file',
        instructions: 'To set up OpenAI API key:\n1. Get an API key from https://platform.openai.com/api-keys\n2. Create a .env file in the project root\n3. Add: OPENAI_API_KEY=your_api_key_here\n4. Never commit the .env file to version control'
    },
    {
        name: 'Configuration File',
        description: 'Main application configuration file',
        defaultPath: './config.json',
        required: true,
        type: 'file',
        instructions: 'To configure the application:\n1. Review the current config.json file\n2. Update settings as needed for your environment\n3. Key settings include: Gmail users, polling intervals, AWS configuration\n4. See src/types/config.d.ts for the complete configuration schema'
    },
    {
        name: 'Environment Variables',
        description: 'Environment variables file (.env)',
        defaultPath: './.env',
        required: false,
        type: 'file',
        instructions: 'To set up environment variables:\n1. Create a .env file in the project root\n2. Add any environment-specific variables\n3. Common variables: AWS_PROFILE, AWS_REGION, etc.\n4. This file is optional but recommended for local development'
    },
    {
        name: 'Gmail History ID',
        description: 'Last processed Gmail history ID',
        defaultPath: './data/last_history_id.txt',
        required: false,
        type: 'file',
        instructions: 'This file tracks the last processed Gmail history ID:\n1. Created automatically when Gmail polling starts\n2. Used to determine which emails are new\n3. If missing, the system will start from the beginning\n4. Optional - will be created automatically if needed'
    },
    {
        name: 'Poll Cycles Counter',
        description: 'Total number of polling cycles',
        defaultPath: './data/total_poll_cycles.txt',
        required: false,
        type: 'file',
        instructions: 'This file tracks polling statistics:\n1. Created automatically during Gmail polling\n2. Used for monitoring and debugging\n3. If missing, polling will start from 0\n4. Optional - will be created automatically if needed'
    },
    {
        name: 'State File',
        description: 'Application state data',
        defaultPath: './data/state.json',
        required: false,
        type: 'file',
        instructions: 'This file stores application state:\n1. Contains runtime state and configuration\n2. Created automatically by the application\n3. If missing, will be recreated with defaults\n4. Optional - will be created automatically if needed'
    },
    {
        name: 'Send Test Configuration',
        description: 'Send test related files',
        defaultPath: './data/sendtest_*.txt',
        required: false,
        type: 'pattern',
        instructions: 'These files configure email sending tests:\n1. sendtest_sender_email.txt - sender email address\n2. sendtest_recipient_email.txt - recipient email address\n3. sendtest_send_count.txt - number of test emails sent\n4. Optional - used only for testing email sending functionality'
    }
];

async function createInitFolder() {
    const initPath = path.join(process.cwd(), 'data', 'init');
    
    if (!fs.existsSync(initPath)) {
        fs.mkdirSync(initPath, { recursive: true });
        printStatus(`Created init folder: ${initPath}`);
    } else {
        printInfo(`Init folder already exists: ${initPath}`);
    }
    
    return initPath;
}

function createNamedFolder(initPath, folderName, description) {
    let finalFolderName = folderName;
    let folderPath = path.join(initPath, finalFolderName);
    
    // Check if folder exists and add timestamp if duplicate
    if (fs.existsSync(folderPath)) {
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        finalFolderName = `${folderName}_${timestamp}`;
        folderPath = path.join(initPath, finalFolderName);
        printWarning(`Folder name already exists, using: ${finalFolderName}`);
    }
    
    fs.mkdirSync(folderPath, { recursive: true });
    printStatus(`Created folder: ${finalFolderName}`);
    
    // Save description to folder
    const descriptionPath = path.join(folderPath, 'description.txt');
    fs.writeFileSync(descriptionPath, description);
    
    return folderPath;
}

function initializeDefaultValues(folderPath) {
    const defaultValues = {
        'last_history_id.txt': '',
        'sendtest_send_count.txt': '0',
        'total_poll_cycles.txt': '0'
    };
    
    printInfo('Initializing default values for counter files...');
    
    for (const [fileName, defaultValue] of Object.entries(defaultValues)) {
        const filePath = path.join(folderPath, fileName);
        fs.writeFileSync(filePath, defaultValue);
        printStatus(`Created ${fileName} with default value: "${defaultValue}"`);
    }
}

function copyFile(sourcePath, destPath) {
    try {
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
            printStatus(`Copied: ${sourcePath} -> ${destPath}`);
            return { success: true };
        } else {
            const errorMsg = `File not found: ${sourcePath}`;
            printWarning(errorMsg);
            return { success: false, reason: errorMsg, filePath: sourcePath };
        }
    } catch (error) {
        const errorMsg = `Error copying ${sourcePath}: ${error.message}`;
        printError(errorMsg);
        return { success: false, reason: errorMsg, filePath: sourcePath };
    }
}

function copyPatternFiles(pattern, destPath) {
    const glob = require('glob');
    const files = glob.sync(pattern);
    
    if (files.length === 0) {
        const errorMsg = `No files found matching pattern: ${pattern}`;
        printWarning(errorMsg);
        return { success: false, reason: errorMsg, filePath: pattern };
    }
    
    let copiedCount = 0;
    let errors = [];
    
    files.forEach(file => {
        const fileName = path.basename(file);
        const destFile = path.join(destPath, fileName);
        const result = copyFile(file, destFile);
        if (result.success) {
            copiedCount++;
        } else {
            errors.push(result.reason);
        }
    });
    
    if (copiedCount > 0) {
        printStatus(`Copied ${copiedCount} files from pattern: ${pattern}`);
    }
    
    if (errors.length > 0) {
        const errorMsg = `Some files failed to copy: ${errors.join('; ')}`;
        return { success: false, reason: errorMsg, filePath: pattern };
    }
    
    return { success: copiedCount > 0 };
}

async function handleMigrationItem(item, timestampPath) {
    printHeader(`\n${item.name}`);
    console.log(`Description: ${item.description}`);
    console.log(`Type: ${item.type}`);
    console.log(`Required: ${item.required ? 'Yes' : 'No'}`);
    console.log(`Default location: ${item.defaultPath}`);
    console.log(`Instructions: ${item.instructions}`);
    
    const hasData = await question('\nDo you have this data ready? (Y/n): ');
    
    if (hasData.toLowerCase() === 'n' || hasData.toLowerCase() === 'no') {
        if (item.required) {
            const reason = `User skipped required item: ${item.name}`;
            printWarning(`⚠️  ${item.name} is required but not ready. You'll need to provide it later.`);
            return { success: false, reason: reason };
        } else {
            printInfo(`Skipping optional item: ${item.name}`);
            return { success: false, reason: `User skipped optional item: ${item.name}` };
        }
    }
    
    let sourcePath;
    if (item.type === 'env_file') {
        sourcePath = await question(`Enter the path to ${item.name} (or press Enter for default): `);
        if (!sourcePath.trim()) {
            sourcePath = item.defaultPath;
        }
        
        // Copy the entire .env file to the timestamp folder
        const fileName = path.basename(sourcePath);
        const destPath = path.join(timestampPath, fileName);
        return copyFile(sourcePath, destPath);
    } else {
        sourcePath = await question(`Enter the path to ${item.name} (or press Enter for default): `);
        if (!sourcePath.trim()) {
            sourcePath = item.defaultPath;
        }
    }
    
    if (item.type === 'pattern') {
        return copyPatternFiles(sourcePath, timestampPath);
    } else {
        const fileName = path.basename(sourcePath);
        const destPath = path.join(timestampPath, fileName);
        return copyFile(sourcePath, destPath);
    }
}

async function createMigrationManifest(timestampPath, migrationResults) {
    const manifest = {
        timestamp: new Date().toISOString(),
        migrationItems: migrationResults,
        summary: {
            total: migrationItems.length,
            successful: migrationResults.filter(r => r.success).length,
            failed: migrationResults.filter(r => !r.success).length
        }
    };
    
    const manifestPath = path.join(timestampPath, 'migration-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    printStatus(`Created migration manifest: ${manifestPath}`);
    
    return manifest;
}

async function updateGitignore() {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const gitignoreContent = '\n# Migration initialization data\ndata/init/\n';
    
    if (fs.existsSync(gitignorePath)) {
        const currentContent = fs.readFileSync(gitignorePath, 'utf8');
        if (!currentContent.includes('data/init/')) {
            fs.appendFileSync(gitignorePath, gitignoreContent);
            printStatus('Updated .gitignore to exclude init folder');
        } else {
            printInfo('.gitignore already excludes init folder');
        }
    } else {
        fs.writeFileSync(gitignorePath, gitignoreContent);
        printStatus('Created .gitignore with init folder exclusion');
    }
}

function listInitFolderFiles(folderPath) {
    printHeader('📁 Files in Init Folder');
    
    try {
        const files = fs.readdirSync(folderPath);
        
        if (files.length === 0) {
            printWarning('No files found in the init folder');
            return;
        }
        
        // Sort files alphabetically
        files.sort();
        
        console.log(`Files in: ${folderPath}\n`);
        
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isDirectory()) {
                console.log(`📁 ${file}/`);
            } else {
                const size = stats.size;
                const sizeStr = size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
                console.log(`📄 ${file} (${sizeStr})`);
            }
        }
        
        console.log(`\nTotal files: ${files.length}`);
        
    } catch (error) {
        printError(`Error listing files: ${error.message}`);
    }
}

async function main() {
    printHeader('🚀 Chatterbox Migration Initialization');
    console.log('This script will help you prepare for data migration by:');
    console.log('1. Checking all prerequisites are in place');
    console.log('2. Creating an init folder under data/');
    console.log('3. Walking through each file/API key that needs migration');
    console.log('4. Asking for data locations (with defaults)');
    console.log('5. Creating a named folder with description');
    console.log('6. Copying files to the named folder');
    console.log('7. Initializing default values for counter files');
    console.log('8. Preparing for new migration script');
    
    // Step 0: Run prerequisite checks
    printHeader('🔍 Checking Prerequisites');
    console.log('Running prerequisite checks to ensure all required components are in place...\n');
    
    try {
        const { main: checkPrerequisites } = require('./check-prerequisites');
        await checkPrerequisites();
    } catch (error) {
        printError(`Prerequisites check failed: ${error.message}`);
        console.log('\nPlease fix the prerequisite issues above before proceeding with migration preparation.');
        console.log('You can run the prerequisite check separately with: node scripts/check-prerequisites.js\n');
        rl.close();
        process.exit(1);
    }
    
    const proceed = await question('\nPrerequisites check passed! Do you want to proceed with migration preparation? (y/n): ');
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log('Migration initialization cancelled.');
        rl.close();
        return;
    }
    
    try {
        // Step 1: Create init folder
        const initPath = await createInitFolder();
        
        // Step 2: Get folder name and description
        const defaultName = 'awsinit';
        const defaultDescription = `Preparation for Chatterbox migration to aws at ${new Date().toISOString()}`;
        
        const folderName = await question(`\nEnter folder name (or press Enter for default "${defaultName}"): `);
        const finalFolderName = folderName.trim() || defaultName;
        
        const description = await question(`\nEnter description (or press Enter for default): `);
        const finalDescription = description.trim() || defaultDescription;
        
        // Step 3: Create named folder
        const folderPath = createNamedFolder(initPath, finalFolderName, finalDescription);
        
        // Step 4: Initialize default values for counter files
        initializeDefaultValues(folderPath);
        
        // Step 5: Walk through migration items
        const migrationResults = [];
        
        for (const item of migrationItems) {
            const result = await handleMigrationItem(item, folderPath);
            migrationResults.push({
                name: item.name,
                success: result.success,
                reason: result.reason,
                timestamp: new Date().toISOString()
            });
        }
        
        // Step 6: Create migration manifest
        const manifest = await createMigrationManifest(folderPath, migrationResults);
        
        // Step 7: Update .gitignore
        await updateGitignore();
        
        // Step 8: Summary
        printHeader('📋 Migration Initialization Summary');
        console.log(`Folder name: ${finalFolderName}`);
        console.log(`Description: ${finalDescription}`);
        console.log(`Total items: ${manifest.summary.total}`);
        console.log(`Successful: ${manifest.summary.successful}`);
        console.log(`Failed: ${manifest.summary.failed}`);
        console.log(`Folder path: ${folderPath}`);
        
        // At the end, summarize failed items with reasons
        const failedItems = migrationResults.filter(item => !item.success);
        if (failedItems.length > 0) {
            console.log('\n❌ The following items failed to migrate:');
            failedItems.forEach(item => {
                console.log(`- ${item.name}: ${item.reason || 'Unknown reason'}`);
            });
        } else {
            console.log('\n✅ All items migrated successfully.');
            
            // Only show file listing if there were no errors
            listInitFolderFiles(folderPath);
        }
        
        printHeader('📋 Next Steps');
        console.log('1. Review the files in the folder');
        console.log('2. Verify all required data is present');
        console.log('3. Run migration: npm run aws:init:migrate');
        console.log('4. Test the migration process');
        
        printStatus('\nMigration initialization completed successfully!');
        
    } catch (error) {
        printError(`Migration initialization failed: ${error.message}`);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();