/**
 * FABRE AUTOMATION - Mock Automation Repository
 * Release 2: Supabase Persistence Foundation
 */

import { Automation, ChannelType } from '../../../types';
import { IAutomationRepository } from '../IAutomationRepository';
import { INITIAL_AUTOMATIONS, storageService } from '../../StorageService';

export class MockAutomationRepository implements IAutomationRepository {
  async getAutomations(filter?: { channel?: ChannelType | 'all'; enabled?: boolean }): Promise<Automation[]> {
    const stored = await storageService.getItem<Automation[]>('automations');
    const automations = stored || INITIAL_AUTOMATIONS;

    return automations.filter(a => {
      if (filter?.channel && filter.channel !== 'all' && a.channel !== filter.channel && a.channel !== 'all') return false;
      if (filter?.enabled !== undefined && a.enabled !== filter.enabled) return false;
      return true;
    });
  }

  async getAutomationById(id: string): Promise<Automation | null> {
    const automations = await this.getAutomations();
    return automations.find(a => a.id === id) || null;
  }

  async createAutomation(data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Automation> {
    const current = await this.getAutomations();
    const now = new Date().toISOString();
    const newAuto: Automation = {
      ...data,
      id: `auto_demo_${Date.now()}`,
      executionCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newAuto, ...current];
    await storageService.setItem('automations', updated);
    return newAuto;
  }

  async updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation> {
    const current = await this.getAutomations();
    let updatedAuto: Automation | null = null;

    const updated = current.map(item => {
      if (item.id === id) {
        updatedAuto = {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        return updatedAuto;
      }
      return item;
    });

    if (!updatedAuto) {
      throw new Error(`Automation not found: ${id}`);
    }

    await storageService.setItem('automations', updated);
    return updatedAuto;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    const current = await this.getAutomations();
    const filtered = current.filter(a => a.id !== id);
    await storageService.setItem('automations', filtered);
    return true;
  }

  async toggleAutomation(id: string, enabled: boolean): Promise<Automation> {
    return this.updateAutomation(id, { enabled });
  }
}
