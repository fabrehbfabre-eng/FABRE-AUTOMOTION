-- =====================================================
-- FABRE AUTOMATION - Supabase PostgreSQL Database Schema
-- Release 2: Supabase Persistence Foundation
-- =====================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Helper function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. CORE TABLES
-- =====================================================

-- 3.1 PROFILES (Contacts, Followers & App Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_profiles_channel ON public.profiles(channel);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

-- 3.2 CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_user', 'resolved', 'archived')),
    handler TEXT NOT NULL DEFAULT 'bot' CHECK (handler IN ('bot', 'human')),
    unread_count INTEGER NOT NULL DEFAULT 0,
    assigned_to TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_handler ON public.conversations(handler);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- 3.3 MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'contact', 'bot', 'system')),
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'quick_reply', 'template', 'system_event')),
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender);

-- 3.4 AUTOMATIONS
CREATE TABLE IF NOT EXISTS public.automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    channel TEXT NOT NULL DEFAULT 'all',
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_automations_updated_at
    BEFORE UPDATE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_automations_enabled ON public.automations(enabled);
CREATE INDEX IF NOT EXISTS idx_automations_channel ON public.automations(channel);

-- 3.5 AUTOMATION TRIGGERS
CREATE TABLE IF NOT EXISTS public.automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_automation ON public.automation_triggers(automation_id);
CREATE INDEX IF NOT EXISTS idx_triggers_type ON public.automation_triggers(type);

-- 3.6 AUTOMATION ACTIONS
CREATE TABLE IF NOT EXISTS public.automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_automation ON public.automation_actions(automation_id);
CREATE INDEX IF NOT EXISTS idx_actions_sort_order ON public.automation_actions(sort_order ASC);

-- 3.7 KNOWLEDGE ITEMS (Oficial & RAG Base)
CREATE TABLE IF NOT EXISTS public.knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('product', 'price', 'faq', 'profile', 'rules', 'tone', 'commercial', 'link')),
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    is_official BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_knowledge_items_updated_at
    BEFORE UPDATE ON public.knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON public.knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_is_active ON public.knowledge_items(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_priority ON public.knowledge_items(priority);

-- 3.8 CHANNEL CONNECTIONS
CREATE TABLE IF NOT EXISTS public.channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL UNIQUE CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    name TEXT NOT NULL,
    account_handle TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_connection' CHECK (status IN ('disconnected', 'awaiting_connection', 'connecting', 'connected', 'error')),
    status_message TEXT,
    connected_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_channel_connections_updated_at
    BEFORE UPDATE ON public.channel_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3.9 CONTACT TAGS
CREATE TABLE IF NOT EXISTS public.contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'cyan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 CONTACT TAG ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.contact_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_assignments_contact ON public.contact_tag_assignments(contact_id);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON public.contact_tag_assignments(tag_id);

-- 3.11 CONTACT NOTES
CREATE TABLE IF NOT EXISTS public.contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON public.contact_notes(contact_id);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- Default Policies for App Operators (Authenticated / Public Anon with Token in Dev)
-- 4.1 Profiles Policy
CREATE POLICY "Allow read profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update profiles" ON public.profiles
    FOR UPDATE USING (true);

-- 4.2 Conversations Policy
CREATE POLICY "Allow read conversations" ON public.conversations
    FOR SELECT USING (true);

CREATE POLICY "Allow insert conversations" ON public.conversations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update conversations" ON public.conversations
    FOR UPDATE USING (true);

-- 4.3 Messages Policy
CREATE POLICY "Allow read messages" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Allow insert messages" ON public.messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update messages" ON public.messages
    FOR UPDATE USING (true);

-- 4.4 Automations Policy
CREATE POLICY "Allow read automations" ON public.automations
    FOR SELECT USING (true);

CREATE POLICY "Allow modify automations" ON public.automations
    FOR ALL USING (true);

-- 4.5 Automation Triggers Policy
CREATE POLICY "Allow all automation triggers" ON public.automation_triggers
    FOR ALL USING (true);

-- 4.6 Automation Actions Policy
CREATE POLICY "Allow all automation actions" ON public.automation_actions
    FOR ALL USING (true);

-- 4.7 Knowledge Items Policy
CREATE POLICY "Allow read knowledge" ON public.knowledge_items
    FOR SELECT USING (true);

CREATE POLICY "Allow modify knowledge" ON public.knowledge_items
    FOR ALL USING (true);

-- 4.8 Channel Connections Policy
CREATE POLICY "Allow read channel connections" ON public.channel_connections
    FOR SELECT USING (true);

CREATE POLICY "Allow modify channel connections" ON public.channel_connections
    FOR ALL USING (true);

-- 4.9 Tags Policies
CREATE POLICY "Allow all contact tags" ON public.contact_tags
    FOR ALL USING (true);

CREATE POLICY "Allow all tag assignments" ON public.contact_tag_assignments
    FOR ALL USING (true);

CREATE POLICY "Allow all contact notes" ON public.contact_notes
    FOR ALL USING (true);

-- =====================================================
-- 5. INITIAL CHANNEL ENTRIES (Awaiting Connection)
-- =====================================================
INSERT INTO public.channel_connections (channel, name, status, status_message)
VALUES 
    ('instagram', 'Instagram Direct API', 'awaiting_connection', 'Aguardando configuração de App Meta & Webhooks'),
    ('messenger', 'Facebook Messenger', 'awaiting_connection', 'Aguardando autenticação Meta Graph API'),
    ('whatsapp', 'WhatsApp Business Cloud API', 'awaiting_connection', 'Aguardando WhatsApp Cloud API Token')
ON CONFLICT (channel) DO NOTHING;
