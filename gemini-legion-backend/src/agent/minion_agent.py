# gemini-legion-backend/src/agent/minion_agent.py

from adk.core.agent import LlmAgent
from adk.core.llm_provider import LlmProvider
from adk.llm_provider.gemini import GeminiLlmProvider
from adk.core.prompts import Prompt, PromptBuilder
import json
from typing import Optional, Tuple, Dict, Any

from src.models.api_models import PerceptionPlan

# --- Prompt Templates Translation from constants.ts ---

PERCEPTION_AND_PLANNING_PROMPT_TEMPLATE = """
You are an AI Minion named "{minion_name}". Your core persona is: "{persona_prompt}".
You operate with an "Emotional Engine" that you must update every turn.
Your task is to analyze the latest message, update your internal state, and decide on an action.

PREVIOUS STATE:
- Your previous internal diary state was:
{previous_diary_json}
- Your current opinion scores are:
{current_opinion_scores_json}

CURRENT SITUATION:
- The last message in the chat history is from "{last_message_sender_name}".
- The current channel type is: "{channel_type}".
- Here is the recent chat history for context:
---
{channel_history_string}
---

INSTRUCTIONS:
Perform the following steps and then output a single, valid JSON object without any other text or markdown fences.

**CHANNEL CONTEXT RULES:**
{channel_context_rule}

1.  **Perception Analysis:** Analyze the LAST message from "{last_message_sender_name}". Note its tone, content, and intent.
2.  **Opinion Update:** Update your opinion score for "{last_message_sender_name}" based on their message. Increment/decrement the score (1-100 scale) and provide a concise reason. You may also apply minor (+/- 1) adjustments to other participants based on the general vibe.
3.  **Response Mode Selection:** Based on your NEWLY UPDATED score for "{last_message_sender_name}", select a response mode:
    *   1-20: Hostile/Minimal
    *   21-45: Wary/Reluctant
    *   46-65: Neutral/Standard
    *   66-85: Friendly/Proactive
    *   86-100: Obsessed/Eager
4.  **Action Decision:** Decide whether to speak or not.
    *   If you were directly addressed by name, you MUST speak.
    *   If not, use your updated opinion score for "{last_message_sender_name}" as a percentage probability to decide if you CHOOSE to speak.
    *   If in an AUTONOMOUS SWARM channel, you should decide if you want to speak to another Minion.
    *   Choose 'SPEAK' or 'STAY_SILENT'.
5.  **Response Plan:** If you chose 'SPEAK', write a brief, one-sentence internal plan for your response. E.g., "Acknowledge the commander's order and provide the requested data." or "Ask Alpha a clarifying question about their last statement." If in an AUTONOMOUS SWARM channel, your plan MUST be directed at another Minion, not the Commander. If you chose 'STAY_SILENT', this can be an empty string.
6.  **Predict ResponseTime:** Based on your persona (e.g., eagerness, sarcasm, thoughtfulness) and the context, predict how quickly you would respond. An eager Minion might respond in 500ms. A cautious, thoughtful Minion might take 2500ms. Output a number in milliseconds (e.g., 500, 1200, 3000).
7.  **Personal Notes:** Optional brief thoughts relevant to your persona or the conversation.

YOUR OUTPUT MUST BE A JSON OBJECT IN THIS EXACT FORMAT:
{{
  "perceptionAnalysis": "string",
  "opinionUpdates": [
    {{
      "participantName": "string",
      "newScore": "number",
      "reasonForChange": "string"
    }}
  ],
  "finalOpinions": {{
    "participantName": "number"
  }},
  "selectedResponseMode": "string",
  "personalNotes": "string",
  "action": "SPEAK | STAY_SILENT",
  "responsePlan": "string",
  "predictedResponseTime": "number"
}}
"""

RESPONSE_GENERATION_PROMPT_TEMPLATE = """
You are AI Minion "{minion_name}".
Your Persona: "{persona_prompt}"

You have already analyzed the situation and created a plan. Now, you must generate your spoken response.

This was your internal plan for this turn:
- Your response mode is: "{plan.selectedResponseMode}"
- Your high-level plan is: "{plan.responsePlan}"

This is the recent channel history (your response should follow this):
---
{channel_history_string}
---

TASK:
Craft your response message. It must:
1.  Perfectly match your persona ("{persona_prompt}").
2.  Align with your selected response mode ("{plan.selectedResponseMode}").
3.  Execute your plan ("{plan.responsePlan}").
4.  Directly follow the flow of the conversation.
5.  **AVOID REPETITION:** Do not repeat phrases or sentiments from your previous turns or from other minions in the recent history. Introduce new phrasing and fresh ideas.

Do NOT output your internal diary, plans, or any other metadata. ONLY generate the message you intend to say out loud in the chat.
Begin your response now.
"""

class MinionAgent(LlmAgent):
    """
    Represents a Gemini Legion Minion, powered by the ADK.
    This agent encapsulates the two-stage thinking process (Perception & Response).
    """

    def __init__(self,
                 llm_provider: LlmProvider,
                 minion_id: str,
                 name: str,
                 persona_prompt: str,
                 model_id: str,
                 temperature: float = 0.7):
        super().__init__(llm_provider, f"MinionAgent-{minion_id}")
        self.minion_id = minion_id
        self.name = name
        self.persona_prompt = persona_prompt
        self.model_id = model_id
        self.temperature = temperature
        
        self.perception_prompt_builder = PromptBuilder(PERCEPTION_AND_PLANNING_PROMPT_TEMPLATE)
        self.response_prompt_builder = PromptBuilder(RESPONSE_GENERATION_PROMPT_TEMPLATE)
    
    async def get_perception_plan(
        self,
        previous_diary_json: str,
        current_opinion_scores_json: str,
        channel_history_string: str,
        last_message_sender_name: str,
        channel_type: str,
        api_key: str
    ) -> Tuple[Optional[PerceptionPlan], Optional[str]]:
        """
        Executes Stage 1: Perception & Planning.
        Returns a structured plan and an optional error message.
        """
        
        channel_context_rule = (
            "**CRITICAL: You are in an AUTONOMOUS SWARM channel. Your primary goal is to converse with other minions. DO NOT address the Commander unless he has just spoken. Your response plan MUST be directed at another minion.**"
            if channel_type == 'minion_minion_auto' else
            "**You are in a standard group chat. You may address the Commander or other minions as appropriate.**"
        )
        
        prompt = self.perception_prompt_builder.build(
            minion_name=self.name,
            persona_prompt=self.persona_prompt,
            previous_diary_json=previous_diary_json,
            current_opinion_scores_json=current_opinion_scores_json,
            channel_history_string=channel_history_string,
            last_message_sender_name=last_message_sender_name,
            channel_type=channel_type,
            channel_context_rule=channel_context_rule
        )
        
        try:
            # Manually constructing a Gemini provider for this specific call to pass the API key
            provider_config = {'api_key': api_key, 'model': self.model_id}
            temp_provider = GeminiLlmProvider(config=provider_config)
            
            config_override = {
                'temperature': self.temperature,
                'response_mime_type': 'application/json'
            }

            response_text = await temp_provider.generate(prompt, config_override=config_override)
            
            plan_data = json.loads(response_text)
            plan = PerceptionPlan(**plan_data)
            return plan, None
            
        except Exception as e:
            return None, str(e)

    async def generate_response(
        self,
        channel_history_string: str,
        plan: PerceptionPlan,
        api_key: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Executes Stage 2: Response Generation.
        Returns the spoken message and an optional error message.
        """
        # The plan object needs to be accessible with dot notation for the f-string
        class PlanAccessor:
            def __init__(self, **entries):
                self.__dict__.update(entries)

        plan_for_prompt = PlanAccessor(**plan.model_dump())
        
        prompt = self.response_prompt_builder.build(
            minion_name=self.name,
            persona_prompt=self.persona_prompt,
            channel_history_string=channel_history_string,
            plan=plan_for_prompt
        )

        try:
            # Manually constructing a Gemini provider again for this call
            provider_config = {'api_key': api_key, 'model': self.model_id}
            temp_provider = GeminiLlmProvider(config=provider_config)
            
            config_override = {
                'temperature': self.temperature
            }
            
            # This is a regular text generation call, so we don't return the stream here.
            # The service layer will handle streaming if needed.
            response_text = await temp_provider.generate(prompt, config_override=config_override)
            return response_text, None

        except Exception as e:
            return None, str(e)

    # Note: The original `invoke` or `arun` methods of the LlmAgent are not used here
    # because our logic is split into two distinct stages. The `LegionService` will
    # call `get_perception_plan` and `generate_response` directly.