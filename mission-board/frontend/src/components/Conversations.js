import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

function Conversations({ supabase, agents }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchConversations();
    
    // Subscribe to new messages
    const channel = supabase
      .channel('conversation-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages' },
        (payload) => {
          if (selectedConv && payload.new.conversation_id === selectedConv.id) {
            setMessages(prev => [...prev, payload.new]);
          }
          fetchConversations(); // Refresh list
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedConv]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          messages:conversation_messages(count)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conv) => {
    setSelectedConv(conv);
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const formatTime = (dateStr) => {
    return format(new Date(dateStr), 'MMM d, yyyy HH:mm:ss');
  };

  if (loading) return <div className="loading">Loading conversations...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="two-column">
      {/* Conversations List */}
      <div>
        <h2 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>
          Conversations ({conversations.length})
        </h2>
        <div className="conversations-list">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              className={`conversation-card ${selectedConv?.id === conv.id ? 'selected' : ''}`}
              onClick={() => selectConversation(conv)}
            >
              <div className="conv-header">
                <div className="conv-title">
                  {conv.title || `Conversation ${conv.id.slice(0, 8)}`}
                </div>
                <div className="conv-time">
                  {formatTime(conv.created_at)}
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
                <span>{conv.messages?.[0]?.count || 0} messages</span>
                <span>By {conv.initiator_agent}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages View */}
      <div>
        <h2 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>
          {selectedConv ? 'Messages' : 'Select a Conversation'}
        </h2>
        {selectedConv ? (
          <div className="messages-container">
            <div className="messages-list">
              {messages.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center' }}>No messages yet</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="message">
                    <div className="message-header">
                      <div className="message-agent">
                        <div 
                          className="message-avatar"
                          style={{ 
                            backgroundColor: agents.find(a => a.name === msg.agent_name)?.color || '#64748b' 
                          }}
                        >
                          {msg.agent_name?.[0] || '?'}
                        </div>
                        <span className="message-agent-name">{msg.agent_name}</span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: '#64748b',
                          marginLeft: '0.5rem',
                          textTransform: 'uppercase'
                        }}>
                          {msg.role}
                        </span>
                      </div>
                      <span className="message-time">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <div className="message-content">{msg.content}</div>
                    {(msg.input_tokens > 0 || msg.output_tokens > 0) && (
                      <div className="message-tokens">
                        Tokens: {msg.input_tokens || 0} in / {msg.output_tokens || 0} out 
                        ({(msg.input_tokens || 0) + (msg.output_tokens || 0)} total)
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ 
            background: '#1e293b', 
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
            color: '#64748b'
          }}>
            Select a conversation from the list to view messages
          </div>
        )}
      </div>
    </div>
  );
}

export default Conversations;
