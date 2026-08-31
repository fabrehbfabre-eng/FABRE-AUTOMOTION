/**
 * FABRE AUTOMATION - Repository Factory & Provider Selector
 * Release 2: Supabase Persistence Foundation
 * 
 * Automatically switches between:
 * - SupabaseProvider (when VITE_SUPABASE_URL & VITE_SUPABASE_PUBLISHABLE_KEY are configured)
 * - MockProvider (local memory & storage demo mode)
 */

import { isSupabaseConfigured } from '../../lib/supabase';
import { IConversationRepository } from './IConversationRepository';
import { IAutomationRepository } from './IAutomationRepository';
import { IKnowledgeRepository } from './IKnowledgeRepository';
import { IChannelRepository } from './IChannelRepository';

import { MockConversationRepository } from './mock/MockConversationRepository';
import { MockAutomationRepository } from './mock/MockAutomationRepository';
import { MockKnowledgeRepository } from './mock/MockKnowledgeRepository';
import { MockChannelRepository } from './mock/MockChannelRepository';

import { SupabaseConversationRepository } from './supabase/SupabaseConversationRepository';
import { SupabaseAutomationRepository } from './supabase/SupabaseAutomationRepository';
import { SupabaseKnowledgeRepository } from './supabase/SupabaseKnowledgeRepository';
import { SupabaseChannelRepository } from './supabase/SupabaseChannelRepository';

export type StorageProviderType = 'supabase' | 'mock';

class RepositoryManager {
  private mockConv = new MockConversationRepository();
  private mockAuto = new MockAutomationRepository();
  private mockKb = new MockKnowledgeRepository();
  private mockChan = new MockChannelRepository();

  private supabaseConv = new SupabaseConversationRepository();
  private supabaseAuto = new SupabaseAutomationRepository();
  private supabaseKb = new SupabaseKnowledgeRepository();
  private supabaseChan = new SupabaseChannelRepository();

  getProvider(): StorageProviderType {
    return isSupabaseConfigured() ? 'supabase' : 'mock';
  }

  get conversation(): IConversationRepository {
    return this.getProvider() === 'supabase' ? this.supabaseConv : this.mockConv;
  }

  get automation(): IAutomationRepository {
    return this.getProvider() === 'supabase' ? this.supabaseAuto : this.mockAuto;
  }

  get knowledge(): IKnowledgeRepository {
    return this.getProvider() === 'supabase' ? this.supabaseKb : this.mockKb;
  }

  get channel(): IChannelRepository {
    return this.getProvider() === 'supabase' ? this.supabaseChan : this.mockChan;
  }
}

export const repositoryManager = new RepositoryManager();
