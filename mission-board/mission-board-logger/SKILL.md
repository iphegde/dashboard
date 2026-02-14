# Mission Board Logger Skill

Log agent conversations to Supabase for real-time dashboard monitoring.

## Installation

```bash
# Install via clawhub
clawhub install mission-board-logger

# Or manually copy to skills folder
cp -r mission-board-logger /path/to/openclaw/skills/
```

## Configuration

Add to your agent's `.env` or OpenClaw config:

```bash
MISSION_BOARD_API_URL=http://your-vps-ip:3001
# Or with HTTPS:
# MISSION_BOARD_API_URL=https://your-domain.com
```

## Quick Start

```javascript
import { MissionBoardLogger } from '@skills/mission-board-logger';

// Create logger instance
const logger = new MissionBoardLogger({
  apiUrl: process.env.MISSION_BOARD_API_URL,
  initiator: 'nexar'  // Your agent name
});

// Start logging a conversation
await logger.startConversation({
  participants: ['user'],
  sessionId: 'webchat-abc123',
  title: 'User Request'
});

// Log messages
await logger.logMessage({
  agentName: 'user',
  role: 'user',
  content: 'Help me analyze data'
});

await logger.logMessage({
  agentName: 'nexar',
  role: 'assistant',
  content: 'I\'ll help you with that!',
  inputTokens: 100,
  outputTokens: 250,
  model: 'moonshot/kimi-k2.5'
});
```

## API Reference

### MissionBoardLogger

#### Constructor
```javascript
const logger = new MissionBoardLogger({
  apiUrl: 'http://your-vps-ip:3001',  // Required
  initiator: 'your-agent-name'         // Required
});
```

#### startConversation(options)
Creates a new conversation in Supabase.

```javascript
await logger.startConversation({
  participants: ['user', 'rio'],        // Array of agent names
  sessionId: 'session-abc123',          // OpenClaw session ID
  title: 'Data Analysis Request',       // Optional title
  metadata: {                           // Optional extra data
    source: 'webchat',
    priority: 'high'
  }
});
```

Returns: `Promise<string>` - Conversation ID

#### logMessage(options)
Logs a single message to the current conversation.

```javascript
await logger.logMessage({
  agentName: 'nexar',                   // Who sent the message
  role: 'assistant',                    // 'user', 'assistant', or 'system'
  content: 'Here is my response...',    // Message content
  inputTokens: 100,                     // Optional: input token count
  outputTokens: 250,                    // Optional: output token count
  model: 'moonshot/kimi-k2.5',          // Optional: model used
  metadata: {                           // Optional: extra data
    source: 'agent-response'
  }
});
```

#### logExchange(userMessage, response, tokenUsage)
Convenience method to log a complete user→agent exchange.

```javascript
await logger.logExchange(
  'Help me with X',                     // User message
  'Here is how I can help...',          // Your response
  {
    inputTokens: 50,
    outputTokens: 150,
    model: 'moonshot/kimi-k2.5'
  }
);
```

#### logAgentDelegation(agentName, task, response, tokenUsage)
Log when you spawn a sub-agent.

```javascript
await logger.logAgentDelegation(
  'rio',                                // Agent you spawned
  'Analyze Q1 sales data',              // Task given
  'Here is the analysis...',            // Agent's response
  {
    inputTokens: 500,
    outputTokens: 800,
    model: 'moonshot/kimi-k2.5'
  }
);
```

#### getConversationId()
Returns the current conversation ID.

```javascript
const convId = logger.getConversationId();
```

#### endConversation()
Clears the current conversation reference.

```javascript
logger.endConversation();
```

## Usage Examples

### Main Agent (Nexar) Pattern

```javascript
import { MissionBoardLogger } from '@skills/mission-board-logger';

class NexarAgent {
  constructor() {
    this.logger = new MissionBoardLogger({
      apiUrl: process.env.MISSION_BOARD_API_URL,
      initiator: 'nexar'
    });
  }

  async handleUserMessage(message) {
    // Start conversation if new session
    if (!this.logger.getConversationId()) {
      await this.logger.startConversation({
        participants: ['user'],
        sessionId: this.sessionKey,
        title: 'User Session'
      });
    }

    // Log user message
    await this.logger.logMessage({
      agentName: 'user',
      role: 'user',
      content: message
    });

    // Generate response...
    const response = await this.generateResponse(message);

    // Log your response
    await this.logger.logMessage({
      agentName: 'nexar',
      role: 'assistant',
      content: response,
      inputTokens: this.lastInputTokens,
      outputTokens: this.lastOutputTokens,
      model: this.model
    });

    return response;
  }

  async spawnSubAgent(agentName, task) {
    // Log delegation
    await this.logger.logMessage({
      agentName: 'nexar',
      role: 'assistant',
      content: `→ Spawning ${agentName}: ${task}`,
      metadata: { type: 'delegation' }
    });

    // Spawn the agent
    const result = await sessions_spawn({
      task: task,
      agentId: agentName
    });

    // Log agent response
    await this.logger.logMessage({
      agentName: agentName,
      role: 'assistant',
      content: result.result,
      inputTokens: result.usage?.input_tokens,
      outputTokens: result.usage?.output_tokens,
      model: result.model,
      metadata: { type: 'agent-response' }
    });

    return result;
  }
}
```

### Sub-Agent Pattern

```javascript
import { MissionBoardLogger } from '@skills/mission-board-logger';

// When a sub-agent receives a task
async function handleTask(task, fromAgent, sessionKey) {
  const logger = new MissionBoardLogger({
    apiUrl: process.env.MISSION_BOARD_API_URL,
    initiator: 'rio'  // Your agent name
  });

  // Continue existing conversation
  await logger.startConversation({
    participants: [fromAgent],
    sessionId: sessionKey,
    title: `Task from ${fromAgent}`
  });

  // Process the task...
  const result = await processTask(task);

  // Log your response
  await logger.logMessage({
    agentName: 'rio',
    role: 'assistant',
    content: result,
    inputTokens: estimateTokens(task),
    outputTokens: estimateTokens(result)
  });

  return result;
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MISSION_BOARD_API_URL` | Yes | - | Your VPS backend URL |
| `MISSION_BOARD_INITIATOR` | No | 'agent' | Default agent name |

## Error Handling

The logger is designed to fail gracefully:

```javascript
// Logging errors don't break your workflow
try {
  await logger.logMessage({...});
} catch (error) {
  console.warn('[MissionBoard] Failed to log:', error.message);
  // Continue with your workflow
}
```

## Viewing Logs

Once conversations are logged:

1. Open your Mission Board dashboard: `http://localhost:3000`
2. See real-time updates as agents log messages
3. Click conversations to see full message history
4. View agent stats and token usage

## Troubleshooting

**"Failed to connect to backend"**
- Check `MISSION_BOARD_API_URL` is correct
- Verify backend is running on your VPS
- Check firewall allows port 3001

**"401 Unauthorized" or "403 Forbidden"**
- Backend uses service_role key for Supabase
- Check backend `.env` has correct Supabase credentials

**"CORS error"**
- Backend has CORS enabled for all origins
- If using a domain, ensure HTTPS is configured

**Conversations not appearing**
- Check browser console for errors
- Verify Supabase realtime is enabled
- Refresh dashboard (F5)

## Backend Requirements

This skill requires the Mission Board backend running on your VPS:

```bash
# On your VPS
git clone https://github.com/iphegde/dashboard.git
cd dashboard/mission-board/backend
npm install
npm start  # Or use PM2 for production
```

See `backend/VPS_DEPLOYMENT.md` for full setup.

## Architecture

```
Agent (You) → Skill → VPS Backend → Supabase ← Frontend Dashboard
                                         ↑
                                    Real-time updates
```

- Agents log to your VPS backend API
- Backend writes to Supabase with service_role key
- Frontend reads from Supabase directly
- Real-time updates via Supabase subscriptions

## License

MIT
