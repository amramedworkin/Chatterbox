// test/testOpenAiCompletion.js
// This script tests the single-turn LLM completion capability using llmCompletion.js.
// It does not handle dialogs or conversation history.

const path = require('path');
const fs = require('fs').promises; // For reading test attachments
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load .env from project root

// Import the single-request LLM completion function
// Ensure the path correctly points to the new file name (llmCompletion.js)
const { getLlmCompletion } = require('../src/openai/llmCompletion');
const config = require('../src/loadConfig'); // Load the main config

async function main() {
    const args = process.argv.slice(2);

    const promptArgIndex = args.indexOf('--prompt');
    const attachmentsPathArgIndex = args.indexOf('--attachments-path');

    let testPrompt = config.testOpenAi.testPrompt; // Default prompt from config
    let testAttachmentsFolder = null;
    let testAttachmentsInfo = [];

    // Override default prompt if --prompt is provided
    if (promptArgIndex > -1 && args[promptArgIndex + 1]) {
        testPrompt = args[promptArgIndex + 1];
    }

    // Handle attachments if --attachments-path is provided
    if (attachmentsPathArgIndex > -1 && args[attachmentsPathArgIndex + 1]) {
        testAttachmentsFolder = args[attachmentsPathArgIndex + 1];
    } else {
        // Use default test attachments folder if specified in config and no specific path provided
        // This leverages config.sendTest.testAttachmentsFolder for testing purposes
        if (config.sendTest && config.sendTest.testAttachmentsFolder) {
            testAttachmentsFolder = config.sendTest.testAttachmentsFolder;
        }
    }

    // If a test attachments folder is determined, try to read its contents
    if (testAttachmentsFolder) {
        const fullAttachmentPath = path.resolve(testAttachmentsFolder);
        try {
            const files = await fs.readdir(fullAttachmentPath, { withFileTypes: true });
            for (const dirent of files) {
                if (dirent.isFile()) {
                    const stats = await fs.stat(path.join(fullAttachmentPath, dirent.name));
                    testAttachmentsInfo.push({
                        filename: dirent.name,
                        size: stats.size,
                    });
                }
            }
            if (testAttachmentsInfo.length > 0) {
                console.log(
                    `Found ${testAttachmentsInfo.length} attachments in test folder: ${fullAttachmentPath}`
                );
            }
        } catch (err) {
            console.warn(
                `Warning: Could not read test attachments folder ${fullAttachmentPath}:`,
                err.message
            );
            testAttachmentsFolder = null; // Reset if error
            testAttachmentsInfo = [];
        }
    }

    console.log(`\n--- Testing OpenAI Single Completion ---`);
    console.log(`Prompt: "${testPrompt}"`);
    console.log(
        `Attachments: ${testAttachmentsInfo.length > 0 ? testAttachmentsInfo.map((a) => a.filename).join(', ') : 'None'}`
    );

    if (!config.openai.apiKey || config.openai.apiKey === 'YOUR_OPENAI_API_KEY') {
        console.error(
            '\nError: OPENAI_API_KEY is not set. Please set it in a .env file or directly in the script.'
        );
        process.exit(1);
    }

    try {
        const llmResponse = await getLlmCompletion(
            testPrompt,
            testAttachmentsInfo,
            testAttachmentsFolder
        );

        console.log(`\n--- LLM Completion Test Result ---`);
        console.log(`Response:`);
        console.log(llmResponse);
        console.log(`----------------------------------`);
    } catch (error) {
        console.error('Error during LLM completion test:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
