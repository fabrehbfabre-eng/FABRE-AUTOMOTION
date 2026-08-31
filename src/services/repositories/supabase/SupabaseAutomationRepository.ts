/**
 * FABRE AUTOMATION - Supabase Automation Repository
 * Release 2: Supabase Persistence Foundation
 */

import { Automation, ChannelType, AutomationTrigger, AutomationAction } from '../../../types';
import { IAutomationRepository } from '../IAutomationRepository';
import { getSupabaseClient } from '../../../lib/supabase';

export class SupabaseAutomationRepository implements IAutomationRepository {
  async getAutomations(filter?: { channel?: ChannelType | 'all'; enabled?: boolean }): Promise<Automation[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    let query = client
      .from('automations')
      .select(`
        id,
        title,
        description,
        enabled,
        channel,
        execution_count,
        last_executed_at,
        created_at,
        updated_at,
        automation_triggers (
          id,
          type,
          name,
          description,
          config,
          created_at
        ),
        automation_actions (
          id,
          type,
          name,
          description,
          config,
          sort_order,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (filter?.channel && filter.channel !== 'all') {
      query = query.or(`channel.eq.${filter.channel},channel.eq.all`);
    }
    if (filter?.enabled !== undefined) {
      query = query.eq('enabled', filter.enabled);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn('[SupabaseAutomationRepository] getAutomations error:', error);
      return [];
    }

    return (data as unknown[]).map((rowRaw: unknown) => {
      const row = rowRaw as {
        id: string;
        title: string;
        description: string | null;
        enabled: boolean;
        channel: string;
        execution_count: number;
        last_executed_at: string | null;
        created_at: string;
        updated_at: string;
        automation_triggers: Array<{
          id: string;
          type: string;
          name: string;
          description: string;
          config: Record<string, unknown>;
        }>;
        automation_actions: Array<{
          id: string;
          type: string;
          name: string;
          description: string;
          config: Record<string, unknown>;
          sort_order: number;
        }>;
      };

      const rawTrigger = row.automation_triggers?.[0];
      const trigger: AutomationTrigger = rawTrigger ? {
        type: rawTrigger.type as AutomationTrigger['type'],
        name: rawTrigger.name,
        description: rawTrigger.description,
        config: rawTrigger.config || {},
      } : {
        type: 'keyword_direct',
        name: 'Gatilho Padrão',
        description: 'Sem gatilho configurado',
        config: {},
      };

      const actions: AutomationAction[] = (row.automation_actions || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(act => ({
          id: act.id,
          type: act.type as AutomationAction['type'],
          name: act.name,
          description: act.description,
          config: act.config || {},
        }));

      return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        enabled: row.enabled,
        channel: (row.channel as Automation['channel']) || 'all',
        trigger,
        actions,
        executionCount: row.execution_count,
        lastExecutedAt: row.last_executed_at || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async getAutomationById(id: string): Promise<Automation | null> {
    const list = await this.getAutomations();
    return list.find(a => a.id === id) || null;
  }

  async createAutomation(data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Automation> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');

    const { data: autoRow, error: autoError } = await client
      .from('automations')
      .insert({
        title: data.title,
        description: data.description,
        enabled: data.enabled,
        channel: data.channel,
        execution_count: 0,
      })
      .select()
      .single();

    if (autoError || !autoRow) {
      throw new Error(`Erro ao criar automação: ${autoError?.message}`);
    }

    // Insert trigger
    if (data.trigger) {
      await (client.from('automation_triggers') as any).insert({
        automation_id: autoRow.id,
        type: data.trigger.type,
        name: data.trigger.name,
        description: data.trigger.description,
        config: data.trigger.config as any,
      });
    }

    // Insert actions
    if (data.actions && data.actions.length > 0) {
      const actionsToInsert = data.actions.map((act, index) => ({
        automation_id: autoRow.id,
        type: act.type,
        name: act.name,
        description: act.description,
        config: act.config as any,
        sort_order: index,
      }));
      await (client.from('automation_actions') as any).insert(actionsToInsert);
    }

    const created = await this.getAutomationById(autoRow.id);
    if (!created) throw new Error('Failed to retrieve created automation');
    return created;
  }

  async updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.enabled !== undefined) updatePayload.enabled = updates.enabled;
    if (updates.channel !== undefined) updatePayload.channel = updates.channel;

    await (client.from('automations') as any).update(updatePayload).eq('id', id);

    const updated = await this.getAutomationById(id);
    if (!updated) throw new Error(`Automation not found: ${id}`);
    return updated;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client.from('automations').delete().eq('id', id);
    return !error;
  }

  async toggleAutomation(id: string, enabled: boolean): Promise<Automation> {
    return this.updateAutomation(id, { enabled });
  }
}
