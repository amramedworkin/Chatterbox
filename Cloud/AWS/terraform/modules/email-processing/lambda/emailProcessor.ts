// src/aws/emailProcessor.ts
// AWS-native email processing system

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { v4 as uuidv4 } from 'uuid';

// AWS Clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const sqsClient = new SQSClient({});
const secretsClient = new SecretsManagerClient({});
const ssmClient = new SSMClient({});

// Interfaces
interface EmailQuery {
    queryId: string;
    gmailId: string;
    userEmail: string;
    fromSender: string;
    subject: string;
    body: string;
    attachments: EmailAttachment[];
    conversationId?: string;
    modelName?: string;
    receivedDate: string;
    queryType: 'standalone' | 'conversation';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    processedAt?: string;
    errorMessage?: string;
    costEstimate?: number;
    tokenCount?: number;
}

interface EmailAttachment {
    filename: string;
    mimeType: string;
    size: number;
    s3Key?: string;
    data?: Buffer;
}

interface Conversation {
    conversationId: string;
    userEmail: string;
    modelName: string;
    messages: ConversationMessage[];
    lastUpdated: string;
    createdAt: string;
    totalCost: number;
    totalTokens: number;
}

interface ConversationMessage {
    messageId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    gmailId?: string;
    cost?: number;
    tokens?: number;
}

interface UserProfile {
    userEmail: string;
    name?: string;
    username?: string;
    subscriptionType: 'pay-per-use' | 'prepaid' | 'daily' | 'weekly' | 'monthly' | 'annual';
    preferredModel: string;
    persistenceEnabled: boolean;
    budgetLimits: {
        maxPerQuery: number;
        maxDaily: number;
        maxWeekly: number;
        maxMonthly: number;
        maxAnnual: number;
    };
    credits: number;
    createdAt: string;
    lastUpdated: string;
}

interface QueryRecord {
    queryId: string;
    userEmail: string;
    querySizeBytes: number;
    querySizeTokens: number;
    isConversation: boolean;
    responseSizeBytes: number;
    responseSizeTokens: number;
    receivedAt: string;
    processedAt: string;
    sentAt: string;
    modelUsed: string;
    wasPreferredModel: boolean;
    costBreakdown: {
        llmCost: number;
        infrastructureCost: number;
        licensingCost: number;
        totalCost: number;
    };
    conversationId?: string;
}

// Configuration
const CONFIG = {
    TABLES: {
        EMAIL_QUERIES: 'chatterbox-email-queries',
        CONVERSATIONS: 'chatterbox-conversations',
        USER_PROFILES: 'chatterbox-user-profiles',
        QUERY_RECORDS: 'chatterbox-query-records',
    },
    BUCKETS: {
        ATTACHMENTS: 'chatterbox-attachments',
    },
    QUEUES: {
        RESPONSE_GENERATION: 'chatterbox-response-generation',
    },
    PARAMETERS: {
        REJECTION_RATE_LIMIT: '/chatterbox/email/rejection-rate-limit',
        DEFAULT_MODEL: '/chatterbox/llm/default-model',
        FREE_TIER_LIMIT: '/chatterbox/billing/free-tier-limit',
    },
};

/**
 * Parse email directives (conversation ID, model name)
 */
function parseEmailDirectives(
    subject: string,
    body: string
): {
    conversationId?: string;
    modelName?: string;
    cleanSubject: string;
    cleanBody: string;
} {
    let conversationId: string | undefined;
    let modelName: string | undefined;

    // Extract conversation ID (<<<guid>>> format)
    const conversationIdRegex =
        /<<<([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>>>/g;
    const conversationMatches = [
        ...subject.matchAll(conversationIdRegex),
        ...body.matchAll(conversationIdRegex),
    ];
    if (conversationMatches.length > 0) {
        conversationId = conversationMatches[0][1];
    }

    // Extract model name (<<<model_name>>> format)
    const modelNameRegex = /<<<([^>]+)>>>/g;
    const modelMatches = [...subject.matchAll(modelNameRegex), ...body.matchAll(modelNameRegex)];
    for (const match of modelMatches) {
        const potentialModel = match[1];
        // Skip if it's a GUID (conversation ID)
        if (
            !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(
                potentialModel
            )
        ) {
            modelName = potentialModel;
            break;
        }
    }

    // Clean subject and body by removing directives
    let cleanSubject = subject.replace(conversationIdRegex, '').replace(modelNameRegex, '').trim();
    const cleanBody = body.replace(conversationIdRegex, '').replace(modelNameRegex, '').trim();

    // Remove "chatterbox" from subject if it's the first word
    cleanSubject = cleanSubject.replace(/^chatterbox\s+/i, '').trim();

    return {
        conversationId,
        modelName,
        cleanSubject,
        cleanBody,
    };
}

/**
 * Validate email query according to project specification
 */
function validateEmailQuery(subject: string, body: string): { isValid: boolean; reason?: string } {
    // Check if "chatterbox" is in subject line
    if (!subject.toLowerCase().includes('chatterbox')) {
        return { isValid: false, reason: 'Subject line must contain "chatterbox"' };
    }

    // Check if query has content
    const cleanBody = body.trim();
    const cleanSubject = subject.replace(/^chatterbox\s+/i, '').trim();

    if (!cleanBody && !cleanSubject) {
        return { isValid: false, reason: 'Query must have content in body or subject' };
    }

    return { isValid: true };
}

/**
 * Upload attachment to S3
 */
async function uploadAttachmentToS3(attachment: EmailAttachment, queryId: string): Promise<string> {
    if (!attachment.data) {
        throw new Error('Attachment data is required for S3 upload');
    }

    const s3Key = `attachments/${queryId}/${attachment.filename}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: CONFIG.BUCKETS.ATTACHMENTS,
            Key: s3Key,
            Body: attachment.data,
            ContentType: attachment.mimeType,
            Metadata: {
                originalFilename: attachment.filename,
                size: attachment.size.toString(),
                queryId: queryId,
            },
        })
    );

    return s3Key;
}

/**
 * Get or create user profile
 */
async function getUserProfile(userEmail: string): Promise<UserProfile> {
    try {
        const result = await docClient.send(
            new GetCommand({
                TableName: CONFIG.TABLES.USER_PROFILES,
                Key: { userEmail },
            })
        );

        if (result.Item) {
            return result.Item as UserProfile;
        }
    } catch (error) {
        console.error('Error getting user profile:', error);
    }

    // Create default profile for new user
    const defaultProfile: UserProfile = {
        userEmail,
        subscriptionType: 'pay-per-use',
        preferredModel: await getDefaultModel(),
        persistenceEnabled: false,
        budgetLimits: {
            maxPerQuery: 10.0,
            maxDaily: 50.0,
            maxWeekly: 200.0,
            maxMonthly: 500.0,
            maxAnnual: 5000.0,
        },
        credits: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    };

    await docClient.send(
        new PutCommand({
            TableName: CONFIG.TABLES.USER_PROFILES,
            Item: defaultProfile,
        })
    );

    return defaultProfile;
}

/**
 * Get default model from Parameter Store
 */
async function getDefaultModel(): Promise<string> {
    try {
        const result = await ssmClient.send(
            new GetParameterCommand({
                Name: CONFIG.PARAMETERS.DEFAULT_MODEL,
            })
        );
        return result.Parameter?.Value || 'gpt-4o';
    } catch (error) {
        console.error('Error getting default model:', error);
        return 'gpt-4o';
    }
}

/**
 * Check if user has exceeded free tier limit
 */
async function checkFreeTierLimit(
    userEmail: string
): Promise<{ allowed: boolean; reason?: string }> {
    try {
        const freeTierLimit = await ssmClient.send(
            new GetParameterCommand({
                Name: CONFIG.PARAMETERS.FREE_TIER_LIMIT,
            })
        );

        const limit = parseInt(freeTierLimit.Parameter?.Value || '10');

        // Count queries for this user
        const result = await docClient.send(
            new QueryCommand({
                TableName: CONFIG.TABLES.QUERY_RECORDS,
                KeyConditionExpression: 'userEmail = :userEmail',
                ExpressionAttributeValues: {
                    ':userEmail': userEmail,
                },
                Select: 'COUNT',
            })
        );

        const queryCount = result.Count || 0;

        if (queryCount >= limit) {
            return {
                allowed: false,
                reason: `Free tier limit of ${limit} queries exceeded. Please register for a paid account.`,
            };
        }

        return { allowed: true };
    } catch (error) {
        console.error('Error checking free tier limit:', error);
        return { allowed: true }; // Allow if check fails
    }
}

/**
 * Get conversation context if it exists
 */
async function getConversation(conversationId: string): Promise<Conversation | null> {
    try {
        const result = await docClient.send(
            new GetCommand({
                TableName: CONFIG.TABLES.CONVERSATIONS,
                Key: { conversationId },
            })
        );

        return (result.Item as Conversation) || null;
    } catch (error) {
        console.error('Error getting conversation:', error);
        return null;
    }
}

/**
 * Create new conversation
 */
async function createConversation(
    conversationId: string,
    userEmail: string,
    modelName: string
): Promise<Conversation> {
    const conversation: Conversation = {
        conversationId,
        userEmail,
        modelName,
        messages: [],
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        totalCost: 0,
        totalTokens: 0,
    };

    await docClient.send(
        new PutCommand({
            TableName: CONFIG.TABLES.CONVERSATIONS,
            Item: conversation,
        })
    );

    return conversation;
}

/**
 * Add message to conversation
 */
async function addMessageToConversation(
    conversationId: string,
    message: ConversationMessage
): Promise<void> {
    await docClient.send(
        new UpdateCommand({
            TableName: CONFIG.TABLES.CONVERSATIONS,
            Key: { conversationId },
            UpdateExpression:
                'SET messages = list_append(messages, :message), lastUpdated = :lastUpdated',
            ExpressionAttributeValues: {
                ':message': [message],
                ':lastUpdated': new Date().toISOString(),
            },
        })
    );
}

/**
 * Store email query in DynamoDB
 */
async function storeEmailQuery(query: EmailQuery): Promise<void> {
    await docClient.send(
        new PutCommand({
            TableName: CONFIG.TABLES.EMAIL_QUERIES,
            Item: query,
        })
    );
}

/**
 * Send message to response generation queue
 */
async function queueResponseGeneration(queryId: string): Promise<void> {
    await sqsClient.send(
        new SendMessageCommand({
            QueueUrl: CONFIG.QUEUES.RESPONSE_GENERATION,
            MessageBody: JSON.stringify({ queryId }),
            MessageAttributes: {
                QueryType: {
                    StringValue: 'email',
                    DataType: 'String',
                },
            },
        })
    );
}

/**
 * Main email processing function
 */
export async function processEmail(
    gmailId: string,
    userEmail: string,
    fromSender: string,
    subject: string,
    body: string,
    attachments: EmailAttachment[],
    receivedDate: string
): Promise<{ success: boolean; queryId?: string; error?: string }> {
    try {
        console.log(`Processing email ${gmailId} from ${fromSender}`);

        // Validate email query
        const validation = validateEmailQuery(subject, body);
        if (!validation.isValid) {
            console.log(`Email validation failed: ${validation.reason}`);
            return { success: false, error: validation.reason };
        }

        // Parse email directives
        const { conversationId, modelName, cleanSubject, cleanBody } = parseEmailDirectives(
            subject,
            body
        );

        // Get user profile
        const userProfile = await getUserProfile(fromSender);

        // Check free tier limit for non-registered users
        if (userProfile.subscriptionType === 'pay-per-use' && userProfile.credits === 0) {
            const freeTierCheck = await checkFreeTierLimit(fromSender);
            if (!freeTierCheck.allowed) {
                return { success: false, error: freeTierCheck.reason };
            }
        }

        // Determine query type
        const queryType = conversationId ? 'conversation' : 'standalone';

        // Handle conversation context
        let conversation: Conversation | null = null;
        if (conversationId) {
            conversation = await getConversation(conversationId);
            if (!conversation && userProfile.persistenceEnabled) {
                // Create new conversation if persistence is enabled
                conversation = await createConversation(
                    conversationId,
                    fromSender,
                    modelName || userProfile.preferredModel
                );
            }
        }

        // Upload attachments to S3
        const processedAttachments: EmailAttachment[] = [];
        for (const attachment of attachments) {
            if (attachment.data) {
                const s3Key = await uploadAttachmentToS3(attachment, gmailId);
                processedAttachments.push({
                    ...attachment,
                    s3Key,
                    data: undefined, // Remove data from memory
                });
            }
        }

        // Create email query record
        const queryId = uuidv4();
        const emailQuery: EmailQuery = {
            queryId,
            gmailId,
            userEmail,
            fromSender,
            subject: cleanSubject,
            body: cleanBody,
            attachments: processedAttachments,
            conversationId,
            modelName: modelName || userProfile.preferredModel,
            receivedDate,
            queryType,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        // Store query in DynamoDB
        await storeEmailQuery(emailQuery);

        // Add user message to conversation if applicable
        if (conversation && userProfile.persistenceEnabled && conversationId) {
            const userMessage: ConversationMessage = {
                messageId: uuidv4(),
                role: 'user',
                content: cleanBody || cleanSubject,
                timestamp: new Date().toISOString(),
                gmailId,
            };
            await addMessageToConversation(conversationId, userMessage);
        }

        // Queue for response generation
        await queueResponseGeneration(queryId);

        console.log(`Successfully processed email ${gmailId}, queryId: ${queryId}`);

        return { success: true, queryId };
    } catch (error) {
        console.error('Error processing email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Lambda handler for email processing
 */
export async function handler(event: any): Promise<any> {
    try {
        console.log('Email processing event:', JSON.stringify(event, null, 2));

        // Process S3 event (email content uploaded by pollGmail)
        if (event.Records && event.Records[0].eventSource === 'aws:s3') {
            const s3Record = event.Records[0].s3;
            const bucket = s3Record.bucket.name;
            const key = decodeURIComponent(s3Record.object.key);

            // Extract email metadata from S3 key
            // Expected format: emails/{gmailId}/metadata.json
            const keyParts = key.split('/');
            if (keyParts.length >= 3 && keyParts[0] === 'emails') {
                const gmailId = keyParts[1];

                // Get email metadata from S3
                const metadataResult = await s3Client.send(
                    new GetObjectCommand({
                        Bucket: bucket,
                        Key: key,
                    })
                );

                const metadata = JSON.parse(await metadataResult.Body!.transformToString());

                // Process the email
                const result = await processEmail(
                    gmailId,
                    metadata.userEmail,
                    metadata.fromSender,
                    metadata.subject,
                    metadata.body,
                    metadata.attachments || [],
                    metadata.receivedDate
                );

                return {
                    statusCode: 200,
                    body: JSON.stringify(result),
                };
            }
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid event format' }),
        };
    } catch (error) {
        console.error('Lambda handler error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
}
