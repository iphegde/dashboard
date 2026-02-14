# Mission Board - Conversation Logger

This module allows your agents to log their conversations to Supabase so they appear on the Mission Board dashboard.

## Installation

No installation needed! Just import the logger in your agent code:

```javascript
import { ConversationLogger } from '../shared/logger.js';
```

## Quick Start

### Basic Usage

```javascript
import { ConversationLogger } from '../shared/logger.js';

// Create logger instance
const logger = new ConversationLogger({
  apiUrl: 'http://localhost:3001',  // Mission Board backend URL
  initiator: 'Nexar'                // Your agent name
});

// Start a conversation
const conversationId = await logger.startConversation({
  participants: ['Rio', 'Orion'],           // Other agents in the conversation
  sessionId: 'agent:main:abc123',           // OpenClaw session ID
  title: 'Project Planning Discussion'      // Optional title
});

// Log each message
await logger.logMessage({
  agentName: 'Nexar',
  role: 'assistant',
  content: 'Hello team! Let\'s discuss the project.',
  inputTokens: 150,      // Get from model response
  outputTokens: 75,      // Get from model response
  model: 'moonshot/kimi-k2.5'
});

// Log a response from another agent
await logger.logMessage({
  agentName: 'Rio',
  role: 'assistant',
  content: 'Great idea! I have some data to share.',
  inputTokens: 100,
  outputTokens: 50,
  model: 'moonshot/kimi-k2.5'
});

// End conversation when done
logger.endConversation();
```

### Quick Log (One-liner)

For simple cases, use `quickLog`:

```javascript
import { quickLog } from '../shared/logger.js';

await quickLog({
  apiUrl: 'http://localhost:3001',
  initiator: 'Nexar',
  participants: ['Rio'],
  sessionId: 'agent:main:abc123',
  agentName: 'Nexar',
  role: 'assistant',
  content: 'Quick message to log',
  inputTokens: 50,
  outputTokens: 25,
  model: 'moonshot/kimi-k2.5'
});
```

## API Reference

### ConversationLogger

#### Constructor
```javascript
const logger = new ConversationLogger({
  apiUrl: 'http://localhost:3001',  // Required: Backend API URL
  initiator: 'AgentName'            // Required: Your agent name
});
```

#### Methods

##### `startConversation({ participants, sessionId, title, metadata })`
Creates a new conversation in the database.

- `participants` (string[]): Array of agent names in the conversation
- `sessionId` (string): OpenClaw session ID (e.g., 'agent:main:abc123')
- `title` (string, optional): Conversation title
- `metadata` (object, optional): Additional metadata

Returns: `Promise<string>` - Conversation ID

##### `logMessage({ agentName, role, content, inputTokens, outputTokens, model, metadata })`
Logs a message to the current conversation.

- `agentName` (string): Name of the agent sending the message
- `role` (string): 'user', 'assistant', or 'system'
- `content` (string): Message content
- `inputTokens` (number, optional): Input token count
- `outputTokens` (number, optional): Output token count
- `model` (string, optional): Model used (e.g., 'moonshot/kimi-k2.5')
- `metadata` (object, optional): Additional metadata

Returns: `Promise<Object>` - Message data

##### `setConversationId(conversationId)`
Set an existing conversation ID (for continuing a conversation).

##### `getConversationId()`
Get the current conversation ID.

##### `endConversation()`
Clear the current conversation reference.

## Token Counts

To get accurate token counts from your agent responses:

```javascript
// Example with OpenClaw response
const response = await someAgentCall();

await logger.logMessage({
  agentName: 'Nexar',
  role: 'assistant',
  content: response.message,
  inputTokens: response.usage?.input_tokens || 0,
  outputTokens: response.usage?.output_tokens || 0,
  model: response.model
});
```

Or use the token counts from your model response metadata.

## Environment Variables

The backend API URL can be configured via environment:

```bash
# .env in your agent workspace
MISSION_BOARD_API_URL=http://localhost:3001
```

Then in your code:
```javascript
const logger = new ConversationLogger({
  apiUrl: process.env.MISSION_BOARD_API_URL || 'http://localhost:3001',
  initiator: 'YourAgentName'
});
```

## Testing

To test that logging works:

1. Start the Mission Board backend:
   ```bash
   cd mission-board/backend
   npm start
   ```

2. Run this test script:
   ```javascript
   import { quickLog } from '../shared/logger.js';
   
   await quickLog({
     apiUrl: 'http://localhost:3001',
     initiator: 'TestAgent',
     participants: ['TestAgent2'],
     sessionId: 'test-session-123',
     agentName: 'TestAgent',
     role: 'assistant',
     content: 'Test message from logger',
     inputTokens: 10,
     outputTokens: 5,
     model: 'test-model'
   });
   
   console.log('Test complete! Check the Mission Board dashboard.');
   ```

3. Open http://localhost:3000 and verify the conversation appears.

## Troubleshooting

**Error: "Failed to create conversation"**
- Check that the backend is running on port 3001
- Verify the API URL is correct
- Check backend logs for errors

**Conversations not appearing on dashboard**
- Refresh the dashboard (F5)
- Check browser console for errors
- Verify the conversation was created in Supabase SQL Editor:
  ```sql
  SELECT * FROM conversations ORDER BY created_at DESC LIMIT 5;
  ```

**Token counts showing as 0**
- Ensure you're passing the token counts from your model response
- Some models don't return token counts - that's OK, they'll show as 0

## Agent List

Current agents that can participate in logged conversations:
- **Nexar** (main) - Strategic coordinator
- **Rio** - Data analyst
- **Orion** - Research specialist
- **Juno** - Creative assistant
- **Cipher** - Security & encryption
- **Phoenix** - System architect
- **Sterling** - Business logic
