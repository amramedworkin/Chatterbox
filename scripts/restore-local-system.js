#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const inquirer = require('inquirer');

console.log(chalk.blue('🔄 Local System Restore for Chatterbox\n'));

function expandHomePath(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE, filePath.slice(2));
  }
  return filePath;
}

function findBackupDirectories(baseDir = './backups') {
  try {
    if (!fs.existsSync(baseDir)) {
      return [];
    }

    const items = fs.readdirSync(baseDir, { withFileTypes: true });
    const backupDirs = items
      .filter(item => item.isDirectory() && (item.name.startsWith('backup-') || item.name.startsWith('clean-')))
      .map(item => ({
        name: item.name,
        path: path.join(baseDir, item.name),
        fullPath: path.resolve(baseDir, item.name)
      }));

    return backupDirs.sort((a, b) => b.name.localeCompare(a.name)); // Sort newest first
  } catch (error) {
    console.error(chalk.red(`❌ Error reading backup directories: ${error.message}`));
    return [];
  }
}

function readBackupMetadata(backupDir) {
  try {
    const metadataPath = path.join(backupDir, 'backup-metadata.json');
    const cleanMetadataPath = path.join(backupDir, 'clean-metadata.json');
    
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return {
        name: metadata.name || 'Unnamed Backup',
        notes: metadata.notes || 'No notes provided',
        timestamp: metadata.timestamp,
        action: metadata.action || 'backup',
        filesBackedUp: metadata.filesBackedUp || 0
      };
    } else if (fs.existsSync(cleanMetadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(cleanMetadataPath, 'utf8'));
      return {
        name: metadata.name || 'Unnamed Clean',
        notes: metadata.notes || 'No notes provided',
        timestamp: metadata.timestamp,
        action: metadata.action || 'clean',
        filesBackedUp: metadata.filesBackedUp || 0
      };
    } else {
      // Extract info from directory name
      const dirName = path.basename(backupDir);
      const timestampMatch = dirName.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
      const timestamp = timestampMatch ? timestampMatch[1] : null;
      
      return {
        name: timestamp ? new Date(timestamp.replace(/-/g, ':').replace('T', ' ').replace('Z', '')).toLocaleString() : dirName,
        notes: 'No metadata available',
        timestamp: timestamp,
        action: dirName.startsWith('clean-') ? 'clean' : 'backup',
        filesBackedUp: 0
      };
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error reading backup metadata: ${error.message}`));
    return {
      name: path.basename(backupDir),
      notes: 'Error reading metadata',
      timestamp: null,
      action: 'unknown',
      filesBackedUp: 0
    };
  }
}

function findBackupFiles(backupDir) {
  try {
    if (!fs.existsSync(backupDir)) {
      console.log(chalk.red(`❌ Backup directory not found: ${backupDir}`));
      return [];
    }

    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(file => file.endsWith('.backup'));
    
    return backupFiles.map(file => ({
      name: file,
      path: path.join(backupDir, file),
      originalName: file.replace(/\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.backup$/, ''),
      timestamp: file.match(/\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.backup$/)?.[1]
    }));
  } catch (error) {
    console.error(chalk.red(`❌ Error reading backup directory: ${error.message}`));
    return [];
  }
}

function restoreFile(backupFile, targetDir = '.') {
  try {
    const targetPath = path.join(targetDir, backupFile.originalName);
    const expandedTargetPath = expandHomePath(targetPath);
    
    // Create target directory if it doesn't exist
    const targetDirPath = path.dirname(expandedTargetPath);
    if (!fs.existsSync(targetDirPath)) {
      fs.mkdirSync(targetDirPath, { recursive: true });
    }

    fs.copyFileSync(backupFile.path, expandedTargetPath);
    return true;
  } catch (error) {
    console.error(chalk.red(`   ❌ Failed to restore ${backupFile.originalName}: ${error.message}`));
    return false;
  }
}

async function promptUser(question, defaultValue = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question(chalk.yellow(`${question} (${defaultValue ? 'Y' : 'n'}/${defaultValue ? 'y' : 'N'}): `), (ans) => {
      rl.close();
      resolve(ans.toLowerCase());
    });
  });

  return answer === 'y' || answer === 'yes' || (defaultValue && answer === '');
}

async function selectBackupDirectory() {
  const backupDirs = findBackupDirectories();
  
  if (backupDirs.length === 0) {
    console.log(chalk.yellow('⚠️  No backup directories found.'));
    console.log(chalk.gray('Make sure you have run the backup or clean script first.'));
    process.exit(1);
  }

  console.log(chalk.blue(`📁 Found ${backupDirs.length} backup directories:`));

  // Read metadata for each backup directory
  const backupOptions = backupDirs.map(dir => {
    const metadata = readBackupMetadata(dir.path);
    return {
      name: metadata.name,
      value: dir.path,
      metadata: metadata,
      dirName: dir.name
    };
  });

  // Create choices for inquirer with detailed information including notes
  const choices = backupOptions.map(option => {
    const notes = option.metadata.notes === 'No notes provided' || option.metadata.notes === 'No metadata available' 
      ? 'No more details' 
      : option.metadata.notes;
    
    return {
      name: `${option.name} (${option.metadata.action}) — ${notes}`,
      value: option.value,
      metadata: option.metadata,
      dirName: option.dirName,
      notes: notes
    };
  });

  // Add a separator and help text
  choices.unshift({ name: 'Available Backups:', disabled: true });
  choices.push({ name: '', disabled: true });

  const { selectedBackup } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBackup',
      message: 'Select a backup to restore from:',
      choices: choices,
      pageSize: 10,
      loop: false
    }
  ]);

  // Find the selected backup metadata
  const selectedOption = backupOptions.find(option => option.value === selectedBackup);
  
  console.log(chalk.blue(`\n📋 Selected Backup Details:`));
  console.log(chalk.blue(`   Name: ${selectedOption.metadata.name}`));
  console.log(chalk.blue(`   Notes: ${selectedOption.metadata.notes}`));
  console.log(chalk.blue(`   Action: ${selectedOption.metadata.action}`));
  console.log(chalk.blue(`   Files: ${selectedOption.metadata.filesBackedUp}`));
  console.log(chalk.blue(`   Directory: ${selectedOption.dirName}`));

  return selectedBackup;
}

function showUsage() {
  console.log(chalk.blue('Local System Restore for Chatterbox'));
  console.log(chalk.gray('\nUsage:'));
  console.log(chalk.gray('  npm run restore:local [backup-dir] [options]'));
  console.log(chalk.gray('  node scripts/restore-local-system.js [backup-dir] [options]'));
  console.log('');
  console.log(chalk.blue('Arguments:'));
  console.log(chalk.gray('  backup-dir    Directory containing backup files (default: interactive selection)'));
  console.log('');
  console.log(chalk.blue('Options:'));
  console.log(chalk.gray('  --force       Skip confirmations and restore all files'));
  console.log(chalk.gray('  --target-dir  Specify target directory for restoration'));
  console.log(chalk.gray('  --help        Show this help message'));
  console.log('');
  console.log(chalk.blue('Examples:'));
  console.log(chalk.gray('  npm run restore:local                    # Interactive backup selection'));
  console.log(chalk.gray('  npm run restore:local ./backups/custom   # Restore from specific backup directory'));
  console.log(chalk.gray('  npm run restore:local --force            # Restore all files without confirmation'));
  console.log(chalk.gray('  npm run restore:local --target-dir ./new # Restore to different target directory'));
  console.log('');
  console.log(chalk.blue('What gets restored:'));
  console.log(chalk.gray('  • Gmail OAuth tokens'));
  console.log(chalk.gray('  • OpenAI API keys'));
  console.log(chalk.gray('  • Google service account credentials'));
  console.log(chalk.gray('  • Email addresses and configuration'));
  console.log(chalk.gray('  • Polling and test state files'));
  console.log(chalk.gray('  • AWS credentials (if backed up)'));
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse options
  const options = {
    force: args.includes('--force'),
    targetDir: '.'
  };

  // Parse target directory
  const targetDirIndex = args.indexOf('--target-dir');
  if (targetDirIndex !== -1 && targetDirIndex + 1 < args.length) {
    options.targetDir = args[targetDirIndex + 1];
  }

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  // Determine backup directory
  let backupDir = null;
  if (args.length > 0 && !args[0].startsWith('--')) {
    backupDir = args[0];
  } else {
    // Interactive backup selection
    backupDir = await selectBackupDirectory();
  }

  console.log(chalk.blue(`📁 Restoring from: ${backupDir}`));
  console.log(chalk.blue(`🎯 Target directory: ${options.targetDir}`));

  // Find backup files
  const backupFiles = findBackupFiles(backupDir);
  
  if (backupFiles.length === 0) {
    console.log(chalk.yellow('⚠️  No backup files found in the selected directory.'));
    console.log(chalk.gray('Make sure you have run the clean script with backup enabled first.'));
    process.exit(1);
  }

  console.log(chalk.green(`\n📋 Found ${backupFiles.length} backup files:`));
  
  // Group files by type
  const fileGroups = {};
  backupFiles.forEach(file => {
    const group = file.originalName.includes('gmail') ? 'Gmail' :
                  file.originalName.includes('openai') ? 'OpenAI' :
                  file.originalName.includes('google') ? 'Google' :
                  file.originalName.includes('aws') ? 'AWS' :
                  file.originalName.includes('config') ? 'Configuration' :
                  file.originalName.includes('state') ? 'State' :
                  file.originalName.includes('test') ? 'Test' : 'Other';
    
    if (!fileGroups[group]) {
      fileGroups[group] = [];
    }
    fileGroups[group].push(file);
  });

  // Display grouped files
  Object.entries(fileGroups).forEach(([group, files]) => {
    console.log(chalk.blue(`\n${group} Files:`));
    files.forEach(file => {
      const timestamp = file.timestamp ? 
        new Date(file.timestamp.replace(/-/g, ':').replace('T', ' ').replace('Z', '')) :
        null;
      const timeStr = timestamp ? timestamp.toLocaleString() : 'Unknown time';
      console.log(chalk.gray(`   • ${file.originalName} (${timeStr})`));
    });
  });

  // Handle force mode
  if (options.force) {
    console.log(chalk.red('\n🚨 FORCE MODE - RESTORING ALL FILES'));
  } else {
    console.log(chalk.blue('\n🔄 Interactive Restore'));
    console.log(chalk.gray('Each file group will be prompted individually unless you use --force.'));
  }

  // Process each group
  let totalRestored = 0;
  let totalSkipped = 0;

  for (const [group, files] of Object.entries(fileGroups)) {
    console.log(chalk.blue(`\n📋 Processing ${group} files...`));
    
    let shouldRestore = false;
    
    if (options.force) {
      shouldRestore = true;
    } else {
      const question = `   🔄 Restore ${group.toLowerCase()} files (${files.length} files)?`;
      shouldRestore = await promptUser(question, false);
    }

    if (shouldRestore) {
      let groupRestored = 0;
      
      for (const file of files) {
        const success = restoreFile(file, options.targetDir);
        if (success) {
          console.log(chalk.green(`   ✅ Restored ${file.originalName}`));
          groupRestored++;
          totalRestored++;
        } else {
          totalSkipped++;
        }
      }
      
      console.log(chalk.green(`   📊 ${group}: ${groupRestored}/${files.length} files restored`));
    } else {
      console.log(chalk.gray(`   ⏭️  Skipped ${group} files`));
      totalSkipped += files.length;
    }
  }

  // Summary
  console.log(chalk.blue(`\n📊 Restore Summary:`));
  console.log(chalk.green(`   ✅ Restored: ${totalRestored} files`));
  console.log(chalk.gray(`   ⏭️  Skipped: ${totalSkipped} files`));
  console.log(chalk.blue(`   🎯 Target: ${options.targetDir}`));

  console.log(chalk.blue(`\n🎉 Local system restore completed!`));
  
  if (totalRestored > 0) {
    console.log(chalk.yellow(`\n💡 Next steps:`));
    console.log(chalk.yellow(`   • Verify restored files are correct`));
    console.log(chalk.yellow(`   • Test application functionality`));
    console.log(chalk.yellow(`   • Re-authorize services if needed`));
  } else {
    console.log(chalk.gray(`\n📝 No files were restored.`));
  }
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red('❌ Restore operation failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
}); 