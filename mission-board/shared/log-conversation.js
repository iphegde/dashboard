#!/usr/bin/env node
/**
 * Live Conversation Logger - CLI Tool
 * 
 * This script logs conversations to the Mission Board backend.
 * It can be called from OpenClaw sessions to log agent interactions.
 * 
 * Usage:
 *   node log-conversation.js --action=start \
 *     --initiator="nexar" \
 *     --participants="user" \
 *     --session-id="webchat-abc123" \
 *     --title="User Request"
 * 
 *   node log-conversation.js --action=message \
 *     --conversation-id="uuid-here" \
 *     --agent="nexar" \
 *     --role="assistant" \
 *     --content="Hello!" \
 *     --input-tokens=100 \
 *     --output-tokens=50 \
 *     --model="moonshot/kimi-k2.5"
 */

import http from 'http';

const API_URL = process.env.MISSION_BOARD_API_URL || 'http://localhost:3001';

function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
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

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      const value = process.argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  
  if (!args.action) {
    console.error('Usage: node log-conversation.js --action=start|message|health');
    process.exit(1);
  }

  try {
    if (args.action === 'health') {
      const result = await makeRequest('/api/health', 'GET');
      console.log('Backend status:', result);
      return;
    }

    if (args.action === 'start') {
      const result = await makeRequest('/api/conversations', 'POST', {
        initiator_agent: args.initiator || 'nexar',
        participants: args.participants ? args.participants.split(',') : ['user'],
        session_id: args.session_id || `session-${Date.now()}`,
        title: args.title || 'Conversation',
        metadata: {
          source: 'live-logger',
          timestamp: new Date().toISOString()
        }
      });
      
      // Print conversation ID for capture
      console.log('CONVERSATION_ID:', result.id);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (args.action === 'message') {
      if (!args.conversation_id) {
        console.error('Error: --conversation-id is required');
        process.exit(1);
      }

      const result = await makeRequest(`/api/conversations/${args.conversation_id}/messages`, 'POST', {
        agent_name: args.agent || 'nexar',
        role: args.role || 'assistant',
        content: args.content || '',
        input_tokens: parseInt(args.input_tokens) || 0,
        output_tokens: parseInt(args.output_tokens) || 0,
        model: args.model || 'moonshot/kimi-k2.5',
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('MESSAGE_LOGGED:', result.id);
      return;
    }

    console.error('Unknown action:', args.action);
    process.exit(1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
