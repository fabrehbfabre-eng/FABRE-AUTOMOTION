/**
 * FABRE AUTOMATION - Conversation Management Hook
 * Release: Supabase Realtime | Live Inbox
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Keep a stable ref to activeConversationId for realtime callbacks without resubscribing
  const activeIdRef = useRef<string | null>(activeConversationId);
  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await conversationService.getConversations();
      setConversations(data);
      setActiveConversationId(prev => prev || (data.length > 0 ? data[0].id : null));
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Supabase Realtime: Live Inbox subscription for new messages (INSERT on messages)
  useEffect(() => {
    if (typeof conversationService.subscribeToNewMessages !== 'function') {
      return;
    }

    const unsubscribe = conversationService.subscribeToNewMessages((newMsg: Message) => {
      // 1. If currently viewing this conversation, append new message avoiding duplicates
      if (activeIdRef.current === newMsg.conversationId) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id || (newMsg.externalEventId && m.externalEventId === newMsg.externalEventId))) {
            return prev;
          }
          return [...prev, newMsg];
        });
      }

      // 2. Update conversation list: update lastMessage, timestamp, and reorder to top
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === newMsg.conversationId);
        if (index !== -1) {
          const currentConv = prev[index];
          const isCurrentlyActive = activeIdRef.current === currentConv.id;
          const updatedConv: Conversation = {
            ...currentConv,
            lastMessage: newMsg,
            updatedAt: newMsg.createdAt || new Date().toISOString(),
            unreadCount: isCurrentlyActive ? currentConv.unreadCount : (currentConv.unreadCount || 0) + 1,
          };

          const remaining = prev.filter((_, i) => i !== index);
          return [updatedConv, ...remaining];
        } else {
          // If conversation is brand new, fetch it from repository
          conversationService.getConversationById(newMsg.conversationId)
            .then(fetched => {
              if (fetched) {
                setConversations(current => {
                  if (current.some(c => c.id === fetched.id)) return current;
                  return [{ ...fetched, lastMessage: newMsg }, ...current];
                });
              }
            })
            .catch(err => {
              console.warn('[LiveInbox] Failed to fetch newly created conversation:', err);
            });
          return prev;
        }
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  const sendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim()) return;
    try {
      const newMsg = await conversationService.sendMessage(activeConversationId, content, 'user');
      setMessages(prev => (prev.some(m => m.id === newMsg.id || (newMsg.externalEventId && m.externalEventId === newMsg.externalEventId)) ? prev : [...prev, newMsg]));
      // Update conversations list for updated timestamps
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === activeConversationId);
        if (index === -1) return prev;
        const currentConv = prev[index];
        const updatedConv: Conversation = {
          ...currentConv,
          lastMessage: newMsg,
          updatedAt: newMsg.createdAt,
        };
        const remaining = prev.filter((_, i) => i !== index);
        return [updatedConv, ...remaining];
      });
      return newMsg;
    } catch (err) {
      console.error('[useConversations] Failed to send message:', err);
      throw err;
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
