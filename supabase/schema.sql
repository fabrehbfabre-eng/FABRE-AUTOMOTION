-- =====================================================
-- FABRE AUTOMATION - Supabase PostgreSQL Database Schema
-- Release: Authentication Hardening, Multi-Tenant Foundation & Production Readiness
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
-- 3. MULTI-TENANT IDENTITY & WORKSPACES
-- =====================================================

-- 3.1 WORKSPACES (Tenant Accounts)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);

-- 3.2 WORKSPACE MEMBERS (Role-Based Access Control per Tenant)
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

DROP TRIGGER IF EXISTS update_workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER update_workspace_members_updated_at
    BEFORE UPDATE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(role);

-- 3.3 APP USERS (Persistent Application Identity linked to auth.users)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    system_role TEXT NOT NULL DEFAULT 'user' CHECK (system_role IN ('user', 'system_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_app_users_updated_at ON public.app_users;
CREATE TRIGGER update_app_users_updated_at
    BEFORE UPDATE ON public.app_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed Canonical Workspace for Casal Fabre (Official Meta Assets - ADM01)
INSERT INTO public.workspaces (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Casal Fabre (Oficial)', 'casal-fabre-oficial')
ON CONFLICT (id) DO NOTHING;

-- 3.4 AUTOMATIC USER PROVISIONING TRIGGER (Auth -> Profile -> Personal Workspace)
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_workspace_id UUID;
    user_name TEXT;
BEGIN
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    -- 1. Create persistent app_users record
    INSERT INTO public.app_users (id, email, full_name)
    VALUES (NEW.id, NEW.email, user_name)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW();

    -- 2. Create personal workspace for the user (Tenant isolation)
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (user_name || ' Workspace', NEW.id)
    RETURNING id INTO new_workspace_id;

    -- 3. Set user as 'owner' of their personal workspace (NOT global admin)
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_setup();

-- =====================================================
-- 4. TENANT OPERATIONAL TABLES
-- =====================================================

-- 4.1 PROFILES (Customer Contacts & Leads per Tenant)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
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

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_profiles_workspace ON public.profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_profiles_channel ON public.profiles(channel);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

-- 4.2 CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
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

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON public.conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_handler ON public.conversations(handler);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- 4.3 MESSAGES (With external_event_id for Idempotency)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'contact', 'bot', 'system')),
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'quick_reply', 'template', 'system_event')),
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
    external_event_id TEXT UNIQUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_workspace ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_external_event ON public.messages(external_event_id);

-- 4.4 AUTOMATIONS
CREATE TABLE IF NOT EXISTS public.automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    channel TEXT NOT NULL DEFAULT 'all',
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_automations_updated_at ON public.automations;
CREATE TRIGGER update_automations_updated_at
    BEFORE UPDATE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_automations_workspace ON public.automations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON public.automations(enabled);
CREATE INDEX IF NOT EXISTS idx_automations_channel ON public.automations(channel);

-- 4.5 AUTOMATION TRIGGERS
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

-- 4.6 AUTOMATION ACTIONS
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

-- 4.7 KNOWLEDGE ITEMS (Official & RAG Base per Tenant)
CREATE TABLE IF NOT EXISTS public.knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
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

DROP TRIGGER IF EXISTS update_knowledge_items_updated_at ON public.knowledge_items;
CREATE TRIGGER update_knowledge_items_updated_at
    BEFORE UPDATE ON public.knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_knowledge_workspace ON public.knowledge_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON public.knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_is_active ON public.knowledge_items(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_priority ON public.knowledge_items(priority);

-- 4.8 CHANNEL CONNECTIONS (Multi-tenant: UNIQUE per workspace + channel)
CREATE TABLE IF NOT EXISTS public.channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    name TEXT NOT NULL,
    account_handle TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_connection' CHECK (status IN ('disconnected', 'awaiting_connection', 'connecting', 'connected', 'error')),
    status_message TEXT,
    connected_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, channel)
);

DROP TRIGGER IF EXISTS update_channel_connections_updated_at ON public.channel_connections;
CREATE TRIGGER update_channel_connections_updated_at
    BEFORE UPDATE ON public.channel_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_channel_connections_workspace ON public.channel_connections(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_connections_workspace_channel ON public.channel_connections(workspace_id, channel);

-- 4.9 CONTACT TAGS (Multi-tenant: UNIQUE per workspace + name)
CREATE TABLE IF NOT EXISTS public.contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'cyan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contact_tags_workspace ON public.contact_tags(workspace_id);

-- 4.10 CONTACT TAG ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.contact_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_assignments_contact ON public.contact_tag_assignments(contact_id);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON public.contact_tag_assignments(tag_id);

-- 4.11 CONTACT NOTES
CREATE TABLE IF NOT EXISTS public.contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_contact_notes_updated_at ON public.contact_notes;
CREATE TRIGGER update_contact_notes_updated_at
    BEFORE UPDATE ON public.contact_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_contact_notes_workspace ON public.contact_notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON public.contact_notes(contact_id);

-- 4.12 AUTOMATION JOBS (Durable Scheduler & Delay Engine)
CREATE TABLE IF NOT EXISTS public.automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.workspaces(id) ON DELETE CASCADE,
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    action_id UUID NOT NULL REFERENCES public.automation_actions(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL DEFAULT 'delayed_action',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_automation_jobs_updated_at ON public.automation_jobs;
CREATE TRIGGER update_automation_jobs_updated_at
    BEFORE UPDATE ON public.automation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_jobs_workspace ON public.automation_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled ON public.automation_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_conversation_id ON public.automation_jobs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_conversation_status ON public.automation_jobs(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON public.automation_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_jobs_automation_id ON public.automation_jobs(automation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON public.automation_jobs(idempotency_key);

-- =====================================================
-- 5. INITIAL CHANNEL ENTRIES (Official Casal Fabre ADM01)
-- =====================================================
INSERT INTO public.channel_connections (workspace_id, channel, name, status, status_message)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'instagram', 'Instagram Direct API', 'awaiting_connection', 'Aguardando configuração de App Meta & Webhooks'),
    ('00000000-0000-0000-0000-000000000001', 'messenger', 'Facebook Messenger', 'awaiting_connection', 'Aguardando autenticação Meta Graph API'),
    ('00000000-0000-0000-0000-000000000001', 'whatsapp', 'WhatsApp Business Cloud API', 'awaiting_connection', 'Aguardando WhatsApp Cloud API Token')
ON CONFLICT (workspace_id, channel) DO NOTHING;

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- =====================================================

-- 6.1 Check if current user is member of given workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = auth.uid()
    );
$$;

-- 6.2 Check if current user is owner or admin of given workspace
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    );
$$;

-- 6.3 Check if current user is a system-wide global administrator
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.app_users
        WHERE id = auth.uid()
          AND system_role = 'system_admin'
    );
$$;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES - STRICT TENANT ISOLATION
-- =====================================================

-- Enable RLS on all 14 tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

-- 7.1 WORKSPACES POLICIES
DROP POLICY IF EXISTS "Workspaces select policy" ON public.workspaces;
CREATE POLICY "Workspaces select policy" ON public.workspaces
    FOR SELECT USING (
        id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
        OR owner_id = auth.uid()
        OR is_system_admin()
    );

DROP POLICY IF EXISTS "Workspaces insert policy" ON public.workspaces;
CREATE POLICY "Workspaces insert policy" ON public.workspaces
    FOR INSERT WITH CHECK (
        owner_id = auth.uid()
        OR is_system_admin()
    );

DROP POLICY IF EXISTS "Workspaces update policy" ON public.workspaces;
CREATE POLICY "Workspaces update policy" ON public.workspaces
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR is_workspace_admin(id)
        OR is_system_admin()
    );

DROP POLICY IF EXISTS "Workspaces delete policy" ON public.workspaces;
CREATE POLICY "Workspaces delete policy" ON public.workspaces
    FOR DELETE USING (
        owner_id = auth.uid()
        OR is_system_admin()
    );

-- 7.2 WORKSPACE MEMBERS POLICIES
DROP POLICY IF EXISTS "Workspace members select policy" ON public.workspace_members;
CREATE POLICY "Workspace members select policy" ON public.workspace_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR is_workspace_member(workspace_id)
        OR is_system_admin()
    );

DROP POLICY IF EXISTS "Workspace members insert policy" ON public.workspace_members;
CREATE POLICY "Workspace members insert policy" ON public.workspace_members
    FOR INSERT WITH CHECK (
        is_workspace_admin(workspace_id)
        OR is_system_admin()
    );

DROP POLICY IF EXISTS "Workspace members update policy" ON public.workspace_members;
CREATE POLICY "Workspace members update policy" ON public.workspace_members
    FOR UPDATE USING (
        is_workspace_admin(workspace_id)
        OR is_system_admin()
    );

DROP POLICY IF EXISTS "Workspace members delete policy" ON public.workspace_members;
CREATE POLICY "Workspace members delete policy" ON public.workspace_members
    FOR DELETE USING (
        is_workspace_admin(workspace_id)
        OR is_system_admin()
    );

-- 7.3 APP USERS POLICIES
DROP POLICY IF EXISTS "App users select policy" ON public.app_users;
CREATE POLICY "App users select policy" ON public.app_users
    FOR SELECT USING (
        id = auth.uid()
        OR is_system_admin()
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm1
            JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
            WHERE wm1.user_id = auth.uid() AND wm2.user_id = app_users.id
        )
    );

DROP POLICY IF EXISTS "App users update policy" ON public.app_users;
CREATE POLICY "App users update policy" ON public.app_users
    FOR UPDATE USING (
        id = auth.uid()
        OR is_system_admin()
    ) WITH CHECK (
        id = auth.uid()
        OR is_system_admin()
    );

-- 7.4 PROFILES (CONTACTS) POLICIES
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles
    FOR INSERT WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE USING (is_workspace_member(workspace_id) OR is_system_admin())
    WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
CREATE POLICY "Profiles delete policy" ON public.profiles
    FOR DELETE USING (is_workspace_admin(workspace_id) OR is_system_admin());

-- 7.5 CONVERSATIONS POLICIES
DROP POLICY IF EXISTS "Conversations select policy" ON public.conversations;
CREATE POLICY "Conversations select policy" ON public.conversations
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Conversations insert policy" ON public.conversations;
CREATE POLICY "Conversations insert policy" ON public.conversations
    FOR INSERT WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Conversations update policy" ON public.conversations;
CREATE POLICY "Conversations update policy" ON public.conversations
    FOR UPDATE USING (is_workspace_member(workspace_id) OR is_system_admin())
    WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Conversations delete policy" ON public.conversations;
CREATE POLICY "Conversations delete policy" ON public.conversations
    FOR DELETE USING (is_workspace_admin(workspace_id) OR is_system_admin());

-- 7.6 MESSAGES POLICIES
DROP POLICY IF EXISTS "Messages select policy" ON public.messages;
CREATE POLICY "Messages select policy" ON public.messages
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Messages insert policy" ON public.messages;
CREATE POLICY "Messages insert policy" ON public.messages
    FOR INSERT WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Messages update policy" ON public.messages;
CREATE POLICY "Messages update policy" ON public.messages
    FOR UPDATE USING (is_workspace_member(workspace_id) OR is_system_admin())
    WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Messages delete policy" ON public.messages;
CREATE POLICY "Messages delete policy" ON public.messages
    FOR DELETE USING (is_workspace_admin(workspace_id) OR is_system_admin());

-- 7.7 AUTOMATIONS POLICIES
DROP POLICY IF EXISTS "Automations select policy" ON public.automations;
CREATE POLICY "Automations select policy" ON public.automations
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Automations insert policy" ON public.automations;
CREATE POLICY "Automations insert policy" ON public.automations
    FOR INSERT WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Automations update policy" ON public.automations;
CREATE POLICY "Automations update policy" ON public.automations
    FOR UPDATE USING (is_workspace_member(workspace_id) OR is_system_admin())
    WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Automations delete policy" ON public.automations;
CREATE POLICY "Automations delete policy" ON public.automations
    FOR DELETE USING (is_workspace_admin(workspace_id) OR is_system_admin());

-- 7.8 AUTOMATION TRIGGERS POLICIES
DROP POLICY IF EXISTS "Automation triggers select policy" ON public.automation_triggers;
CREATE POLICY "Automation triggers select policy" ON public.automation_triggers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.automations a
            WHERE a.id = automation_id
              AND (is_workspace_member(a.workspace_id) OR is_system_admin())
        )
    );

DROP POLICY IF EXISTS "Automation triggers modify policy" ON public.automation_triggers;
CREATE POLICY "Automation triggers modify policy" ON public.automation_triggers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.automations a
            WHERE a.id = automation_id
              AND (is_workspace_member(a.workspace_id) OR is_system_admin())
        )
    );

-- 7.9 AUTOMATION ACTIONS POLICIES
DROP POLICY IF EXISTS "Automation actions select policy" ON public.automation_actions;
CREATE POLICY "Automation actions select policy" ON public.automation_actions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.automations a
            WHERE a.id = automation_id
              AND (is_workspace_member(a.workspace_id) OR is_system_admin())
        )
    );

DROP POLICY IF EXISTS "Automation actions modify policy" ON public.automation_actions;
CREATE POLICY "Automation actions modify policy" ON public.automation_actions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.automations a
            WHERE a.id = automation_id
              AND (is_workspace_member(a.workspace_id) OR is_system_admin())
        )
    );

-- 7.10 KNOWLEDGE ITEMS POLICIES
DROP POLICY IF EXISTS "Knowledge select policy" ON public.knowledge_items;
CREATE POLICY "Knowledge select policy" ON public.knowledge_items
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Knowledge insert policy" ON public.knowledge_items;
CREATE POLICY "Knowledge insert policy" ON public.knowledge_items
    FOR INSERT WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Knowledge update policy" ON public.knowledge_items;
CREATE POLICY "Knowledge update policy" ON public.knowledge_items
    FOR UPDATE USING (is_workspace_member(workspace_id) OR is_system_admin())
    WITH CHECK (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Knowledge delete policy" ON public.knowledge_items;
CREATE POLICY "Knowledge delete policy" ON public.knowledge_items
    FOR DELETE USING (is_workspace_admin(workspace_id) OR is_system_admin());

-- 7.11 CHANNEL CONNECTIONS POLICIES
DROP POLICY IF EXISTS "Channel connections select policy" ON public.channel_connections;
CREATE POLICY "Channel connections select policy" ON public.channel_connections
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Channel connections insert policy" ON public.channel_connections;
CREATE POLICY "Channel connections insert policy" ON public.channel_connections
    FOR INSERT WITH CHECK (is_workspace_admin(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Channel connections update policy" ON public.channel_connections;
CREATE POLICY "Channel connections update policy" ON public.channel_connections
    FOR UPDATE USING (is_workspace_admin(workspace_id) OR is_system_admin())
    WITH CHECK (is_workspace_admin(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Channel connections delete policy" ON public.channel_connections;
CREATE POLICY "Channel connections delete policy" ON public.channel_connections
    FOR DELETE USING (is_workspace_admin(workspace_id) OR is_system_admin());

-- 7.12 CONTACT TAGS POLICIES
DROP POLICY IF EXISTS "Contact tags select policy" ON public.contact_tags;
CREATE POLICY "Contact tags select policy" ON public.contact_tags
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Contact tags modify policy" ON public.contact_tags;
CREATE POLICY "Contact tags modify policy" ON public.contact_tags
    FOR ALL USING (is_workspace_member(workspace_id) OR is_system_admin());

-- 7.13 CONTACT TAG ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "Tag assignments policy" ON public.contact_tag_assignments;
CREATE POLICY "Tag assignments policy" ON public.contact_tag_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = contact_id
              AND (is_workspace_member(p.workspace_id) OR is_system_admin())
        )
    );

-- 7.14 CONTACT NOTES POLICIES
DROP POLICY IF EXISTS "Contact notes select policy" ON public.contact_notes;
CREATE POLICY "Contact notes select policy" ON public.contact_notes
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Contact notes modify policy" ON public.contact_notes;
CREATE POLICY "Contact notes modify policy" ON public.contact_notes
    FOR ALL USING (is_workspace_member(workspace_id) OR is_system_admin());

-- 7.15 AUTOMATION JOBS POLICIES
DROP POLICY IF EXISTS "Automation jobs select policy" ON public.automation_jobs;
CREATE POLICY "Automation jobs select policy" ON public.automation_jobs
    FOR SELECT USING (is_workspace_member(workspace_id) OR is_system_admin());

DROP POLICY IF EXISTS "Automation jobs modify policy" ON public.automation_jobs;
CREATE POLICY "Automation jobs modify policy" ON public.automation_jobs
    FOR ALL USING (is_workspace_member(workspace_id) OR is_system_admin());

-- =====================================================
-- 8. DURABLE SCHEDULER STORED PROCEDURES
-- =====================================================

-- Concurrency-safe atomic claim using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_due_automation_jobs(
    p_limit INT DEFAULT 10,
    p_worker_id TEXT DEFAULT NULL
)
RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH due_jobs AS (
        SELECT id
        FROM public.automation_jobs
        WHERE status = 'pending'
          AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.automation_jobs j
    SET 
        status = 'processing',
        started_at = NOW(),
        attempts = j.attempts + 1,
        updated_at = NOW()
    FROM due_jobs
    WHERE j.id = due_jobs.id
    RETURNING j.*;
END;
$$;
