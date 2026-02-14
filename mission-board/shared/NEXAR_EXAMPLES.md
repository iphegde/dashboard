# Nexar Integration Examples

This guide shows exactly how Nexar (you) should use the Mission Board logger in your workflows.

## Your Workflow Model

```
You (Human) ←→ Nexar (Main Agent) ←→ Sub-Agents (Rio, Orion, Juno, etc.)
                         ↓
              Mission Board (Auto-logged)
```

## Example 1: Simple Task Delegation

**You ask:** "Nexar, analyze my sales data for Q1"

**Nexar should do:**

```javascript
import { routeTaskWithLogging } from './shared/nexar-helpers.js';

// Nexar automatically routes to Rio (data analysis agent)
const result = await routeTaskWithLogging(
  "Analyze sales data for Q1 2026 from /data/sales.csv",
  { timeout: 180 },
  sessions_spawn  // Pass the OpenClaw tool
);

// Result includes the Mission Board conversation ID
console.log("Rio's analysis:", result.result);
console.log("View on dashboard:", result._missionBoard.conversationId);
```

**What gets logged:**
- Conversation between Nexar and Rio
- Full task description
- Rio's response
- Token usage
- Model used

---

## Example 2: Multi-Agent Project

**You ask:** "Nexar, help me prepare a business presentation"

**Nexar should do:**

```javascript
import { coordinateProject } from './shared/nexar-helpers.js';

// Define the workflow
const project = await coordinateProject(
  "Business Presentation",  // Project name
  [
    { 
      description: "Research market trends for our industry",
      agent: "orion",
      timeout: 120
    },
    { 
      description: "Create charts and data visualizations",
      agent: "rio",
      timeout: 120
    },
    { 
      description: "Design the presentation slides",
      agent: "juno",
      timeout: 180
    }
  ],
  sessions_spawn  // Pass the OpenClaw tool
);

// Returns all results + all conversation IDs
console.log("Project conversations:", project.results.map(r => r.conversationId));
```

**What gets logged:**
- One "Project" conversation showing all coordination
- Three individual conversations (Nexar→Orion, Nexar→Rio, Nexar→Juno)
- All messages and responses
- Total token usage across all agents

---

## Example 3: Agent-to-Agent via Nexar

**Scenario:** Rio needs information from Orion

**Nexar should do:**

```javascript
import { relayConversation } from './shared/nexar-helpers.js';

// Rio asks a question that needs Orion's expertise
const response = await relayConversation(
  "rio",           // From
  "orion",         // To
  "What are the latest research papers on AI trends?",
  sessions_spawn
);

// Returns Orion's response with full conversation logged
console.log("Orion's response:", response.result);
```

**What gets logged:**
- Rio's question to Nexar
- Nexar relaying to Orion
- Orion's response
- Nexar relaying back to Rio

---

## Example 4: Manual Logging (Full Control)

When you need more control:

```javascript
import { createAgentLogger } from './shared/agent-logger.js';

// Create a logger for this specific interaction
const logger = createAgentLogger('nexar', 'cipher', 'security-audit-123');

// Start conversation
await logger.start('Security Audit Project', {
  project: 'Q1 Security Review',
  priority: 'high'
});

// Log your request to Cipher
await logger.log({
  agentName: 'nexar',
  role: 'user',
  content: 'Please audit our authentication system for vulnerabilities',
  inputTokens: 50
});

// Spawn Cipher
const result = await sessions_spawn({
  task: 'Audit authentication system',
  agentId: 'cipher'
});

// Log Cipher's response
await logger.log({
  agentName: 'cipher',
  role: 'assistant',
  content: result.result,
  inputTokens: result.usage?.input_tokens || 500,
  outputTokens: result.usage?.output_tokens || 800,
  model: result.model
});

// You follow up
await logger.log({
  agentName: 'nexar',
  role: 'user',
  content: 'Can you also check the API endpoints?',
  inputTokens: 30
});

// Continue the conversation...
```

---

## Quick Reference: When to Use What

| Situation | Use This Function |
|-----------|------------------|
| Single task to one agent | `routeTaskWithLogging()` |
| Project with multiple agents | `coordinateProject()` |
| Agent asking another agent | `relayConversation()` |
| Full control over logging | `createAgentLogger()` |

---

## Setup Checklist for Nexar

- [ ] Import the helpers in your workflow file:
  ```javascript
  import { routeTaskWithLogging, coordinateProject } from './shared/nexar-helpers.js';
  ```

- [ ] Pass `sessions_spawn` function from your tool context

- [ ] Ensure backend is running:
  ```bash
  cd mission-board/backend && npm start
  ```

- [ ] Check Mission Board at http://localhost:3000

---

## Real-World Example: Your Session

```javascript
// In your current Nexar session, when user asks for help:

async function handleUserRequest(userMessage) {
  // Determine what the user wants
  if (userMessage.includes('analyze') || userMessage.includes('data')) {
    // Route to Rio
    return await routeTaskWithLogging(userMessage, {}, sessions_spawn);
  }
  
  if (userMessage.includes('research') || userMessage.includes('find')) {
    // Route to Orion
    return await routeTaskWithLogging(userMessage, {}, sessions_spawn);
  }
  
  if (userMessage.includes('design') || userMessage.includes('create')) {
    // Route to Juno
    return await routeTaskWithLogging(userMessage, {}, sessions_spawn);
  }
  
  if (userMessage.includes('security') || userMessage.includes('code')) {
    // Route to Cipher
    return await routeTaskWithLogging(userMessage, {}, sessions_spawn);
  }
  
  // Default: handle yourself or ask for clarification
  return { result: "I can help with that directly or delegate to a specialist. What would you prefer?" };
}

// Usage:
const response = await handleUserRequest("Analyze my sales data");
```

---

## Viewing Results on Mission Board

After running any of these examples:

1. Open http://localhost:3000
2. Click "Conversations" tab
3. See all logged agent interactions
4. Click any conversation to see full message history
5. Watch real-time updates as new conversations are logged

## Troubleshooting

**"sessions_spawn is not defined"**
- Make sure you're passing it from your tool context
- In OpenClaw agents, it should be available as `sessions_spawn`

**"Failed to fetch" errors**
- Check backend is running: `cd backend && npm start`
- Verify backend `.env` has correct Supabase URL

**Conversations not appearing**
- Refresh the dashboard (F5)
- Check browser console for errors
- Verify Supabase project is active

## Next Steps

1. Pull the latest code: `git pull origin main`
2. Start backend: `cd backend && npm start`
3. Start frontend: `cd frontend && npm run dev`
4. Import helpers in your Nexar workflow
5. Replace your existing `sessions_spawn` calls with `routeTaskWithLogging`
6. Watch conversations appear on the dashboard!

---

**Ready to integrate?** Show me a specific task you want to delegate, and I'll help you write the exact code!
