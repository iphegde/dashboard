/**
 * Mission Board Conversation Logger
 * 
 * Import this module in your agent to log conversations to Supabase.
 * The Mission Board dashboard will display all logged conversations in real-time.
 * 
 * Usage:
 *   import { ConversationLogger } from './logger.js';
 *   
 *   const logger = new ConversationLogger({
 *     apiUrl: 'http://localhost:3001',  // Backend API URL
 *     initiator: 'Nexar'                 // Your agent name
 *   });
 *   
 *   // Start a conversation
 *   const conv = await logger.startConversation({
 *     participants: ['Rio', 'Orion'],
 *     sessionId: 'abc-123',
 *     title: 'Project Planning'
 *   });
 *   
 *   // Log each message
 *   await logger.logMessage({
 *     agentName: 'Nexar',
 *     role: 'assistant',
 *     content: 'Hello team!',
 *     inputTokens: 150,
 *     outputTokens: 75,
 *     model: 'moonshot/kimi-k2.5'
 *   });
 */

class ConversationLogger {
  constructor(config) {
    this.apiUrl = config.apiUrl || 'http://localhost:3001';
    this.initiator = config.initiator;
    this.conversationId = null;
    this.sessionId = null;
  }

  /**
   * Start a new conversation
   * @param {Object} params
   * @param {string[]} params.participants - Array of agent names in the conversation
   * @param {string} params.sessionId - OpenClaw session ID
   * @param {string} [params.title] - Optional conversation title
   * @param {Object} [params.metadata] - Optional additional metadata
   * @returns {Promise<string>} Conversation ID
   */
  async startConversation({ participants, sessionId, title, metadata = {} }) {
    try {
      this.sessionId = sessionId;
      
      // Ensure initiator is in participants
      const allParticipants = [...new Set([this.initiator, ...participants])];
      
      const response = await fetch(`${this.apiUrl}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiator_agent: this.initiator,
          participants: allParticipants,
          session_id: sessionId,
          title: title || `${this.initiator} → ${participants.join(', ')}`,
          metadata: {
            ...metadata,
            created_by: 'mission-board-logger',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create conversation: ${error}`);
      }

      const data = await response.json();
      this.conversationId = data.id;
      
      console.log(`[MissionBoard] Started conversation: ${this.conversationId}`);
      return this.conversationId;
    } catch (error) {
      console.error('[MissionBoard] Error starting conversation:', error);
      throw error;
    }
  }

  /**
   * Log a message to the current conversation
   * @param {Object} params
   * @param {string} params.agentName - Name of the agent sending the message
   * @param {string} params.role - 'user', 'assistant', or 'system'
   * @param {string} params.content - Message content
   * @param {number} [params.inputTokens=0] - Input token count
   * @param {number} [params.outputTokens=0] - Output token count
   * @param {string} [params.model] - Model used (e.g., 'moonshot/kimi-k2.5')
   * @param {Object} [params.metadata] - Optional additional metadata
   */
  async logMessage({ agentName, role, content, inputTokens = 0, outputTokens = 0, model, metadata = {} }) {
    if (!this.conversationId) {
      console.warn('[MissionBoard] No active conversation. Call startConversation() first.');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/conversations/${this.conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName,
          role: role,
          content: content,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          model: model,
          metadata: {
            ...metadata,
            session_id: this.sessionId,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to log message: ${error}`);
      }

      const data = await response.json();
      console.log(`[MissionBoard] Logged message from ${agentName}: ${data.id}`);
      return data;
    } catch (error) {
      console.error('[MissionBoard] Error logging message:', error);
      // Don't throw - logging failures shouldn't break agent workflows
    }
  }

  /**
   * Set an existing conversation ID (for continuing a conversation)
   * @param {string} conversationId
   */
  setConversationId(conversationId) {
    this.conversationId = conversationId;
  }

  /**
   * Get current conversation ID
   * @returns {string|null}
   */
  getConversationId() {
    return this.conversationId;
  }

  /**
   * End the current conversation (marks as completed)
   * Note: Conversations stay in database, this just clears the local reference
   */
  endConversation() {
    console.log(`[MissionBoard] Ended conversation: ${this.conversationId}`);
    this.conversationId = null;
    this.sessionId = null;
  }
}

/**
 * Quick log helper for simple use cases
 * Creates a conversation and logs a message in one call
 * 
 * @param {Object} config
 * @param {string} config.apiUrl - Backend API URL
 * @param {string} config.initiator - Initiator agent name
 * @param {string[]} config.participants - Array of participant names
 * @param {string} config.sessionId - OpenClaw session ID
 * @param {string} config.agentName - Agent sending the message
 * @param {string} config.role - Message role (user/assistant/system)
 * @param {string} config.content - Message content
 * @param {number} [config.inputTokens=0]
 * @param {number} [config.outputTokens=0]
 * @param {string} [config.model]
 * @returns {Promise<Object>} { conversationId, message }
 */
async function quickLog(config) {
  const logger = new ConversationLogger({
    apiUrl: config.apiUrl,
    initiator: config.initiator
  });

  const conversationId = await logger.startConversation({
    participants: config.participants,
    sessionId: config.sessionId,
    title: config.title
  });

  const message = await logger.logMessage({
    agentName: config.agentName,
    role: config.role,
    content: config.content,
    inputTokens: config.inputTokens,
    outputTokens: config.outputTokens,
    model: config.model
  });

  return { conversationId, message };
}

export { ConversationLogger, quickLog };

// Default export for convenience
export default ConversationLogger;
