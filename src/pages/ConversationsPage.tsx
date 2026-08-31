/**
 * FABRE AUTOMATION - Conversations Page (Inbox)
 * Release 1: Foundation & Architecture
 */

import React, { useState } from 'react';
import { ConversationList } from '../components/conversations/ConversationList';
import { ConversationView } from '../components/conversations/ConversationView';
import { ConversationDetailSidebar } from '../components/conversations/ConversationDetailSidebar';
import { useConversations } from '../hooks/useConversations';

interface ConversationsPageProps {
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
}

export const ConversationsPage: React.FC<ConversationsPageProps> = ({
  selectedId,
  onSelectId,
}) => {
  const {
    conversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    messages,
    channelFilter,
    setChannelFilter,
    handlerFilter,
    setHandlerFilter,
    searchQuery,
    setSearchQuery,
    sendMessage,
    toggleHandler,
    updateStatus,
  } = useConversations();

  const [showDetailSidebar, setShowDetailSidebar] = useState(true);

  const currentActiveId = selectedId || activeConversationId;
  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    if (onSelectId) onSelectId(id);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-neutral-950">
      {/* 1. Left: Conversation Inbox List */}
      <ConversationList
        conversations={conversations}
        activeId={currentActiveId}
        onSelect={handleSelect}
        channelFilter={channelFilter}
        onChannelFilterChange={setChannelFilter}
        handlerFilter={handlerFilter}
        onHandlerFilterChange={setHandlerFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 2. Middle: Active Conversation Thread */}
      <ConversationView
        conversation={activeConversation}
        messages={messages}
        onSendMessage={sendMessage}
        onToggleHandler={toggleHandler}
        onUpdateStatus={updateStatus}
        onToggleSidebar={() => setShowDetailSidebar(!showDetailSidebar)}
        showSidebar={showDetailSidebar}
      />

      {/* 3. Right: Contact Detail Sidebar (Collapsible) */}
      {showDetailSidebar && (
        <ConversationDetailSidebar
          conversation={activeConversation}
          onClose={() => setShowDetailSidebar(false)}
        />
      )}
    </div>
  );
};
