
export interface ApiKey {
  id: string;
  name: string;
  key: string; // The actual API key value
}

export interface SelectedKeyInfo {
  key: string;
  name: string;
  method: 'Assigned' | 'Load Balanced' | 'None';
}

export interface MinionConfig {
  id: string;
  name: string; // Unique Minion name (e.g., "Alpha", "Bravo")
  provider: 'google'; // Assuming Gemini models via ADK backend
  model_id: string; // Specific model for this Minion
  model_name?: string; // Optional user-friendly name for the model
  system_prompt_persona: string; // The Minion's core personality and Fire Code
  params: {
    temperature: number;
    // Potentially other ADK-specific params in future
  };
  apiKeyId?: string; // Optional: Assign a specific key from the user's pool
  opinionScores: Record<string, number>; // Minion's opinion of others { participantName: score }
  lastDiaryState?: MinionDiaryState | null; // The last known structured diary state
  status?: string; // e.g., "Idle", "Processing Task X"
  currentTask?: string;
}

export enum MessageSender {
  User = 'User',
  AI = 'AI', // Represents a Minion
  System = 'System',
}

export interface MinionDiaryState {
  perceptionAnalysis: string;
  opinionUpdates: {
    participantName: string;
    newScore: number;
    reasonForChange: string;
  }[];
  finalOpinions: Record<string, number>;
  selectedResponseMode: string;
  personalNotes?: string;
}

export interface PerceptionPlan extends MinionDiaryState {
  action: 'SPEAK' | 'STAY_SILENT';
  responsePlan: string; // A brief summary of what the minion intends to say if it chooses to speak.
  predictedResponseTime: number; // Estimated time in ms for how quickly the Minion wants to respond.
}


export interface ChatMessageData {
  id:string;
  channelId: string; // ID of the channel this message belongs to
  senderType: MessageSender;
  senderName: string; // "Steven" for user, Minion's name for AI
  content: string;
  timestamp: number;
  internalDiary?: MinionDiaryState | null; // For Minion messages, now structured
  isError?: boolean;
  replyToMessageId?: string; // For threaded replies (future)
  isProcessing?: boolean; // New flag for typing indicator
  isApiKeyLog?: boolean; // New flag for API key logs
}

export interface ModelOption {
  id: string;
  name: string;
}

export type ChannelType = 'user_minion_group' | 'minion_minion_auto' | 'system_log';

export interface Channel {
  id:string;
  name: string; // e.g., "#general", "#commander_direct_alpha"
  description?: string;
  type: ChannelType;
  members: string[]; // IDs of Minions/User in this channel
  isPrivate?: boolean;
  
  // Properties for the new autonomous mode
  isAutoModeActive?: boolean;
  autoModeDelayType?: 'fixed' | 'random';
  autoModeFixedDelay?: number; // in seconds
  autoModeRandomDelay?: { min: number, max: number }; // in seconds
}

export interface ChannelPayload extends Omit<Channel, 'id' | 'members'> {
  id?: string;
  members: string[];
}


// Environment variable access (still relevant for UI's own potential key)
export interface ProcessEnv {
  API_KEY?: string;
}