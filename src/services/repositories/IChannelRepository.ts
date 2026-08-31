/**
 * FABRE AUTOMATION - Channel Repository Interface
 * Release 2: Supabase Persistence Foundation
 */

import { ChannelConnection, IntegrationCardConfig } from '../../types';

export interface IChannelRepository {
  getConnections(): Promise<Record<'instagram' | 'messenger' | 'whatsapp', ChannelConnection>>;
  getConnection(channel: 'instagram' | 'messenger' | 'whatsapp'): Promise<ChannelConnection>;
  getIntegrations(): Promise<IntegrationCardConfig[]>;
  updateConnectionStatus(channel: 'instagram' | 'messenger' | 'whatsapp', status: ChannelConnection['status'], message?: string): Promise<ChannelConnection>;
  updateConnection(channel: 'instagram' | 'messenger' | 'whatsapp', updates: Partial<ChannelConnection>): Promise<ChannelConnection>;
}
