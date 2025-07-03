# Local System Clean Capability

This document describes the comprehensive local system clean capability for the Chatterbox project, which allows you to safely remove sensitive configuration data while preserving essential application settings.

## Overview

The local system clean capability provides a secure way to remove sensitive information from your local development environment, including:

- **Credentials and Tokens**: Gmail OAuth tokens, OpenAI API keys, Google credentials
- **Email Addresses**: Personal email addresses stored in configuration
- **State Files**: Polling state, test state, and application state
- **AWS Credentials**: AWS CLI configuration (if present)

## Key Features

### ✅ **Two Prompting Levels**
1. **Global Clean** (requires `--force` flag)
   - Single confirmation for all cleaning operations
   - Detailed warning about what will be cleaned
   - `--force:quiet` skips all confirmations

2. **Individual Clean** (default mode)
   - Each cleanup item prompted separately
   - Detailed description of each item's impact and usage
   - Current values displayed before cleaning

### ✅ **Backup and Wipe Modes**
- **Backup Mode** (default): Creates timestamped backups before cleaning
- **Wipe Mode** (`--wipe` flag): Completely deletes files without backup

### ✅ **Comprehensive Coverage**
- All sensitive configuration data identified and cleaned
- Semi-static configuration preserved (polling intervals, folder paths, etc.)
- Detailed documentation references for each item

## What Gets Cleaned

### 1. Gmail OAuth Tokens
- **Files**: `tokens/gmail_tokens.json`, `data/google_tokens.json`
- **Impact**: Removes ability to access Gmail accounts
- **Usage**: Mail polling, sending, and authorization
- **Documentation**: `src/mail/authorizeGmail.ts`, `Cloud/AWS/SECRETS_MIGRATION.md`

### 2. OpenAI API Key
- **Files**: `.env` (OPENAI_API_KEY)
- **Impact**: Removes ability to use OpenAI LLM services
- **Usage**: AI-powered email processing and responses
- **Documentation**: `src/openai/`, `Cloud/AWS/SECRETS_MIGRATION.md`

### 3. Google Service Account Credentials
- **Files**: `tokens/google_credentials.json`
- **Impact**: Removes ability to authenticate with Google APIs
- **Usage**: OAuth2 authentication flow
- **Documentation**: `src/mail/authorizeGmail.ts`, `Cloud/AWS/SECRETS_MIGRATION.md`

### 4. Email Addresses
- **Files**: `config.json` (email configuration)
- **Impact**: Removes default email addresses
- **Usage**: Default values for Gmail operations
- **Documentation**: `config.json`, `src/loadConfig.ts`

### 5. Gmail Polling State
- **Files**: Various state files in `data/` directory
- **Impact**: Resets polling state, may cause duplicate processing
- **Usage**: Tracks polling progress and history
- **Documentation**: `src/mail/pollGmail.ts`, `data/` directory

### 6. Send Test State
- **Files**: Send test files in `data/` directory
- **Impact**: Resets test state and email numbering
- **Usage**: Tracks send test progress
- **Documentation**: `test/sendGmail.test.ts`, `data/` directory

### 7. AWS Credentials
- **Files**: `~/.aws/credentials`, `~/.aws/config`
- **Impact**: Removes AWS CLI access
- **Usage**: AWS infrastructure management
- **Documentation**: `Cloud/AWS/`, `scripts/aws/`

## What Is Preserved

The following semi-static configuration is **NOT** cleaned:

- **Polling Configuration**: Intervals, durations, silent flags
- **Folder Paths**: Interaction base folder, attachment folders
- **Test Configuration**: Test prompts, dialog prompts, scopes
- **Application Settings**: Model settings, token limits, flags

## Usage Examples

### Interactive Cleaning (Default)
```bash
# Interactive cleaning with backups
npm run clean:local

# Interactive cleaning with custom backup location
npm run clean:local --backup-dir ./my-backups
```

### Force Mode (Global Confirmation)
```bash
# Global confirmation, individual backups
npm run clean:local --force

# Complete wipe with global confirmation
npm run clean:local --force --wipe
```

### Force Quiet Mode (No Confirmations)
```bash
# Complete wipe without any confirmations (dangerous!)
npm run clean:local --force:quiet --wipe
```

### Wipe Mode (No Backups)
```bash
# Interactive cleaning, no backups
npm run clean:local --wipe

# Force wipe with backups
npm run clean:local --force --wipe
```

## Restore Capability

After cleaning, you can restore from backups using the restore script:

### Interactive Restore
```bash
# Restore from default backup location
npm run restore:local

# Restore from specific backup directory
npm run restore:local ./backups/custom
```

### Force Restore
```bash
# Restore all files without confirmation
npm run restore:local --force

# Restore to different target directory
npm run restore:local --target-dir ./new-location
```

## Command Reference

### Clean Commands
```bash
npm run clean:local                    # Interactive cleaning with backups
npm run clean:local:force              # Global confirmation, individual backups
npm run clean:local:wipe               # Interactive cleaning, no backups
npm run clean:local:force:wipe         # Complete wipe, no confirmations
npm run clean:local:backup             # Custom backup location
```

### Restore Commands
```bash
npm run restore:local                  # Interactive restore from default backup
npm run restore:local:force            # Restore all files without confirmation
npm run restore:local:custom           # Restore from custom backup directory
```

## Safety Features

### 1. Confirmation Levels
- **Default**: Each item prompted individually
- **Force**: Global confirmation required
- **Force:quiet**: No confirmations (dangerous!)

### 2. Backup System
- **Automatic**: Timestamped backups created by default
- **Custom**: Specify backup directory with `--backup-dir`
- **Wipe**: Skip backups with `--wipe` flag

### 3. Value Display
- **Current Values**: Shows what will be cleaned
- **Sensitive Masking**: Partially masks sensitive values
- **Impact Description**: Explains what each item does

### 4. Documentation References
- **Usage**: How each item is used in the application
- **Impact**: What happens when the item is removed
- **Documentation**: Where to find more information

## Workflow Examples

### Development Environment Reset
```bash
# 1. Clean all sensitive data with backups
npm run clean:local --force

# 2. Verify cleaning worked
ls -la tokens/ data/ .env

# 3. Restore if needed
npm run restore:local
```

### Complete System Wipe
```bash
# 1. Complete wipe without backups (dangerous!)
npm run clean:local --force:quiet --wipe

# 2. Re-authorize all services
npm run mail:authorize
# ... configure OpenAI API key
# ... setup Google credentials
```

### Selective Cleaning
```bash
# 1. Interactive cleaning (choose what to clean)
npm run clean:local

# 2. Only clean specific items when prompted
# Answer 'n' to items you want to keep
```

## Integration with AWS Secrets Manager

If you have migrated secrets to AWS Secrets Manager, the clean process works seamlessly:

### Before AWS Migration
```bash
# Clean local secrets
npm run clean:local --force

# Re-authorize all services
npm run mail:authorize
# ... configure new tokens and keys
```

### After AWS Migration
```bash
# Clean local secrets (AWS has backups)
npm run clean:local --force

# Restore from AWS if needed
npm run aws:migrate:secrets:env development
```

## Troubleshooting

### Common Issues

#### 1. Permission Errors
```bash
# Check file permissions
ls -la tokens/ data/ .env

# Fix permissions if needed
chmod 644 tokens/* data/* .env
```

#### 2. Backup Directory Issues
```bash
# Create backup directory manually
mkdir -p ./backups

# Use custom backup location
npm run clean:local --backup-dir /tmp/backups
```

#### 3. Restore Issues
```bash
# Check backup files exist
ls -la ./backups/

# Restore from specific backup
npm run restore:local ./backups/clean-2024-01-15T10-30-00-000Z
```

### Debug Mode
```bash
# Enable verbose logging
DEBUG=* npm run clean:local

# Check script execution
node scripts/clean-local-system.js --help
```

## Best Practices

### 1. Always Use Backups
- Use default backup mode unless absolutely necessary
- Keep backups in a secure location
- Test restore functionality periodically

### 2. Understand Impact
- Read the impact descriptions carefully
- Know what will break after cleaning
- Have a plan for re-authorization

### 3. Use Force Mode Carefully
- `--force` requires global confirmation
- `--force:quiet` is dangerous and skips all safety checks
- Only use when you're certain about the action

### 4. Test After Cleaning
- Verify application functionality
- Check that sensitive data is actually removed
- Test restore capability if needed

### 5. Document Your Process
- Keep track of what was cleaned
- Note any manual re-configuration needed
- Document any issues encountered

## Security Considerations

### 1. Sensitive Data Handling
- Sensitive values are partially masked in output
- Backups are created with original permissions
- Wipe mode completely removes files

### 2. Backup Security
- Backups contain sensitive information
- Store backups in secure location
- Consider encrypting backup directories

### 3. AWS Integration
- AWS credentials are cleaned if present
- AWS Secrets Manager provides secure backup
- Consider using AWS for all sensitive data

## Support

For issues or questions about the local system clean capability:

1. Check the troubleshooting section above
2. Review the help output: `npm run clean:local --help`
3. Test with a small subset of files first
4. Use backup mode until you're confident with the process 