# Local System Backup Summary

## Overview

The Local System Backup capability provides a **standalone backup mechanism** that allows you to backup sensitive configuration data without cleaning or modifying any files. This complements the existing clean and restore systems.

## Key Features

### 🔒 **Security & Safety**
- **Non-destructive**: Only creates backups, never modifies original files
- **Sensitive data masking**: API keys and tokens are masked in output
- **Timestamped backups**: Each backup is uniquely identified with ISO timestamps
- **Multiple backup points**: Keep various backups over time for rollback capability

### 📁 **Flexible Operation**
- **Interactive mode**: Prompt for each item individually (default)
- **Force mode**: Backup all items without prompts (`--force`)
- **Custom directories**: Specify your own backup location (`--backup-dir`)
- **Comprehensive coverage**: 7 categories of configuration data

## Quick Start

```bash
# Interactive backup (recommended)
npm run backup:local

# Force backup all items
npm run backup:local --force

# Custom backup location
npm run backup:local --backup-dir ./my-backups

# Show help
npm run backup:local --help
```

## What Gets Backed Up

### 🔐 **Sensitive Data (7 categories)**
1. **Gmail OAuth Tokens** - Access and refresh tokens
2. **OpenAI API Key** - API key for AI services  
3. **Google Credentials** - OAuth client credentials
4. **Email Addresses** - Configuration email addresses
5. **Gmail Polling State** - Polling progress tracking
6. **Send Test State** - Email sending test configurations
7. **AWS Credentials** - AWS CLI configuration

## Backup Structure

### Directory Layout
```
./backups/
├── backup-2024-01-15T10-30-00-000Z/
│   ├── gmail_tokens.json.2024-01-15T10-30-00-000Z.backup
│   ├── google_credentials.json.2024-01-15T10-30-00-000Z.backup
│   ├── .env.2024-01-15T10-30-00-000Z.backup
│   └── ...
└── backup-2024-01-16T14-45-30-123Z/
    └── ...
```

### File Naming
- **Format**: `{originalFileName}.{timestamp}.backup`
- **Example**: `gmail_tokens.json.2024-01-15T10-30-00-000Z.backup`

## Package.json Scripts

| Script | Description |
|--------|-------------|
| `backup:local` | Interactive backup with prompts |
| `backup:local:force` | Backup all items without confirmation |
| `backup:local:custom` | Backup to custom directory `./backups/custom` |

## Integration Points

### 🔄 **Clean System Integration**
- **Shared configuration**: Uses same item definitions as clean system
- **Consistent behavior**: Same prompting and validation logic
- **Complementary workflow**: Backup before cleaning, restore after

### ☁️ **AWS Secrets Manager**
- **Migration preparation**: Backup before migrating to AWS
- **Fallback option**: Local backups as alternative to AWS
- **Hybrid approach**: Use both local backups and AWS secrets

### 🔧 **Environment Management**
- **Environment-specific backups**: Backup before environment changes
- **Deployment safety**: Backup before infrastructure deployments
- **Rollback capability**: Restore from backup if needed

## Use Cases

### 🛡️ **Pre-Deployment Safety**
```bash
# Before making changes
npm run backup:local
# Make your changes
# If something goes wrong, restore
npm run restore:local
```

### 📅 **Regular Backups**
```bash
# Weekly backup
npm run backup:local --backup-dir ./backups/weekly
# Monthly backup  
npm run backup:local --backup-dir ./backups/monthly
```

### 🔄 **Migration Preparation**
```bash
# Before migrating to AWS
npm run backup:local
npm run aws:migrate:secrets
# If migration fails, restore from backup
npm run restore:local
```

### 🚨 **Disaster Recovery**
```bash
# Multiple backup points for rollback
ls ./backups/
# backup-2024-01-15T10-30-00-000Z/
# backup-2024-01-16T14-45-30-123Z/
# backup-2024-01-17T09-15-45-789Z/

# Restore to specific point
npm run restore:local ./backups/backup-2024-01-15T10-30-00-000Z
```

## Security Considerations

### 🔒 **Data Protection**
- **Local storage**: Backups stored locally by default
- **No encryption**: Backups not encrypted (consider manual encryption)
- **Access control**: Ensure backup directories have appropriate permissions
- **Sensitive data**: API keys and tokens masked in output

### 🛡️ **Best Practices**
1. **Secure location**: Store backups in secure, private location
2. **Regular backups**: Create backups before major changes
3. **Multiple points**: Keep several backup versions
4. **Test restoration**: Periodically test restore functionality
5. **Consider encryption**: Encrypt backup directories for additional security

## File Locations

### Scripts
- **Backup Script**: `scripts/backup-local-system.js`
- **Restore Script**: `scripts/restore-local-system.js`
- **Clean Script**: `scripts/clean-local-system.js`

### Documentation
- **Full Documentation**: `LOCAL_SYSTEM_BACKUP.md`
- **Clean System**: `LOCAL_SYSTEM_CLEAN.md`
- **Clean Summary**: `LOCAL_SYSTEM_CLEAN_SUMMARY.md`

## Example Output

```bash
$ npm run backup:local

💾 Interactive Local System Backup
This will backup sensitive configuration data from your local system.
Each item will be prompted individually unless you use --force.

📁 Backup directory: ./backups/backup-2024-01-15T10-30-00-000Z

📋 Processing: Gmail OAuth Tokens
   Description: OAuth tokens for Gmail API access
   Usage: Used by mail polling, sending, and authorization functions
   Documentation: See src/mail/authorizeGmail.ts and Cloud/AWS/SECRETS_MIGRATION.md
   Current value: sk-1234...abcd
   💾 Backup Main Gmail tokens file with access and refresh tokens? (n/Y): y
   ✅ Backed up to ./backups/backup-2024-01-15T10-30-00-000Z/gmail_tokens.json.2024-01-15T10-30-00-000Z.backup

📊 Backup Summary:
   ✅ Backed up: 5 files
   ⏭️  Processed: 8 files
   💾 Backups saved to: ./backups/backup-2024-01-15T10-30-00-000Z
   📝 To restore, use: npm run restore:local ./backups/backup-2024-01-15T10-30-00-000Z

🎉 Local system backup completed!
```

## Related Commands

### 🔄 **Clean System**
```bash
npm run clean:local          # Clean with backup
npm run clean:local --wipe   # Clean without backup
```

### 🔙 **Restore System**
```bash
npm run restore:local        # Restore from backup
npm run restore:local ./backups/backup-2024-01-15T10-30-00-000Z  # Specific backup
```

### ☁️ **AWS Integration**
```bash
npm run aws:migrate:secrets  # Migrate to AWS
npm run aws:smart-migrate    # Smart migration
```

## Benefits

### 🛡️ **Safety**
- **Non-destructive**: Never modifies original files
- **Multiple backup points**: Rollback to any previous state
- **Comprehensive coverage**: All sensitive data backed up

### 🔄 **Flexibility**
- **Interactive or automated**: Choose your workflow
- **Custom locations**: Store backups where you want
- **Integration ready**: Works with clean/restore systems

### 📊 **Transparency**
- **Clear output**: See exactly what's being backed up
- **Masked sensitive data**: Safe to share output
- **Audit trail**: Know what was backed up when

---

**The Local System Backup capability provides a robust, flexible, and safe way to protect your Chatterbox configuration data with timestamped backups that can be restored at any time.** 