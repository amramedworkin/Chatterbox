// src/loadConfig.ts

import 'dotenv/config';
import { AppConfig } from './types/config';
import path from 'path';

let appDefaults: Partial<AppConfig> = {};
try {
    // Use path.resolve to get the absolute path to config.json in the project root
    const configPath = path.resolve(process.cwd(), 'config.json');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appDefaults = require(configPath) as Partial<AppConfig>;
} catch (error: unknown) {
    console.error(
        "Error loading config.json. Please ensure it exists and is valid JSON and located in the 'root' directory.",
        error
    );
    process.exit(1);
}

const getOrDefault = <T>(envVar: string, appDefaultPath: string, fallback: T): T => {
    const defaultVal = appDefaultPath
        .split('.')
        .reduce<Record<string, unknown> | undefined>((obj, key: string) => {
            if (obj && typeof obj === 'object') {
                return (obj as Record<string, unknown>)[key] as Record<string, unknown> | undefined;
            }
            return undefined;
        }, appDefaults as Record<string, unknown>);

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
        defaultSendGmailUser: getOrDefault(
            'DEFAULT_SEND_GMAIL_USER',
            'app.defaultSendGmailUser',
            'amram.dworkin@gmail.com'
        ),
        defaultGetGmailUser: getOrDefault(
            'DEFAULT_GET_GMAIL_USER',
            'app.defaultGetGmailUser',
            'isnotmynameatall@gmail.com'
        ),
    },
    google: {
        credentialsPath: getOrDefault(
            'GOOGLE_CREDENTIALS_PATH',
            'google.credentialsPath',
            '~/google_credentials.json'
        ),
        pollTokenPath: getOrDefault(
            'GOOGLE_POLL_TOKEN_PATH',
            'google.pollTokenPath',
            './data/google_tokens.json'
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
            : appDefaults.google
            ? appDefaults.google.scopes
            : [
                  'https://www.googleapis.com/auth/gmail.readonly',
                  'https://www.googleapis.com/auth/gmail.send',
              ],
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
        defaultSilent: getOrDefault('DEFAULT_SILENT_FLAG', 'flags.defaultSilent', false),
    },
    openai: {
        llmModel: getOrDefault('OPENAI_LLM_MODEL', 'openai.llmModel', 'gpt-4o'),
        organizationId: getOrDefault('OPENAI_ORGANIZATION_ID', 'openai.organizationId', ''),
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
            './data/google_tokens.json'
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
        defaultRecipient: getOrDefault(
            'DEFAULT_SENDTEST_RECIPIENT',
            'sendTest.defaultRecipient',
            'awsamram@gmail.com'
        ),
        scopes: process.env.SENDTEST_SCOPES
            ? process.env.SENDTEST_SCOPES.split(' ')
            : appDefaults.sendTest
            ? appDefaults.sendTest.scopes
            : ['https://www.googleapis.com/auth/gmail.send'],
    },
    testOpenAi: {
        testPrompt: getOrDefault(
            'TESTOPENAI_PROMPT',
            'testOpenAi.testPrompt',
            'Explain the concept of quantum entanglement in simple terms.'
        ),
        dialogPrompts: process.env.TESTOPENAI_DIALOG_PROMPTS
            ? process.env.TESTOPENAI_DIALOG_PROMPTS.split('|')
            : appDefaults.testOpenAi
            ? appDefaults.testOpenAi.dialogPrompts
            : [],
    },
    aws: {
        region: getOrDefault('AWS_REGION', 'aws.region', 'us-east-1'),
        profile: process.env.AWS_PROFILE || appDefaults.aws?.profile,
        vpc: {
            id: getOrDefault('AWS_VPC_ID', 'aws.vpc.id', ''),
            cidrBlock: getOrDefault('AWS_VPC_CIDR', 'aws.vpc.cidrBlock', '10.0.0.0/16'),
            availabilityZones: process.env.AWS_AVAILABILITY_ZONES
                ? process.env.AWS_AVAILABILITY_ZONES.split(',')
                : appDefaults.aws?.vpc?.availabilityZones || ['us-east-1a', 'us-east-1b'],
        },
        dynamodb: {
            stateTableName: getOrDefault(
                'AWS_DYNAMODB_STATE_TABLE',
                'aws.dynamodb.stateTableName',
                'chatterbox-state'
            ),
            endpoint: process.env.AWS_DYNAMODB_ENDPOINT || appDefaults.aws?.dynamodb?.endpoint,
        },
        s3: {
            bucketName: getOrDefault('AWS_S3_BUCKET_NAME', 'aws.s3.bucketName', 'chatterbox-data'),
            backupBucketName: getOrDefault(
                'AWS_S3_BACKUP_BUCKET_NAME',
                'aws.s3.backupBucketName',
                'chatterbox-backups'
            ),
            endpoint: process.env.AWS_S3_ENDPOINT || appDefaults.aws?.s3?.endpoint,
        },
        secretsManager: {
            gmailTokensSecretName: getOrDefault(
                'AWS_SECRETS_GMAIL_TOKENS_NAME',
                'aws.secretsManager.gmailTokensSecretName',
                'chatterbox/gmail-tokens'
            ),
            endpoint: process.env.AWS_SECRETS_ENDPOINT || appDefaults.aws?.secretsManager?.endpoint,
        },
        parameterStore: {
            prefix: getOrDefault(
                'AWS_PARAMETER_STORE_PREFIX',
                'aws.parameterStore.prefix',
                '/chatterbox'
            ),
            endpoint:
                process.env.AWS_PARAMETER_STORE_ENDPOINT ||
                appDefaults.aws?.parameterStore?.endpoint,
        },
        iam: {
            roleArn: process.env.AWS_IAM_ROLE_ARN || appDefaults.aws?.iam?.roleArn,
            instanceProfileArn:
                process.env.AWS_IAM_INSTANCE_PROFILE_ARN ||
                appDefaults.aws?.iam?.instanceProfileArn,
        },
        cloudwatch: {
            logGroupName: getOrDefault(
                'AWS_CLOUDWATCH_LOG_GROUP',
                'aws.cloudwatch.logGroupName',
                '/aws/chatterbox'
            ),
            endpoint: process.env.AWS_CLOUDWATCH_ENDPOINT || appDefaults.aws?.cloudwatch?.endpoint,
        },
        environment: getOrDefault('AWS_ENVIRONMENT', 'aws.environment', 'local') as
            | 'local'
            | 'development'
            | 'staging'
            | 'production',
    },
};

config.polling.defaultIntervalMilliseconds = config.polling.defaultIntervalMinutes * 60 * 1000;

export default config;

if (!config.openai.apiKey) {
    console.warn('Warning: OPENAI_API_KEY is not set. LLM interactions will fail.');
}
