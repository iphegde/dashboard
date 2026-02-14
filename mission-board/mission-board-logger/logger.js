/**
 * Mission Board Logger - Agent Skill
 * 
 * Log conversations to Supabase via your VPS backend.
 * Dashboard updates in real-time via Supabase subscriptions.
 */

class MissionBoardLogger {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.MISSION_BOARD_API_URL || 'http://localhost:3001';
    this.initiator = config.initiator || process.env.MISSION_BOARD_INITIATOR || 'agent';
    this.conversationId = null;
    this.sessionId = null;
  }

  /**
   * Start a new conversation
   */
  async startConversation({ participants, sessionId, title, metadata = {} }) {
    this.sessionId = sessionId;
    
    try {
      const response = await fetch(`${this.apiUrl}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiator_agent: this.initiator,
          participants: participants || [this.initiator],
          session_id: sessionId,
          title: title || `${this.initiator} Session`,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            source: 'mission-board-logger'
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const data = await response.json();
      this.conversationId = data.id;
      
      console.log(`[MissionBoard] Started: ${this.conversationId}`);
      return this.conversationId;
    } catch (error) {
      console.error('[MissionBoard] Error starting conversation:', error.message);
      throw error;
    }
  }

  /**
   * Log a single message
   */
  async logMessage({ agentName, role, content, inputTokens = 0, outputTokens = 0, model, metadata = {} }) {
    if (!this.conversationId) {
      console.warn('[MissionBoard] No active conversation. Call startConversation() first.');
      return null;
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
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const data = await response.json();
      console.log(`[MissionBoard] Logged: ${agentName} (${role})`);
      return data;
    } catch (error) {
      console.error('[MissionBoard] Error logging message:', error.message);
      // Don't throw - logging shouldn't break workflows
      return null;
    }
  }

  /**
   * Log a complete user→agent exchange
   */
  async logExchange(userMessage, response, tokenUsage = {}) {
    // Auto-start if needed
    if (!this.conversationId) {
      await this.startConversation({
        participants: ['user'],
        sessionId: this.sessionId || `session-${Date.now()}`,
        title: 'Live Session'
      });
    }

    // Log user message
    await this.logMessage({
      agentName: 'user',
      role: 'user',
      content: userMessage,
      inputTokens: 0,
      outputTokens: 0,
      model: 'user'
    });

    // Log agent response
    await this.logMessage({
      agentName: this.initiator,
      role: 'assistant',
      content: response,
      inputTokens: tokenUsage.inputTokens || 0,
      outputTokens: tokenUsage.outputTokens || 0,
      model: tokenUsage.model || 'unknown'
    });

    return this.conversationId;
  }

  /**
   * Log when you spawn a sub-agent
   */
  async logAgentDelegation(agentName, task, response, tokenUsage = {}) {
    if (!this.conversationId) {
      await this.startConversation({
        participants: [agentName],
        sessionId: this.sessionId || `session-${Date.now()}`,
        title: `${this.initiator} → ${agentName}`
      });
    }

    // Log your delegation
    await this.logMessage({
      agentName: this.initiator,
      role: 'assistant',
      content: `→ Delegating to ${agentName}: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`,
      metadata: { type: 'delegation', targetAgent: agentName }
    });

    // Log agent response
    await this.logMessage({
      agentName: agentName,
      role: 'assistant',
      content: response,
      inputTokens: tokenUsage.inputTokens || 0,
      outputTokens: tokenUsage.outputTokens || 0,
      model: tokenUsage.model || 'unknown',
      metadata: { type: 'agent-response', delegatedBy: this.initiator }
    });
  }

  /**
   * Get current conversation ID
   */
  getConversationId() {
    return this.conversationId;
  }

  /**
   * Set conversation ID manually
   */
  setConversationId(id) {
    this.conversationId = id;
  }

  /**
   * End current conversation
   */
  endConversation() {
    console.log(`[MissionBoard] Ended: ${this.conversationId}`);
    this.conversationId = null;
    this.sessionId = null;
  }
}

/**
 * Quick log helper for simple cases
 */
async function quickLog(config) {
  const logger = new MissionBoardLogger({
    apiUrl: config.apiUrl,
    initiator: config.initiator || 'agent'
  });

  await logger.startConversation({
    participants: config.participants || ['user'],
    sessionId: config.sessionId || `session-${Date.now()}`,
    title: config.title
  });

  await logger.logExchange(
    config.userMessage,
    config.response,
    config.tokenUsage
  );

  return logger.getConversationId();
}

export { MissionBoardLogger, quickLog };
export default MissionBoardLogger;
