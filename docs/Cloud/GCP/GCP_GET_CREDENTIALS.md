# GCP Credentials Setup Guide for Chatterbox

This guide provides detailed instructions for obtaining the necessary Google Cloud Platform (GCP) credentials to enable Gmail API integration with Chatterbox.

## Prerequisites

- A Google account
- Access to Google Cloud Console
- Basic familiarity with Google Cloud Platform

## Step 1: Create a Google Cloud Project

1. **Navigate to Google Cloud Console**
   - Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click on the project dropdown at the top of the page
   - Click "New Project"
   - Enter a project name (e.g., "Chatterbox-Gmail-Integration")
   - Click "Create"

3. **Select Your Project**
   - Make sure your new project is selected in the project dropdown

## Step 2: Enable the Gmail API

1. **Navigate to APIs & Services**
   - In the left sidebar, click "APIs & Services" > "Library"

2. **Search for Gmail API**
   - In the search bar, type "Gmail API"
   - Click on "Gmail API" from the results

3. **Enable the API**
   - Click the "Enable" button
   - Wait for the API to be enabled

## Step 3: Create OAuth 2.0 Credentials

1. **Navigate to Credentials**
   - In the left sidebar, click "APIs & Services" > "Credentials"

2. **Create OAuth 2.0 Client ID**
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure the OAuth consent screen first (see Step 4)

3. **Configure OAuth Consent Screen**
   - If you haven't configured the consent screen yet, you'll be prompted to do so
   - Follow the instructions in Step 4 below

4. **Set Application Type**
   - Choose "Desktop application" for local development
   - Enter a name for your OAuth 2.0 client (e.g., "Chatterbox Desktop Client")
   - Click "Create"

5. **Download Credentials**
   - After creation, click "Download JSON"
   - Save the file as `google_credentials.json` in your home directory (`~/google_credentials.json`)
   - **Important**: Keep this file secure and never commit it to version control

## Step 4: Configure OAuth Consent Screen

1. **Navigate to OAuth Consent Screen**
   - In the left sidebar, click "APIs & Services" > "OAuth consent screen"

2. **Choose User Type**
   - Select "External" (unless you have a Google Workspace organization)
   - Click "Create"

3. **Fill in App Information**
   - **App name**: Chatterbox
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
   - Click "Save and Continue"

4. **Add Scopes**
   - Click "Add or Remove Scopes"
   - Search for and select the following scopes:
     - `https://www.googleapis.com/auth/gmail.readonly` (for reading emails)
     - `https://www.googleapis.com/auth/gmail.send` (for sending emails)
     - `https://www.googleapis.com/auth/gmail.modify` (for modifying emails)
   - Click "Update"
   - Click "Save and Continue"

5. **Add Test Users** (if using External user type)
   - Click "Add Users"
   - Add your Google account email address
   - Click "Save and Continue"

6. **Review and Publish**
   - Review the summary
   - Click "Back to Dashboard"

## Step 5: Understanding Gmail API Permissions

### Read-Only Permissions
- **Scope**: `https://www.googleapis.com/auth/gmail.readonly`
- **Capabilities**:
  - Read email messages
  - List email threads
  - Access email metadata
  - Search emails
  - Download attachments

### Write/Send Permissions
- **Scope**: `https://www.googleapis.com/auth/gmail.send`
- **Capabilities**:
  - Send emails
  - Reply to emails
  - Forward emails
  - Draft emails

### Modify Permissions
- **Scope**: `https://www.googleapis.com/auth/gmail.modify`
- **Capabilities**:
  - All read capabilities
  - Modify email labels
  - Mark emails as read/unread
  - Move emails between folders
  - Delete emails

## Step 6: Security Best Practices

1. **Credential Storage**
   - Store `google_credentials.json` in a secure location
   - Never commit credentials to version control
   - Use environment variables or secure storage for production

2. **Access Control**
   - Regularly review and rotate credentials
   - Use the principle of least privilege
   - Monitor API usage in Google Cloud Console

3. **Rate Limiting**
   - Gmail API has quotas and rate limits
   - Monitor usage in the Google Cloud Console
   - Implement appropriate error handling

## Step 7: Testing Your Setup

1. **Verify Credentials File**
   - Ensure `google_credentials.json` is in the correct location
   - Verify the file contains valid JSON with client_id and client_secret

2. **Test API Access**
   - Run the Chatterbox authorization command:
     ```bash
     npm run mail:authorize
     ```
   - Follow the OAuth flow in your browser
   - Verify that tokens are generated successfully

## Troubleshooting

### Common Issues

1. **"API not enabled" error**
   - Ensure Gmail API is enabled in your Google Cloud project
   - Check that you're using the correct project

2. **"Invalid client" error**
   - Verify your `google_credentials.json` file is correct
   - Ensure the OAuth client ID matches your credentials

3. **"Access denied" error**
   - Check that your email is added as a test user (for external apps)
   - Verify the OAuth consent screen is properly configured

4. **"Quota exceeded" error**
   - Check your API usage in Google Cloud Console
   - Implement rate limiting in your application

### Getting Help

- **Google Cloud Console**: [https://console.cloud.google.com/](https://console.cloud.google.com/)
- **Gmail API Documentation**: [https://developers.google.com/gmail/api](https://developers.google.com/gmail/api)
- **Google Cloud Support**: Available through Google Cloud Console

## File Structure

After completing this setup, your project should have:

```
config/
├── google_credentials.json    # OAuth 2.0 credentials (from Step 3)
└── ...

data/
├── google_tokens.json                 # Generated after OAuth flow
└── ...
```

## Next Steps

1. **Run the initialization script**:
   ```bash
   npm run aws:init:prepare
   ```

2. **Authorize Gmail access**:
   ```bash
   npm run mail:authorize
   ```

3. **Test the integration**:
   ```bash
   npm run mail:poll
   ```

---

**Note**: This guide assumes you're setting up for development. For production deployments, additional security measures and proper credential management should be implemented. 