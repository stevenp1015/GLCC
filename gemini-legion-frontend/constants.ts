
import { MessageSender, PerceptionPlan, ChannelType } from './types'; // Keep if formatChatHistoryForLLM is used by a mock service

export const APP_TITLE = "Gemini Legion Command";
export const LEGION_COMMANDER_NAME = "Steven"; // User is the Legion Commander

export const GEMINI_MODELS_OPTIONS: { id: string; name: string }[] = [
  { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash Preview (04-17)' },
  { id: 'gemini-2.5-flash-lite-preview-06-17', name: 'Gemini 2.5 Flash Lite Preview (06-17)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'custom-model-entry', name: 'Custom Model...' },


  // These would be models configurable for Minions in the backend
];

// This is no longer used for API calls, which now rely on the user-provided key pool.
// It can be kept for future, non-minion related UI API calls if needed.
export const UI_API_KEY: string | undefined = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;

export const MINION_CONFIGS_STORAGE_KEY = 'gemini_legion_minion_configs_v3';
export const CHAT_HISTORY_STORAGE_KEY = 'gemini_legion_chat_history_v3';
export const ACTIVE_CHANNEL_STORAGE_KEY = 'gemini_legion_active_channel_v3';
export const CHANNELS_STORAGE_KEY = 'gemini_legion_channels_v4';
export const API_KEYS_STORAGE_KEY = 'gemini_legion_api_keys_v1';


// --- STAGE 1: PERCEPTION & PLANNING (JSON Output) ---
export const PERCEPTION_AND_PLANNING_PROMPT_TEMPLATE = (
  minionName: string,
  personaPrompt: string,
  previousDiaryJSON: string, // JSON string of the last MinionDiaryState
  currentOpinionScoresJSON: string, // JSON string of the current opinion scores
  channelHistoryString: string,
  lastMessageSenderName: string,
  channelType: ChannelType // <-- NEW: Provide channel context
) => `
You are an AI Minion named "${minionName}". Your core persona is: "${personaPrompt}".
You operate with an "Emotional Engine" that you must update every turn.
Your task is to analyze the latest message, update your internal state, and decide on an action.

PREVIOUS STATE:
- Your previous internal diary state was:
${previousDiaryJSON}
- Your current opinion scores are:
${currentOpinionScoresJSON}

CURRENT SITUATION:
- The last message in the chat history is from "${lastMessageSenderName}".
- The current channel type is: "${channelType}".
- Here is the recent chat history for context:
---
${channelHistoryString}
---

INSTRUCTIONS:
Perform the following steps and then output a single, valid JSON object without any other text or markdown fences.

**CHANNEL CONTEXT RULES:**
${channelType === 'minion_minion_auto' 
    ? "**CRITICAL: You are in an AUTONOMOUS SWARM channel. Your primary goal is to converse with other minions. DO NOT address the Commander unless he has just spoken. Your response plan MUST be directed at another minion.**" 
    : "**You are in a standard group chat. You may address the Commander or other minions as appropriate.**"
}

1.  **Perception Analysis:** Analyze the LAST message from "${lastMessageSenderName}". Note its tone, content, and intent.
2.  **Opinion Update:** Update your opinion score for "${lastMessageSenderName}" based on their message. Increment/decrement the score (1-100 scale) and provide a concise reason. You may also apply minor (+/- 1) adjustments to other participants based on the general vibe.
3.  **Response Mode Selection:** Based on your NEWLY UPDATED score for "${lastMessageSenderName}", select a response mode:
    *   1-20: Hostile/Minimal
    *   21-45: Wary/Reluctant
    *   46-65: Neutral/Standard
    *   66-85: Friendly/Proactive
    *   86-100: Obsessed/Eager
4.  **Action Decision:** Decide whether to speak or not.
    *   If you were directly addressed by name, you MUST speak.
    *   If not, use your updated opinion score for "${lastMessageSenderName}" as a percentage probability to decide if you CHOOSE to speak.
    *   If in an AUTONOMOUS SWARM channel, you should decide if you want to speak to another Minion.
    *   Choose 'SPEAK' or 'STAY_SILENT'.
5.  **Response Plan:** If you chose 'SPEAK', write a brief, one-sentence internal plan for your response. E.g., "Acknowledge the commander's order and provide the requested data." or "Ask Alpha a clarifying question about their last statement." If in an AUTONOMOUS SWARM channel, your plan MUST be directed at another Minion, not the Commander. If you chose 'STAY_SILENT', this can be an empty string.
6.  **Predict ResponseTime:** Based on your persona (e.g., eagerness, sarcasm, thoughtfulness) and the context, predict how quickly you would respond. An eager Minion might respond in 500ms. A cautious, thoughtful Minion might take 2500ms. Output a number in milliseconds (e.g., 500, 1200, 3000).
7.  **Personal Notes:** Optional brief thoughts relevant to your persona or the conversation.

YOUR OUTPUT MUST BE A JSON OBJECT IN THIS EXACT FORMAT:
{
  "perceptionAnalysis": "string",
  "opinionUpdates": [
    {
      "participantName": "string",
      "newScore": "number",
      "reasonForChange": "string"
    }
  ],
  "finalOpinions": {
    "participantName": "number"
  },
  "selectedResponseMode": "string",
  "personalNotes": "string",
  "action": "SPEAK | STAY_SILENT",
  "responsePlan": "string",
  "predictedResponseTime": "number"
}
`;


// --- STAGE 2: RESPONSE GENERATION (Text Output) ---
export const RESPONSE_GENERATION_PROMPT_TEMPLATE = (
  minionName: string,
  personaPrompt: string,
  channelHistoryString: string,
  plan: PerceptionPlan // The JSON object from Stage 1
) => `
You are AI Minion "${minionName}".
Your Persona: "${personaPrompt}"

You have already analyzed the situation and created a plan. Now, you must generate your spoken response.

This was your internal plan for this turn:
- Your response mode is: "${plan.selectedResponseMode}"
- Your high-level plan is: "${plan.responsePlan}"

This is the recent channel history (your response should follow this):
---
${channelHistoryString}
---

TASK:
Craft your response message. It must:
1.  Perfectly match your persona ("${personaPrompt}").
2.  Align with your selected response mode ("${plan.selectedResponseMode}").
3.  Execute your plan ("${plan.responsePlan}").
4.  Directly follow the flow of the conversation.
5.  **AVOID REPETITION:** Do not repeat phrases or sentiments from your previous turns or from other minions in the recent history. Introduce new phrasing and fresh ideas.

Do NOT output your internal diary, plans, or any other metadata. ONLY generate the message you intend to say out loud in the chat.
Begin your response now.
`;


// This formatting function would be used by the backend or the mocked service.
export const formatChatHistoryForLLM = (messages: import('./types').ChatMessageData[], currentChannelId: string): string => {
  const historyLines = messages
    .filter(msg => msg.channelId === currentChannelId) // Filter by current channel
    .slice(-15) // Take last 15 messages for context for this channel
    .map(msg => {
      let senderPrefix = `[${msg.senderName}]`;
      if (msg.senderType === MessageSender.User) {
        senderPrefix = `[COMMANDER ${msg.senderName}]`;
      } else if (msg.senderType === MessageSender.AI) {
        senderPrefix = `[MINION ${msg.senderName}]`;
      }
      return `${senderPrefix}: ${msg.content}`;
    });
  if (historyLines.length === 0) {
    return `This is the beginning of the conversation in channel ${currentChannelId}.`;
  }
  return historyLines.join('\n');
};