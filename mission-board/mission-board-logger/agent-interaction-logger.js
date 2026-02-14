/**
 * Agent Interaction Logger - For Nexar (Main Agent)
 * 
 * Automatically logs when:
 * - Nexar spawns/talks to sub-agents
 * - Sub-agents respond back to Nexar
 * - Agents communicate among themselves
 * 
 * Does NOT log:
 * - User messages to Nexar
 * - Nexar's direct responses to user (unless involving agents)
 */

const API_URL = process.env.MISSION_BOARD_API_URL || 'http://76.13.148.180:3001';

class AgentInteractionLogger {
  constructor() {
    this.activeConversations = new Map(); // sessionKey -> conversationId
  }

  /**
   * Log when Nexar spawns a sub-agent
   * @param {string} agentName - Agent being spawned (rio, orion, etc.)
   * @param {string} task - The task given to the agent
   * @param {string} sessionKey - OpenClaw session key
   * @returns {Promise<string>} Conversation ID
   */
  async logAgentSpawn(agentName, task, sessionKey) {
    try {
      // Check if conversation already exists for this session
      let conversationId = this.activeConversations.get(sessionKey);
      
      if (!conversationId) {
        // Create new conversation
        const conv = await this.apiCall('/api/conversations', 'POST', {
          initiator_agent: 'Nexar',
          participants: [agentName],
          session_id: sessionKey,
          title: `Nexar → ${agentName}: ${task.substring(0, 50)}...`,
          metadata: {
            type: 'agent-delegation',
            agent: agentName,
            timestamp: new Date().toISOString()
          }
        });
        conversationId = conv.id;
        this.activeConversations.set(sessionKey, conversationId);
      }

      // Log the delegation
      await this.apiCall(`/api/conversations/${conversationId}/messages`, 'POST', {
        agent_name: 'Nexar',
        role: 'assistant',
        content: `🎯 Delegating to ${agentName}:\n${task}`,
        input_tokens: 0,
        output_tokens: 0,
        model: 'system',
        metadata: { type: 'delegation', targetAgent: agentName }
      });

      console.log(`[MissionBoard] Logged spawn: Nexar → ${agentName}`);
      return conversationId;

    } catch (error) {
      console.error('[MissionBoard] Error logging spawn:', error.message);
      return null;
    }
  }

  /**
   * Log when a sub-agent responds
   * @param {string} agentName - Agent that responded
   * @param {string} response - Agent's response content
   * @param {string} sessionKey - OpenClaw session key
   * @param {Object} tokenUsage - { inputTokens, outputTokens, model }
   */
  async logAgentResponse(agentName, response, sessionKey, tokenUsage = {}) {
    try {
      const conversationId = this.activeConversations.get(sessionKey);
      if (!conversationId) {
        console.warn('[MissionBoard] No conversation found for session:', sessionKey);
        return;
      }

      await this.apiCall(`/api/conversations/${conversationId}/messages`, 'POST', {
        agent_name: agentName,
        role: 'assistant',
        content: response,
        input_tokens: tokenUsage.inputTokens || this.estimateTokens(response),
        output_tokens: tokenUsage.outputTokens || 0,
        model: tokenUsage.model || 'moonshot/kimi-k2.5',
        metadata: { 
          type: 'agent-response',
          respondedTo: 'Nexar'
        }
      });

      console.log(`[MissionBoard] Logged response: ${agentName} → Nexar`);

    } catch (error) {
      console.error('[MissionBoard] Error logging response:', error.message);
    }
  }

  /**
   * Log agent-to-agent communication (via Nexar relay)
   * @param {string} fromAgent - Agent sending message
   * @param {string} toAgent - Agent receiving message
   * @param {string} message - Content
   * @param {string} sessionKey - Session identifier
   */
  async logAgentToAgent(fromAgent, toAgent, message, sessionKey) {
    try {
      const convId = await this.getOrCreateMultiAgentConversation(
        [fromAgent, toAgent], 
        sessionKey,
        `${fromAgent} ↔ ${toAgent}`
      );

      await this.apiCall(`/api/conversations/${convId}/messages`, 'POST', {
        agent_name: fromAgent,
        role: 'assistant',
        content: `→ To ${toAgent}: ${message}`,
        input_tokens: this.estimateTokens(message),
        output_tokens: 0,
        model: 'system',
        metadata: { type: 'agent-to-agent', from: fromAgent, to: toAgent }
      });

      console.log(`[MissionBoard] Logged: ${fromAgent} → ${toAgent}`);

    } catch (error) {
      console.error('[MissionBoard] Error logging agent-to-agent:', error.message);
    }
  }

  /**
   * Complete flow: Spawn agent and log both request and response
   */
  async logCompleteInteraction(agentName, task, response, sessionKey, tokenUsage = {}) {
    await this.logAgentSpawn(agentName, task, sessionKey);
    await this.logAgentResponse(agentName, response, sessionKey, tokenUsage);
  }

  /**
   * Helper: Make API call to backend
   */
  async apiCall(path, method, data) {
    const url = `${API_URL}${path}`;
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  }

  /**
   * Helper: Get or create multi-agent conversation
   */
  async getOrCreateMultiAgentConversation(agents, sessionKey, title) {
    const key = `multi:${agents.sort().join(',')}:${sessionKey}`;
    
    if (this.activeConversations.has(key)) {
      return this.activeConversations.get(key);
    }

    const conv = await this.apiCall('/api/conversations', 'POST', {
      initiator_agent: agents[0],
      participants: agents,
      session_id: sessionKey,
      title: title,
      metadata: { type: 'multi-agent', agents }
    });

    this.activeConversations.set(key, conv.id);
    return conv.id;
  }

  /**
   * Estimate tokens (rough approximation)
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * End a conversation session
   */
  endSession(sessionKey) {
    this.activeConversations.delete(sessionKey);
    console.log(`[MissionBoard] Ended session: ${sessionKey}`);
  }
}

// Singleton instance
const agentLogger = new AgentInteractionLogger();

// Export for use
export { AgentInteractionLogger, agentLogger };
export default agentLogger;
