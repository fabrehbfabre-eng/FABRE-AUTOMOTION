/**
 * FABRE AUTOMATION - Meta Graph API Service Abstraction
 * Release 1: Foundation & Architecture
 * 
 * Prepared for official Meta Graph API (Instagram Direct & Messenger) in Release 2.
 * Decoupled interface contract without active external API calls.
 */

import { IMetaService } from './types';

export class MetaService implements IMetaService {
  async checkStatus(): Promise<{ instagram: boolean; messenger: boolean; error?: string }> {
    return {
      instagram: false,
      messenger: false,
      error: 'Canal aguardando conexão oficial do Meta App na Release 2',
    };
  }

  verifyWebhook(hubChallenge: string, _hubToken: string): boolean {
    return Boolean(hubChallenge);
  }

  async sendDirectMessage(_recipientId: string, text: string): Promise<{ success: boolean; messageId?: string }> {
    // Contract stub for Meta Graph API Send API
    console.info('[MetaService Mock] Prepared for sendDirectMessage:', text);
    return {
      success: true,
      messageId: `meta_msg_${Date.now()}`,
    };
  }
}

export const metaService = new MetaService();
