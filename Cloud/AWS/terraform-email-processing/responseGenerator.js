"use strict";
// src/aws/responseGenerator.ts
// AWS-native response generation system
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.processResponseQueue = exports.generateResponse = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_sqs_1 = require("@aws-sdk/client-sqs");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const client_ses_1 = require("@aws-sdk/client-ses");
// Simple UUID v4 generator (no external dependency)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
// AWS Clients
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new client_sqs_1.SQSClient({});
const s3Client = new client_s3_1.S3Client({});
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({});
const ssmClient = new client_ssm_1.SSMClient({});
const sesClient = new client_ses_1.SESClient({});
// Configuration
const CONFIG = {
    TABLES: {
        EMAIL_QUERIES: 'chatterbox-email-queries',
        CONVERSATIONS: 'chatterbox-conversations',
        GENERATED_RESPONSES: 'chatterbox-generated-responses',
        QUERY_RECORDS: 'chatterbox-query-records',
    },
    BUCKETS: {
        ATTACHMENTS: 'chatterbox-attachments',
    },
    QUEUES: {
        RESPONSE_GENERATION: 'chatterbox-response-generation',
    },
    PARAMETERS: {
        DEFAULT_MODEL: '/chatterbox/llm/default-model',
        INFRASTRUCTURE_COST: '/chatterbox/billing/infrastructure-cost',
        LICENSING_COST: '/chatterbox/billing/licensing-cost',
    },
};
/**
 * Get email query from DynamoDB
 */
async function getEmailQuery(queryId) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: CONFIG.TABLES.EMAIL_QUERIES,
            Key: { queryId },
        }));
        return result.Item || null;
    }
    catch (error) {
        console.error('Error getting email query:', error);
        return null;
    }
}
/**
 * Get conversation context
 */
async function getConversation(conversationId) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: CONFIG.TABLES.CONVERSATIONS,
            Key: { conversationId },
        }));
        return result.Item || null;
    }
    catch (error) {
        console.error('Error getting conversation:', error);
        return null;
    }
}
/**
 * Update conversation with assistant message
 */
async function updateConversationWithResponse(conversationId, message, cost, tokens) {
    await docClient.send(new lib_dynamodb_1.UpdateCommand({
        TableName: CONFIG.TABLES.CONVERSATIONS,
        Key: { conversationId },
        UpdateExpression: 'SET messages = list_append(messages, :message), lastUpdated = :lastUpdated, totalCost = totalCost + :cost, totalTokens = totalTokens + :tokens',
        ExpressionAttributeValues: {
            ':message': [message],
            ':lastUpdated': new Date().toISOString(),
            ':cost': cost,
            ':tokens': tokens,
        },
    }));
}
/**
 * Get conversation history for LLM context
 */
function formatConversationHistory(conversation) {
    if (conversation.messages.length === 0) {
        return '';
    }
    let history = '\n\nPrevious conversation:\n';
    for (const message of conversation.messages) {
        const role = message.role === 'user' ? 'User' : 'Assistant';
        history += `${role}: ${message.content}\n`;
    }
    return history;
}
/**
 * Call OpenAI API for response generation
 */
async function generateLLMResponse(prompt, modelName, attachments) {
    try {
        // Get OpenAI API key from Secrets Manager
        const secretResult = await secretsClient.send(new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: 'chatterbox/openai-api-key',
        }));
        const openaiApiKey = secretResult.SecretString;
        if (!openaiApiKey) {
            throw new Error('OpenAI API key not found in Secrets Manager');
        }
        // Prepare the full prompt with attachments
        let fullPrompt = prompt;
        if (attachments.length > 0) {
            fullPrompt += '\n\nAttachments provided:\n';
            for (const attachment of attachments) {
                fullPrompt += `- ${attachment.filename} (${attachment.mimeType}, ${attachment.size} bytes)\n`;
            }
            fullPrompt +=
                '\nNote: Please reference any relevant information from the attachments in your response.';
        }
        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    {
                        role: 'system',
                        content: "You are a helpful assistant. Respond to the user's request based on the provided prompt.",
                    },
                    {
                        role: 'user',
                        content: fullPrompt,
                    },
                ],
                max_tokens: 4000,
                temperature: 0.7,
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const content = data.choices[0].message.content;
        const usage = data.usage;
        // Calculate cost (approximate based on OpenAI pricing)
        const inputTokens = usage.prompt_tokens;
        const outputTokens = usage.completion_tokens;
        const totalTokens = usage.total_tokens;
        // Cost calculation (GPT-4o pricing as of 2024)
        const inputCost = (inputTokens / 1000) * 0.005; // $0.005 per 1K input tokens
        const outputCost = (outputTokens / 1000) * 0.015; // $0.015 per 1K output tokens
        const totalCost = inputCost + outputCost;
        return {
            content,
            cost: totalCost,
            tokens: totalTokens,
        };
    }
    catch (error) {
        console.error('Error generating LLM response:', error);
        throw error;
    }
}
/**
 * Format email response subject
 */
function formatResponseSubject(originalSubject, conversationId) {
    let subject = `Re: ${originalSubject}`;
    // Add conversation ID if present
    if (conversationId) {
        subject += ` <<<${conversationId}>>>`;
    }
    return subject;
}
/**
 * Format email response body
 */
function formatResponseBody(responseContent, conversationId, modelName) {
    let body = responseContent;
    // Add conversation ID if present
    if (conversationId) {
        body += `\n\n<<<${conversationId}>>>`;
    }
    // Add model name if specified
    if (modelName) {
        body += `\n<<<${modelName}>>>`;
    }
    return body;
}
/**
 * Send email response via SES
 */
async function sendEmailResponse(fromEmail, toEmail, subject, body) {
    try {
        const result = await sesClient.send(new client_ses_1.SendEmailCommand({
            Source: fromEmail,
            Destination: {
                ToAddresses: [toEmail],
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8',
                },
                Body: {
                    Text: {
                        Data: body,
                        Charset: 'UTF-8',
                    },
                },
            },
        }));
        return result.MessageId || '';
    }
    catch (error) {
        console.error('Error sending email via SES:', error);
        throw error;
    }
}
/**
 * Store generated response
 */
async function storeGeneratedResponse(response) {
    await docClient.send(new lib_dynamodb_1.PutCommand({
        TableName: CONFIG.TABLES.GENERATED_RESPONSES,
        Item: response,
    }));
}
/**
 * Create query record for billing and analytics
 */
async function createQueryRecord(query, response, wasPreferredModel) {
    const infrastructureCost = await getInfrastructureCost();
    const licensingCost = await getLicensingCost();
    const queryRecord = {
        queryId: query.queryId,
        userEmail: query.fromSender,
        querySizeBytes: Buffer.byteLength(query.body, 'utf8'),
        querySizeTokens: query.tokenCount || 0,
        isConversation: query.queryType === 'conversation',
        responseSizeBytes: Buffer.byteLength(response.responseContent, 'utf8'),
        responseSizeTokens: response.tokens,
        receivedAt: query.receivedDate,
        processedAt: query.processedAt || new Date().toISOString(),
        sentAt: response.sentAt || new Date().toISOString(),
        modelUsed: response.modelUsed,
        wasPreferredModel,
        costBreakdown: {
            llmCost: response.cost,
            infrastructureCost,
            licensingCost,
            totalCost: response.cost + infrastructureCost + licensingCost,
        },
        conversationId: query.conversationId,
    };
    await docClient.send(new lib_dynamodb_1.PutCommand({
        TableName: CONFIG.TABLES.QUERY_RECORDS,
        Item: queryRecord,
    }));
}
/**
 * Get infrastructure cost from Parameter Store
 */
async function getInfrastructureCost() {
    try {
        const result = await ssmClient.send(new client_ssm_1.GetParameterCommand({
            Name: CONFIG.PARAMETERS.INFRASTRUCTURE_COST,
        }));
        return parseFloat(result.Parameter?.Value || '0.01');
    }
    catch (error) {
        console.error('Error getting infrastructure cost:', error);
        return 0.01; // Default cost
    }
}
/**
 * Get licensing cost from Parameter Store
 */
async function getLicensingCost() {
    try {
        const result = await ssmClient.send(new client_ssm_1.GetParameterCommand({
            Name: CONFIG.PARAMETERS.LICENSING_COST,
        }));
        return parseFloat(result.Parameter?.Value || '0.005');
    }
    catch (error) {
        console.error('Error getting licensing cost:', error);
        return 0.005; // Default cost
    }
}
/**
 * Update email query status
 */
async function updateQueryStatus(queryId, status, errorMessage) {
    const updateExpression = 'SET #status = :status, processedAt = :processedAt';
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues = {
        ':status': status,
        ':processedAt': new Date().toISOString(),
    };
    if (errorMessage) {
        expressionAttributeValues[':errorMessage'] = errorMessage;
    }
    await docClient.send(new lib_dynamodb_1.UpdateCommand({
        TableName: CONFIG.TABLES.EMAIL_QUERIES,
        Key: { queryId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
    }));
}
/**
 * Main response generation function
 */
async function generateResponse(queryId) {
    const startTime = Date.now();
    try {
        console.log(`Generating response for query ${queryId}`);
        // Get email query
        const query = await getEmailQuery(queryId);
        if (!query) {
            throw new Error(`Email query not found: ${queryId}`);
        }
        // Update status to processing
        await updateQueryStatus(queryId, 'processing');
        // Get conversation context if applicable
        let conversation = null;
        let conversationHistory = '';
        if (query.conversationId) {
            conversation = await getConversation(query.conversationId);
            if (conversation) {
                conversationHistory = formatConversationHistory(conversation);
            }
        }
        // Prepare prompt
        let prompt = query.body || query.subject;
        if (conversationHistory) {
            prompt += conversationHistory;
        }
        // Generate LLM response
        const llmResult = await generateLLMResponse(prompt, query.modelName || 'gpt-4o', query.attachments);
        // Create response record
        const responseId = generateUUID();
        const response = {
            responseId,
            queryId,
            responseContent: llmResult.content,
            conversationId: query.conversationId,
            modelUsed: query.modelName || 'gpt-4o',
            responseTime: Date.now() - startTime,
            cost: llmResult.cost,
            tokens: llmResult.tokens,
            createdAt: new Date().toISOString(),
        };
        // Store response
        await storeGeneratedResponse(response);
        // Update conversation if applicable
        if (conversation) {
            const assistantMessage = {
                messageId: generateUUID(),
                role: 'assistant',
                content: llmResult.content,
                timestamp: new Date().toISOString(),
                cost: llmResult.cost,
                tokens: llmResult.tokens,
            };
            await updateConversationWithResponse(query.conversationId, assistantMessage, llmResult.cost, llmResult.tokens);
        }
        // Format and send email response
        const responseSubject = formatResponseSubject(query.subject, query.conversationId);
        const responseBody = formatResponseBody(llmResult.content, query.conversationId, query.modelName);
        const messageId = await sendEmailResponse(query.userEmail, query.fromSender, responseSubject, responseBody);
        // Update response with sent timestamp
        response.sentAt = new Date().toISOString();
        await storeGeneratedResponse(response);
        // Create query record for billing
        const wasPreferredModel = query.modelName === 'gpt-4o'; // Default model
        await createQueryRecord(query, response, wasPreferredModel);
        // Update query status to completed
        await updateQueryStatus(queryId, 'completed');
        console.log(`Successfully generated and sent response for query ${queryId}`);
        return { success: true, responseId };
    }
    catch (error) {
        console.error(`Error generating response for query ${queryId}:`, error);
        // Update query status to failed
        await updateQueryStatus(queryId, 'failed', error instanceof Error ? error.message : 'Unknown error');
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
exports.generateResponse = generateResponse;
/**
 * Process messages from SQS queue
 */
async function processResponseQueue() {
    try {
        console.log('Polling response generation queue...');
        const result = await sqsClient.send(new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: CONFIG.QUEUES.RESPONSE_GENERATION,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
        }));
        if (!result.Messages || result.Messages.length === 0) {
            console.log('No messages in queue');
            return;
        }
        console.log(`Processing ${result.Messages.length} messages`);
        for (const message of result.Messages) {
            try {
                const body = JSON.parse(message.Body || '{}');
                const queryId = body.queryId;
                if (!queryId) {
                    console.error('Invalid message format:', message.Body);
                    continue;
                }
                const response = await generateResponse(queryId);
                if (response.success) {
                    // Delete message from queue
                    await sqsClient.send(new client_sqs_1.DeleteMessageCommand({
                        QueueUrl: CONFIG.QUEUES.RESPONSE_GENERATION,
                        ReceiptHandle: message.ReceiptHandle,
                    }));
                    console.log(`Successfully processed query ${queryId}`);
                }
                else {
                    console.error(`Failed to process query ${queryId}:`, response.error);
                }
            }
            catch (error) {
                console.error('Error processing message:', error);
            }
        }
    }
    catch (error) {
        console.error('Error processing response queue:', error);
    }
}
exports.processResponseQueue = processResponseQueue;
/**
 * Lambda handler for response generation
 */
async function handler(event) {
    try {
        console.log('Response generation event:', JSON.stringify(event, null, 2));
        // Handle SQS event
        if (event.Records && event.Records[0].eventSource === 'aws:sqs') {
            const body = JSON.parse(event.Records[0].body);
            const queryId = body.queryId;
            const result = await generateResponse(queryId);
            return {
                statusCode: result.success ? 200 : 500,
                body: JSON.stringify(result),
            };
        }
        // Handle direct invocation
        if (event.queryId) {
            const result = await generateResponse(event.queryId);
            return {
                statusCode: result.success ? 200 : 500,
                body: JSON.stringify(result),
            };
        }
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid event format' }),
        };
    }
    catch (error) {
        console.error('Lambda handler error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
}
exports.handler = handler;
