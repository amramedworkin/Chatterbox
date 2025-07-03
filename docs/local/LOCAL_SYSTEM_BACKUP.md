# Local System Backup for Chatterbox

## Overview

The Local System Backup capability provides a standalone mechanism to backup sensitive configuration data from your local Chatterbox system without cleaning or modifying any files. This is useful for:

- **Pre-deployment backups**: Before making changes to your system
- **Regular backups**: Periodic backups of your configuration
- **Migration preparation**: Backing up before migrating to AWS Secrets Manager
- **Disaster recovery**: Having multiple backup points to restore from

## Features

### 🔒 **Security-First Design**
- **Sensitive data masking**: API keys and tokens are masked in output
- **Timestamped backups**: Each backup is uniquely identified
- **Organized structure**: Files are grouped by type and purpose
- **Audit trail**: Clear logging of what was backed up

### 📁 **Flexible Backup Options**
- **Interactive mode**: Prompt for each item individually
- **Force mode**: Backup all items without prompts
- **Custom directories**: Specify your own backup location
- **Multiple backup points**: Keep various backups over time

### 🛡️ **Comprehensive Coverage**
- **Gmail OAuth Tokens**: Access and refresh tokens
- **OpenAI API Keys**: API keys for AI services
- **Google Credentials**: OAuth client credentials
- **Email Addresses**: Configuration email addresses
- **Polling State**: Gmail polling progress tracking
- **Send Test State**: Email sending test configurations
- **AWS Credentials**: AWS CLI configuration

## Usage

### Basic Commands

```bash
# Interactive backup (recommended)
npm run backup:local

# Force backup all items without prompts
npm run backup:local --force

# Custom backup directory
npm run backup:local --backup-dir ./my-backups

# Show help
npm run backup:local --help
```

### Package.json Scripts

| Script | Description |
|--------|-------------|
| `backup:local` | Interactive backup with prompts |
| `backup:local:force` | Backup all items without confirmation |
| `backup:local:custom` | Backup to custom directory `./backups/custom` |

### Command Line Options

| Option | Description |
|--------|-------------|
| `--force` | Skip individual confirmations |
| `--backup-dir <path>` | Specify custom backup directory |
| `--help` | Show help message |

## Backup Structure

### Directory Layout
```
./backups/
├── backup-2024-01-15T10-30-00-000Z/
│   ├── gmail_tokens.json.2024-01-15T10-30-00-000Z.backup
│   ├── google_credentials.json.2024-01-15T10-30-00-000Z.backup
│   ├── .env.2024-01-15T10-30-00-000Z.backup
│   ├── config.json.2024-01-15T10-30-00-000Z.backup
│   ├── last_history_id.txt.2024-01-15T10-30-00-000Z.backup
│   └── ...
└── backup-2024-01-16T14-45-30-123Z/
    ├── gmail_tokens.json.2024-01-16T14-45-30-123Z.backup
    └── ...
```

### File Naming Convention
- **Format**: `{originalFileName}.{timestamp}.backup`
- **Timestamp**: ISO 8601 format with colons and periods replaced by hyphens
- **Example**: `gmail_tokens.json.2024-01-15T10-30-00-000Z.backup`

## What Gets Backed Up

### 🔐 **Sensitive Data (Masked in Output)**
1. **Gmail OAuth Tokens**
   - File: `tokens/gmail_tokens.json`
   - File: `data/google_tokens.json`
   - Usage: Gmail API access, polling, sending
   - Documentation: `src/mail/authorizeGmail.ts`

2. **OpenAI API Key**
   - File: `.env`
   - Extraction: `OPENAI_API_KEY` environment variable
   - Usage: AI-powered responses, agents
   - Documentation: `src/openai/`

3. **Google Service Account Credentials**
   - File: `tokens/google_credentials.json`
   - Usage: OAuth2 authentication flow
   - Documentation: `src/mail/authorizeGmail.ts`

4. **AWS Credentials**
   - Files: `~/.aws/credentials`, `~/.aws/config`
   - Usage: AWS infrastructure management
   - Documentation: `Cloud/AWS/`

### 📧 **Configuration Data**
5. **Email Addresses**
   - File: `config.json`
   - Extraction: Email addresses from configuration
   - Usage: Default values for Gmail operations
   - Documentation: `src/loadConfig.ts`

### 📊 **State Data**
6. **Gmail Polling State**
   - Files: `data/last_history_id.txt`, `data/last_polled_email.txt`, etc.
   - Usage: Track polling progress and history
   - Documentation: `src/mail/pollGmail.ts`

7. **Send Test State**
   - Files: `data/sendtest_*.txt`, `data/sendtest_google_tokens.json`
   - Usage: Email sending test configurations
   - Documentation: `test/sendGmail.test.ts`

## Integration with Other Systems

### 🔄 **Clean System Integration**
- **Shared configuration**: Uses same item definitions as clean system
- **Consistent behavior**: Same prompting and validation logic
- **Complementary workflow**: Backup before cleaning, restore after

### ☁️ **AWS Secrets Manager Integration**
- **Migration preparation**: Backup before migrating to AWS
- **Fallback option**: Local backups as alternative to AWS
- **Hybrid approach**: Use both local backups and AWS secrets

### 🔧 **Environment Management**
- **Environment-specific backups**: Backup before environment changes
- **Deployment safety**: Backup before infrastructure deployments
- **Rollback capability**: Restore from backup if needed

## Security Considerations

### 🔒 **Data Protection**
- **Local storage**: Backups are stored locally by default
- **No encryption**: Backups are not encrypted (consider manual encryption)
- **Access control**: Ensure backup directories have appropriate permissions
- **Sensitive data**: API keys and tokens are masked in output

### 🛡️ **Best Practices**
1. **Secure backup location**: Store backups in a secure, private location
2. **Regular backups**: Create backups before major changes
3. **Multiple backup points**: Keep several backup versions
4. **Test restoration**: Periodically test restore functionality
5. **Consider encryption**: Encrypt backup directories for additional security

## Examples

### Interactive Backup Session
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

### Force Backup (No Prompts)
```bash
$ npm run backup:local --force

🚨 FORCE MODE - BACKING UP ALL FILES
This will backup ALL sensitive data without any prompts!

📁 Backup directory: ./backups/backup-2024-01-15T10-30-00-000Z

📋 Processing: Gmail OAuth Tokens
   Description: OAuth tokens for Gmail API access
   Usage: Used by mail polling, sending, and authorization functions
   Documentation: See src/mail/authorizeGmail.ts and Cloud/AWS/SECRETS_MIGRATION.md
   ✅ Backed up to ./backups/backup-2024-01-15T10-30-00-000Z/gmail_tokens.json.2024-01-15T10-30-00-000Z.backup

📊 Backup Summary:
   ✅ Backed up: 8 files
   ⏭️  Processed: 8 files
   💾 Backups saved to: ./backups/backups/backup-2024-01-15T10-30-00-000Z

🎉 Local system backup completed!
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   ❌ Failed to backup ~/.aws/credentials: EACCES: permission denied
   ```
   **Solution**: Check file permissions or run with appropriate privileges

2. **File Not Found**
   ```bash
   ⏭️  Skipping tokens/gmail_tokens.json (not found)
   ```
   **Solution**: This is normal if files don't exist yet

3. **Backup Directory Creation Failed**
   ```bash
   ❌ Failed to create backup directory: EACCES: permission denied
   ```
   **Solution**: Check directory permissions or specify different location

### Error Recovery

1. **Partial Backup**: If backup fails partway through, completed backups are still valid
2. **Retry**: Run backup again to capture remaining files
3. **Manual Backup**: Copy files manually if script fails completely

## Related Commands

### 🔄 **Clean System**
```bash
# Clean with backup
npm run clean:local

# Clean without backup (wipe)
npm run clean:local --wipe
```

### 🔙 **Restore System**
```bash
# Restore from backup
npm run restore:local

# Restore from specific backup
npm run restore:local ./backups/backup-2024-01-15T10-30-00-000Z
```

### ☁️ **AWS Integration**
```bash
# Migrate to AWS Secrets Manager
npm run aws:migrate:secrets

# Smart migration (update only changed secrets)
npm run aws:smart-migrate
```

## File Locations

### Script Files
- **Backup Script**: `scripts/backup-local-system.js`
- **Restore Script**: `scripts/restore-local-system.js`
- **Clean Script**: `scripts/clean-local-system.js`

### Documentation
- **This File**: `LOCAL_SYSTEM_BACKUP.md`
- **Clean System**: `LOCAL_SYSTEM_CLEAN.md`
- **Clean Summary**: `LOCAL_SYSTEM_CLEAN_SUMMARY.md`

### Configuration
- **Package.json Scripts**: `package.json` (backup:local, backup:local:force, etc.)
- **Item Definitions**: Defined in backup script for consistency

## Future Enhancements

### 🔮 **Planned Features**
1. **Encryption**: Built-in backup encryption
2. **Compression**: Backup file compression
3. **Cloud Storage**: Direct backup to cloud storage
4. **Scheduling**: Automated backup scheduling
5. **Differential Backups**: Only backup changed files
6. **Backup Verification**: Verify backup integrity
7. **Backup Rotation**: Automatic cleanup of old backups

### 🛠️ **Technical Improvements**
1. **Parallel Processing**: Backup multiple files simultaneously
2. **Progress Indicators**: Show backup progress
3. **Resume Capability**: Resume interrupted backups
4. **Backup Metadata**: Store additional backup information
5. **Validation**: Validate backup contents after creation

---

**Note**: This backup system is designed to work alongside the clean and restore systems, providing a comprehensive local data management solution for the Chatterbox project.
