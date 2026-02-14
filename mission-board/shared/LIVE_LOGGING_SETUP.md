# Live Mission Board Logging Setup

This guide enables **real-time logging** of all conversations between you, Nexar, and sub-agents to the Mission Board dashboard.

## What Gets Logged

- ✅ Your messages to Nexar
- ✅ Nexar's responses
- ✅ All sub-agent spawns and replies
- ✅ Token usage (input/output)
- ✅ Models used
- ✅ Timestamps

## Quick Start

### Step 1: Start Backend (Terminal 1)

```bash
cd mission-board/backend
npm start
```

You should see:
```
Mission Board API server running on port 3001
WebSocket endpoint: ws://localhost:3001/ws
```

### Step 2: Start Frontend (Terminal 2)

```bash
cd mission-board/frontend
npm run dev
```

Open http://localhost:3000 in your browser.

### Step 3: Enable Live Logging (Terminal 3)

```bash
cd mission-board/shared
source live-logger.sh

# Check backend is reachable
check_backend

# Start a conversation
start_live_conversation "nexar" "user" "Live Session $(date)" "webchat-$(date +%s)"
```

You'll see:
```
✅ Live logging started: uuid-here
```

## Auto-Logging Integration

### For Nexar (Me) to Auto-Log

I can now automatically log our conversations. In your next message, tell me:

> "Nexar, enable live logging for conversation ID: [the-uuid-from-step-3]"

Once enabled, I'll automatically:
1. Log your messages as they arrive
2. Log my responses with token counts
3. Continue logging throughout our session

### Manual Logging Commands

While we chat, you (or scripts) can log messages:

```bash
# Log your message
log_user_message "What should I do about X?" 50

# Log my response
log_agent_response "nexar" "Here's what I recommend..." 50 150 "moonshot/kimi-k2.5"

# When done
end_live_conversation
```

## Automated Logging via Wrapper

### Option A: Shell Wrapper Script

Create a wrapper that auto-logs:

```bash
#!/bin/bash
# save as: chat-with-logging.sh

cd /path/to/mission-board/shared
source live-logger.sh

# Start conversation
start_live_conversation "nexar" "user" "Session $(date)" "webchat-$(date +%s)"
CONV_ID=$(get_conversation_id)

echo "================================================"
echo "🟢 Live logging enabled: $CONV_ID"
echo "================================================"
echo ""
echo "Tell Nexar: 'Enable live logging for conversation $CONV_ID'"
echo ""

# Keep session alive
read -p "Press Enter when done chatting..."

end_live_conversation
```

### Option B: Node.js Auto-Logger

For automatic background logging:

```javascript
// auto-logger.js - Run this alongside your chat
import { spawn } from 'child_process';
import { createAgentLogger } from './agent-logger.js';

const logger = createAgentLogger('nexar', 'user', `webchat-${Date.now()}`);

// This would integrate with your chat interface
// to automatically capture messages
```

## Integration with OpenClaw

To make this work seamlessly with OpenClaw, you need to:

### 1. Set Environment Variable

In your OpenClaw config or `.env`:
```bash
MISSION_BOARD_API_URL=http://localhost:3001
ENABLE_LIVE_LOGGING=true
```

### 2. Create a Pre-Message Hook

If OpenClaw supports hooks, create one that calls:
```bash
log_user_message "$USER_MESSAGE" $TOKEN_COUNT
```

### 3. Create a Post-Response Hook

After each AI response:
```bash
log_agent_response "nexar" "$AI_RESPONSE" $INPUT_TOKENS $OUTPUT_TOKENS "$MODEL"
```

## What I (Nexar) Need From You

To enable automatic logging, I need:

1. **Backend running** on port 3001 ✅ (you do this)
2. **Conversation ID** from `start_live_conversation` ✅ (you give me this)
3. **Your permission** to log our conversation ✅ (you tell me to enable it)

Once you say:
> "Enable live logging for conversation [uuid-here]"

I'll use my `exec` tool to call the logger after each response.

## Example Session

**You:**
```bash
cd mission-board/shared
source live-logger.sh
start_live_conversation "nexar" "user" "Project Planning" "webchat-123"
# Output: ✅ Live logging started: abc-123-uuid
```

**You to Nexar:**
> Enable live logging for conversation abc-123-uuid

**Nexar:**
> ✅ Live logging enabled! All our conversations will now appear on the Mission Board dashboard.

**You:**
> Help me analyze this data

**Nexar:** (auto-logs your message + my response)
> I'll help you analyze that. Let me spawn Rio...

**On Dashboard:**
- Real-time updates as messages are logged
- Conversation appears in the list
- Click to see full message history

## Verifying It Works

1. Check backend is receiving requests:
   ```bash
   curl http://localhost:3001/api/conversations
   ```

2. Check Supabase has data:
   ```sql
   SELECT * FROM conversations ORDER BY created_at DESC LIMIT 5;
   ```

3. Refresh Mission Board dashboard

## Troubleshooting

**"Backend not found"**
- Ensure backend is running: `cd backend && npm start`
- Check port 3001 is not blocked

**"Failed to start conversation"**
- Check backend `.env` has correct Supabase URL
- Verify Supabase project is active

**"Messages not appearing on dashboard"**
- Refresh browser (F5)
- Check browser console for errors
- Verify conversation ID is correct

**"Token counts are 0"**
- This is expected - token estimation happens on the backend
- Or we can add estimation to the logger

## Advanced: Auto-Log All Agent Spawns

When I spawn sub-agents, I can auto-log those too:

```javascript
// In my workflow
import { spawnWithLogging } from './shared/nexar-helpers.js';

const result = await spawnWithLogging({
  task: "Analyze data",
  agentId: "rio",
  initiator: "nexar",
  sessionsSpawn: sessions_spawn
});
```

This logs:
1. Your request to me
2. My delegation to Rio
3. Rio's response
4. My summary back to you

All linked to the same conversation thread!

## Security Note

⚠️ **Important:** This logs conversation content to Supabase.
- Don't enable for sensitive/private conversations
- You can pause logging anytime: `end_live_conversation`
- Logs include full message content and metadata

## Ready to Start?

1. Pull latest: `git pull origin main`
2. Start backend: `cd backend && npm start`
3. Start frontend: `cd frontend && npm run dev`
4. Source logger: `cd shared && source live-logger.sh`
5. Start conversation: `start_live_conversation "nexar" "user" "My Session"`
6. Tell me the conversation ID
7. Start chatting - everything logs automatically!

---

**Tell me when you're ready and give me the conversation ID!**
