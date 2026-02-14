#!/usr/bin/env node
/**
 * Quick Log - Standalone script for logging to Mission Board
 * 
 * Usage:
 *   node quick-log.js start <session-id> [title]
 *   node quick-log.js message <conversation-id> <agent> <role> <content> [input-tokens] [output-tokens] [model]
 *   node quick-log.js exchange <session-id> <user-msg> <agent-response> [input-toks] [output-toks] [model]
 * 
 * Examples:
 *   node quick-log.js start webchat-abc123 "User Session"
 *   node quick-log.js message uuid-here nexar assistant "Hello!" 0 100 "moonshot/kimi-k2.5"
 *   node quick-log.js exchange webchat-abc123 "Help me" "Sure!" 50 150 "moonshot/kimi-k2.5"
 */

import http from 'http';

const API_URL = process.env.MISSION_BOARD_API_URL || 'http://localhost:3001';

function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', (err) => reject(err));
    
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Usage:');
    console.log('  node quick-log.js start <session-id> [title]');
    console.log('  node quick-log.js message <conversation-id> <agent> <role> <content> [input] [output] [model]');
    console.log('  node quick-log.js exchange <session-id> <user-msg> <response> [input] [output] [model]');
    process.exit(1);
  }

  try {
    if (command === 'start') {
      const sessionId = args[1] || `session-${Date.now()}`;
      const title = args[2] || 'Live Session';
      
      const result = await makeRequest('/api/conversations', 'POST', {
        initiator_agent: 'nexar',
        participants: ['user'],
        session_id: sessionId,
        title: title,
        metadata: { timestamp: new Date().toISOString() }
      });
      
      console.log('CONVERSATION_ID:', result.id);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'message') {
      const conversationId = args[1];
      const agent = args[2];
      const role = args[3];
      const content = args[4];
      const inputTokens = parseInt(args[5]) || 0;
      const outputTokens = parseInt(args[6]) || 0;
      const model = args[7] || 'moonshot/kimi-k2.5';
      
      if (!conversationId || !content) {
        console.error('Error: conversation-id and content required');
        process.exit(1);
      }
      
      const result = await makeRequest(`/api/conversations/${conversationId}/messages`, 'POST', {
        agent_name: agent,
        role: role,
        content: content,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model: model,
        metadata: { timestamp: new Date().toISOString() }
      });
      
      console.log('MESSAGE_LOGGED:', result.id);
      return;
    }

    if (command === 'exchange') {
      const sessionId = args[1];
      const userMsg = args[2];
      const response = args[3];
      const inputTokens = parseInt(args[4]) || 0;
      const outputTokens = parseInt(args[5]) || 0;
      const model = args[6] || 'moonshot/kimi-k2.5';
      
      if (!userMsg || !response) {
        console.error('Error: user-msg and response required');
        process.exit(1);
      }
      
      // Start conversation
      const conv = await makeRequest('/api/conversations', 'POST', {
        initiator_agent: 'nexar',
        participants: ['user'],
        session_id: sessionId,
        title: 'Live Exchange',
        metadata: { timestamp: new Date().toISOString() }
      });
      
      // Log user message
      await makeRequest(`/api/conversations/${conv.id}/messages`, 'POST', {
        agent_name: 'user',
        role: 'user',
        content: userMsg,
        input_tokens: 0,
        output_tokens: 0,
        model: 'user'
      });
      
      // Log response
      await makeRequest(`/api/conversations/${conv.id}/messages`, 'POST', {
        agent_name: 'nexar',
        role: 'assistant',
        content: response,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model: model
      });
      
      console.log('CONVERSATION_ID:', conv.id);
      console.log('Exchange logged successfully');
      return;
    }

    console.error('Unknown command:', command);
    process.exit(1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
