
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MinionConfig, ChatMessageData, MessageSender, Channel, ChannelPayload, ApiKey } from './types';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import MinionsPanel from './components/ConfigPanel';
import ChannelList from './components/ChannelList';
import AutoChatControls from './components/AutoChatControls';
import { CogIcon } from './components/Icons';
import { APP_TITLE, LEGION_COMMANDER_NAME, ACTIVE_CHANNEL_STORAGE_KEY } from './constants';
import legionApiService from './services/legionApiService';

const App: React.FC = () => {
  const [minionConfigs, setMinionConfigs] = useState<MinionConfig[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessageData[]>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  
  const [isMinionsPanelOpen, setIsMinionsPanelOpen] = useState(false);
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const [activeMinionProcessors, setActiveMinionProcessors] = useState<Record<string, boolean>>({});

  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const autoChatTimeoutRef = useRef<number | null>(null);
  const service = useRef(legionApiService).current;

  // --- Data Loading and Persistence ---
  useEffect(() => {
    const loadInitialData = async () => {
      const fetchedMinions = await service.getMinions();
      setMinionConfigs(fetchedMinions);
      
      const fetchedKeys = await service.getApiKeys();
      setApiKeys(fetchedKeys);

      const fetchedChannels = await service.getChannels();
      setChannels(fetchedChannels);

      let activeChannelId = localStorage.getItem(ACTIVE_CHANNEL_STORAGE_KEY);

      if (!activeChannelId && fetchedChannels.length > 0) {
        activeChannelId = fetchedChannels[0].id;
      }
      if (activeChannelId && fetchedChannels.some(c => c.id === activeChannelId)) {
        await selectChannel(activeChannelId);
      } else if (fetchedChannels.length > 0) {
        await selectChannel(fetchedChannels[0].id);
      } else {
        // This case handles a completely fresh start
        const generalChannel = await service.addChannel({ name: '#general', type: 'user_minion_group', members: [LEGION_COMMANDER_NAME] });
        setChannels(prev => [...prev, ...service.getInitialChannels().filter(ic => ic.id !== 'general')]);
        await selectChannel(generalChannel.id);
      }
    };
    
    loadInitialData();
    
    return () => {
      if (autoChatTimeoutRef.current) clearTimeout(autoChatTimeoutRef.current);
    };
  }, [service]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages, activeMinionProcessors]);

  useEffect(() => {
    if (currentChannelId) {
      localStorage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, currentChannelId);
    }
  }, [currentChannelId]);

  // --- API Key Management ---
  const handleAddApiKey = async (name: string, key: string) => {
    await service.addApiKey(name, key);
    setApiKeys(await service.getApiKeys());
  };
  const handleDeleteApiKey = async (id: string) => {
    await service.deleteApiKey(id);
    setApiKeys(await service.getApiKeys());
  };

  // --- Minion Management ---
  const addMinionConfig = async (config: MinionConfig) => {
    await service.addMinion(config);
    setMinionConfigs(await service.getMinions());
  };
  const updateMinionConfig = async (updatedConfig: MinionConfig) => {
    await service.updateMinion(updatedConfig);
    setMinionConfigs(await service.getMinions());
  };
  const deleteMinionConfig = async (id: string) => {
    await service.deleteMinion(id);
    setMinionConfigs(await service.getMinions());
    setChannels(await service.getChannels()); // Also update channels as member lists might change
  };

  // --- Message Management (Robust Functional Updates) ---
  const handleMessageUpdate = useCallback((channelId: string, messageId: string, updates: Partial<ChatMessageData>) => {
    setMessages(prevMessages => ({
      ...prevMessages,
      [channelId]: (prevMessages[channelId] || []).map(m => 
        m.id === messageId ? { ...m, ...updates } : m
      ),
    }));
  }, []);

  const handleMessageAdd = useCallback((channelId: string, message: ChatMessageData) => {
    setMessages(prevMessages => {
        const channelMessages = prevMessages[channelId] || [];
        // Prevent adding a message that already exists (e.g., from a rapid retry)
        if (channelMessages.some(m => m.id === message.id)) {
            return prevMessages;
        }
        return {
            ...prevMessages,
            [channelId]: [...channelMessages, message],
        };
    });
  }, []);

  const handleMessageChunk = useCallback((channelId: string, messageId: string, chunk: string) => {
      setMessages(prevMessages => ({
        ...prevMessages,
        [channelId]: (prevMessages[channelId] || []).map(m => 
          m.id === messageId ? { ...m, content: m.content + chunk } : m
        ),
      }));
  }, []);

  const handleMessageUpsert = useCallback((message: ChatMessageData) => {
     setMessages(prevMessages => {
        const channelMessages = prevMessages[message.channelId] || [];
        const existingMsgIndex = channelMessages.findIndex(m => m.id === message.id);

        if (existingMsgIndex > -1) {
            // Update existing message
            const newChannelMessages = [...channelMessages];
            newChannelMessages[existingMsgIndex] = { ...newChannelMessages[existingMsgIndex], ...message };
            return { ...prevMessages, [message.channelId]: newChannelMessages };
        } else {
            // Add new message
            return { ...prevMessages, [message.channelId]: [...channelMessages, message] };
        }
     });
  }, []);
  
  const deleteMessageFromChannel = async (channelId: string, messageId: string) => {
    await service.deleteMessage(channelId, messageId);
    setMessages(prev => ({...prev, [channelId]: (prev[channelId] || []).filter(m => m.id !== messageId) }));
  };
  const editMessageContent = async (channelId: string, messageId: string, newContent: string) => {
    await service.editMessage(channelId, messageId, newContent);
    handleMessageUpdate(channelId, messageId, { content: newContent });
  };
  
  // --- Channel Management ---
  const selectChannel = async (channelId: string) => {
    if (autoChatTimeoutRef.current) clearTimeout(autoChatTimeoutRef.current);
    if (!messages[channelId]) {
      const channelMessages = await service.getMessages(channelId);
      setMessages(prev => ({...prev, [channelId]: channelMessages}));
    }
    setCurrentChannelId(channelId);
  };
  
  const handleAddOrUpdateChannel = async (channelData: ChannelPayload) => {
    if (channelData.id) {
      await service.updateChannel(channelData as Channel);
    } else {
      await service.addChannel(channelData);
    }
    setChannels(await service.getChannels());
  };


  // --- Core Message Sending Logic ---
  const handleSendMessage = async (userInput: string) => {
    if (!currentChannelId || isProcessingMessage) return;
    setIsProcessingMessage(true);

    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`, channelId: currentChannelId, senderType: MessageSender.User,
      senderName: LEGION_COMMANDER_NAME, content: userInput, timestamp: Date.now(),
    };
    handleMessageAdd(currentChannelId, userMessage);

    await service.handleUserMessage({
      channelId: currentChannelId, message: userMessage,
      onMinionResponse: handleMessageUpsert,
      onMinionResponseChunk: handleMessageChunk,
      onMinionProcessingUpdate: (minionName, isProcessing) => {
        setActiveMinionProcessors(prev => ({ ...prev, [minionName]: isProcessing }));
      },
      onSystemMessage: (systemMessage) => handleMessageAdd(systemMessage.channelId, systemMessage),
    });

    setIsProcessingMessage(false);
  };
  
  // --- Autonomous Chat Loop ---
  const runAutoChatTurn = useCallback(async () => {
    if (!currentChannelId) return;
    setIsProcessingMessage(true);
    await service.triggerNextAutoChatTurn(
        currentChannelId,
        handleMessageUpsert,
        handleMessageChunk,
        (minionName, isProcessing) => {
          setActiveMinionProcessors(prev => ({ ...prev, [minionName]: isProcessing }));
        },
        (systemMessage) => handleMessageAdd(systemMessage.channelId, systemMessage)
    );
    setIsProcessingMessage(false);
  }, [currentChannelId, handleMessageUpsert, handleMessageChunk, handleMessageAdd]);

  useEffect(() => {
    const channel = channels.find(c => c.id === currentChannelId);
    if (channel?.type === 'minion_minion_auto' && channel.isAutoModeActive && !isProcessingMessage) {
      const delay = channel.autoModeDelayType === 'random' 
        ? (Math.random() * ((channel.autoModeRandomDelay?.max || 10) - (channel.autoModeRandomDelay?.min || 3)) + (channel.autoModeRandomDelay?.min || 3)) * 1000
        : (channel.autoModeFixedDelay || 5) * 1000;
        
      autoChatTimeoutRef.current = window.setTimeout(runAutoChatTurn, delay);
    }
    return () => {
      if (autoChatTimeoutRef.current) {
        clearTimeout(autoChatTimeoutRef.current);
      }
    };
  }, [currentChannelId, channels, messages, isProcessingMessage, runAutoChatTurn]);

  const handleTogglePlayPause = (isActive: boolean) => {
    if (!currentChannelId) return;
    const channel = channels.find(c => c.id === currentChannelId);
    if (channel) {
      handleAddOrUpdateChannel({ ...channel, isAutoModeActive: isActive, members: channel.members });
    }
  };

  const handleDelayChange = (type: 'fixed' | 'random', value: number | { min: number, max: number }) => {
    if (!currentChannelId) return;
    const channel = channels.find(c => c.id === currentChannelId);
    if (channel) {
      const updates: Partial<Channel> = { autoModeDelayType: type };
      if (type === 'fixed' && typeof value === 'number') {
        updates.autoModeFixedDelay = value;
      } else if (type === 'random' && typeof value === 'object') {
        updates.autoModeRandomDelay = value;
      }
      handleAddOrUpdateChannel({ ...channel, ...updates, members: channel.members });
    }
  };
  
  const currentChannel = channels.find(c => c.id === currentChannelId);
  const currentChannelMessages = messages[currentChannelId || ''] || [];
  const allMinionNames = minionConfigs.map(m => m.name);

  // Derive a set of minions currently processing in the current channel
  const processingMinionNames = Object.entries(activeMinionProcessors)
    .filter(([name, isProcessing]) => isProcessing && currentChannel?.members.includes(name))
    .map(([name]) => name);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-200 selection:bg-sky-500 selection:text-white overflow-hidden">
      <header className="p-3 bg-gray-800 border-b border-gray-700 shadow-md flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <img src="https://picsum.photos/seed/legionicon/40/40" alt="Legion Icon" className="w-10 h-10 rounded-full ring-2 ring-sky-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-100">{APP_TITLE}</h1>
            <p className="text-xs text-sky-400">Commander: {LEGION_COMMANDER_NAME}</p>
          </div>
        </div>
        <button
          onClick={() => setIsMinionsPanelOpen(!isMinionsPanelOpen)}
          className="p-2 rounded-md text-gray-400 hover:text-sky-400 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
          title="Toggle Minions Roster"
        >
          <CogIcon className="w-6 h-6" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <ChannelList 
            channels={channels} 
            currentChannelId={currentChannelId} 
            onSelectChannel={selectChannel} 
            onAddOrUpdateChannel={handleAddOrUpdateChannel}
            allMinionNames={allMinionNames}
        />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentChannel ? (
            <>
              <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-200">{currentChannel.name}</h3>
                  <p className="text-xs text-gray-400">{currentChannel.description}</p>
                </div>
                {currentChannel.type === 'minion_minion_auto' && (
                  <AutoChatControls channel={currentChannel} onTogglePlayPause={handleTogglePlayPause} onDelayChange={handleDelayChange} />
                )}
              </div>
              <div ref={chatHistoryRef} className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
                {currentChannelMessages.length === 0 && (
                  <div className="text-center text-gray-500 pt-10">
                    <p>No messages in <span className="font-semibold">{currentChannel.name}</span> yet.</p>
                  </div>
                )}
                {currentChannelMessages.map(msg => (
                  <ChatMessage key={msg.id} message={msg} onDelete={deleteMessageFromChannel} onEdit={editMessageContent}
                    isProcessing={msg.isProcessing}
                  />
                ))}
                 {processingMinionNames
                    // Filter out minions that already have a placeholder message in the chat
                    .filter(name => !currentChannelMessages.some(m => m.senderName === name && m.isProcessing))
                    .map(name => (
                        <ChatMessage key={`proc-${name}`} message={{ id: `proc-${name}`, channelId: currentChannelId!, senderName: name, senderType: MessageSender.AI, content: '', timestamp: Date.now(), isProcessing: true }} onDelete={()=>{}} onEdit={()=>{}} />
                    ))
                 }
              </div>
              <ChatInput onSendMessage={handleSendMessage} isSending={isProcessingMessage} disabled={currentChannel.type === 'minion_minion_auto' && currentChannel.isAutoModeActive} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500"><p>Select or create a channel to begin.</p></div>
          )}
        </main>

        <MinionsPanel 
            minionConfigs={minionConfigs} 
            apiKeys={apiKeys}
            onAddMinion={addMinionConfig} 
            onUpdateMinion={updateMinionConfig}
            onDeleteMinion={deleteMinionConfig} 
            onAddApiKey={handleAddApiKey}
            onDeleteApiKey={handleDeleteApiKey}
            isOpen={isMinionsPanelOpen} 
            onToggle={() => setIsMinionsPanelOpen(!isMinionsPanelOpen)} 
        />
      </div>
    </div>
  );
};

export default App;
