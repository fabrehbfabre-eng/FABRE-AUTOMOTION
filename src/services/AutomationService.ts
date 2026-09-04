/**
 * FABRE AUTOMATION - Automation Service
 * Release 2: Supabase Persistence Foundation
 * 
 * Delegates to repositoryManager (SupabaseProvider or MockProvider)
 */

import { Automation } from '../types';
import { IAutomationService } from './types';
import { repositoryManager } from './repositories';
import { validateAutomationData } from './engine/validation';

export class AutomationService implements IAutomationService {
  async getAutomations(): Promise<Automation[]> {
    return repositoryManager.automation.getAutomations();
  }

  async getAutomationById(id: string): Promise<Automation | null> {
    return repositoryManager.automation.getAutomationById(id);
  }

  async createAutomation(data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Automation> {
    validateAutomationData(data);
    return repositoryManager.automation.createAutomation(data);
  }

  async updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation> {
    validateAutomationData(updates);
    return repositoryManager.automation.updateAutomation(id, updates);
  }

  async toggleAutomation(id: string, enabled: boolean): Promise<Automation> {
    return repositoryManager.automation.toggleAutomation(id, enabled);
  }

  async deleteAutomation(id: string): Promise<boolean> {
    return repositoryManager.automation.deleteAutomation(id);
  }
}

export const automationService = new AutomationService();
