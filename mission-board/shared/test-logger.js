/**
 * Test script for Mission Board Conversation Logger
 * Run this to verify that conversations are being logged correctly.
 */

import { ConversationLogger, quickLog } from './logger.js';

const API_URL = process.env.MISSION_BOARD_API_URL || 'http://localhost:3001';

async function runTests() {
  console.log('🧪 Testing Mission Board Conversation Logger...\n');

  // Test 1: Quick log
  console.log('Test 1: Quick Log');
  try {
    const result = await quickLog({
      apiUrl: API_URL,
      initiator: 'TestAgent',
      participants: ['TestAgent2', 'TestAgent3'],
      sessionId: 'test-session-quick-' + Date.now(),
      agentName: 'TestAgent',
      role: 'assistant',
      content: 'This is a test message from the quickLog function!',
      inputTokens: 25,
      outputTokens: 15,
      model: 'test-model-v1'
    });
    console.log('✅ Quick log successful!');
    console.log('   Conversation ID:', result.conversationId);
    console.log('   Message ID:', result.message?.id);
  } catch (error) {
    console.error('❌ Quick log failed:', error.message);
  }

  console.log('\n' + '-'.repeat(50) + '\n');

  // Test 2: Full logger workflow
  console.log('Test 2: Full Logger Workflow');
  try {
    const logger = new ConversationLogger({
      apiUrl: API_URL,
      initiator: 'Nexar'
    });

    // Start conversation
    const convId = await logger.startConversation({
      participants: ['Rio', 'Orion'],
      sessionId: 'test-session-full-' + Date.now(),
      title: 'Test Conversation - Project Planning',
      metadata: { test: true, source: 'test-script' }
    });
    console.log('✅ Conversation started:', convId);

    // Log multiple messages
    await logger.logMessage({
      agentName: 'Nexar',
      role: 'assistant',
      content: 'Hello team! Let\'s plan our next project.',
      inputTokens: 50,
      outputTokens: 25,
      model: 'moonshot/kimi-k2.5'
    });
    console.log('✅ Message 1 logged (Nexar)');

    await logger.logMessage({
      agentName: 'Rio',
      role: 'assistant',
      content: 'Great idea! I\'ll analyze the data requirements.',
      inputTokens: 40,
      outputTokens: 20,
      model: 'moonshot/kimi-k2.5'
    });
    console.log('✅ Message 2 logged (Rio)');

    await logger.logMessage({
      agentName: 'Orion',
      role: 'assistant',
      content: 'I can research similar projects for reference.',
      inputTokens: 45,
      outputTokens: 22,
      model: 'moonshot/kimi-k2.5'
    });
    console.log('✅ Message 3 logged (Orion)');

    // Log a user/system message
    await logger.logMessage({
      agentName: 'System',
      role: 'system',
      content: 'Conversation context: Project Alpha planning session',
      inputTokens: 10,
      outputTokens: 0,
      model: 'system'
    });
    console.log('✅ Message 4 logged (System)');

    logger.endConversation();
    console.log('✅ Conversation ended');

  } catch (error) {
    console.error('❌ Full workflow test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ Tests complete!');
  console.log('Check the Mission Board dashboard at: http://localhost:3000');
  console.log('You should see the test conversations listed.');
  console.log('='.repeat(50));
}

// Run tests
runTests().catch(console.error);
