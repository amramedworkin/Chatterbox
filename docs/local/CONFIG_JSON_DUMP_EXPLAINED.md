# Configuration Dump Script

A comprehensive script that displays all Chatterbox configuration variables in a beautifully formatted, color-coded output.

## Features

- **🎨 Beautiful Formatting**: Color-coded output with ASCII art banner
- **🔒 Security**: Automatically masks sensitive data (API keys, tokens, emails)
- **📊 Logical Grouping**: Organizes configuration by category
- **✅ Status Check**: Shows which environment variables are set
- **📋 Summary**: Provides a quick overview of configuration status

## Usage

### Basic Usage
```bash
npm run config:dump
# or
npm run config:show
```

### Direct Execution
```bash
node scripts/dump-config.js
```

## Output Sections

### 1. Environment Info
- Node version, platform, architecture
- Working directory

### 2. OpenAI Configuration
- **🔴 Red**: API keys and organization IDs (masked)
- Model settings and token limits

### 3. Google Configuration
- **🟢 Green**: File paths and URLs
- Gmail credentials and token paths

### 4. Application Configuration
- **🔵 Blue**: Email addresses (masked)
- Default user settings

### 5. Polling Configuration
- **🟡 Yellow**: Numeric values
- Polling intervals and durations

### 6. AWS Configuration
- **🔵 Blue**: All AWS-related settings
- Region, profile, environment settings
- VPC, DynamoDB, S3, Secrets Manager, etc.

### 7. Environment Variables Check
- **✅ Green checkmarks**: Set variables
- **❌ Red X**: Missing variables
- Shows masked values for sensitive data

### 8. Configuration Summary
- Quick status of key configurations
- OpenAI API key, AWS profile, Google credentials

## Color Coding

- **🔴 Red**: API keys and sensitive tokens
- **🟣 Magenta**: Tokens and credentials
- **🔵 Blue**: Email addresses and AWS settings
- **🟢 Green**: File paths and Google settings
- **🟡 Yellow**: Numbers and boolean values
- **⚪ White**: Regular text
- **⚫ Gray**: Not set or empty values

## Security Features

### Data Masking
- **API Keys**: Shows first 8 characters, masks the rest
- **Tokens**: Shows first 6 characters, masks the rest
- **Emails**: Shows first 2 characters of local part, keeps domain
- **Paths**: Shows full paths (not sensitive)

### Safe Display
- No sensitive data is logged or stored
- All masking is done in memory
- Original values are never exposed

## Use Cases

### Development
- Verify configuration is loaded correctly
- Check which environment variables are set
- Debug configuration issues

### Deployment
- Validate configuration before deployment
- Ensure all required settings are present
- Check AWS and OpenAI credentials

### Troubleshooting
- Identify missing configuration
- Verify file paths exist
- Check API key format

## Examples

### Successful Configuration
```
✓ OpenAI API Key: Configured
✓ AWS Profile: Configured
✓ Google Credentials: Configured
```

### Missing Configuration
```
✗ OpenAI API Key: Not configured
✓ AWS Profile: Configured
✗ Google Credentials: Not configured
```

## Integration

The script integrates with:
- `loadConfig.ts` - Reads all configuration
- `dotenv` - Loads environment variables
- `chalk` - Provides color formatting
- `package.json` - Available as npm scripts

## Notes

- Requires the project to be built (`npm run build`)
- Uses the compiled JavaScript from `dist/`
- Safe to run in any environment
- No external dependencies beyond project requirements 