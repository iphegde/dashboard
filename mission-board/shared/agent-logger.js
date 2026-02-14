/**
 * Agent Communication Logger - Integration Helper
 * 
 * This module wraps OpenClaw's session tools to automatically log
 * agent conversations to the Mission Board.
 * 
 * Use this when spawning sub-agents or sending messages between agents.
 * 
 * Usage in your agent code:
 *   import { spawnWithLogging, sendWithLogging } from './agent-logger.js';
 *   
 *   // Instead of sessions_spawn
 *   const result = await spawnWithLogging({
 *     task: "Analyze this data",
 *     agentId: "rio",
 *     initiator: "nexar"
 *   });
 *   
 *   // Instead of sessions_send
 *   await sendWithLogging({
 *     sessionKey: "agent:rio:abc123",
 *     message: "Here's the analysis",
 *     fromAgent: "nexar",
 *     toAgent: "rio"
 *   });
 */

import { ConversationLogger } from './logger.js';

// Default configuration - adjust as needed
const DEFAULT_CONFIG = {
  apiUrl: process.env.MISSION_BOARD_API_URL || 'http://localhost:3001',
};

/**
 * Track active conversations by session key
 * This allows us to continue logging to the same conversation
 */
const activeConversations = new Map();

/**
 * Get or create a conversation logger for a session
 * @param {string} initiator - Name of the initiating agent
 * @param {string} participant - Name of the other agent
 * @param {string} sessionKey - OpenClaw session key
 * @returns {ConversationLogger}
 */
function getOrCreateLogger(initiator, participant, sessionKey) {
  const key = `${initiator}:${participant}:${sessionKey}`;
  
  if (!activeConversations.has(key)) {
    const logger = new ConversationLogger({
      apiUrl: DEFAULT_CONFIG.apiUrl,
      initiator: initiator
    });
    activeConversations.set(key, logger);
  }
  
  return activeConversations.get(key);
}

/**
 * Spawn a sub-agent with conversation logging
 * 
 * This wraps sessions_spawn and automatically logs:
 * - The task/request sent to the sub-agent
 * - The response received from the sub-agent
 * 
 * @param {Object} params
 * @param {string} params.task - The task for the sub-agent
 * @param {string} params.agentId - ID of the agent to spawn (e.g., 'rio', 'orion')
 * @param {string} params.initiator - Name of the agent spawning (e.g., 'nexar')
 * @param {string} [params.sessionKey] - Optional existing session key
 * @param {Object} [params.spawnOptions] - Additional options for sessions_spawn
 * @param {Function} [params.sessionsSpawn] - The sessions_spawn function (injected)
 * @returns {Promise<Object>} Spawn result with conversation ID
 */
async function spawnWithLogging({
  task,
  agentId,
  initiator,
  sessionKey,
  spawnOptions = {},
  sessionsSpawn // Function to be injected
}) {
  if (!sessionsSpawn) {
    throw new Error('sessionsSpawn function is required. Pass it from your tool context.');
  }

  const logger = getOrCreateLogger(initiator, agentId, sessionKey || `spawn-${Date.now()}`);
  
  // Start conversation if not already started
  if (!logger.getConversationId()) {
    await logger.startConversation({
      participants: [agentId],
      sessionId: sessionKey || `spawn-${Date.now()}`,
      title: `${initiator} → ${agentId}: ${task.substring(0, 50)}...`,
      metadata: {
        type: 'spawn',
        fullTask: task,
        initiator: initiator,
        targetAgent: agentId
      }
    });
  }

  // Log the task/request
  await logger.logMessage({
    agentName: initiator,
    role: 'user',
    content: task,
    inputTokens: 0, // We'll estimate or get from response
    outputTokens: 0,
    model: 'N/A',
    metadata: { type: 'request', targetAgent: agentId }
  });

  try {
    // Call the actual spawn function
    const result = await sessionsSpawn({
      task: task,
      agentId: agentId,
      ...spawnOptions
    });

    // Log the response
    const responseContent = result?.result || result?.message || JSON.stringify(result);
    const responseTokens = result?.usage?.output_tokens || estimateTokens(responseContent);
    const inputTokens = result?.usage?.input_tokens || estimateTokens(task);

    await logger.logMessage({
      agentName: agentId,
      role: 'assistant',
      content: responseContent,
      inputTokens: inputTokens,
      outputTokens: responseTokens,
      model: result?.model || 'unknown',
      metadata: { 
        type: 'response', 
        initiator: initiator,
        resultStatus: result?.status || 'completed'
      }
    });

    return {
      ...result,
      _missionBoard: {
        conversationId: logger.getConversationId(),
        logged: true
      }
    };

  } catch (error) {
    // Log the error
    await logger.logMessage({
      agentName: agentId,
      role: 'system',
      content: `Error: ${error.message}`,
      inputTokens: 0,
      outputTokens: 0,
      model: 'system',
      metadata: { type: 'error', error: error.message }
    });
    throw error;
  }
}

/**
 * Send a message to a session with logging
 * 
 * This wraps sessions_send and logs the message exchange.
 * 
 * @param {Object} params
 * @param {string} params.sessionKey - Target session key
 * @param {string} params.message - Message to send
 * @param {string} params.fromAgent - Name of sender
 * @param {string} params.toAgent - Name of recipient
 * @param {Function} [params.sessionsSend] - The sessions_send function (injected)
 */
async function sendWithLogging({
  sessionKey,
  message,
  fromAgent,
  toAgent,
  sessionsSend // Function to be injected
}) {
  if (!sessionsSend) {
    throw new Error('sessionsSend function is required. Pass it from your tool context.');
  }

  const logger = getOrCreateLogger(fromAgent, toAgent, sessionKey);
  
  // Start conversation if needed
  if (!logger.getConversationId()) {
    await logger.startConversation({
      participants: [toAgent],
      sessionId: sessionKey,
      title: `${fromAgent} ↔ ${toAgent} Session`,
      metadata: { type: 'session', sessionKey }
    });
  }

  // Log outgoing message
  await logger.logMessage({
    agentName: fromAgent,
    role: 'user',
    content: message,
    inputTokens: estimateTokens(message),
    outputTokens: 0,
    model: 'N/A'
  });

  try {
    // Send the actual message
    await sessionsSend({
      sessionKey: sessionKey,
      message: message
    });

    // Note: We can't log the response here since sessions_send is fire-and-forget
    // The receiving agent would need to log their response separately

  } catch (error) {
    await logger.logMessage({
      agentName: 'system',
      role: 'system',
      content: `Send failed: ${error.message}`,
      inputTokens: 0,
      outputTokens: 0,
      model: 'system'
    });
    throw error;
  }
}

/**
 * Simple token estimator (rough approximation)
 * 1 token ≈ 4 characters for English text
 * @param {string} text 
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Manual logging helper for agents
 * Use this when you want explicit control over logging
 * 
 * @param {string} initiator - Agent starting the conversation
 * @param {string} participant - Other agent in conversation
 * @param {string} sessionKey - Session identifier
 */
function createAgentLogger(initiator, participant, sessionKey) {
  const logger = new ConversationLogger({
    apiUrl: DEFAULT_CONFIG.apiUrl,
    initiator: initiator
  });

  return {
    /**
     * Start logging a conversation
     */
    start: async (title, metadata = {}) => {
      const convId = await logger.startConversation({
        participants: [participant],
        sessionId: sessionKey,
        title: title || `${initiator} ↔ ${participant}`,
        metadata: {
          ...metadata,
          initiator,
          participant,
          sessionKey
        }
      });
      activeConversations.set(`${initiator}:${participant}:${sessionKey}`, logger);
      return convId;
    },

    /**
     * Log a message from either agent
     */
    log: async ({ agentName, role, content, inputTokens, outputTokens, model, metadata }) => {
      return await logger.logMessage({
        agentName,
        role,
        content,
        inputTokens: inputTokens || estimateTokens(content),
        outputTokens: outputTokens || 0,
        model: model || 'unknown',
        metadata
      });
    },

    /**
     * Get conversation ID
     */
    getId: () => logger.getConversationId(),

    /**
     * End conversation
     */
    end: () => {
      logger.endConversation();
      activeConversations.delete(`${initiator}:${participant}:${sessionKey}`);
    }
  };
}

export {
  spawnWithLogging,
  sendWithLogging,
  createAgentLogger,
  estimateTokens,
  activeConversations
};

// Default export
export default {
  spawnWithLogging,
  sendWithLogging,
  createAgentLogger,
  estimateTokens
};
