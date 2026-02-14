# Agent Integration Guide - Mission Board Logging

This guide shows how to integrate conversation logging into your agent workflows.

## Quick Start for Main Agent (Nexar)

As the main agent, when you spawn sub-agents, wrap the calls with logging:

```javascript
// Before (without logging):
const result = await sessions_spawn({
  task: "Analyze market trends for Q1 2026",
  agentId: "rio",
  label: "market-analysis"
});

// After (with logging):
import { spawnWithLogging } from '../shared/agent-logger.js';

const result = await spawnWithLogging({
  task: "Analyze market trends for Q1 2026",
  agentId: "rio",
  initiator: "nexar",
  sessionsSpawn: sessions_spawn,  // Pass the tool function
  spawnOptions: {
    label: "market-analysis",
    timeoutSeconds: 120
  }
});

// The result now includes the Mission Board conversation ID:
console.log("Conversation logged:", result._missionBoard.conversationId);
```

## Manual Logging (Full Control)

For more control, use the manual logger:

```javascript
import { createAgentLogger } from '../shared/agent-logger.js';

// Create a logger instance
const logger = createAgentLogger("nexar", "rio", "session-abc123");

// Start the conversation
await logger.start("Market Analysis Discussion", {
  project: "Q1 Planning",
  priority: "high"
});

// Log your request
await logger.log({
  agentName: "nexar",
  role: "user",
  content: "Please analyze market trends for Q1 2026",
  inputTokens: 50,
  model: "moonshot/kimi-k2.5"
});

// Spawn the sub-agent
const result = await sessions_spawn({
  task: "Analyze market trends for Q1 2026",
  agentId: "rio"
});

// Log the response
await logger.log({
  agentName: "rio",
  role: "assistant",
  content: result.result || result.message,
  inputTokens: result.usage?.input_tokens || 100,
  outputTokens: result.usage?.output_tokens || 500,
  model: result.model
});

// Continue the conversation...
await logger.log({
  agentName: "nexar",
  role: "user",
  content: "Thanks! Can you also check competitor data?",
  inputTokens: 30
});

// When done
logger.end();
```

## For Sub-Agents (Rio, Orion, Juno, etc.)

Sub-agents can log their responses back:

```javascript
// In a sub-agent's response handling
import { createAgentLogger } from '../shared/agent-logger.js';

// When receiving a task from main agent
async function handleTask(task) {
  const logger = createAgentLogger("rio", "nexar", currentSessionKey);
  
  // Continue existing conversation or start new
  if (!logger.getId()) {
    await logger.start("Task: " + task.substring(0, 50));
  }
  
  // Process the task...
  const result = await doAnalysis(task);
  
  // Log your response
  await logger.log({
    agentName: "rio",
    role: "assistant",
    content: result,
    inputTokens: estimateTokens(task),
    outputTokens: estimateTokens(result),
    model: modelUsed
  });
  
  return result;
}
```

## Multi-Agent Conversations

When multiple agents collaborate on one task:

```javascript
import { createAgentLogger } from '../shared/agent-logger.js';

// Main agent starts the group discussion
const groupLogger = createAgentLogger(
  "nexar", 
  "rio,orion,juno", 
  "project-alpha-discussion"
);

await groupLogger.start("Project Alpha Planning", {
  participants: ["nexar", "rio", "orion", "juno"],
  project: "Alpha"
});

// Each agent logs their contributions:

// Nexar (coordinator)
await groupLogger.log({
  agentName: "nexar",
  role: "user",
  content: "Team, let's plan Project Alpha. Rio, analyze data. Orion, research market. Juno, draft proposal.",
  inputTokens: 100
});

// Rio responds
await groupLogger.log({
  agentName: "rio",
  role: "assistant", 
  content: "Data analysis complete. Trends show 23% growth...",
  inputTokens: 500,
  outputTokens: 800
});

// Orion responds
await groupLogger.log({
  agentName: "orion",
  role: "assistant",
  content: "Market research indicates strong demand...",
  inputTokens: 600,
  outputTokens: 900
});

// And so on...
```

## Token Counts

### Getting Accurate Token Counts

Most model responses include token usage. Extract it like this:

```javascript
// From sessions_spawn result
const result = await sessions_spawn({ task, agentId });

const inputTokens = result.usage?.input_tokens 
  || result.inputTokens 
  || estimateTokens(task);

const outputTokens = result.usage?.output_tokens 
  || result.outputTokens 
  || estimateTokens(result.result);

// From session_status
const status = await session_status({ sessionKey });
const tokens = status.totalTokens;
```

### Token Estimation

If exact counts aren't available, the logger estimates:
- 1 token ≈ 4 characters for English text

```javascript
import { estimateTokens } from '../shared/agent-logger.js';

const approxTokens = estimateTokens("Hello world, this is a test message.");
// ≈ 9 tokens
```

## Environment Configuration

Set the backend URL in your environment:

```bash
# In your agent's .env file
MISSION_BOARD_API_URL=http://localhost:3001
```

Or pass it explicitly:

```javascript
import { ConversationLogger } from '../shared/logger.js';

const logger = new ConversationLogger({
  apiUrl: 'http://your-server:3001',
  initiator: 'nexar'
});
```

## Error Handling

Logging errors won't break your agent workflow:

```javascript
try {
  await spawnWithLogging({
    task: "Important task",
    agentId: "rio",
    initiator: "nexar",
    sessionsSpawn: sessions_spawn
  });
} catch (error) {
  // If logging fails, the spawn still happens
  // The error will be logged but not thrown
  console.warn("Logging failed, but spawn succeeded:", error);
}
```

## Viewing on Mission Board

Once logging is integrated:

1. Start your backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Open http://localhost:3000
4. Run your agent workflows
5. Watch conversations appear in real-time!

## Migration Checklist

- [ ] Update main agent (Nexar) to use `spawnWithLogging`
- [ ] Update sub-agents to log their responses
- [ ] Ensure `MISSION_BOARD_API_URL` is set
- [ ] Test with a simple spawn task
- [ ] Verify conversations appear on dashboard
- [ ] Monitor token usage accuracy

## Example: Complete Workflow

```javascript
// Complete example in main agent session
import { spawnWithLogging, createAgentLogger } from './shared/agent-logger.js';

async function coordinateProject() {
  console.log("🎯 Starting coordinated project...");
  
  // 1. Rio analyzes data
  const analysis = await spawnWithLogging({
    task: "Analyze Q1 sales data from /data/sales.csv",
    agentId: "rio",
    initiator: "nexar",
    sessionsSpawn: sessions_spawn,
    spawnOptions: { timeoutSeconds: 180 }
  });
  
  console.log("📊 Analysis complete:", analysis._missionBoard.conversationId);
  
  // 2. Orion researches based on findings
  const research = await spawnWithLogging({
    task: `Research market trends related to: ${analysis.result}`,
    agentId: "orion", 
    initiator: "nexar",
    sessionsSpawn: sessions_spawn
  });
  
  console.log("🔍 Research complete:", research._missionBoard.conversationId);
  
  // 3. Juno creates presentation
  const creative = await spawnWithLogging({
    task: `Create a presentation combining: ${analysis.result} and ${research.result}`,
    agentId: "juno",
    initiator: "nexar",
    sessionsSpawn: sessions_spawn
  });
  
  console.log("🎨 Creative work complete:", creative._missionBoard.conversationId);
  
  // All conversations are now visible on Mission Board!
  return {
    analysis,
    research,
    creative
  };
}

coordinateProject();
```

## Questions?

Check the main logger documentation: `/shared/README.md`
