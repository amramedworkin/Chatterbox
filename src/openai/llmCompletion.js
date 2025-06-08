// src/openai/llmCompletion.js
// This module is optimized for handling single, stateless LLM requests.
// It does not maintain conversation history.

// Import necessary libraries.
require('dotenv').config(); // For loading API key from .env file
const path = require('path'); // Re-add path for standalone testing block
const fs = require('fs').promises; // Re-add fs for standalone testing block

// Import the configuration object from loadConfig.js
const config = require('../../src/loadConfig'); // Adjusted path as llmCompletion.js moved to src/openai

// Import shared LLM utilities, including the initialized OpenAI client and helper functions
const { openai, prepareAttachmentsForOpenAI } = require('../../utils/llmUtilities'); // Adjusted path

// --- Main LLM Interaction Function ---

/**
 * Interacts with the OpenAI LLM to get a single completion response.
 * This function does not maintain conversation history.
 * @param {string} promptContent The main text prompt from the email body.
 * @param {Array<object>} attachmentsInfo An array of attachment objects ({ filename: string, size: number }).
 * @param {string} attachmentsFolderPath The specific folder for this message's attachments.
 * @returns {Promise<string>} The LLM's generated response.
 */
async function getLlmCompletion(promptContent, attachmentsInfo, attachmentsFolderPath) {
    try {
        // Construct the user's current message, including text prompt and attachments
        const userMessageContent = [];
        if (promptContent) {
            userMessageContent.push({ type: 'text', text: promptContent });
        }

        // Use the abstracted function from llmUtilities to prepare attachments
        const attachmentContentParts = await prepareAttachmentsForOpenAI(
            attachmentsInfo,
            attachmentsFolderPath
        );
        userMessageContent.push(...attachmentContentParts);

        if (userMessageContent.length === 0) {
            console.error('No content (prompt or attachments) provided for the LLM request.');
            return 'Error: No content provided for LLM interaction.';
        }

        const messages = [
            {
                role: 'user',
                content: userMessageContent,
            },
        ];

        console.log(`Sending single request to OpenAI model: ${config.openai.llmModel}`);
        // console.log("Messages being sent:", JSON.stringify(messages, null, 2)); // Uncomment for debugging messages

        // Use the imported 'openai' client
        const completion = await openai.chat.completions.create({
            model: config.openai.llmModel,
            messages: messages,
            max_tokens: config.openai.maxResponseTokens,
        });

        const llmResponse = completion.choices[0].message.content;
        console.log('\n--- LLM Response Received ---');
        console.log(llmResponse);
        console.log('-----------------------------\n');

        return llmResponse;
    } catch (error) {
        console.error('Error interacting with OpenAI API:', error.message);
        if (error.response) {
            console.error('OpenAI API Error Response Data:', error.response.data);
        }
        return `Error: Could not get response from LLM. Details: ${error.message}`;
    }
}

// --- Main Execution Block (for standalone testing) ---
// This block allows you to run llmCompletion.js directly for testing purposes.
// In a real integration, pollGmail.js would import and call getLlmCompletion directly.
async function main() {
    const args = process.argv.slice(2);

    // Example Usage:
    // node llmCompletion.js --prompt "Summarize this for me."
    // node llmCompletion.js --prompt "Analyze image." --attachments-path test/attachments
    // (Ensure you have test/attachments folder with files if using --attachments-path)

    const promptIndex = args.indexOf('--prompt');
    const attachmentsPathIndex = args.indexOf('--attachments-path'); // Path to the folder containing attachments for this specific message

    let testPrompt = 'What is the capital of France?'; // Default test prompt for a single request
    let testAttachmentsFolder = null; // Default no attachments
    let testAttachmentsInfo = []; // Empty by default for direct invocation

    if (promptIndex > -1 && args[promptIndex + 1]) {
        testPrompt = args[promptIndex + 1];
    }
    if (attachmentsPathIndex > -1 && args[attachmentsPathIndex + 1]) {
        testAttachmentsFolder = args[attachmentsPathIndex + 1];
        // For standalone test, we need to list files in that folder
        const fullAttachmentPath = path.resolve(testAttachmentsFolder);
        try {
            const files = await fs.readdir(fullAttachmentPath, {
                withFileTypes: true,
            });
            for (const dirent of files) {
                if (dirent.isFile()) {
                    const stats = await fs.stat(path.join(fullAttachmentPath, dirent.name));
                    testAttachmentsInfo.push({
                        filename: dirent.name,
                        size: stats.size,
                    });
                }
            }
            console.log(
                `Found ${testAttachmentsInfo.length} attachments in test folder: ${fullAttachmentPath}`
            );
        } catch (err) {
            console.error(
                `Error reading test attachments folder ${fullAttachmentPath}:`,
                err.message
            );
            testAttachmentsFolder = null; // Reset if error
            testAttachmentsInfo = [];
        }
    } else {
        // If no specific attachments path, use the default from config for a generic test
        // This is for demonstration purposes in standalone mode.
        // In actual pollGmail integration, the specific path is passed.
        const defaultTestAttachmentPath = config.sendTest.testAttachmentsFolder; // Use from config
        try {
            const files = await fs.readdir(defaultTestAttachmentPath, {
                withFileTypes: true,
            });
            for (const dirent of files) {
                if (dirent.isFile()) {
                    const stats = await fs.stat(path.join(defaultTestAttachmentPath, dirent.name));
                    testAttachmentsInfo.push({
                        filename: dirent.name,
                        size: stats.size,
                    });
                }
            }
            // Only log if attachments were found in default path
            if (testAttachmentsInfo.length > 0) {
                console.log(
                    `Found ${testAttachmentsInfo.length} attachments in default test folder: ${defaultTestAttachmentPath}`
                );
            }
            // If attachments were found in the default path, set testAttachmentsFolder to that path
            if (testAttachmentsInfo.length > 0) {
                testAttachmentsFolder = defaultTestAttachmentPath;
            }
        } catch (err) {
            // Silently ignore if default test attachments folder doesn't exist for a simple test
            // console.warn(`Warning: Default test attachments folder not found or unreadable: ${defaultTestAttachmentPath}`);
        }
    }

    if (!config.openai.apiKey || config.openai.apiKey === 'YOUR_OPENAI_API_KEY') {
        console.error(
            '\nError: OPENAI_API_KEY is not set. Please set it in a .env file or directly in the script.'
        );
        process.exit(1);
    }

    console.log(`\nSimulating LLM single request for prompt: "${testPrompt.substring(0, 50)}..."`);
    console.log(
        `Attachments: ${testAttachmentsInfo.length > 0 ? testAttachmentsInfo.map((a) => a.filename).join(', ') : 'None'}`
    );

    // Call the core LLM interaction function
    const llmResponse = await getLlmCompletion(
        testPrompt,
        testAttachmentsInfo,
        testAttachmentsFolder // Pass the actual folder path for reading attachments
    );

    console.log(`LLM Response (full): ${llmResponse}`);
}

// Run the main function when the script is executed directly
if (require.main === module) {
    main();
}

// Export the core function for other modules (e.g., pollGmail.js) to use
module.exports = {
    getLlmCompletion,
};
