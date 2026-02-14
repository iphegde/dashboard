import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Dashboard from './components/Dashboard.jsx';
import Conversations from './components/Conversations.jsx';
import Agents from './components/Agents.jsx';

// Supabase configuration - Vite uses import.meta.env instead of process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yckghcjicjvqdfcrrknzs.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2doY2ppY2p2cWRmY3Jya256cyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MzE1MzYwMDB9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

const AGENTS = [
  { name: 'Nexar', color: '#EF4444' },
  { name: 'Rio', color: '#3B82F6' },
  { name: 'Orion', color: '#10B981' },
  { name: 'Juno', color: '#F59E0B' },
  { name: 'Cipher', color: '#8B5CF6' },
  { name: 'Phoenix', color: '#EC4899' },
  { name: 'Sterling', color: '#06B6D4' }
];

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [stats, setStats] = useState({
    totalConversations: 0,
    totalMessages: 0,
    totalTokens: 0,
    isRealtime: false
  });

  useEffect(() => {
    // Subscribe to real-time changes
    const channel = supabase
      .channel('app-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_messages' },
        () => {
          fetchStats();
        }
      )
      .subscribe((status) => {
        setStats(prev => ({ ...prev, isRealtime: status === 'SUBSCRIBED' }));
      });

    fetchStats();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Get total conversations
      const { count: convCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      // Get total messages
      const { count: msgCount } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true });

      // Get total tokens
      const { data: tokenData } = await supabase
        .from('conversation_messages')
        .select('input_tokens, output_tokens');

      const totalTokens = tokenData?.reduce((sum, msg) => 
        sum + (msg.input_tokens || 0) + (msg.output_tokens || 0), 0) || 0;

      setStats(prev => ({
        ...prev,
        totalConversations: convCount || 0,
        totalMessages: msgCount || 0,
        totalTokens
      }));
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🎯 Mission Board - Live Agents Data</h1>
        <div className="header-stats">
          <span>{stats.totalConversations.toLocaleString()} Conversations</span>
          <span>{stats.totalMessages.toLocaleString()} Messages</span>
          <span>{stats.totalTokens.toLocaleString()} Tokens</span>
          {stats.isRealtime && (
            <span className="realtime-indicator">
              <span className="pulse"></span>
              Live
            </span>
          )}
        </div>
      </header>

      <nav className="nav">
        <button 
          className={currentView === 'dashboard' ? 'active' : ''}
          onClick={() => setCurrentView('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={currentView === 'conversations' ? 'active' : ''}
          onClick={() => setCurrentView('conversations')}
        >
          Conversations
        </button>
        <button 
          className={currentView === 'agents' ? 'active' : ''}
          onClick={() => setCurrentView('agents')}
        >
          Agents
        </button>
      </nav>

      <main className="main">
        {currentView === 'dashboard' && <Dashboard supabase={supabase} agents={AGENTS} />}
        {currentView === 'conversations' && <Conversations supabase={supabase} agents={AGENTS} />}
        {currentView === 'agents' && <Agents supabase={supabase} agents={AGENTS} />}
      </main>
    </div>
  );
}

export default App;
