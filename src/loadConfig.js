// loadConfig.js
const path = require('path');

// Load environment variables from .env file first
// This ensures that process.env has the values before we use them for overrides.
require('dotenv').config();

// Load the default application configuration from config.json
// Use a try-catch block in case config.json is missing or malformed.
let appDefaults = {};
try {
    appDefaults = require('./config.json');
} catch (error) {
    console.error("Error loading config.json. Please ensure it exists and is valid JSON.", error);
    // Exit or use hardcoded minimum defaults if config.json is critical and missing.
    process.exit(1);
}

// --- Construct the final configuration object ---
// Environment variables (from .env or system) will override defaults from config.json.
const config = {
    app: {
        interactionsBaseFolder: process.env.INTERACTIONS_BASE_FOLDER || appDefaults.app.interactionsBaseFolder,
        defaultPollGmailUser: process.env.DEFAULT_POLL_GMAIL_USER || appDefaults.app.defaultPollGmailUser,
        // testAttachmentsFolder is now under sendTest config
        // testAttachmentsFolder: process.env.TEST_ATTACHMENTS_FOLDER || appDefaults.app.testAttachmentsFolder
    },
    google: {
        credentialsPath: process.env.CREDENTIALS_PATH || appDefaults.google.credentialsPath,
        pollTokenPath: process.env.POLL_TOKEN_PATH || appDefaults.google.pollTokenPath,
        lastHistoryIdPath: process.env.LAST_HISTORY_ID_PATH || appDefaults.google.lastHistoryIdPath,
        lastPolledEmailPath: process.env.LAST_POLLED_EMAIL_PATH || appDefaults.google.lastPolledEmailPath,
        totalPollCyclesPath: process.env.TOTAL_POLL_CYCLES_PATH || appDefaults.google.totalPollCyclesPath,
        // Scopes are space-separated in .env, so split into array
        scopes: process.env.GOOGLE_SCOPES ? process.env.GOOGLE_SCOPES.split(' ') : appDefaults.google.scopes,
        redirectUri: process.env.REDIRECT_URI || appDefaults.google.redirectUri
    },
    polling: {
        // Parse numerical values, defaulting to config.json then hardcoded fallback
        defaultIntervalMinutes: parseFloat(process.env.DEFAULT_POLL_INTERVAL_MINUTES || appDefaults.polling.defaultIntervalMinutes || 2.0),
        defaultDurationMinutes: parseInt(process.env.DEFAULT_POLL_DURATION_MINUTES || appDefaults.polling.defaultDurationMinutes || 60, 10)
    },
    flags: {
        // Parse boolean string from .env, defaulting to config.json then hardcoded fallback
        defaultSilent: (process.env.DEFAULT_SILENT_FLAG === 'true' ? true : (process.env.DEFAULT_SILENT_FLAG === 'false' ? false : appDefaults.flags.defaultSilent || false))
    },
    openai: {
        // OpenAI API Key MUST come from environment variable (sensitive data)
        apiKey: process.env.OPENAI_API_KEY,
        llmModel: process.env.OPENAI_LLM_MODEL || appDefaults.openai.llmModel,
        maxResponseTokens: parseInt(process.env.OPENAI_MAX_RESPONSE_TOKENS || appDefaults.openai.maxResponseTokens || 1000, 10)
    },
    // --- New: Load sendTest specific configurations ---
    sendTest: {
        testAttachmentsFolder: process.env.TEST_ATTACHMENTS_FOLDER || (appDefaults.sendTest ? appDefaults.sendTest.testAttachmentsFolder : './test/attachments'),
        tokenPath: process.env.SENDTEST_TOKEN_PATH || (appDefaults.sendTest ? appDefaults.sendTest.tokenPath : './data/sendtest_token.json'),
        lastSentEmailNumberPath: process.env.SENDTEST_LAST_SENT_EMAIL_NUMBER_PATH || (appDefaults.sendTest ? appDefaults.sendTest.lastSentEmailNumberPath : './data/sendtest_last_sent_email_number.txt'),
        senderEmailPath: process.env.SENDTEST_SENDER_EMAIL_PATH || (appDefaults.sendTest ? appDefaults.sendTest.senderEmailPath : './data/sendtest_sender_email.txt'),
        recipientEmailPath: process.env.SENDTEST_RECIPIENT_EMAIL_PATH || (appDefaults.sendTest ? appDefaults.sendTest.recipientEmailPath : './data/sendtest_recipient_email.txt'),
        sendCountPath: process.env.SENDTEST_SEND_COUNT_PATH || (appDefaults.sendTest ? appDefaults.sendTest.sendCountPath : './data/sendtest_send_count.txt'),
        defaultSender: process.env.DEFAULT_SENDTEST_SENDER || (appDefaults.sendTest ? appDefaults.sendTest.defaultSender : 'amram.dworkin@gmail.com'),
        defaultRecipient: process.env.DEFAULT_SENDTEST_RECIPIENT || (appDefaults.sendTest ? appDefaults.sendTest.defaultRecipient : 'awsamram@gmail.com'),
        scopes: process.env.SENDTEST_SCOPES ? process.env.SENDTEST_SCOPES.split(' ') : (appDefaults.sendTest ? appDefaults.sendTest.scopes : ['https://www.googleapis.com/auth/gmail.send'])
    }
};

// Convert polling interval to milliseconds for direct use in setInterval
config.polling.defaultIntervalMilliseconds = config.polling.defaultIntervalMinutes * 60 * 1000;

// Export the final config object
module.exports = config;

// --- Optional: Basic validation/logging for debugging ---
if (!config.openai.apiKey) {
    console.warn("Warning: OPENAI_API_KEY is not set. LLM interactions will fail.");
}
// console.log("Loaded Configuration:", JSON.stringify(config, null, 2)); // Uncomment for full config dump
