#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

console.log(chalk.blue('💾 Local System Backup for Chatterbox\n'));

// Configuration items that can be backed up
const BACKUP_ITEMS = [
  {
    id: 'gmail-tokens',
    name: 'Gmail OAuth Tokens',
    description: 'OAuth tokens for Gmail API access',
    usage: 'Used by mail polling, sending, and authorization functions',
    documentation: 'See src/mail/authorizeGmail.ts and Cloud/AWS/SECRETS_MIGRATION.md',
    locations: [
      {
        path: 'tokens/gmail_tokens.json',
        type: 'file',
        description: 'Main Gmail tokens file with access and refresh tokens'
      },
      {
        path: 'data/token.json',
        type: 'file',
        description: 'Legacy token file for Gmail polling'
      }
    ],
    sensitive: true
  },
  {
    id: 'openai-api-key',
    name: 'OpenAI API Key',
    description: 'API key for OpenAI services (GPT models)',
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
    usage: 'Used to track send test progress and email numbering',
    documentation: 'See test/sendGmail.test.ts and data/ directory',
    locations: [
      {
        path: 'data/sendtest_token.json',
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

function writeBackupMetadata(backupDir, metadata) {
  try {
    const metadataPath = path.join(backupDir, 'backup-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    return metadataPath;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to write backup metadata: ${error.message}`));
    return false;
  }
}

function writeBackupLog(backupDir, logEntry) {
  try {
    const logPath = path.join(backupDir, 'backup-log.txt');
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${logEntry}\n`;
    fs.appendFileSync(logPath, logLine);
    return logPath;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to write backup log: ${error.message}`));
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
      backupDir: path.relative('./backups', backupDir),
      name: metadata.name || 'Unnamed',
      notes: metadata.notes || '',
      filesBackedUp: metadata.filesBackedUp || 0
    };
    
    const logLine = `[${timestamp}] ${action.toUpperCase()} - ${logEntry.name} - ${logEntry.notes} - ${logEntry.filesBackedUp} files - ${logEntry.backupDir}\n`;
    
    // Ensure backups directory exists
    fs.mkdirSync('./backups', { recursive: true });
    fs.appendFileSync(globalLogPath, logLine);
    return globalLogPath;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to write global log: ${error.message}`));
    return false;
  }
}

async function backupItem(item, options) {
  const { force = false, backupDir } = options;
  
  console.log(chalk.blue(`\n📋 Processing: ${item.name}`));
  console.log(chalk.gray(`   Description: ${item.description}`));
  console.log(chalk.gray(`   Usage: ${item.usage}`));
  console.log(chalk.gray(`   Documentation: ${item.documentation}`));

  let totalProcessed = 0;
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
    let shouldBackup = false;
    
    if (force) {
      shouldBackup = true;
    } else {
      const question = `   💾 Backup ${location.description}?`;
      shouldBackup = await promptUser(question, false);
    }

    if (shouldBackup) {
      const backupPath = backupFile(location.path, backupDir);
      if (backupPath) {
        console.log(chalk.green(`   ✅ Backed up to ${backupPath}`));
        totalBackedUp++;
      }
    } else {
      console.log(chalk.gray(`   ⏭️  Skipped ${location.path}`));
    }
  }

  return { processed: totalProcessed, backedUp: totalBackedUp };
}

function showUsage() {
  console.log(chalk.blue('Local System Backup for Chatterbox'));
  console.log(chalk.gray('\nUsage:'));
  console.log(chalk.gray('  npm run backup:local [options]'));
  console.log(chalk.gray('  node scripts/backup-local-system.js [options]'));
  console.log('');
  console.log(chalk.blue('Options:'));
  console.log(chalk.gray('  --force        Skip individual confirmations'));
  console.log(chalk.gray('  --backup-dir   Specify custom backup directory'));
  console.log(chalk.gray('  --name         Specify backup name (skips prompt)'));
  console.log(chalk.gray('  --notes        Specify backup notes (skips prompt)'));
  console.log(chalk.gray('  --help         Show this help message'));
  console.log('');
  console.log(chalk.blue('Examples:'));
  console.log(chalk.gray('  npm run backup:local                    # Interactive backup'));
  console.log(chalk.gray('  npm run backup:local --force            # Backup all without confirmation'));
  console.log(chalk.gray('  npm run backup:local --backup-dir ./my-backups # Custom backup location'));
  console.log(chalk.gray('  npm run backup:local --name "Pre-deployment" --notes "Before AWS migration"'));
  console.log('');
  console.log(chalk.blue('What gets backed up:'));
  BACKUP_ITEMS.forEach(item => {
    console.log(chalk.gray(`  • ${item.name}: ${item.description}`));
  });
  console.log('');
  console.log(chalk.blue('Backup format:'));
  console.log(chalk.gray('  • Timestamped files: filename.2024-01-15T10-30-00-000Z.backup'));
  console.log(chalk.gray('  • Organized by type: Gmail, OpenAI, Google, etc.'));
  console.log(chalk.gray('  • Sensitive data masked in output'));
  console.log(chalk.gray('  • Metadata and logs stored with each backup'));
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse options
  const options = {
    force: args.includes('--force'),
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
  if (!options.backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    options.backupDir = `./backups/backup-${timestamp}`;
  }

  // Create backup directory
  try {
    fs.mkdirSync(options.backupDir, { recursive: true });
    console.log(chalk.blue(`📁 Backup directory: ${options.backupDir}`));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to create backup directory: ${error.message}`));
    process.exit(1);
  }

  // Get backup name and notes
  let backupName = options.name;
  let backupNotes = options.notes;

  if (!backupName) {
    backupName = await promptUser('📝 Enter a name for this backup', 'Local System Backup', true);
    if (!backupName.trim()) {
      backupName = 'Local System Backup';
    }
  }

  if (!backupNotes) {
    backupNotes = await promptUser('📝 Enter notes for this backup (optional)', '', true);
  }

  console.log(chalk.blue(`\n📋 Backup Details:`));
  console.log(chalk.blue(`   Name: ${backupName}`));
  console.log(chalk.blue(`   Notes: ${backupNotes || 'None'}`));

  // Handle force mode
  if (options.force) {
    console.log(chalk.red('🚨 FORCE MODE - BACKING UP ALL FILES'));
    console.log(chalk.red('This will backup ALL sensitive data without any prompts!'));
    console.log(chalk.red(''));
  } else {
    console.log(chalk.blue('💾 Interactive Local System Backup'));
    console.log(chalk.gray('This will backup sensitive configuration data from your local system.'));
    console.log(chalk.gray('Each item will be prompted individually unless you use --force.'));
    console.log(chalk.gray(''));
  }

  // Process each backup item
  let totalProcessed = 0;
  let totalBackedUp = 0;

  for (const item of BACKUP_ITEMS) {
    const result = await backupItem(item, options);
    totalProcessed += result.processed;
    totalBackedUp += result.backedUp;
  }

  // Create backup metadata
  const metadata = {
    name: backupName,
    notes: backupNotes,
    timestamp: new Date().toISOString(),
    action: 'backup',
    filesBackedUp: totalBackedUp,
    filesProcessed: totalProcessed,
    items: BACKUP_ITEMS.map(item => ({
      id: item.id,
      name: item.name,
      backedUp: true
    }))
  };

  // Write metadata and logs
  const metadataPath = writeBackupMetadata(options.backupDir, metadata);
  const logPath = writeBackupLog(options.backupDir, `BACKUP - ${backupName} - ${backupNotes || 'No notes'}`);
  const globalLogPath = writeGlobalLog('backup', options.backupDir, metadata);

  // Summary
  console.log(chalk.blue(`\n📊 Backup Summary:`));
  console.log(chalk.green(`   ✅ Backed up: ${totalBackedUp} files`));
  console.log(chalk.gray(`   ⏭️  Processed: ${totalProcessed} files`));
  console.log(chalk.blue(`   💾 Backups saved to: ${options.backupDir}`));
  console.log(chalk.gray(`   📝 To restore, use: npm run restore:local ${options.backupDir}`));
  
  if (metadataPath) {
    console.log(chalk.blue(`   📋 Metadata: ${metadataPath}`));
  }
  if (logPath) {
    console.log(chalk.blue(`   📝 Log: ${logPath}`));
  }
  if (globalLogPath) {
    console.log(chalk.blue(`   🌐 Global log: ${globalLogPath}`));
  }

  console.log(chalk.blue(`\n🎉 Local system backup completed!`));
  
  if (totalBackedUp > 0) {
    console.log(chalk.yellow(`\n💡 Next steps:`));
    console.log(chalk.yellow(`   • Keep backup directory secure`));
    console.log(chalk.yellow(`   • Test restore functionality: npm run restore:local ${options.backupDir}`));
    console.log(chalk.yellow(`   • Consider encrypting backup directory for additional security`));
  } else {
    console.log(chalk.gray(`\n📝 No files were backed up.`));
  }
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red('❌ Backup operation failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});
