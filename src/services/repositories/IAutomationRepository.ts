/**
 * FABRE AUTOMATION - Automation Repository Interface
 * Release 2: Supabase Persistence Foundation
 */

import { Automation, ChannelType } from '../../types';

export interface IAutomationRepository {
  getAutomations(filter?: { channel?: ChannelType | 'all'; enabled?: boolean }): Promise<Automation[]>;
  getAutomationById(id: string): Promise<Automation | null>;
  createAutomation(data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Automation>;
  updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation>;
  deleteAutomation(id: string): Promise<boolean>;
  toggleAutomation(id: string, enabled: boolean): Promise<Automation>;
}
