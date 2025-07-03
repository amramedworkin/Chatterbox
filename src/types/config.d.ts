// src/types/config.d.ts

declare interface GoogleConfig {
    credentialsPath: string;
    pollTokenPath: string; // Path to google_tokens.json
    lastHistoryIdPath: string;
    lastPolledEmailPath: string;
    totalPollCyclesPath: string;
    scopes: string[];
    redirectUri: string;
}

declare interface PollingConfig {
    defaultIntervalMinutes: number;
    defaultDurationMinutes: number;
    defaultIntervalMilliseconds?: number; // Added as it's computed
}

declare interface FlagsConfig {
    defaultSilent: boolean;
}

declare interface OpenAiConfig {
    llmModel: string;
    organizationId: string;
    maxResponseTokens: number;
    apiKey: string; // From .env
}

declare interface SendTestConfig {
    testAttachmentsFolder: string;
    tokenPath: string;
    lastSentEmailNumberPath: string;
    senderEmailPath: string;
    recipientEmailPath: string;
    sendCountPath: string;
    defaultRecipient: string;
    scopes: string[];
}

declare interface TestOpenAiConfig {
    testPrompt: string;
    dialogPrompts: string[];
}

declare interface AwsConfig {
    region: string;
    profile?: string;
    vpc: {
        id: string;
        cidrBlock: string;
        availabilityZones: string[];
    };
    dynamodb: {
        stateTableName: string;
        endpoint?: string; // For local development
    };
    s3: {
        bucketName: string;
        backupBucketName: string;
        endpoint?: string; // For local development
    };
    secretsManager: {
        gmailTokensSecretName: string;
        endpoint?: string; // For local development
    };
    parameterStore: {
        prefix: string;
        endpoint?: string; // For local development
    };
    iam: {
        roleArn?: string;
        instanceProfileArn?: string;
    };
    cloudwatch: {
        logGroupName: string;
        endpoint?: string; // For local development
    };
    environment: 'local' | 'development' | 'staging' | 'production';
}

declare interface AppConfig {
    app: {
        interactionsBaseFolder: string;
        defaultPollGmailUser: string;
        defaultSendGmailUser: string;
        defaultGetGmailUser: string;
    };
    google: GoogleConfig;
    polling: PollingConfig;
    flags: FlagsConfig;
    openai: OpenAiConfig;
    sendTest: SendTestConfig;
    testOpenAi: TestOpenAiConfig;
    aws: AwsConfig;
}

// Export the type if you prefer to import it directly instead of using global declarations
export type { AppConfig };
