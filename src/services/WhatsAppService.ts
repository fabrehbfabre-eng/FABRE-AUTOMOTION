/**
 * FABRE AUTOMATION - WhatsApp Cloud API Service Abstraction
 * Release 1: Foundation & Architecture
 * 
 * Prepared for official WhatsApp Business Cloud API in Release 2.
 * Decoupled interface contract without active external API calls.
 */

import { IWhatsAppService } from './types';

export class WhatsAppService implements IWhatsAppService {
  async checkStatus(): Promise<{ whatsapp: boolean; error?: string }> {
    return {
      whatsapp: false,
      error: 'WhatsApp Business Cloud API aguardando credenciais na Release 2',
    };
  }

  async sendWhatsAppMessage(phoneNumber: string, text: string): Promise<{ success: boolean; messageId?: string }> {
    console.info('[WhatsAppService Mock] Prepared for sendWhatsAppMessage to:', phoneNumber, text);
    return {
      success: true,
      messageId: `wa_msg_${Date.now()}`,
    };
  }

  async sendTemplateMessage(phoneNumber: string, templateName: string, params: Record<string, string>): Promise<{ success: boolean }> {
    console.info('[WhatsAppService Mock] Prepared for sendTemplateMessage:', templateName, params);
    return {
      success: true,
    };
  }
}

export const whatsAppService = new WhatsAppService();
