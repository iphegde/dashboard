-- Mission Board - Supabase Schema Migration
-- Run this in your Supabase SQL Editor to add Mission Board tables
-- This is designed to work WITH your existing agents table

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: UPDATE EXISTING AGENTS TABLE
-- Add missing columns if they don't exist
-- ============================================

-- Add display_name if missing
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Add color if missing  
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';

-- Add avatar_url if missing
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add is_active if missing
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add metadata JSONB if missing
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add updated_at if missing
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update display_name for existing agents (use name as fallback)
UPDATE agents SET display_name = name WHERE display_name IS NULL;

-- Insert the 7 agents if they don't exist
INSERT INTO agents (name, display_name, description, color) VALUES
    ('Nexar', 'Nexar', 'Strategic coordinator', '#EF4444'),
    ('Rio', 'Rio', 'Data analyst', '#3B82F6'),
    ('Orion', 'Orion', 'Research specialist', '#10B981'),
    ('Juno', 'Juno', 'Creative assistant', '#F59E0B'),
    ('Cipher', 'Cipher', 'Security & encryption', '#8B5CF6'),
    ('Phoenix', 'Phoenix', 'System architect', '#EC4899'),
    ('Sterling', 'Sterling', 'Business logic', '#06B6D4')
ON CONFLICT (name) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color = EXCLUDED.color;

-- ============================================
-- STEP 2: CREATE CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255),
    initiator_agent VARCHAR(50) REFERENCES agents(name),
    participants TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    title VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_initiator ON conversations(initiator_agent);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participants);

-- ============================================
-- STEP 3: CREATE CONVERSATION MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_name VARCHAR(50) REFERENCES agents(name),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    model VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_name ON conversation_messages(agent_name);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON conversation_messages(conversation_id, created_at);

-- ============================================
-- STEP 4: CREATE TOKEN USAGE STATS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS token_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    agent_name VARCHAR(50) REFERENCES agents(name),
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    UNIQUE(date, agent_name)
);

CREATE INDEX IF NOT EXISTS idx_token_stats_date ON token_usage_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_token_stats_agent ON token_usage_stats(agent_name);

-- ============================================
-- STEP 5: ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;

-- ============================================
-- STEP 6: CREATE FUNCTIONS
-- ============================================

-- Function to update conversation updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update conversation timestamp on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON conversation_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Function to get conversation stats
CREATE OR REPLACE FUNCTION get_conversation_stats(p_conversation_id UUID)
RETURNS TABLE (
    total_messages BIGINT,
    total_input_tokens BIGINT,
    total_output_tokens BIGINT,
    agent_count BIGINT,
    duration_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_messages,
        COALESCE(SUM(input_tokens), 0)::BIGINT as total_input_tokens,
        COALESCE(SUM(output_tokens), 0)::BIGINT as total_output_tokens,
        COUNT(DISTINCT agent_name)::BIGINT as agent_count,
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))::INTEGER / 60 as duration_minutes
    FROM conversation_messages
    WHERE conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 7: ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_stats ENABLE ROW LEVEL SECURITY;

-- Enable RLS on agents table (if not already)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
-- First drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all access to service role" ON agents;
DROP POLICY IF EXISTS "Allow all access to service role" ON conversations;
DROP POLICY IF EXISTS "Allow all access to service role" ON conversation_messages;
DROP POLICY IF EXISTS "Allow all access to service role" ON token_usage_stats;
DROP POLICY IF EXISTS "Allow anonymous read" ON agents;
DROP POLICY IF EXISTS "Allow anonymous read" ON conversations;
DROP POLICY IF EXISTS "Allow anonymous read" ON conversation_messages;
DROP POLICY IF EXISTS "Allow anonymous read" ON token_usage_stats;

-- Create policies for service role access
CREATE POLICY "Allow all access to service role" ON agents
    FOR ALL USING (auth.role() = 'service_role');
    
CREATE POLICY "Allow all access to service role" ON conversations
    FOR ALL USING (auth.role() = 'service_role');
    
CREATE POLICY "Allow all access to service role" ON conversation_messages
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow all access to service role" ON token_usage_stats
    FOR ALL USING (auth.role() = 'service_role');

-- Allow anonymous read access
CREATE POLICY "Allow anonymous read" ON agents
    FOR SELECT TO anon USING (true);
    
CREATE POLICY "Allow anonymous read" ON conversations
    FOR SELECT TO anon USING (true);
    
CREATE POLICY "Allow anonymous read" ON conversation_messages
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous read" ON token_usage_stats
    FOR SELECT TO anon USING (true);

-- ============================================
-- STEP 8: CREATE VIEWS
-- ============================================

-- View: Recent conversations with message counts
CREATE OR REPLACE VIEW recent_conversations AS
SELECT 
    c.*,
    COUNT(m.id) as message_count,
    COALESCE(SUM(m.input_tokens + m.output_tokens), 0) as total_tokens
FROM conversations c
LEFT JOIN conversation_messages m ON c.id = m.conversation_id
GROUP BY c.id
ORDER BY c.updated_at DESC;

-- View: Agent activity summary
CREATE OR REPLACE VIEW agent_activity_summary AS
SELECT 
    a.name,
    a.display_name,
    a.color,
    COUNT(DISTINCT m.conversation_id) as conversations_participated,
    COUNT(m.id) as total_messages,
    COALESCE(SUM(m.input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(m.output_tokens), 0) as total_output_tokens,
    MAX(m.created_at) as last_active
FROM agents a
LEFT JOIN conversation_messages m ON a.name = m.agent_name
GROUP BY a.id, a.name, a.display_name, a.color
ORDER BY total_messages DESC;

-- ============================================
-- STEP 9: GRANTS
-- ============================================
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Migration complete!' as status;
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_name = 'agents' 
ORDER BY ordinal_position;
