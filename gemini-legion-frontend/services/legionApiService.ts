
import { MinionConfig, ChatMessageData, MessageSender, Channel, ModelOption, PerceptionPlan, ChannelPayload, ApiKey, SelectedKeyInfo } from '../types';
import { 
    LEGION_COMMANDER_NAME, 
    MINION_CONFIGS_STORAGE_KEY, 
    CHAT_HISTORY_STORAGE_KEY,
    CHANNELS_STORAGE_KEY,
    API_KEYS_STORAGE_KEY,
    RESPONSE_GENERATION_PROMPT_TEMPLATE,
    PERCEPTION_AND_PLANNING_PROMPT_TEMPLATE,
    formatChatHistoryForLLM,
    GEMINI_MODELS_OPTIONS
} from '../constants';
import { callGeminiAPIStream, callGeminiApiForJson } from './geminiService'; 

// Helper to get data from localStorage or return default
const getStoredData = <T>(key: string, defaultValue: T): T => {
  const saved = localStorage.getItem(key);
  if (saved === null || saved === 'undefined') {
    return defaultValue;
  }
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error(`Error parsing stored data for key ${key}, returning default. Error:`, error);
    localStorage.setItem(`${key}_corrupted_${Date.now()}`, saved);
    localStorage.removeItem(key);
    return defaultValue;
  }
};

// Helper to set data to localStorage
const setStoredData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save data for key ${key} to localStorage. Error:`, error);
  }
};


export interface HandleUserMessageParams {
  channelId: string;
  message: ChatMessageData;
  onMinionResponse: (message: ChatMessageData) => void;
  onMinionResponseChunk: (channelId: string, messageId: string, chunk: string) => void;
  onMinionProcessingUpdate: (minionName: string, isProcessing: boolean) => void;
  onSystemMessage: (message: ChatMessageData) => void;
}

class LegionApiService {
  private minionConfigs: MinionConfig[];
  private channels: Channel[];
  private messages: Record<string, ChatMessageData[]>;
  private apiKeys: ApiKey[];
  private apiKeyRoundRobinIndex = 0;

  constructor() {
    this.minionConfigs = getStoredData<MinionConfig[]>(MINION_CONFIGS_STORAGE_KEY, []);
    this.channels = getStoredData<Channel[]>(CHANNELS_STORAGE_KEY, this.getInitialChannels());
    this.messages = getStoredData<Record<string, ChatMessageData[]>>(CHAT_HISTORY_STORAGE_KEY, {});
    this.apiKeys = getStoredData<ApiKey[]>(API_KEYS_STORAGE_KEY, []);

    // Ensure default log channel has its init message if message history is empty
    if (!this.messages['legion_ops_log']) {
        this.messages['legion_ops_log'] = [
            { id: `sys-init-${Date.now()}`, channelId: 'legion_ops_log', senderType: MessageSender.System, senderName: 'LegionOS', content: 'Legion Command Interface Initialized.', timestamp: Date.now() }
        ];
    }
  }

  getInitialChannels(): Channel[] {
      return [
        { id: 'general', name: '#general', description: 'General discussion with all Minions.', type: 'user_minion_group', members: [LEGION_COMMANDER_NAME, ...this.minionConfigs.map(m=>m.name)] },
        { id: 'legion_ops_log', name: '#legion_ops_log', description: 'Automated Legion operational logs.', type: 'system_log', members: [] },
      ];
  }

  private saveState() {
    setStoredData(MINION_CONFIGS_STORAGE_KEY, this.minionConfigs);
    setStoredData(CHANNELS_STORAGE_KEY, this.channels);
    setStoredData(CHAT_HISTORY_STORAGE_KEY, this.messages);
    setStoredData(API_KEYS_STORAGE_KEY, this.apiKeys);
  }

  // --- API Key Management ---
  async getApiKeys(): Promise<ApiKey[]> {
    return Promise.resolve([...this.apiKeys]);
  }

  async addApiKey(name: string, key: string): Promise<void> {
    if (!name.trim() || !key.trim()) throw new Error("API Key and Name cannot be empty.");
    this.apiKeys.push({ id: `key-${Date.now()}`, name, key });
    this.saveState();
    return Promise.resolve();
  }

  async deleteApiKey(id: string): Promise<void> {
    this.minionConfigs.forEach(minion => {
        if (minion.apiKeyId === id) {
            minion.apiKeyId = undefined;
        }
    });
    this.apiKeys = this.apiKeys.filter(k => k.id !== id);
    this.saveState();
    return Promise.resolve();
  }

  private _selectApiKey(minion?: MinionConfig): SelectedKeyInfo {
    if (minion?.apiKeyId) {
        const specificKey = this.apiKeys.find(k => k.id === minion.apiKeyId);
        if (specificKey) return { key: specificKey.key, name: specificKey.name, method: 'Assigned' };
    }
    if (this.apiKeys.length > 0) {
        const keyInfo = this.apiKeys[this.apiKeyRoundRobinIndex];
        this.apiKeyRoundRobinIndex = (this.apiKeyRoundRobinIndex + 1) % this.apiKeys.length;
        return { key: keyInfo.key, name: keyInfo.name, method: 'Load Balanced' };
    }
    return { key: '', name: 'N/A', method: 'None' }; // No key available
  }
  
  private _createApiKeyLogMessage(channelId: string, minionName: string, keyInfo: SelectedKeyInfo, stage: 'Perception' | 'Response'): ChatMessageData {
    return {
      id: `sys-keylog-${minionName}-${Date.now()}`,
      channelId,
      senderType: MessageSender.System,
      senderName: "System",
      content: `${minionName} is using key '${keyInfo.name}' (${keyInfo.method}) for ${stage}.`,
      timestamp: Date.now(),
      isApiKeyLog: true,
    };
  }

  // --- Minion Management ---
  async getMinions(): Promise<MinionConfig[]> {
    return Promise.resolve([...this.minionConfigs]);
  }

  async addMinion(config: MinionConfig): Promise<MinionConfig> {
    const newMinionName = config.name;

    this.minionConfigs.forEach(existingMinion => {
      existingMinion.opinionScores[newMinionName] = 50;
    });

    const initialScoresForNewMinion: Record<string, number> = { [LEGION_COMMANDER_NAME]: 50 };
    this.minionConfigs.forEach(existingMinion => {
      initialScoresForNewMinion[existingMinion.name] = 50;
    });

    const newMinion: MinionConfig = { 
        ...config, 
        id: config.id || `minion-${Date.now()}`,
        opinionScores: initialScoresForNewMinion,
        status: 'Idle',
        lastDiaryState: null,
    };
    this.minionConfigs.push(newMinion);
    this.saveState();
    return Promise.resolve(newMinion);
  }

  async updateMinion(updatedConfig: MinionConfig): Promise<MinionConfig> {
    const index = this.minionConfigs.findIndex(m => m.id === updatedConfig.id);
    if (index === -1) throw new Error("Minion not found for update.");
    this.minionConfigs[index] = updatedConfig;
    this.saveState();
    return Promise.resolve(updatedConfig);
  }

  async deleteMinion(id: string): Promise<void> {
    const minionToDelete = this.minionConfigs.find(m => m.id === id);
    if (!minionToDelete) return Promise.resolve();
    
    this.minionConfigs = this.minionConfigs.filter(m => m.id !== id);
    this.minionConfigs.forEach(m => { delete m.opinionScores[minionToDelete.name]; });
    this.channels.forEach(c => { c.members = c.members.filter(name => name !== minionToDelete.name); });

    this.saveState();
    return Promise.resolve();
  }

  // --- Channel Management ---
  async getChannels(): Promise<Channel[]> {
    return Promise.resolve([...this.channels]);
  }
  
  async addChannel(channelData: ChannelPayload): Promise<Channel> {
    const newChannel: Channel = { 
        id: `channel-${Date.now()}`,
        name: channelData.name,
        type: channelData.type,
        description: channelData.description || '',
        isPrivate: false,
        members: channelData.members,
        isAutoModeActive: false,
        autoModeDelayType: 'fixed',
        autoModeFixedDelay: 5,
        autoModeRandomDelay: { min: 3, max: 10 },
    };
    this.channels.push(newChannel);
    if (!this.messages[newChannel.id]) this.messages[newChannel.id] = [];
    this.saveState();
    return Promise.resolve(newChannel);
  }

  async updateChannel(updatedChannelData: ChannelPayload & {id: string}): Promise<Channel> {
    const index = this.channels.findIndex(c => c.id === updatedChannelData.id);
    if (index === -1) throw new Error("Channel not found for update.");
    const existingChannel = this.channels[index];
    this.channels[index] = {...existingChannel, ...updatedChannelData};
    this.saveState();
    return Promise.resolve(this.channels[index]);
  }

  // --- Message Management ---
  async getMessages(channelId: string): Promise<ChatMessageData[]> {
    return Promise.resolve([...(this.messages[channelId] || [])]);
  }
  
  async handleUserMessage(params: HandleUserMessageParams): Promise<void> {
    const { channelId, message: userMessage, onMinionResponse, onMinionResponseChunk, onMinionProcessingUpdate, onSystemMessage } = params;
    
    // Add user message to service's internal state
    if (!this.messages[channelId]) this.messages[channelId] = [];
    this.messages[channelId].push(userMessage);

    const activeChannel = this.channels.find(c => c.id === channelId);
    if (!activeChannel) return;

    const minionsInChannel = this.minionConfigs.filter(minion => activeChannel.members.includes(minion.name));
    if (minionsInChannel.length === 0) return;

    const initialChatHistory = formatChatHistoryForLLM(this.messages[channelId], channelId);
    minionsInChannel.forEach(m => onMinionProcessingUpdate(m.name, true));

    const perceptionPromises = minionsInChannel.map(minion => {
        const keyInfo = this._selectApiKey(minion);
        onSystemMessage(this._createApiKeyLogMessage(channelId, minion.name, keyInfo, 'Perception'));

        if (!keyInfo.key) return Promise.resolve({ minion, plan: null, error: "No API key available." });

        const perceptionPrompt = PERCEPTION_AND_PLANNING_PROMPT_TEMPLATE(
            minion.name, minion.system_prompt_persona, JSON.stringify(minion.lastDiaryState || {}),
            JSON.stringify(minion.opinionScores, null, 2), initialChatHistory, userMessage.senderName, activeChannel.type
        );
        return callGeminiApiForJson(perceptionPrompt, minion.model_id, minion.params.temperature, keyInfo.key)
            .then(({ plan, error }) => ({ minion, plan, error }));
    });
    
    const perceptionResults = await Promise.all(perceptionPromises);
    const minionsWhoWillSpeak: { minion: MinionConfig, plan: PerceptionPlan }[] = [];

    for (const { minion, plan, error } of perceptionResults) {
        if (error || !plan) {
            onSystemMessage({
                id: `sys-err-${minion.id}-${Date.now()}`, channelId, senderType: MessageSender.System,
                senderName: 'System', content: `Error during ${minion.name}'s perception stage: ${error || 'No plan returned.'}`, timestamp: Date.now(), isError: true,
            });
            continue;
        }
        this.updateMinionState(minion.id, plan);
        if (plan.action === 'SPEAK') minionsWhoWillSpeak.push({ minion, plan });
        else onSystemMessage({ id: `sys-silent-${minion.id}-${Date.now()}`, channelId, senderType: MessageSender.System, senderName: 'System', content: `${minion.name} chose to remain silent.`, timestamp: Date.now() });
    }
    
    // Once all perceptions are done, mark processing as false for those who are silent
    minionsInChannel.forEach(m => {
      if (!minionsWhoWillSpeak.some(speaker => speaker.minion.id === m.id)) {
        onMinionProcessingUpdate(m.name, false);
      }
    });

    minionsWhoWillSpeak.sort((a, b) => a.plan.predictedResponseTime - b.plan.predictedResponseTime);

    let dynamicChatHistory = initialChatHistory;
    for (const { minion, plan } of minionsWhoWillSpeak) {
        const tempMessageId = `ai-${minion.id}-${Date.now()}`;
        const tempStreamingMessage: ChatMessageData = { id: tempMessageId, channelId, senderType: MessageSender.AI, senderName: minion.name, content: "", timestamp: Date.now(), isProcessing: true };
        onMinionResponse(tempStreamingMessage);

        const responseGenPrompt = RESPONSE_GENERATION_PROMPT_TEMPLATE(minion.name, minion.system_prompt_persona, dynamicChatHistory, plan);
        const keyInfo = this._selectApiKey(minion);
        onSystemMessage(this._createApiKeyLogMessage(channelId, minion.name, keyInfo, 'Response'));
        
        await this.runStreamingResponse(channelId, tempMessageId, minion, plan, responseGenPrompt, keyInfo, onMinionResponse, onMinionResponseChunk);
        
        const finalMessage = (this.messages[channelId] || []).find(m => m.id === tempMessageId);
        if (finalMessage) dynamicChatHistory += `\n[MINION ${minion.name}]: ${finalMessage.content}`;
        onMinionProcessingUpdate(minion.name, false);
    }
    this.saveState();
  }

  async triggerNextAutoChatTurn(
    channelId: string,
    onMinionResponse: (message: ChatMessageData) => void,
    onMinionResponseChunk: (channelId: string, messageId: string, chunk: string) => void,
    onMinionProcessingUpdate: (minionName: string, isProcessing: boolean) => void,
    onSystemMessage: (message: ChatMessageData) => void
  ): Promise<void> {
    const activeChannel = this.channels.find(c => c.id === channelId);
    if (!activeChannel || !activeChannel.isAutoModeActive) return;

    const minionsInChannel = this.minionConfigs.filter(minion => activeChannel.members.includes(minion.name));
    if (minionsInChannel.length < 2) {
      onSystemMessage({ id: `sys-auto-err-${Date.now()}`, channelId, senderType: MessageSender.System, senderName: 'System', content: `Auto-mode paused. Requires at least 2 minions in the channel.`, timestamp: Date.now() });
      return;
    }

    const currentMessages = this.messages[channelId] || [];
    const chatHistory = formatChatHistoryForLLM(currentMessages, channelId);
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (!lastMessage) return;

    minionsInChannel.forEach(m => onMinionProcessingUpdate(m.name, true));

    const perceptionPromises = minionsInChannel.map(minion => {
      if (minion.name === lastMessage.senderName) return Promise.resolve({ minion, plan: null, error: "Cannot respond to self." });
      
      const keyInfo = this._selectApiKey(minion);
      onSystemMessage(this._createApiKeyLogMessage(channelId, minion.name, keyInfo, 'Perception'));
      if (!keyInfo.key) return Promise.resolve({ minion, plan: null, error: "No API key available." });

      const prompt = PERCEPTION_AND_PLANNING_PROMPT_TEMPLATE( minion.name, minion.system_prompt_persona, JSON.stringify(minion.lastDiaryState || {}), JSON.stringify(minion.opinionScores), chatHistory, lastMessage.senderName, activeChannel.type );
      return callGeminiApiForJson(prompt, minion.model_id, minion.params.temperature, keyInfo.key).then(({ plan, error }) => ({ minion, plan, error }));
    });

    const results = await Promise.all(perceptionPromises);
    const speakers = results
      .filter((r): r is { minion: MinionConfig; plan: PerceptionPlan; error: undefined } => !!r.plan && r.plan.action === 'SPEAK')
      .sort((a, b) => a.plan.predictedResponseTime - b.plan.predictedResponseTime);

    const nextSpeaker = speakers[0];
    
    // Once perceptions are done, mark all as not processing initially
    minionsInChannel.forEach(m => onMinionProcessingUpdate(m.name, false));

    if (!nextSpeaker) {
      onSystemMessage({ id: `sys-auto-silent-${Date.now()}`, channelId, senderType: MessageSender.System, senderName: 'System', content: `All minions chose to remain silent this turn.`, timestamp: Date.now() });
      this.saveState();
      return;
    }

    const { minion, plan } = nextSpeaker;
    // Mark only the speaker as processing again
    onMinionProcessingUpdate(minion.name, true);
    
    const tempMessageId = `ai-${minion.id}-${Date.now()}`;
    const placeholderMessage: ChatMessageData = { id: tempMessageId, channelId, senderType: MessageSender.AI, senderName: minion.name, content: '', timestamp: Date.now(), isProcessing: true };
    onMinionResponse(placeholderMessage);

    const responsePrompt = RESPONSE_GENERATION_PROMPT_TEMPLATE(minion.name, minion.system_prompt_persona, chatHistory, plan);
    const keyInfo = this._selectApiKey(minion);
    onSystemMessage(this._createApiKeyLogMessage(channelId, minion.name, keyInfo, 'Response'));

    await this.runStreamingResponse(channelId, tempMessageId, minion, plan, responsePrompt, keyInfo, onMinionResponse, onMinionResponseChunk);
    
    onMinionProcessingUpdate(minion.name, false);
    this.saveState();
  }
  
  private async runStreamingResponse(
    channelId: string, messageId: string, minion: MinionConfig, plan: PerceptionPlan, prompt: string, keyInfo: SelectedKeyInfo,
    onMinionResponse: (message: ChatMessageData) => void, onMinionResponseChunk: (channelId: string, messageId: string, chunk: string) => void
  ): Promise<void> {
      let accumulatedContent = "";
      await new Promise<void>(resolve => {
          if(!keyInfo.key) {
             const errorMsg: ChatMessageData = { id: messageId, channelId, senderType: MessageSender.AI, senderName: minion.name, content: `Error: No API key available for response generation.`, timestamp: Date.now(), isError: true, isProcessing: false };
             onMinionResponse(errorMsg);
             this.messages[channelId] = (this.messages[channelId] || []).map(m => m.id === messageId ? errorMsg : m);
             resolve();
             return;
          }
          callGeminiAPIStream(
              prompt, minion.model_id, minion.params.temperature, keyInfo.key,
              (chunk, isFinal) => {
                  if (!isFinal) {
                      accumulatedContent += chunk;
                      onMinionResponseChunk(channelId, messageId, chunk);
                  } else {
                      const finalContent = accumulatedContent.trim();
                      const finalMessage: ChatMessageData = {
                          id: messageId, channelId, senderType: MessageSender.AI, senderName: minion.name,
                          content: finalContent, timestamp: Date.now(), internalDiary: plan, isProcessing: false,
                      };
                      onMinionResponse(finalMessage);
                      this.updateMinionState(minion.id, plan);
                      
                      const existingMessages = this.messages[channelId] || [];
                      const msgIndex = existingMessages.findIndex(m => m.id === messageId);
                      if (msgIndex > -1) {
                         existingMessages[msgIndex] = finalMessage;
                      } else {
                         existingMessages.push(finalMessage);
                      }
                       this.messages[channelId] = existingMessages;

                      resolve();
                  }
              },
              (errorMessage) => {
                  const errorMsg: ChatMessageData = { id: messageId, channelId, senderType: MessageSender.AI, senderName: minion.name, content: `Error: ${errorMessage}`, timestamp: Date.now(), isError: true, isProcessing: false };
                  onMinionResponse(errorMsg);
                  this.messages[channelId] = (this.messages[channelId] || []).map(m => m.id === messageId ? errorMsg : m);
                  resolve();
              }
          );
      });
  }

  private updateMinionState(minionId: string, plan: PerceptionPlan) {
      const minionIndex = this.minionConfigs.findIndex(m => m.id === minionId);
      if (minionIndex > -1) {
          this.minionConfigs[minionIndex].opinionScores = plan.finalOpinions;
          this.minionConfigs[minionIndex].lastDiaryState = plan;
      }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    this.messages[channelId] = (this.messages[channelId] || []).filter(m => m.id !== messageId);
    this.saveState();
  }

  async editMessage(channelId: string, messageId: string, newContent: string): Promise<void> {
    this.messages[channelId] = (this.messages[channelId] || []).map(m => 
        m.id === messageId ? { ...m, content: newContent } : m
    );
    this.saveState();
  }
}

const legionApiService = new LegionApiService();
export default legionApiService;
