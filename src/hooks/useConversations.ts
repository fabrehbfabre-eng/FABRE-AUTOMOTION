/**
 * FABRE AUTOMATION - Conversation Management Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { Conversation, Message, ChannelType } from '../types';
import { conversationService } from '../services';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<ChannelType | 'all'>('all');
  const [handlerFilter, setHandlerFilter] = useState<'all' | 'bot' | 'human'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await conversationService.getConversations();
      setConversations(data);
      if (!activeConversationId && data.length > 0) {
        setActiveConversationId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  }, [activeConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages whenever active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const msgs = await conversationService.getMessages(activeConversationId);
        setMessages(msgs);
      } catch (err) {
        console.error('Failed to load messages', err);
      }
    };

    fetchMessages();
  }, [activeConversationId]);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  const sendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim()) return;
    try {
      const newMsg = await conversationService.sendMessage(activeConversationId, content, 'user');
      setMessages(prev => [...prev, newMsg]);
      // refresh conversations list for updated timestamps
      const updated = await conversationService.getConversations();
      setConversations(updated);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const toggleHandler = async (handler: 'bot' | 'human') => {
    if (!activeConversationId) return;
    try {
      const updated = await conversationService.toggleHandler(activeConversationId, handler);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? updated : c));
      // Reload messages to see the handoff system event
      const msgs = await conversationService.getMessages(activeConversationId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to toggle handler', err);
    }
  };

  const updateStatus = async (status: Conversation['status']) => {
    if (!activeConversationId) return;
    try {
      const updated = await conversationService.updateStatus(activeConversationId, status);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? updated : c));
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (handlerFilter !== 'all' && c.handler !== handlerFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = c.contact.name.toLowerCase().includes(q);
      const matchUsername = c.contact.username.toLowerCase().includes(q);
      const matchLastMsg = c.lastMessage?.content.toLowerCase().includes(q);
      const matchTags = c.tags.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchUsername && !matchLastMsg && !matchTags) return false;
    }
    return true;
  });

  return {
    conversations: filteredConversations,
    allConversations: conversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    messages,
    loading,
    channelFilter,
    setChannelFilter,
    handlerFilter,
    setHandlerFilter,
    searchQuery,
    setSearchQuery,
    sendMessage,
    toggleHandler,
    updateStatus,
    refresh: loadConversations,
  };
}
