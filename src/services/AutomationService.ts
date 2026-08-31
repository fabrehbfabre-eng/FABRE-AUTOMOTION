/**
 * FABRE AUTOMATION - Automation Service
 * Release 1: Foundation & Architecture
 */

import { Automation } from '../types';
import { IAutomationService } from './types';
import { INITIAL_AUTOMATIONS, storageService } from './StorageService';

export class AutomationService implements IAutomationService {
  async getAutomations(): Promise<Automation[]> {
    const stored = await storageService.getItem<Automation[]>('automations');
    return stored || INITIAL_AUTOMATIONS;
  }

  async getAutomationById(id: string): Promise<Automation | null> {
    const list = await this.getAutomations();
    return list.find(a => a.id === id) || null;
  }

  async createAutomation(data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Automation> {
    const current = await this.getAutomations();
    const now = new Date().toISOString();
    const newAutomation: Automation = {
      ...data,
      id: `auto_${Date.now()}`,
      executionCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newAutomation, ...current];
    await storageService.setItem('automations', updated);
    return newAutomation;
  }

  async updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation> {
    const current = await this.getAutomations();
    let updatedItem: Automation | null = null;

    const updated = current.map(a => {
      if (a.id === id) {
        updatedItem = {
          ...a,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return a;
    });

    if (!updatedItem) {
      throw new Error(`Automation not found: ${id}`);
    }

    await storageService.setItem('automations', updated);
    return updatedItem;
  }

  async toggleAutomation(id: string, enabled: boolean): Promise<Automation> {
    return this.updateAutomation(id, { enabled });
  }

  async deleteAutomation(id: string): Promise<boolean> {
    const current = await this.getAutomations();
    const filtered = current.filter(a => a.id !== id);
    await storageService.setItem('automations', filtered);
    return true;
  }
}

export const automationService = new AutomationService();
