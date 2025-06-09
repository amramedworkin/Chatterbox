// src/types/config.d.ts

declare interface GoogleConfig {
    credentialsPath: string;
    pollTokenPath: string;
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
    defaultSender: string;
    defaultRecipient: string;
    scopes: string[];
}

declare interface TestOpenAiConfig {
    testPrompt: string;
    dialogPrompts: string[];
}

declare interface AppConfig {
    app: {
        interactionsBaseFolder: string;
        defaultPollGmailUser: string;
    };
    google: GoogleConfig;
    polling: PollingConfig;
    flags: FlagsConfig;
    openai: OpenAiConfig;
    sendTest: SendTestConfig;
    testOpenAi: TestOpenAiConfig;
}

// Export the type if you prefer to import it directly instead of using global declarations
export type { AppConfig };
