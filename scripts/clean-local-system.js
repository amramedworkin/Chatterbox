#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const crypto = require('crypto');

console.log(chalk.blue('🧹 Local System Clean for Chatterbox\n'));

// Configuration items that need cleaning
const CLEANUP_ITEMS = [
  {
    id: 'gmail-tokens',
    name: 'Gmail OAuth Tokens',
    description: 'OAuth tokens for Gmail API access',
    impact: 'Removes ability to access Gmail accounts for polling and sending emails',
    usage: 'Used by mail polling, sending, and authorization functions',
    documentation: 'See src/mail/authorizeGmail.ts and Cloud/AWS/SECRETS_MIGRATION.md',
    locations: [
      {
        path: 'tokens/gmail_tokens.json',
        type: 'file',
        description: 'Main Gmail tokens file with access and refresh tokens'
      },
      {
        path: 'data/google_tokens.json',
        type: 'file',
        description: 'Gmail OAuth tokens'
      }
    ],
    sensitive: true
  },
  {
    id: 'openai-api-key',
    name: 'OpenAI API Key',
    description: 'API key for OpenAI services (GPT models)',
    impact: 'Removes ability to use OpenAI LLM services for email processing and AI interactions',
    usage: 'Used by askAgent, dialogAgent, and emailAgent for AI-powered responses',
    documentation: 'See src/openai/ and Cloud/AWS/SECRETS_MIGRATION.md',
    locations: [
      {
        path: '.env',
        type: 'file',
        description: 'Environment file containing OPENAI_API_KEY',
        extract: (content) => {
          const match = content.match(/OPENAI_API_KEY\s*=\s*['"]?([^'"\n]+)['"]?/);
          return match ? match[1] : null;
        }
      }
    ],
    sensitive: true
  },
  {
    id: 'google-credentials',
    name: 'Google Service Account Credentials',
    description: 'Google OAuth client credentials for API access',
    impact: 'Removes ability to authenticate with Google APIs for Gmail and other services',
    usage: 'Used for OAuth2 authentication flow and API client initialization',
    documentation: 'See src/mail/authorizeGmail.ts and Cloud/AWS/SECRETS_MIGRATION.md',
    locations: [
      {
        path: 'tokens/google_credentials.json',
        type: 'file',
        description: 'Google OAuth client credentials (web or service account format)'
      }
    ],
    sensitive: true
  },
  {
    id: 'email-addresses',
    name: 'Email Addresses',
    description: 'Email addresses stored in configuration files',
    impact: 'Removes default email addresses for polling, sending, and testing',
    usage: 'Used as default values for Gmail operations and test configurations',
    documentation: 'See config.json and src/loadConfig.ts',
    locations: [
      {
        path: 'config.json',
        type: 'file',
        description: 'Main configuration file with email addresses',
        extract: (content) => {
          try {
            const config = JSON.parse(content);
            return {
              'app.defaultPollGmailUser': config.app?.defaultPollGmailUser,
              'app.defaultSendGmailUser': config.app?.defaultSendGmailUser,
              'app.defaultGetGmailUser': config.app?.defaultGetGmailUser,
              'sendTest.defaultRecipient': config.sendTest?.defaultRecipient
            };
          } catch {
            return null;
          }
        }
      }
    ],
    sensitive: false
  },
  {
    id: 'polling-state',
    name: 'Gmail Polling State',
    description: 'State files tracking Gmail polling progress',
    impact: 'Resets Gmail polling state, may cause duplicate email processing on next run',
    usage: 'Used to track last polled email, history ID, and polling cycles',
    documentation: 'See src/mail/pollGmail.ts and data/ directory',
    locations: [
      {
        path: 'data/last_history_id.txt',
        type: 'file',
        description: 'Last Gmail history ID for incremental polling'
      },
      {
        path: 'data/last_polled_email.txt',
        type: 'file',
        description: 'Last polled email address'
      },
      {
        path: 'data/last_polled_uid.txt',
        type: 'file',
        description: 'Last polled email UID'
      },
      {
        path: 'data/total_poll_cycles.txt',
        type: 'file',
        description: 'Total number of polling cycles completed'
      },
      {
        path: 'data/state.json',
        type: 'file',
        description: 'Application state file with polling information'
      }
    ],
    sensitive: false
  },
  {
    id: 'send-test-state',
    name: 'Send Test State',
    description: 'State files for email sending tests',
    impact: 'Resets send test state, may affect test email numbering and tracking',
    usage: 'Used to track send test progress and email numbering',
    documentation: 'See test/sendGmail.test.ts and data/ directory',
    locations: [
      {
        // Removed: sendtest_google_tokens.json - now using standard google_tokens.json
        type: 'file',
        description: 'Send test Gmail tokens'
      },
      {
        path: 'data/sendtest_last_sent_email_number.txt',
        type: 'file',
        description: 'Last sent email number for send tests'
      },
      {
        path: 'data/sendtest_sender_email.txt',
        type: 'file',
        description: 'Sender email for send tests'
      },
      {
        path: 'data/sendtest_recipient_email.txt',
        type: 'file',
        description: 'Recipient email for send tests'
      },
      {
        path: 'data/sendtest_send_count.txt',
        type: 'file',
        description: 'Send count for send tests'
      }
    ],
    sensitive: false
  },
  {
    id: 'aws-credentials',
    name: 'AWS Credentials',
    description: 'AWS CLI credentials and configuration',
    impact: 'Removes AWS CLI access, affects AWS infrastructure management',
    usage: 'Used for AWS infrastructure deployment, secrets management, and resource access',
    documentation: 'See Cloud/AWS/ and scripts/aws/',
    locations: [
      {
        path: '~/.aws/credentials',
        type: 'file',
        description: 'AWS CLI credentials file',
        expandHome: true
      },
      {
        path: '~/.aws/config',
        type: 'file',
        description: 'AWS CLI configuration file',
        expandHome: true
      }
    ],
    sensitive: true
  }
];

// Items that should NOT be cleaned (semi-static configuration)
const PRESERVE_ITEMS = [
  'config.json:app.interactionsBaseFolder',
  'config.json:polling.defaultIntervalMinutes',
  'config.json:polling.defaultDurationMinutes',
  'config.json:flags.defaultSilent',
  'config.json:openai.llmModel',
  'config.json:openai.maxResponseTokens',
  'config.json:sendTest.testAttachmentsFolder',
  'config.json:sendTest.scopes',
  'config.json:testOpenAi.testPrompt',
  'config.json:testOpenAi.dialogPrompts',
  '.env:INTERACTIONS_BASE_FOLDER',
  '.env:DEFAULT_POLL_INTERVAL_MINUTES',
  '.env:DEFAULT_POLL_DURATION_MINUTES',
  '.env:DEFAULT_SILENT_FLAG',
  '.env:OPENAI_LLM_MODEL',
  '.env:OPENAI_MAX_RESPONSE_TOKENS',
  '.env:SENDTEST_ATTACHMENTS_FOLDER',
  '.env:SENDTEST_SCOPES',
  '.env:TESTOPENAI_PROMPT',
  '.env:TESTOPENAI_DIALOG_PROMPTS'
];

function expandHomePath(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE, filePath.slice(2));
  }
  return filePath;
}

function readFileContent(filePath) {
  try {
    const expandedPath = expandHomePath(filePath);
    if (fs.existsSync(expandedPath)) {
      return fs.readFileSync(expandedPath, 'utf8');
    }
    return null;
  } catch (error) {
    return null;
  }
}

function backupFile(filePath, backupDir) {
  try {
    const expandedPath = expandHomePath(filePath);
    if (!fs.existsSync(expandedPath)) {
      return false;
    }

    const fileName = path.basename(expandedPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
    
    fs.copyFileSync(expandedPath, backupPath);
    return backupPath;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to backup ${filePath}: ${error.message}`));
    return false;
  }
}

function deleteFile(filePath) {
  try {
    const expandedPath = expandHomePath(filePath);
    if (fs.existsSync(expandedPath)) {
      fs.unlinkSync(expandedPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to delete ${filePath}: ${error.message}`));
    return false;
  }
}

function updateConfigFile(filePath, updates, backupDir) {
  try {
    const expandedPath = expandHomePath(filePath);
    if (!fs.existsSync(expandedPath)) {
      return false;
    }

    // Backup original file
    backupFile(filePath, backupDir);

    let content = fs.readFileSync(expandedPath, 'utf8');
    let config;

    if (filePath.endsWith('.json')) {
      config = JSON.parse(content);
    } else if (filePath.endsWith('.env')) {
      // Handle .env file updates
      const lines = content.split('\n');
      const updatedLines = lines.map(line => {
        for (const [key, value] of Object.entries(updates)) {
          if (line.startsWith(`${key}=`)) {
            return `${key}=${value}`;
          }
        }
        return line;
      });
      content = updatedLines.join('\n');
      fs.writeFileSync(expandedPath, content);
      return true;
    }

    // Apply updates to JSON config
    for (const [path, value] of Object.entries(updates)) {
      const keys = path.split('.');
      let current = config;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }

    fs.writeFileSync(expandedPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to update ${filePath}: ${error.message}`));
    return false;
  }
}

function showGlobalWarning() {
  console.log(chalk.red('⚠️  GLOBAL CLEAN WARNING ⚠️'));
  console.log(chalk.red('This will clean ALL sensitive configuration data from your local system.'));
  console.log(chalk.red('This action will:'));
  console.log(chalk.red('  • Remove all Gmail OAuth tokens'));
  console.log(chalk.red('  • Remove OpenAI API keys'));
  console.log(chalk.red('  • Remove Google service account credentials'));
  console.log(chalk.red('  • Remove email addresses from configuration'));
  console.log(chalk.red('  • Reset all polling and test state'));
  console.log(chalk.red('  • Remove AWS credentials (if present)'));
  console.log(chalk.red(''));
  console.log(chalk.red('This will make the application non-functional until you:'));
  console.log(chalk.red('  • Re-authorize Gmail accounts'));
  console.log(chalk.red('  • Re-configure OpenAI API keys'));
  console.log(chalk.red('  • Re-setup Google credentials'));
  console.log(chalk.red('  • Re-configure email addresses'));
  console.log(chalk.red(''));
  console.log(chalk.yellow('If you have not migrated secrets to AWS Secrets Manager,'));
  console.log(chalk.yellow('you will need to re-authorize all services.'));
  console.log(chalk.yellow(''));
  console.log(chalk.yellow('If you have migrated to AWS, you can restore from there.'));
  console.log(chalk.red(''));
}

async function promptUser(question, defaultValue = false, allowEmpty = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question(chalk.yellow(`${question}${defaultValue ? ` (${defaultValue})` : ''}: `), (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });

  if (allowEmpty) {
    return answer;
  }

  return answer === 'y' || answer === 'yes' || (defaultValue && answer === '');
}

function writeCleanMetadata(backupDir, metadata) {
  try {
    const metadataPath = path.join(backupDir, 'clean-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    return metadataPath;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to write clean metadata: ${error.message}`));
    return false;
  }
}

function writeCleanLog(backupDir, logEntry) {
  try {
    const logPath = path.join(backupDir, 'clean-log.txt');
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${logEntry}\n`;
    fs.appendFileSync(logPath, logLine);
    return logPath;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to write clean log: ${error.message}`));
    return false;
  }
}

function writeGlobalLog(action, backupDir, metadata) {
  try {
    const globalLogPath = './backups/backup-actions.log';
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      backupDir: backupDir ? path.relative('./backups', backupDir) : 'N/A',
      name: metadata.name || 'Unnamed',
      notes: metadata.notes || '',
      filesBackedUp: metadata.filesBackedUp || 0,
      filesCleaned: metadata.filesCleaned || 0
    };
    
    const logLine = `[${timestamp}] ${action.toUpperCase()} - ${logEntry.name} - ${logEntry.notes} - ${logEntry.filesBackedUp} backed up, ${logEntry.filesCleaned} cleaned - ${logEntry.backupDir}\n`;
    
    // Ensure backups directory exists
    fs.mkdirSync('./backups', { recursive: true });
    fs.appendFileSync(globalLogPath, logLine);
    return globalLogPath;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to write global log: ${error.message}`));
    return false;
  }
}

async function cleanItem(item, options) {
  const { force = false, wipe = false, backupDir = null } = options;
  
  console.log(chalk.blue(`\n📋 Processing: ${item.name}`));
  console.log(chalk.gray(`   Description: ${item.description}`));
  console.log(chalk.gray(`   Impact: ${item.impact}`));
  console.log(chalk.gray(`   Usage: ${item.usage}`));
  console.log(chalk.gray(`   Documentation: ${item.documentation}`));

  let totalProcessed = 0;
  let totalCleaned = 0;
  let totalBackedUp = 0;

  for (const location of item.locations) {
    const expandedPath = expandHomePath(location.path);
    
    if (!fs.existsSync(expandedPath)) {
      console.log(chalk.gray(`   ⏭️  Skipping ${location.path} (not found)`));
      continue;
    }

    totalProcessed++;

    // Show current value if extract function exists
    if (location.extract) {
      const content = readFileContent(location.path);
      if (content) {
        const extracted = location.extract(content);
        if (extracted) {
          if (typeof extracted === 'object') {
            console.log(chalk.yellow(`   Current values in ${location.path}:`));
            for (const [key, value] of Object.entries(extracted)) {
              if (value) {
                const displayValue = item.sensitive ? 
                  `${value.substring(0, 8)}...${value.substring(value.length - 4)}` : 
                  value;
                console.log(chalk.yellow(`     ${key}: ${displayValue}`));
              }
            }
          } else {
            const displayValue = item.sensitive ? 
              `${extracted.substring(0, 8)}...${extracted.substring(extracted.length - 4)}` : 
              extracted;
            console.log(chalk.yellow(`   Current value: ${displayValue}`));
          }
        }
      }
    }

    // Determine action based on options
    let shouldClean = false;
    
    if (force) {
      shouldClean = true;
    } else {
      const question = `   🗑️  Clean ${location.description}?`;
      shouldClean = await promptUser(question, false);
    }

    if (shouldClean) {
      let success = false;

      if (wipe) {
        // Complete deletion
        success = deleteFile(location.path);
        if (success) {
          console.log(chalk.green(`   ✅ Deleted ${location.path}`));
        }
      } else {
        // Backup and clean
        if (backupDir) {
          const backupPath = backupFile(location.path, backupDir);
          if (backupPath) {
            console.log(chalk.green(`   💾 Backed up to ${backupPath}`));
            totalBackedUp++;
          }
        }

        if (location.path.endsWith('.json') || location.path.endsWith('.env')) {
          // For config files, we might want to reset to defaults instead of deletion
          if (location.path === 'config.json') {
            // Reset email addresses to placeholders
            const updates = {
              'app.defaultPollGmailUser': 'YOUR-POLL-GMAIL-USER-HERE',
              'app.defaultSendGmailUser': 'YOUR-SEND-GMAIL-USER-HERE',
              'app.defaultGetGmailUser': 'YOUR-GET-GMAIL-USER-HERE',
              'sendTest.defaultRecipient': 'YOUR-SENDTEST-RECIPIENT-HERE'
            };
            success = updateConfigFile(location.path, updates, backupDir);
          } else if (location.path === '.env') {
            // Reset API key to placeholder
            const content = readFileContent(location.path);
            if (content) {
              const updatedContent = content.replace(
                /OPENAI_API_KEY\s*=\s*['"]?[^'"\n]+['"]?/,
                'OPENAI_API_KEY=YOUR-OPENAI-API-KEY-HERE'
              );
              fs.writeFileSync(expandedPath, updatedContent);
              success = true;
            }
          } else {
            // Delete other sensitive files
            success = deleteFile(location.path);
          }
        } else {
          // Delete non-config files
          success = deleteFile(location.path);
        }

        if (success) {
          console.log(chalk.green(`   ✅ Cleaned ${location.path}`));
        }
      }

      if (success) {
        totalCleaned++;
      }
    } else {
      console.log(chalk.gray(`   ⏭️  Skipped ${location.path}`));
    }
  }

  return { processed: totalProcessed, cleaned: totalCleaned, backedUp: totalBackedUp };
}

function showUsage() {
  console.log(chalk.blue('Local System Clean for Chatterbox'));
  console.log(chalk.gray('\nUsage:'));
  console.log(chalk.gray('  npm run clean:local [options]'));
  console.log(chalk.gray('  node scripts/clean-local-system.js [options]'));
  console.log('');
  console.log(chalk.blue('Options:'));
  console.log(chalk.gray('  --force        Skip individual confirmations (requires global confirmation)'));
  console.log(chalk.gray('  --force:quiet  Skip all confirmations (dangerous!)'));
  console.log(chalk.gray('  --wipe         Delete files completely instead of backing up'));
  console.log(chalk.gray('  --backup-dir   Specify custom backup directory'));
  console.log(chalk.gray('  --name         Specify clean operation name (skips prompt)'));
  console.log(chalk.gray('  --notes        Specify clean operation notes (skips prompt)'));
  console.log(chalk.gray('  --help         Show this help message'));
  console.log('');
  console.log(chalk.blue('Examples:'));
  console.log(chalk.gray('  npm run clean:local                    # Interactive cleaning with backups'));
  console.log(chalk.gray('  npm run clean:local --force            # Global confirmation, individual backups'));
  console.log(chalk.gray('  npm run clean:local --wipe             # Interactive cleaning, no backups'));
  console.log(chalk.gray('  npm run clean:local --force:quiet --wipe # Complete wipe, no confirmations'));
  console.log(chalk.gray('  npm run clean:local --backup-dir ./backups # Custom backup location'));
  console.log(chalk.gray('  npm run clean:local --name "Pre-migration" --notes "Before AWS migration"'));
  console.log('');
  console.log(chalk.blue('What gets cleaned:'));
  CLEANUP_ITEMS.forEach(item => {
    console.log(chalk.gray(`  • ${item.name}: ${item.description}`));
  });
  console.log('');
  console.log(chalk.blue('What is preserved:'));
  console.log(chalk.gray('  • Polling intervals and durations'));
  console.log(chalk.gray('  • Folder paths and locations'));
  console.log(chalk.gray('  • Test prompts and configurations'));
  console.log(chalk.gray('  • Application flags and settings'));
  console.log(chalk.gray('  • Metadata and logs stored with each operation'));
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse options
  const options = {
    force: args.includes('--force'),
    forceQuiet: args.includes('--force:quiet'),
    wipe: args.includes('--wipe'),
    backupDir: null,
    name: null,
    notes: null
  };

  // Parse backup directory
  const backupDirIndex = args.indexOf('--backup-dir');
  if (backupDirIndex !== -1 && backupDirIndex + 1 < args.length) {
    options.backupDir = args[backupDirIndex + 1];
  }

  // Parse name
  const nameIndex = args.indexOf('--name');
  if (nameIndex !== -1 && nameIndex + 1 < args.length) {
    options.name = args[nameIndex + 1];
  }

  // Parse notes
  const notesIndex = args.indexOf('--notes');
  if (notesIndex !== -1 && notesIndex + 1 < args.length) {
    options.notes = args[notesIndex + 1];
  }

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  // Set default backup directory if not specified
  if (!options.backupDir && !options.wipe) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    options.backupDir = `./backups/clean-${timestamp}`;
  }

  // Create backup directory if needed
  if (options.backupDir && !options.wipe) {
    try {
      fs.mkdirSync(options.backupDir, { recursive: true });
      console.log(chalk.blue(`📁 Backup directory: ${options.backupDir}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create backup directory: ${error.message}`));
      process.exit(1);
    }
  }

  // Get clean operation name and notes
  let cleanName = options.name;
  let cleanNotes = options.notes;

  if (!cleanName) {
    cleanName = await promptUser('📝 Enter a name for this clean operation', 'Local System Clean', true);
    if (!cleanName.trim()) {
      cleanName = 'Local System Clean';
    }
  }

  if (!cleanNotes) {
    cleanNotes = await promptUser('📝 Enter notes for this clean operation (optional)', '', true);
  }

  console.log(chalk.blue(`\n📋 Clean Operation Details:`));
  console.log(chalk.blue(`   Name: ${cleanName}`));
  console.log(chalk.blue(`   Notes: ${cleanNotes || 'None'}`));

  // Handle force:quiet mode
  if (options.forceQuiet) {
    console.log(chalk.red('🚨 FORCE QUIET MODE - NO CONFIRMATIONS'));
    console.log(chalk.red('This will clean ALL sensitive data without any prompts!'));
    console.log(chalk.red(''));
  }
  // Handle force mode
  else if (options.force) {
    showGlobalWarning();
    const proceed = await promptUser('Do you want to continue with global cleaning?', false);
    if (!proceed) {
      console.log(chalk.gray('Operation cancelled.'));
      process.exit(0);
    }
  }
  // Interactive mode
  else {
    console.log(chalk.blue('🧹 Interactive Local System Clean'));
    console.log(chalk.gray('This will clean sensitive configuration data from your local system.'));
    console.log(chalk.gray('Each item will be prompted individually unless you use --force.'));
    console.log(chalk.gray(''));
  }

  // Process each cleanup item
  let totalProcessed = 0;
  let totalCleaned = 0;
  let totalBackedUp = 0;

  for (const item of CLEANUP_ITEMS) {
    const result = await cleanItem(item, options);
    totalProcessed += result.processed;
    totalCleaned += result.cleaned;
    totalBackedUp += result.backedUp || 0;
  }

  // Create clean metadata
  const metadata = {
    name: cleanName,
    notes: cleanNotes,
    timestamp: new Date().toISOString(),
    action: options.wipe ? 'wipe' : 'clean',
    filesBackedUp: totalBackedUp,
    filesCleaned: totalCleaned,
    filesProcessed: totalProcessed,
    wipe: options.wipe,
    items: CLEANUP_ITEMS.map(item => ({
      id: item.id,
      name: item.name,
      cleaned: true
    }))
  };

  // Write metadata and logs
  let metadataPath = null;
  let logPath = null;
  let globalLogPath = null;

  if (options.backupDir && !options.wipe) {
    metadataPath = writeCleanMetadata(options.backupDir, metadata);
    logPath = writeCleanLog(options.backupDir, `CLEAN - ${cleanName} - ${cleanNotes || 'No notes'}`);
  }
  globalLogPath = writeGlobalLog(options.wipe ? 'wipe' : 'clean', options.backupDir, metadata);

  // Summary
  console.log(chalk.blue(`\n📊 Clean Summary:`));
  console.log(chalk.green(`   ✅ Cleaned: ${totalCleaned} items`));
  console.log(chalk.gray(`   ⏭️  Processed: ${totalProcessed} items`));
  
  if (options.backupDir && !options.wipe) {
    console.log(chalk.blue(`   💾 Backups saved to: ${options.backupDir}`));
    console.log(chalk.gray(`   📝 To restore, copy files from backup directory back to their original locations`));
    
    if (metadataPath) {
      console.log(chalk.blue(`   📋 Metadata: ${metadataPath}`));
    }
    if (logPath) {
      console.log(chalk.blue(`   📝 Log: ${logPath}`));
    }
  }

  if (options.wipe) {
    console.log(chalk.red(`   🗑️  Files were completely deleted (no backups)`));
  }

  if (globalLogPath) {
    console.log(chalk.blue(`   🌐 Global log: ${globalLogPath}`));
  }

  console.log(chalk.blue(`\n🎉 Local system clean completed!`));
  
  if (totalCleaned > 0) {
    console.log(chalk.yellow(`\n⚠️  Next steps:`));
    console.log(chalk.yellow(`   • Re-authorize Gmail accounts if needed`));
    console.log(chalk.yellow(`   • Re-configure OpenAI API keys`));
    console.log(chalk.yellow(`   • Re-setup Google credentials`));
    console.log(chalk.yellow(`   • Update email addresses in configuration`));
    console.log(chalk.yellow(`   • Re-configure AWS credentials if needed`));
  }
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red('❌ Clean operation failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});
