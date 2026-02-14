import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

function Agents({ supabase, agents }) {
  const [agentStats, setAgentStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAgentStats();
  }, []);

  const fetchAgentStats = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_activity_summary')
        .select('*');

      if (error) throw error;
      setAgentStats(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading agents...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: '#e2e8f0' }}>Agent Directory</h2>
      
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
                <span style={{ color: agent.total_messages > 0 ? '#10b981' : '#64748b' }}>
                  {agent.total_messages > 0 ? '● Active' : '○ Inactive'}
                </span>
              </div>
            </div>
            
            <div className="agent-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="agent-stat">
                <div className="number">{agent.conversations_participated || 0}</div>
                <div className="label">Conversations</div>
              </div>
              <div className="agent-stat">
                <div className="number">{agent.total_messages || 0}</div>
                <div className="label">Messages</div>
              </div>
              <div className="agent-stat">
                <div className="number">{(agent.total_input_tokens || 0).toLocaleString()}</div>
                <div className="label">Input Tokens</div>
              </div>
              <div className="agent-stat">
                <div className="number">{(agent.total_output_tokens || 0).toLocaleString()}</div>
                <div className="label">Output Tokens</div>
              </div>
            </div>

            {agent.last_active && (
              <div style={{ 
                marginTop: '1rem', 
                paddingTop: '1rem',
                borderTop: '1px solid #334155',
                fontSize: '0.875rem',
                color: '#64748b'
              }}>
                Last active: {format(new Date(agent.last_active), 'MMM d, yyyy HH:mm')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ 
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid #334155'
      }}>
        <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Agent Color Legend</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {agents.map(agent => (
            <div key={agent.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '4px',
                backgroundColor: agent.color 
              }} />
              <span style={{ color: '#94a3b8' }}>{agent.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Agents;
