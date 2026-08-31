/**
 * FABRE AUTOMATION - Supabase Database Types
 * Generated & Structured for PostgreSQL Schema
 * Release 2: Supabase Persistence Foundation
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          username: string;
          channel: 'instagram' | 'messenger' | 'whatsapp';
          avatar_url: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
          last_active_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          username: string;
          channel: 'instagram' | 'messenger' | 'whatsapp';
          avatar_url?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
          last_active_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          username?: string;
          channel?: 'instagram' | 'messenger' | 'whatsapp';
          avatar_url?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
          last_active_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          contact_id: string;
          channel: 'instagram' | 'messenger' | 'whatsapp';
          status: 'open' | 'waiting_user' | 'resolved' | 'archived';
          handler: 'bot' | 'human';
          unread_count: number;
          assigned_to: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          channel: 'instagram' | 'messenger' | 'whatsapp';
          status?: 'open' | 'waiting_user' | 'resolved' | 'archived';
          handler?: 'bot' | 'human';
          unread_count?: number;
          assigned_to?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          channel?: 'instagram' | 'messenger' | 'whatsapp';
          status?: 'open' | 'waiting_user' | 'resolved' | 'archived';
          handler?: 'bot' | 'human';
          unread_count?: number;
          assigned_to?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_contact_id_fkey';
            columns: ['contact_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender: 'user' | 'contact' | 'bot' | 'system';
          channel: 'instagram' | 'messenger' | 'whatsapp';
          content: string;
          content_type: 'text' | 'image' | 'audio' | 'quick_reply' | 'template' | 'system_event';
          media_url: string | null;
          status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
          external_event_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender: 'user' | 'contact' | 'bot' | 'system';
          channel: 'instagram' | 'messenger' | 'whatsapp';
          content: string;
          content_type?: 'text' | 'image' | 'audio' | 'quick_reply' | 'template' | 'system_event';
          media_url?: string | null;
          status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
          external_event_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender?: 'user' | 'contact' | 'bot' | 'system';
          channel?: 'instagram' | 'messenger' | 'whatsapp';
          content?: string;
          content_type?: 'text' | 'image' | 'audio' | 'quick_reply' | 'template' | 'system_event';
          media_url?: string | null;
          status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
          external_event_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          }
        ];
      };
      automations: {
        Row: {
          id: string;
          title: string;
          description: string;
          enabled: boolean;
          channel: string;
          execution_count: number;
          last_executed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          enabled?: boolean;
          channel?: string;
          execution_count?: number;
          last_executed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          enabled?: boolean;
          channel?: string;
          execution_count?: number;
          last_executed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      automation_triggers: {
        Row: {
          id: string;
          automation_id: string;
          type: string;
          name: string;
          description: string;
          config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          automation_id: string;
          type: string;
          name: string;
          description?: string;
          config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          automation_id?: string;
          type?: string;
          name?: string;
          description?: string;
          config?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'automation_triggers_automation_id_fkey';
            columns: ['automation_id'];
            referencedRelation: 'automations';
            referencedColumns: ['id'];
          }
        ];
      };
      automation_actions: {
        Row: {
          id: string;
          automation_id: string;
          type: string;
          name: string;
          description: string;
          config: Json;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          automation_id: string;
          type: string;
          name: string;
          description?: string;
          config?: Json;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          automation_id?: string;
          type?: string;
          name?: string;
          description?: string;
          config?: Json;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'automation_actions_automation_id_fkey';
            columns: ['automation_id'];
            referencedRelation: 'automations';
            referencedColumns: ['id'];
          }
        ];
      };
      knowledge_items: {
        Row: {
          id: string;
          title: string;
          category: string;
          content: string;
          summary: string | null;
          tags: string[];
          is_active: boolean;
          priority: number;
          is_official: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category: string;
          content: string;
          summary?: string | null;
          tags?: string[];
          is_active?: boolean;
          priority?: number;
          is_official?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string;
          content?: string;
          summary?: string | null;
          tags?: string[];
          is_active?: boolean;
          priority?: number;
          is_official?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      channel_connections: {
        Row: {
          id: string;
          channel: 'instagram' | 'messenger' | 'whatsapp';
          name: string;
          account_handle: string | null;
          status: string;
          status_message: string | null;
          connected_at: string | null;
          last_sync_at: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          channel: 'instagram' | 'messenger' | 'whatsapp';
          name: string;
          account_handle?: string | null;
          status?: string;
          status_message?: string | null;
          connected_at?: string | null;
          last_sync_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          channel?: 'instagram' | 'messenger' | 'whatsapp';
          name?: string;
          account_handle?: string | null;
          status?: string;
          status_message?: string | null;
          connected_at?: string | null;
          last_sync_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_tags: {
        Row: {
          id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      contact_tag_assignments: {
        Row: {
          id: string;
          contact_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          tag_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_tag_assignments_contact_id_fkey';
            columns: ['contact_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_tag_assignments_tag_id_fkey';
            columns: ['tag_id'];
            referencedRelation: 'contact_tags';
            referencedColumns: ['id'];
          }
        ];
      };
      contact_notes: {
        Row: {
          id: string;
          contact_id: string;
          author_name: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          author_name: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          author_name?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_notes_contact_id_fkey';
            columns: ['contact_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
