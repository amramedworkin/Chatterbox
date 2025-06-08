// src/loadConfig.ts

// Load environment variables from .env file first
// This ensures that process.env has the values before we use them for overrides.
import 'dotenv/config';

import * as path from 'path'; // Needed for path.resolve if dynamically loading config.json
import { AppConfig, GoogleConfig, PollingConfig, FlagsConfig, OpenAIConfig, SendTestConfig, TestOpenAiConfig } from './types/config';

// Define a type for the structure of config.json
// This interface should ideally be in src/types/config.ts
// For demonstration, here's a simplified version that would be consistent
// with your config.json if AppConfig was not already defined elsewhere.
/*
interface AppConfig {
    app: {
        interactionsBaseFolder: string;
        defaultPollGmailUser: string;
    };
    google: {
        credentialsPath: string;
        pollTokenPath: string;
        lastHistoryIdPath: string;
        lastPolledEmailPath: string;
        totalPollCyclesPath: string;
        scopes: string[];
        redirectUri: string;
    };
    polling: {
        defaultIntervalMinutes: number;
        defaultDurationMinutes: number;
        defaultIntervalMilliseconds?: number; // Added in JS, so it should be optional here
    };
    flags: {
        defaultSilent: boolean;
    };
    openai: {
        llmModel: string;
        organizationId: string;
        maxResponseTokens: number;
        openaiApiKeyNOTE: string;
        apiKey?: string; // As it's set from env, it might be optional in the type
    };
    sendTest: {
        testAttachmentsFolder: string;
        tokenPath: string;
        lastSentEmailNumberPath: string;
        senderEmailPath: string;
        recipientEmailPath: string;
        sendCountPath: string;
        defaultSender: string;
        defaultRecipient: string;
        scopes?: string[]; // Assuming it might be set from env or default
    };
    testOpenAi: {
        testPrompt: string;
        dialogPrompts: string[];
    };
}
*/

// Load the default application configuration from config.json
// Use a try-catch block in case config.json is missing or malformed.
let appDefaults: Partial<AppConfig> = {}; // Use Partial as we might not load everything
try {
    // Dynamically require config.json relative to this script's location (src folder)
    // In TypeScript, 'require' for JSON works if 'esModuleInterop' is true and 'module' is 'commonjs'
    // or if 'resolveJsonModule' is true in tsconfig.json.
    // If 'resolveJsonModule' is false, you might need to use fs.readFileSync and JSON.parse.
    // Assuming current tsconfig allows for direct require.
    appDefaults = require('./config.json');
} catch (error) {
    console.error(
        "Error loading config.json. Please ensure it exists and is valid JSON and located in the 'src' directory.",
        error
    );
    // Exit or use hardcoded minimum defaults if config.json is critical and missing.
    process.exit(1);
}

// Helper function to safely get a value from appDefaults, with a fallback
// Type annotations added for clarity and safety
const getOrDefault = <T>(envVar: string, appDefaultPath: string, fallback: T): T => {
    // Navigate through the appDefaults object using the string path (e.g., 'app.interactionsBaseFolder')
    const defaultVal = appDefaultPath
        ? appDefaultPath.split('.').reduce((obj: any, key: string) => obj && obj[key], appDefaults)
        : undefined;

    // Prioritize environment variable, then default from config.json, then hardcoded fallback
    // Explicitly cast process.env[envVar] to T or string to handle environment variable types
    return (process.env[envVar] !== undefined
        ? (process.env[envVar] as T) // Cast to T, assuming environment variable is of correct type
        : (defaultVal !== undefined
            ? defaultVal
            : fallback)) as T;
};

// Construct the final config object, applying environment variable overrides
const config: AppConfig = {
    app: {
        interactionsBaseFolder: getOrDefault(
            'INTERACTIONS_BASE_FOLDER',
            'app.interactionsBaseFolder',
            '../interactions'
        ),
        defaultPollGmailUser: getOrDefault(
            'DEFAULT_POLL_GMAIL_USER',
            'app.defaultPollGmailUser',
            'awsamram@gmail.com'
        ),
    },
    google: {
        credentialsPath: getOrDefault(
            'GOOGLE_CREDENTIALS_PATH',
            'google.credentialsPath',
            './credentials.json'
        ),
        pollTokenPath: getOrDefault(
            'GOOGLE_POLL_TOKEN_PATH',
            'google.pollTokenPath',
            './data/token.json'
        ),
        lastHistoryIdPath: getOrDefault(
            'GOOGLE_LAST_HISTORY_ID_PATH',
            'google.lastHistoryIdPath',
            './data/last_history_id.txt'
        ),
        lastPolledEmailPath: getOrDefault(
            'GOOGLE_LAST_POLLED_EMAIL_PATH',
            'google.lastPolledEmailPath',
            './data/last_polled_email.txt'
        ),
        totalPollCyclesPath: getOrDefault(
            'GOOGLE_TOTAL_POLL_CYCLES_PATH',
            'google.totalPollCyclesPath',
            './data/total_poll_cycles.txt'
        ),
        scopes: process.env.GOOGLE_SCOPES
            ? process.env.GOOGLE_SCOPES.split(' ')
            : (appDefaults.google?.scopes || ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']),
        redirectUri: getOrDefault(
            'GOOGLE_REDIRECT_URI',
            'google.redirectUri',
            'http://localhost:3000'
        ),
    },
    polling: {
        defaultIntervalMinutes: parseFloat(
            getOrDefault(
                'DEFAULT_POLL_INTERVAL_MINUTES',
                'polling.defaultIntervalMinutes',
                2.0
            ).toString()
        ),
        defaultDurationMinutes: parseFloat(
            getOrDefault(
                'DEFAULT_POLL_DURATION_MINUTES',
                'polling.defaultDurationMinutes',
                60
            ).toString()
        ),
    },
    flags: {
        defaultSilent: getOrDefault(
            'DEFAULT_SILENT_FLAG',
            'flags.defaultSilent',
            false
        ).toString() === 'true', // Convert string from env to boolean
    },
    openai: {
        llmModel: getOrDefault(
            'OPENAI_LLM_MODEL',
            'openai.llmModel',
            'gpt-4o'
        ),
        organizationId: getOrDefault(
            'OPENAI_ORGANIZATION_ID',
            'openai.organizationId',
            'org-jtUOS2ket5MKPTVgmcbv5mIP'
        ),
        maxResponseTokens: parseInt(
            getOrDefault(
                'OPENAI_MAX_RESPONSE_TOKENS',
                'openai.maxResponseTokens',
                10000
            ).toString(),
            10
        ),
        openaiApiKeyNOTE: getOrDefault(
            'OPENAI_API_KEY_NOTE',
            'openai.openaiApiKeyNOTE',
            "apiKey is *not* here, it's always from .env"
        ),
        apiKey: process.env.OPENAI_API_KEY || undefined, // Directly from .env
    },
    sendTest: {
        testAttachmentsFolder: getOrDefault(
            'TEST_ATTACHMENTS_FOLDER',
            'sendTest.testAttachmentsFolder',
            './test/attachments'
        ),
        tokenPath: getOrDefault(
            'SENDTEST_TOKEN_PATH',
            'sendTest.tokenPath',
            './data/sendtest_token.json'
        ),
        lastSentEmailNumberPath: getOrDefault(
            'SENDTEST_LAST_SENT_EMAIL_NUMBER_PATH',
            'sendTest.lastSentEmailNumberPath',
            './data/sendtest_last_sent_email_number.txt'
        ),
        senderEmailPath: getOrDefault(
            'SENDTEST_SENDER_EMAIL_PATH',
            'sendTest.senderEmailPath',
            './data/sendtest_sender_email.txt'
        ),
        recipientEmailPath: getOrDefault(
            'SENDTEST_RECIPIENT_EMAIL_PATH',
            'sendTest.recipientEmailPath',
            './data/sendtest_recipient_email.txt'
        ),
        sendCountPath: getOrDefault(
            'SENDTEST_SEND_COUNT_PATH',
            'sendTest.sendCountPath',
            './data/sendtest_send_count.txt'
        ),
        defaultSender: getOrDefault(
            'DEFAULT_SENDTEST_SENDER',
            'sendTest.defaultSender',
            'amram.dworkin@gmail.com'
        ),
        defaultRecipient: getOrDefault(
            'DEFAULT_SENDTEST_RECIPIENT',
            'sendTest.defaultRecipient',
            'awsamram@gmail.com'
        ),
        scopes: process.env.SENDTEST_SCOPES
            ? process.env.SENDTEST_SCOPES.split(' ')
            : (appDefaults.sendTest?.scopes || ['https://www.googleapis.com/auth/gmail.send']),
    },
    testOpenAi: {
        testPrompt: getOrDefault(
            'TESTOPENAI_PROMPT',
            'testOpenAi.testPrompt',
            'Explain the concept of quantum entanglement in simple terms.'
        ),
        dialogPrompts: process.env.TESTOPENAI_DIALOG_PROMPTS
            ? process.env.TESTOPENAI_DIALOG_PROMPTS.split('|')
            : (appDefaults.testOpenAi?.dialogPrompts || []),
    },
};

// Convert polling interval to milliseconds for direct use in setInterval
config.polling.defaultIntervalMilliseconds = config.polling.defaultIntervalMinutes * 60 * 1000;

// Export the final config object for use in other modules
export default config;

// --- Optional: Basic validation/logging for debugging ---
if (!config.openai.apiKey) {
    console.warn('Warning: OPENAI_API_KEY is not set. LLM interactions will fail.');
}