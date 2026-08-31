/**
 * FABRE AUTOMATION - Supabase Channel Repository
 * Release 2: Supabase Persistence Foundation
 */

import { ChannelConnection, IntegrationCardConfig } from '../../../types';
import { IChannelRepository } from '../IChannelRepository';
import { getSupabaseClient } from '../../../lib/supabase';
import { INITIAL_CONNECTIONS, INITIAL_INTEGRATIONS } from '../../StorageService';

export class SupabaseChannelRepository implements IChannelRepository {
  async getConnections(): Promise<Record<'instagram' | 'messenger' | 'whatsapp', ChannelConnection>> {
    const client = getSupabaseClient();
    if (!client) return INITIAL_CONNECTIONS;

    const { data, error } = await client
      .from('channel_connections')
      .select('*');

    if (error || !data || data.length === 0) {
      return INITIAL_CONNECTIONS;
    }

    const map = { ...INITIAL_CONNECTIONS };
    data.forEach(row => {
      const channel = row.channel as 'instagram' | 'messenger' | 'whatsapp';
      if (map[channel]) {
        map[channel] = {
          id: row.id,
          channel,
          name: row.name,
          accountHandle: row.account_handle || undefined,
          status: row.status as ChannelConnection['status'],
          statusMessage: row.status_message || undefined,
          connectedAt: row.connected_at || undefined,
          lastSyncAt: row.last_sync_at || undefined,
          metadata: (row.metadata as Record<string, unknown>) || undefined,
        };
      }
    });

    return map;
  }

  async getIntegrations(): Promise<IntegrationCardConfig[]> {
    return INITIAL_INTEGRATIONS;
  }

  async getConnection(channel: 'instagram' | 'messenger' | 'whatsapp'): Promise<ChannelConnection> {
    const connections = await this.getConnections();
    return connections[channel];
  }

  async updateConnection(
    channel: 'instagram' | 'messenger' | 'whatsapp',
    updates: Partial<ChannelConnection>
  ): Promise<ChannelConnection> {
    const client = getSupabaseClient();
    if (!client) {
      const fallback = INITIAL_CONNECTIONS[channel];
      Object.assign(fallback, updates);
      return fallback;
    }

    const { data, error } = await client
      .from('channel_connections')
      .update({
        status: updates.status,
        status_message: updates.statusMessage || null,
        account_handle: updates.accountHandle || null,
        connected_at: updates.connectedAt || (updates.status === 'connected' ? new Date().toISOString() : null),
        last_sync_at: updates.lastSyncAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('channel', channel)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar conexão do canal: ${error?.message}`);
    }

    return {
      id: data.id,
      channel: data.channel as 'instagram' | 'messenger' | 'whatsapp',
      name: data.name,
      accountHandle: data.account_handle || undefined,
      status: data.status as ChannelConnection['status'],
      statusMessage: data.status_message || undefined,
      connectedAt: data.connected_at || undefined,
      lastSyncAt: data.last_sync_at || undefined,
    };
  }

  async updateConnectionStatus(
    channel: 'instagram' | 'messenger' | 'whatsapp',
    status: ChannelConnection['status'],
    message?: string
  ): Promise<ChannelConnection> {
    const client = getSupabaseClient();
    if (!client) {
      const fallback = INITIAL_CONNECTIONS[channel];
      fallback.status = status;
      fallback.statusMessage = message;
      return fallback;
    }

    const { data, error } = await client
      .from('channel_connections')
      .update({
        status,
        status_message: message || null,
        connected_at: status === 'connected' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('channel', channel)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao atualizar status do canal: ${error?.message}`);
    }

    return {
      id: data.id,
      channel: data.channel as 'instagram' | 'messenger' | 'whatsapp',
      name: data.name,
      accountHandle: data.account_handle || undefined,
      status: data.status as ChannelConnection['status'],
      statusMessage: data.status_message || undefined,
      connectedAt: data.connected_at || undefined,
      lastSyncAt: data.last_sync_at || undefined,
    };
  }
}
