/**
 * Direct Supabase Logger for Nexar (Main Agent)
 * 
 * Use this module to log conversations directly to Supabase tables.
 * This bypasses the CLI and uses the backend API directly.
 * 
 * Usage inside Nexar:
 *   import { DirectLogger } from './direct-logger.js';
 *   
 *   const logger = new DirectLogger('nexar');
 *   
 *   // Auto-log user message + your response
 *   await logger.logExchange(userMessage, yourResponse, tokenUsage);
 *   
 *   // Or log agent spawn
 *   await logger.logAgentSpawn('rio', task, rioResponse);
 */

class DirectLogger {
  constructor(initiator = 'nexar', apiUrl = 'http://localhost:3001') {
    this.apiUrl = apiUrl;
    this.initiator = initiator;
    this.conversationId = null;
    this.sessionId = null;
  }

  /**
   * Start a conversation session
   * Call this when a new user session starts
   */
  async startSession(sessionId, title = 'Live Session') {
    this.sessionId = sessionId;
    
    try {
      const response = await fetch(`${this.apiUrl}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiator_agent: this.initiator,
          participants: ['user'],
          session_id: sessionId,
          title: title,
          metadata: {
            source: 'nexar-direct',
            startTime: new Date().toISOString()
          }
        })
      });

      if (!response.ok) throw new Error('Failed to create conversation');
      
      const data = await response.json();
      this.conversationId = data.id;
      console.log(`[MissionBoard] Session started: ${this.conversationId}`);
      return this.conversationId;
    } catch (error) {
      console.error('[MissionBoard] Error starting session:', error.message);
      return null;
    }
  }

  /**
   * Log a complete exchange: user message + your response
   * Call this after you respond to the user
   */
  async logExchange(userMessage, yourResponse, tokenUsage = {}) {
    if (!this.conversationId) {
      // Auto-start session if not started
      await this.startSession(`session-${Date.now()}`);
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

    // Log your response
    await this.logMessage({
      agentName: this.initiator,
      role: 'assistant',
      content: yourResponse,
      inputTokens: tokenUsage.inputTokens || 0,
      outputTokens: tokenUsage.outputTokens || 0,
      model: tokenUsage.model || 'moonshot/kimi-k2.5'
    });

    console.log(`[MissionBoard] Exchange logged`);
  }

  /**
   * Log when you spawn a sub-agent
   */
  async logAgentSpawn(agentName, task, agentResponse, tokenUsage = {}) {
    if (!this.conversationId) {
      await this.startSession(`session-${Date.now()}`);
    }

    // Log your delegation
    await this.logMessage({
      agentName: this.initiator,
      role: 'assistant',
      content: `→ Delegating to ${agentName}: ${task.substring(0, 100)}...`,
      inputTokens: 0,
      outputTokens: 0,
      model: 'system',
      metadata: { type: 'delegation', targetAgent: agentName }
    });

    // Log agent's response
    await this.logMessage({
      agentName: agentName,
      role: 'assistant',
      content: agentResponse,
      inputTokens: tokenUsage.inputTokens || 0,
      outputTokens: tokenUsage.outputTokens || 0,
      model: tokenUsage.model || 'unknown',
      metadata: { type: 'agent-response', delegatedBy: this.initiator }
    });

    console.log(`[MissionBoard] ${agentName} response logged`);
  }

  /**
   * Log a single message
   */
  async logMessage({ agentName, role, content, inputTokens, outputTokens, model, metadata = {} }) {
    if (!this.conversationId) {
      console.warn('[MissionBoard] No active conversation');
      return;
    }

    try {
      await fetch(`${this.apiUrl}/api/conversations/${this.conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName,
          role: role,
          content: content,
          input_tokens: inputTokens || 0,
          output_tokens: outputTokens || 0,
          model: model,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (error) {
      console.error('[MissionBoard] Error logging message:', error.message);
    }
  }

  /**
   * Get current conversation ID
   */
  getConversationId() {
    return this.conversationId;
  }

  /**
   * Set an existing conversation ID
   */
  setConversationId(id) {
    this.conversationId = id;
  }
}

/**
 * Simple function to log a complete interaction
 * Use this for one-off logging
 */
async function logInteraction(initiator, userMessage, response, tokenUsage = {}, apiUrl = 'http://localhost:3001') {
  const logger = new DirectLogger(initiator, apiUrl);
  await logger.startSession(`session-${Date.now()}`, 'Direct Log');
  await logger.logExchange(userMessage, response, tokenUsage);
  return logger.getConversationId();
}

export { DirectLogger, logInteraction };
export default DirectLogger;
