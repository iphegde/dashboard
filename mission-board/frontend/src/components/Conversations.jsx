import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

function Conversations({ supabase, agents }) {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date filter states
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Modal and toast states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations(); // Refresh when conversations are deleted
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedConv]);

  // Filter conversations when dates change
  useEffect(() => {
    filterConversations();
  }, [conversations, fromDate, toDate]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
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

  const filterConversations = useCallback(() => {
    if (!fromDate && !toDate) {
      setFilteredConversations(conversations);
      return;
    }

    let filtered = [...conversations];

    if (fromDate) {
      const fromTimestamp = new Date(fromDate).toISOString();
      filtered = filtered.filter(conv => conv.created_at >= fromTimestamp);
    }

    if (toDate) {
      const toTimestamp = new Date(toDate).toISOString();
      filtered = filtered.filter(conv => conv.created_at <= toTimestamp);
    }

    setFilteredConversations(filtered);
  }, [conversations, fromDate, toDate]);

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
  };

  const handleDeleteClick = () => {
    if (!fromDate || !toDate) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!fromDate || !toDate) return;
    
    setIsDeleting(true);
    try {
      const fromTimestamp = new Date(fromDate).toISOString();
      const toTimestamp = new Date(toDate).toISOString();

      // Call backend API to delete (frontend only has read-only anon key)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://76.13.148.180:3001'}/api/conversations/delete-range?from=${encodeURIComponent(fromTimestamp)}&to=${encodeURIComponent(toTimestamp)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete');
      }

      const result = await response.json();
      showToast(`Successfully deleted ${result.deletedCount} conversation(s)`, 'success');
      handleClearFilters();
      setSelectedConv(null);
      await fetchConversations();
    } catch (err) {
      console.error('Delete error:', err);
      showToast(`Error deleting conversations: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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

  const formatDateTimeLocal = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16);
  };

  if (loading) return <div className="loading">Loading conversations...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const hasActiveFilters = fromDate || toDate;
  const canDelete = fromDate && toDate && filteredConversations.length > 0;

  return (
    <div className="two-column">
      {/* Conversations List */}
      <div>
        {/* Filter Section */}
        <div style={{ 
          background: '#1e293b', 
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: '#e2e8f0', fontSize: '0.875rem' }}>
            Filter by Date
          </h3>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '180px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                From
              </label>
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            
            <div style={{ flex: '1', minWidth: '180px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                To
              </label>
              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Delete Button */}
          {canDelete && (
            <div style={{ 
              marginTop: '0.75rem', 
              paddingTop: '0.75rem',
              borderTop: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : `Delete ${filteredConversations.length} Conversation(s)`}
              </button>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                ⚠️ This action cannot be undone
              </span>
            </div>
          )}
        </div>

        <h2 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>
          Conversations ({filteredConversations.length} of {conversations.length})
        </h2>

        {filteredConversations.length === 0 ? (
          <div style={{ 
            background: '#1e293b', 
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            color: '#64748b'
          }}>
            {hasActiveFilters ? 'No conversations match the selected filters' : 'No conversations yet'}
          </div>
        ) : (
          <div className="conversations-list">
            {filteredConversations.map(conv => (
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
        )}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '450px',
            width: '90%'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#e2e8f0' }}>Confirm Deletion</h3>
            </div>
            
            <p style={{ color: '#cbd5e1', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong style={{ color: '#fca5a5' }}>{filteredConversations.length}</strong> conversation(s) between:
              <br /><br />
              <strong>{formatDateTimeLocal(fromDate)}</strong>
              <br />and<br />
              <strong>{formatDateTimeLocal(toDate)}</strong>?
              <br /><br />
              <span style={{ color: '#fca5a5' }}>This action cannot be undone.</span>
            </p>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          padding: '1rem 1.5rem',
          background: toast.type === 'success' ? '#059669' : '#dc2626',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          zIndex: 1001,
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default Conversations;
