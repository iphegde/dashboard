/**
 * Nexar (Main Agent) - Mission Board Integration Example
 * 
 * This shows how Nexar should log conversations when coordinating with sub-agents.
 * 
 * Usage: Import these helper functions into your Nexar agent workflow.
 */

import { spawnWithLogging, createAgentLogger } from './agent-logger.js';

/**
 * Agent Skill Mapping
 * Map tasks to the right agent based on their specialty
 */
const AGENT_SKILLS = {
  'rio': ['data analysis', 'analytics', 'metrics', 'statistics', 'charts', 'reports'],
  'orion': ['research', 'investigation', 'documentation', 'web search', 'analysis'],
  'juno': ['creative', 'design', 'writing', 'content', 'presentation', 'ui/ux'],
  'cipher': ['security', 'encryption', 'code review', 'audit', 'pentest'],
  'phoenix': ['architecture', 'system design', 'infrastructure', 'devops'],
  'sterling': ['business', 'finance', 'strategy', 'planning', 'requirements']
};

/**
 * Route a task to the right agent and log the conversation
 * 
 * @param {string} task - The task description
 * @param {Object} context - Additional context
 * @param {Function} sessionsSpawn - The sessions_spawn tool function
 * @returns {Promise<Object>} Result with Mission Board conversation ID
 */
async function routeTaskWithLogging(task, context = {}, sessionsSpawn) {
  // Determine which agent to use based on task keywords
  const agentId = selectAgentForTask(task);
  
  console.log(`🎯 Nexar → ${agentId}: ${task.substring(0, 60)}...`);
  
  const result = await spawnWithLogging({
    task: task,
    agentId: agentId,
    initiator: 'nexar',
    sessionsSpawn: sessionsSpawn,
    spawnOptions: {
      label: `${agentId}-task-${Date.now()}`,
      timeoutSeconds: context.timeout || 120
    }
  });
  
  console.log(`✅ ${agentId} completed task`);
  console.log(`📊 Logged to Mission Board: ${result._missionBoard?.conversationId || 'N/A'}`);
  
  return result;
}

/**
 * Multi-agent workflow with full logging
 * 
 * @param {string} projectName - Name of the project
 * @param {Array} tasks - Array of tasks to delegate
 * @param {Function} sessionsSpawn - The sessions_spawn tool function
 * @returns {Promise<Object>} All results with conversation IDs
 */
async function coordinateProject(projectName, tasks, sessionsSpawn) {
  console.log(`\n🚀 Starting Project: ${projectName}\n`);
  
  // Create a group conversation for the entire project
  const projectLogger = createAgentLogger('nexar', 'team', `project-${Date.now()}`);
  await projectLogger.start(`Project: ${projectName}`, {
    type: 'project',
    tasks: tasks.map(t => t.description || t),
    timestamp: new Date().toISOString()
  });
  
  // Log project kickoff
  await projectLogger.log({
    agentName: 'nexar',
    role: 'assistant',
    content: `Starting project "${projectName}". Delegating ${tasks.length} tasks to the team.`,
    inputTokens: 0,
    outputTokens: 0
  });
  
  const results = [];
  
  for (const task of tasks) {
    const taskDesc = typeof task === 'string' ? task : task.description;
    const agentId = typeof task === 'string' ? selectAgentForTask(taskDesc) : task.agent;
    
    // Log delegation
    await projectLogger.log({
      agentName: 'nexar',
      role: 'assistant',
      content: `Delegating to ${agentId}: ${taskDesc}`,
      inputTokens: 0,
      outputTokens: 0
    });
    
    // Spawn the agent with individual logging
    const result = await spawnWithLogging({
      task: taskDesc,
      agentId: agentId,
      initiator: 'nexar',
      sessionsSpawn: sessionsSpawn,
      spawnOptions: {
        label: `${projectName}-${agentId}`,
        timeoutSeconds: task.timeout || 120
      }
    });
    
    // Log the result summary
    const summary = result.result?.substring(0, 200) || 'Task completed';
    await projectLogger.log({
      agentName: agentId,
      role: 'assistant',
      content: `${agentId} result: ${summary}...`,
      inputTokens: result.usage?.input_tokens || 0,
      outputTokens: result.usage?.output_tokens || 0,
      model: result.model
    });
    
    results.push({
      agent: agentId,
      task: taskDesc,
      result: result,
      conversationId: result._missionBoard?.conversationId
    });
  }
  
  // Log project completion
  await projectLogger.log({
    agentName: 'nexar',
    role: 'assistant',
    content: `Project "${projectName}" complete. All ${tasks.length} tasks finished.`,
    inputTokens: 0,
    outputTokens: 0
  });
  
  projectLogger.end();
  
  console.log(`\n✅ Project complete! ${results.length} conversations logged.`);
  console.log(`📊 View on Mission Board: http://localhost:3000\n`);
  
  return {
    projectName,
    projectConversationId: projectLogger.getId(),
    results
  };
}

/**
 * Facilitate agent-to-agent conversation via Nexar
 * 
 * When Agent A needs to talk to Agent B, Nexar acts as relay and logs everything
 * 
 * @param {string} fromAgent - Agent initiating the question
 * @param {string} toAgent - Agent being asked
 * @param {string} question - The question/request
 * @param {Function} sessionsSpawn - The sessions_spawn tool function
 * @returns {Promise<Object>} Response with full conversation log
 */
async function relayConversation(fromAgent, toAgent, question, sessionsSpawn) {
  console.log(`🔄 ${fromAgent} → Nexar → ${toAgent}: ${question.substring(0, 50)}...`);
  
  const logger = createAgentLogger('nexar', `${fromAgent},${toAgent}`, `relay-${Date.now()}`);
  
  await logger.start(`${fromAgent} asks ${toAgent}`, {
    type: 'relay',
    from: fromAgent,
    to: toAgent
  });
  
  // Log the relay request
  await logger.log({
    agentName: fromAgent,
    role: 'user',
    content: question,
    inputTokens: 0
  });
  
  await logger.log({
    agentName: 'nexar',
    role: 'assistant',
    content: `Relaying question from ${fromAgent} to ${toAgent}...`,
    inputTokens: 0,
    outputTokens: 0
  });
  
  // Spawn the target agent
  const result = await spawnWithLogging({
    task: `${fromAgent} asks: ${question}\n\nPlease provide a response that ${fromAgent} can use.`,
    agentId: toAgent,
    initiator: 'nexar',
    sessionsSpawn: sessionsSpawn,
    spawnOptions: {
      label: `relay-${fromAgent}-${toAgent}`,
      timeoutSeconds: 120
    }
  });
  
  // Log the response back through Nexar
  await logger.log({
    agentName: 'nexar',
    role: 'assistant',
    content: `${toAgent} responded. Relaying back to ${fromAgent}...`,
    inputTokens: 0,
    outputTokens: 0
  });
  
  await logger.log({
    agentName: fromAgent,
    role: 'assistant',
    content: `Received response from ${toAgent}: ${result.result?.substring(0, 200)}...`,
    inputTokens: result.usage?.input_tokens || 0,
    outputTokens: result.usage?.output_tokens || 0
  });
  
  logger.end();
  
  console.log(`✅ Relay complete: ${logger.getId()}`);
  
  return {
    ...result,
    relayConversationId: logger.getId(),
    from: fromAgent,
    to: toAgent
  };
}

/**
 * Simple keyword-based agent selection
 * Override this with your own logic as needed
 */
function selectAgentForTask(task) {
  const taskLower = task.toLowerCase();
  
  // Check each agent's skills
  for (const [agent, skills] of Object.entries(AGENT_SKILLS)) {
    for (const skill of skills) {
      if (taskLower.includes(skill)) {
        return agent;
      }
    }
  }
  
  // Default to orion for general tasks
  return 'orion';
}

/**
 * Get agent recommendation with explanation
 */
function recommendAgent(task) {
  const agent = selectAgentForTask(task);
  const skills = AGENT_SKILLS[agent] || [];
  
  return {
    agent: agent,
    reason: `${agent} specializes in: ${skills.join(', ')}`,
    alternative: agent === 'orion' ? 'Any agent could handle this' : `Consider orion for general tasks`
  };
}

// Export all functions
export {
  routeTaskWithLogging,
  coordinateProject,
  relayConversation,
  selectAgentForTask,
  recommendAgent,
  AGENT_SKILLS
};

// Default export
export default {
  routeTaskWithLogging,
  coordinateProject,
  relayConversation,
  selectAgentForTask,
  recommendAgent
};
