// src/loadConfig.ts

import 'dotenv/config';
import * as path from 'path'; // path is not strictly needed in this version but can be kept
import { AppConfig } from './types/config'; // Import the defined AppConfig interface

let appDefaults: any = {};
try {
    // Adjusted path: Go up from 'dist/src' to 'dist', then up to the project root,
    // where config.json now resides.
    appDefaults = require('../../config.json');
} catch (error: any) {
    console.error(
        "Error loading config.json. Please ensure it exists and is valid JSON and located in the 'root' directory.",
        error
    );
    process.exit(1);
}

const getOrDefault = <T>(
    envVar: string,
    appDefaultPath: string,
    fallback: T
): T => {
    const defaultVal = appDefaultPath
        .split('.')
        .reduce((obj: any, key: string) => obj && obj[key], appDefaults);

    const envValue = process.env[envVar];

    if (envValue !== undefined) {
        // Attempt to convert based on fallback type if it's not a string
        if (typeof fallback === 'number') {
            return parseFloat(envValue) as T;
        }
        if (typeof fallback === 'boolean') {
            return (envValue.toLowerCase() === 'true') as T;
        }
        return envValue as T; // Return string as is if fallback is not number/boolean
    }

    if (defaultVal !== undefined) {
        return defaultVal as T;
    }

    return fallback;
};

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
            : (appDefaults.google ? appDefaults.google.scopes : ['https://www.googleapis.com/auth/gmail.readonly']),
        redirectUri: getOrDefault(
            'GOOGLE_REDIRECT_URI',
            'google.redirectUri',
            'http://localhost:3000'
        ),
    },
    polling: {
        defaultIntervalMinutes: getOrDefault(
            'DEFAULT_POLL_INTERVAL_MINUTES',
            'polling.defaultIntervalMinutes',
            2.0
        ),
        defaultDurationMinutes: getOrDefault(
            'DEFAULT_POLL_DURATION_MINUTES',
            'polling.defaultDurationMinutes',
            60
        ),
    },
    flags: {
        defaultSilent: getOrDefault(
            'DEFAULT_SILENT_FLAG',
            'flags.defaultSilent',
            false
        ),
    },
    openai: {
        llmModel: getOrDefault('OPENAI_LLM_MODEL', 'openai.llmModel', 'gpt-4o'),
        organizationId: getOrDefault(
            'OPENAI_ORGANIZATION_ID',
            'openai.organizationId',
            ''
        ),
        maxResponseTokens: getOrDefault(
            'OPENAI_MAX_RESPONSE_TOKENS',
            'openai.maxResponseTokens',
            10000
        ),
        apiKey: process.env.OPENAI_API_KEY || '',
    },
    sendTest: {
        testAttachmentsFolder: getOrDefault(
            'SENDTEST_ATTACHMENTS_FOLDER',
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
            : (appDefaults.sendTest ? appDefaults.sendTest.scopes : ['https://www.googleapis.com/auth/gmail.send']),
    },
    testOpenAi: {
        testPrompt: getOrDefault(
            'TESTOPENAI_PROMPT',
            'testOpenAi.testPrompt',
            'Explain the concept of quantum entanglement in simple terms.'
        ),
        dialogPrompts: process.env.TESTOPENAI_DIALOG_PROMPTS
            ? process.env.TESTOPENAI_DIALOG_PROMPTS.split('|')
            : (appDefaults.testOpenAi ? appDefaults.testOpenAi.dialogPrompts : []),
    },
};

config.polling.defaultIntervalMilliseconds = config.polling.defaultIntervalMinutes * 60 * 1000;

export default config;

if (!config.openai.apiKey) {
    console.warn('Warning: OPENAI_API_KEY is not set. LLM interactions will fail.');
}