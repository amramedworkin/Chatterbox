// Import necessary libraries.
// If you haven't installed them yet, run:
// npm install openai dotenv fs readline
const OpenAI = require('openai');
const fs = require('fs').promises; // Use promises version for async/await
const path = require('path');
const readline = require('readline'); // For potential CLI interaction if needed
require('dotenv').config(); // For loading API key from .env file

// --- Configuration ---
// Your OpenAI API Key.
// It's recommended to load this from an environment variable (e.g., in a .env file).
// Create a .env file in the same directory as this script with: OPENAI_API_KEY=your_openai_api_key_here
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// OpenAI Model to use.
// GPT-4o is recommended for multimodal capabilities (text + images).
// If you only expect text, 'gpt-3.5-turbo' or 'gpt-4-turbo' can be used.
const LLM_MODEL = 'gpt-4o'; // Or 'gpt-3.5-turbo', 'gpt-4-turbo', etc.

// Max tokens for the LLM response. Adjust based on your needs and model limits.
const MAX_RESPONSE_TOKENS = 10000;

// Base folder where interactions (including attachments) are saved by pollGmail.js
// Assumes this script is in a 'test' subfolder under the main 'nodetest'
const INTERACTIONS_BASE_FOLDER = path.join(__dirname, '..', 'interactions');

// --- Helper Functions ---

/**
 * Loads an attachment file, returning its base64 encoded content.
 * @param {string} filePath The full path to the attachment file.
 * @returns {Promise<string>} Base64 encoded file content.
 */
async function loadAttachmentBase64(filePath) {
    try {
        const fileBuffer = await fs.readFile(filePath);
        return fileBuffer.toString('base64');
    } catch (error) {
        console.error(`Error loading attachment ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Prepares attachments for inclusion in an OpenAI multimodal message.
 * It reads the actual files from the given path.
 * @param {Array<object>} attachmentsInfo An array of attachment objects ({ filename: string, size: number }).
 * @param {string} conversationSpecificFolderPath The specific folder for this message's attachments (e.g., 'interactions/GUID/001').
 * @returns {Promise<Array<object>>} An array of OpenAI image_url content objects or text content objects for the attachments.
 */
async function prepareAttachmentsForOpenAI(attachmentsInfo, conversationSpecificFolderPath) {
    const contentParts = [];

    if (!attachmentsInfo || attachmentsInfo.length === 0) {
        return contentParts;
    }

    console.log(`Preparing ${attachmentsInfo.length} attachments from: ${conversationSpecificFolderPath}`);

    for (const attach of attachmentsInfo) {
        const filePath = path.join(conversationSpecificFolderPath, attach.filename);
        const fileExtension = path.extname(attach.filename).toLowerCase();
        let mimeType = 'application/octet-stream'; // Default MIME type

        // Determine MIME type based on extension
        if (fileExtension === '.txt') {
            mimeType = 'text/plain';
        } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
            mimeType = 'image/jpeg';
        } else if (fileExtension === '.png') {
            mimeType = 'image/png';
        } else if (fileExtension === '.pdf') {
             mimeType = 'application/pdf'; // GPT-4o can process PDFs for text
        }
        // Add more MIME types as needed for other file types OpenAI supports

        try {
            if (mimeType.startsWith('image/')) {
                const base64Image = await loadAttachmentBase64(filePath);
                if (base64Image) {
                    contentParts.push({
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`,
                            detail: "auto", // or 'low', 'high'
                        },
                    });
                    console.log(`  - Added image attachment: ${attach.filename}`);
                }
            } else if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
                const fileContent = await fs.readFile(filePath, 'utf8');
                contentParts.push({
                    type: "text",
                    text: `--- Start of attached file: ${attach.filename} ---\n${fileContent}\n--- End of attached file: ${attach.filename} ---`,
                });
                console.log(`  - Added text attachment: ${attach.filename}`);
            } else {
                console.warn(`  - Skipping unsupported attachment type for LLM: ${attach.filename} (${mimeType}).`);
                // For other file types, you might choose to embed as binary (if LLM supports)
                // or provide a placeholder indicating a file was present but not processed.
            }
        } catch (error) {
            console.error(`Error processing attachment ${attach.filename}:`, error.message);
        }
    }
    return contentParts;
}

/**
 * Placeholder for loading conversation history from a persistent store.
 * In a real application, this would read from a database or a file per conversation ID.
 * @param {string} conversationId The ID of the conversation.
 * @returns {Promise<Array<object>>} An array of messages representing past conversation turns.
 */
async function loadConversationHistory(conversationId) {
    const history = [];
    // TODO: Implement actual loading of conversation history from a persistent store.
    // This would typically involve reading a file like 'interactions/<conversationId>/history.json'
    // or querying a database.
    // Each message should be in the format { role: "user"|"assistant", content: "..." }
    console.log(`Loading conversation history for ID: ${conversationId} (placeholder - not implemented yet).`);
    return history;
}

/**
 * Interacts with the OpenAI LLM to get a completion or conversational response.
 * @param {string} promptContent The main text prompt from the email body.
 * @param {string} conversationId The conversation ID (GUID or 'completion').
 * @param {Array<object>} attachmentsInfo An array of attachment objects ({ filename: string, size: number }).
 * @param {string} conversationSpecificFolderPath The specific folder for this message's attachments.
 * @returns {Promise<string>} The LLM's generated response.
 */
async function getLlmCompletion(promptContent, conversationId, attachmentsInfo, conversationSpecificFolderPath) {
    try {
        let messages = [];

        // 1. Load conversation history (if applicable and implemented)
        if (conversationId !== 'completion') { // 'completion' implies a new, single-turn request for now
            const history = await loadConversationHistory(conversationId);
            messages = messages.concat(history);
        }

        // 2. Prepare attachments for inclusion in the user's message
        const attachmentContentParts = await prepareAttachmentsForOpenAI(attachmentsInfo, conversationSpecificFolderPath);

        // 3. Construct the user's current message, including text prompt and attachments
        const userMessageContent = [];
        if (promptContent) {
            userMessageContent.push({ type: "text", text: promptContent });
        }
        userMessageContent.push(...attachmentContentParts);

        if (userMessageContent.length === 0) {
            console.error("No content (prompt or attachments) provided for the LLM request.");
            return "Error: No content provided for LLM interaction.";
        }

        messages.push({
            role: "user",
            content: userMessageContent,
        });

        console.log(`Sending request to OpenAI model: ${LLM_MODEL}`);
        // console.log("Messages being sent:", JSON.stringify(messages, null, 2)); // Uncomment for debugging messages

        const completion = await openai.chat.completions.create({
            model: LLM_MODEL,
            messages: messages,
            max_tokens: MAX_RESPONSE_TOKENS,
        });

        const llmResponse = completion.choices[0].message.content;
        console.log("\n--- LLM Response Received ---");
        console.log(llmResponse);
        console.log("-----------------------------\n");

        // TODO: Save the current interaction (user message + LLM response) to history
        // This is crucial for ongoing conversations.
        // E.g., `messages.push({ role: "assistant", content: llmResponse });`
        // Then save `messages` (or relevant parts) to `interactions/<conversationId>/history.json`

        return llmResponse;

    } catch (error) {
        console.error("Error interacting with OpenAI API:", error.message);
        if (error.response) {
            console.error("OpenAI API Error Response Data:", error.response.data);
        }
        return `Error: Could not get response from LLM. Details: ${error.message}`;
    }
}

// --- Main Execution Block (for standalone testing) ---
// This block allows you to run converseWithLlm.js directly for testing purposes.
// In a real integration, pollGmail.js would import and call getLlmCompletion directly.
async function main() {
    const args = process.argv.slice(2);
    const scriptName = path.basename(process.argv[1]);

    // Example Usage:
    // node converseWithLlm.js --prompt "Summarize this for me." --id 123e4567-e89b-12d3-a456-426614174000 --attachments path/to/interactions/GUID/001
    // node converseWithLlm.js --prompt "Hello LLM."
    // node converseWithLlm.js --prompt "Analyze image." --attachments test/attachments
    // (Ensure you have test/attachments folder with files if using --attachments)

    const promptIndex = args.indexOf('--prompt');
    const idIndex = args.indexOf('--id');
    const attachmentsPathIndex = args.indexOf('--attachments-path'); // Path to the folder containing attachments for this specific message

    let testPrompt = "What is the square root of 81?"; // Default test prompt
    let testConversationId = 'completion'; // Default new conversation
    let testAttachmentsFolder = null; // Default no attachments
    let testAttachmentsInfo = []; // Empty by default for direct invocation

    if (promptIndex > -1 && args[promptIndex + 1]) {
        testPrompt = args[promptIndex + 1];
    }
    if (idIndex > -1 && args[idIndex + 1]) {
        testConversationId = args[idIndex + 1];
    }
    if (attachmentsPathIndex > -1 && args[attachmentsPathIndex + 1]) {
        testAttachmentsFolder = args[attachmentsPathIndex + 1];
        // For standalone test, we need to list files in that folder
        const fullAttachmentPath = path.resolve(testAttachmentsFolder);
        try {
            const files = await fs.readdir(fullAttachmentPath, { withFileTypes: true });
            for (const dirent of files) {
                if (dirent.isFile()) {
                    const stats = await fs.stat(path.join(fullAttachmentPath, dirent.name));
                    testAttachmentsInfo.push({
                        filename: dirent.name,
                        size: stats.size
                    });
                }
            }
            console.log(`Found ${testAttachmentsInfo.length} attachments in test folder: ${fullAttachmentPath}`);
        } catch (err) {
            console.error(`Error reading test attachments folder ${fullAttachmentPath}:`, err.message);
            testAttachmentsFolder = null; // Reset if error
            testAttachmentsInfo = [];
        }
    } else {
        // If no specific attachments path, use the default TEST_ATTACHMENTS_FOLDER for a generic test
        // This is for demonstration purposes in standalone mode.
        // In actual pollGmail integration, the specific path is passed.
        const defaultTestAttachmentPath = TEST_ATTACHMENTS_FOLDER;
        try {
             const files = await fs.readdir(defaultTestAttachmentPath, { withFileTypes: true });
             for (const dirent of files) {
                 if (dirent.isFile()) {
                     const stats = await fs.stat(path.join(defaultTestAttachmentPath, dirent.name));
                     testAttachmentsInfo.push({
                         filename: dirent.name,
                         size: stats.size
                     });
                 }
             }
             // Only log if attachments were found in default path
             if (testAttachmentsInfo.length > 0) {
                 console.log(`Found ${testAttachmentsInfo.length} attachments in default test folder: ${defaultTestAttachmentPath}`);
             }
         } catch (err) {
             // Silently ignore if default test attachments folder doesn't exist for a simple test
             // console.warn(`Warning: Default test attachments folder not found or unreadable: ${defaultTestAttachmentPath}`);
         }
    }


    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY') {
        console.error("\nError: OPENAI_API_KEY is not set. Please set it in a .env file or directly in the script.");
        process.exit(1);
    }

    console.log(`\nSimulating LLM interaction for prompt: "${testPrompt.substring(0, 50)}..."`);
    console.log(`Conversation ID: ${testConversationId}`);
    console.log(`Attachments: ${testAttachmentsInfo.length > 0 ? testAttachmentsInfo.map(a => a.filename).join(', ') : 'None'}`);


    // Call the core LLM interaction function
    const llmResponse = await getLlmCompletion(
        testPrompt,
        testConversationId,
        testAttachmentsInfo,
        testAttachmentsFolder || TEST_ATTACHMENTS_FOLDER // Pass the actual folder path for reading attachments
    );

    console.log(`LLM Response (full): ${llmResponse}`);
}

// Run the main function when the script is executed directly
if (require.main === module) {
    main();
}

// Export the core function for pollGmail.js to use
module.exports = { getLlmCompletion };
