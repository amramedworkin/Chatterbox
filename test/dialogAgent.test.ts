import {
    dialogAgent,
    askDialog,
    askDialogWithInstructions,
    askDialogFull,
} from '../src/openai/dialogAgent';

async function testDialogAgent() {
    console.log('Testing dialogAgent module...\n');

    try {
        // Test 1: Basic dialog
        console.log('Test 1: Basic dialog');
        const response1 = await askDialog('What is artificial intelligence?');
        console.log('Response:', response1);
        console.log('---\n');

        // Test 2: Dialog with custom instructions
        console.log('Test 2: Dialog with custom instructions');
        const response2 = await askDialogWithInstructions(
            'Write a short story',
            'You are a creative storyteller. Write engaging, imaginative stories.'
        );
        console.log('Response:', response2);
        console.log('---\n');

        // Test 3: Full response object
        console.log('Test 3: Full response object');
        const fullResponse = await askDialogFull('Explain machine learning in one sentence.');
        console.log('Text:', fullResponse.text);
        console.log('Turns:', fullResponse.turns);
        console.log('Usage:', fullResponse.usage);
        console.log('---\n');

        // Test 4: Custom options
        console.log('Test 4: Custom options');
        const customResponse = await dialogAgent({
            question: 'What is the capital of France?',
            model: 'gpt-4o-mini',
            instructions: 'You are a geography expert. Provide brief, accurate answers.',
            maxTurns: 1,
        });
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
    testDialogAgent();
}

export { testDialogAgent };
