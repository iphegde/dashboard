require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://yckghcjicjvqdfcrrknzs.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages:conversation_messages(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single conversation with messages
app.get('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError) throw convError;

    // Get messages
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    res.json({ ...conversation, messages });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get conversations by agent
app.get('/api/agents/:agentId/conversations', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages:conversation_messages(count)
      `)
      .or(`initiator_agent.eq.${agentId},participants.cs.{${agentId}}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching agent conversations:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { initiator_agent, participants, session_id, metadata = {} } = req.body;
    
    const { data, error } = await supabase
      .from('conversations')
      .insert([{
        initiator_agent,
        participants: participants || [initiator_agent],
        session_id,
        metadata
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error creating conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add message to conversation
app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      agent_name, 
      role, 
      content, 
      input_tokens = 0, 
      output_tokens = 0,
      metadata = {} 
    } = req.body;

    const { data, error } = await supabase
      .from('conversation_messages')
      .insert([{
        conversation_id: id,
        agent_name,
        role,
        content,
        input_tokens,
        output_tokens,
        metadata
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    res.status(201).json(data);
  } catch (err) {
    console.error('Error adding message:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get agent stats
app.get('/api/stats/agents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('agent_name, input_tokens, output_tokens');

    if (error) throw error;

    // Aggregate stats by agent
    const stats = {};
    data.forEach(msg => {
      if (!stats[msg.agent_name]) {
        stats[msg.agent_name] = {
          agent_name: msg.agent_name,
          total_messages: 0,
          total_input_tokens: 0,
          total_output_tokens: 0
        };
      }
      stats[msg.agent_name].total_messages++;
      stats[msg.agent_name].total_input_tokens += msg.input_tokens || 0;
      stats[msg.agent_name].total_output_tokens += msg.output_tokens || 0;
    });

    res.json(Object.values(stats));
  } catch (err) {
    console.error('Error fetching agent stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete conversations by date range
app.delete('/api/conversations/delete-range', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'Both from and to dates are required' });
    }

    // Delete conversations within date range
    // Messages will be cascade deleted due to ON DELETE CASCADE
    const { data, error, count } = await supabase
      .from('conversations')
      .delete()
      .gte('created_at', from)
      .lte('created_at', to)
      .select('count');

    if (error) throw error;

    res.json({ 
      success: true, 
      deletedCount: data?.length || 0,
      message: `Deleted ${data?.length || 0} conversation(s)`
    });
  } catch (err) {
    console.error('Error deleting conversations:', err);
    res.status(500).json({ error: err.message });
  }
});

// Real-time subscription endpoint (WebSocket)
const WebSocket = require('ws');
const http = require('http');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });
});

// Subscribe to Supabase real-time changes
const channel = supabase
  .channel('conversation-messages')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'conversation_messages' },
    (payload) => {
      // Broadcast to all connected WebSocket clients
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'new_message',
            data: payload.new
          }));
        }
      });
    }
  )
  .subscribe();

console.log('Subscribed to Supabase real-time changes');

server.listen(PORT, () => {
  console.log(`Mission Board API server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
