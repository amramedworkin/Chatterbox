import { askAgent, askAgentText, askAgentNative, AskAgentOptions } from '../src/openai/askAgent';

async function testAskAgent() {
    console.log('Testing askAgent module...\n');

    try {
        // Test 1: Basic text response
        console.log('Test 1: Basic text response');
        const textResponse = await askAgentText('Explain quantum computing in simple terms.');
        console.log('Response:', textResponse);
        console.log('---\n');

        // Test 2: Native response format
        console.log('Test 2: Native response format');
        const nativeResponse = await askAgentNative('What is machine learning?');
        console.log('Response type:', typeof nativeResponse);
        console.log('Has native data:', !!nativeResponse.native);
        console.log('Usage:', nativeResponse.usage);
        console.log('---\n');

        // Test 3: Custom options
        console.log('Test 3: Custom options');
        const options: AskAgentOptions = {
            prompt: 'Write a short poem about coding.',
            responseFormat: 'text',
            model: 'gpt-4o-mini', // Use a smaller model for faster response
        };
        const customResponse = await askAgent(options);
        console.log('Response:', customResponse.text);
        console.log('---\n');

        console.log('All tests completed successfully!');

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testAskAgent();
}

export { testAskAgent }; 