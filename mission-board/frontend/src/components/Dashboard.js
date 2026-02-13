import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

function Dashboard({ supabase, agents }) {
  const [conversations, setConversations] = useState([]);
  const [agentStats, setAgentStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch recent conversations
      const { data: convData, error: convError } = await supabase
        .from('recent_conversations')
        .select('*')
        .limit(5);

      if (convError) throw convError;
      setConversations(convData || []);

      // Fetch agent stats
      const { data: statsData, error: statsError } = await supabase
        .from('agent_activity_summary')
        .select('*');

      if (statsError) throw statsError;
      setAgentStats(statsData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const totalMessages = agentStats.reduce((sum, a) => sum + (a.total_messages || 0), 0);
  const totalTokens = agentStats.reduce((sum, a) => sum + (a.total_input_tokens || 0) + (a.total_output_tokens || 0), 0);

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: '#e2e8f0' }}>Overview</h2>
      
      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>Total Messages</h3>
          <div className="value">{totalMessages.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <h3>Total Tokens</h3>
          <div className="value">{totalTokens.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <h3>Active Agents</h3>
          <div className="value">{agentStats.filter(a => a.total_messages > 0).length} / {agents.length}</div>
        </div>
        <div className="stat-card">
          <h3>Latest Activity</h3>
          <div className="value" style={{ fontSize: '1rem' }}>
            {agentStats[0]?.last_active 
              ? format(new Date(agentStats[0].last_active), 'MMM d, HH:mm')
              : 'No activity'}
          </div>
        </div>
      </div>

      {/* Agent Activity */}
      <h2 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Agent Activity</h2>
      <div className="agents-grid">
        {agentStats.map(agent => (
          <div key={agent.name} className="agent-card">
            <div className="agent-header">
              <div 
                className="agent-avatar" 
                style={{ backgroundColor: agent.color || '#3B82F6' }}
              >
                {agent.name[0]}
              </div>
              <div className="agent-info">
                <h3>{agent.display_name || agent.name}</h3>
                <span>{agent.total_messages > 0 ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div className="agent-stats">
              <div className="agent-stat">
                <div className="number">{agent.total_messages || 0}</div>
                <div className="label">Messages</div>
              </div>
              <div className="agent-stat">
                <div className="number">{(agent.total_input_tokens + agent.total_output_tokens).toLocaleString()}</div>
                <div className="label">Tokens</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Conversations */}
      <h2 style={{ margin: '2rem 0 1rem', color: '#e2e8f0' }}>Recent Conversations</h2>
      <div className="conversations-list">
        {conversations.map(conv => (
          <div key={conv.id} className="conversation-card">
            <div className="conv-header">
              <div className="conv-title">{conv.title || `Conversation ${conv.id.slice(0, 8)}`}</div>
              <div className="conv-time">
                {format(new Date(conv.created_at), 'MMM d, yyyy HH:mm')}
              </div>
            </div>
            <div className="conv-agents">
              {conv.participants?.map(agent => (
                <span 
                  key={agent} 
                  className="agent-badge"
                  style={{ backgroundColor: agents.find(a => a.name === agent)?.color || '#64748b' }}
                >
                  {agent}
                </span>
              ))}
            </div>
            <div className="conv-stats">
              <span>{conv.message_count || 0} messages</span>
              <span>{(conv.total_tokens || 0).toLocaleString()} tokens</span>
              <span>Initiated by {conv.initiator_agent}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
