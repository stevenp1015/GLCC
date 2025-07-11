# gemini-legion-backend/src/services/legion_service.py

import asyncio
import uuid
import time
import random
from typing import List, Dict, Optional, Coroutine, Any, Tuple
from adk.llm_provider.gemini import GeminiLlmProvider

from src.models.api_models import (
    MinionConfig, ApiKey, SelectedKeyInfo, ChatMessageData,
    Channel, PerceptionPlan, MessageSender
)
from src.store.storage import legion_storage as storage
from src.agent.minion_agent import MinionAgent
from src.core.config import settings

# --- Helper Functions ---

def _format_chat_history_for_llm(messages: List[ChatMessageData]) -> str:
    """Formats a list of messages into a string for the LLM context."""
    history_slice = messages[-15:]
    lines = []
    for msg in history_slice:
        prefix = f"[{msg.senderName}]"
        if msg.senderType == 'User':
            prefix = f"[COMMANDER {msg.senderName}]"
        elif msg.senderType == 'AI':
            prefix = f"[MINION {msg.senderName}]"
        lines.append(f"{prefix}: {msg.content}")
    if not lines:
        return "This is the beginning of the conversation."
    return "\n".join(lines)


class LegionService:
    """
    The master orchestrator for the Gemini Legion.
    Contains all business logic for multi-agent interaction, state management,
    and API key handling.
    """
    def __init__(self):
        self._api_key_round_robin_index = 0
        self._minion_agents: Dict[str, MinionAgent] = {}

    async def initialize_agents(self):
        """Loads minion configurations from storage and initializes agent instances."""
        all_minion_configs = await storage.get_all_minions()
        for config in all_minion_configs:
            # The provider is implicitly Gemini for this entire backend.
            # We don't need a full ADK provider instance here, as the agent
            # creates temporary ones for its calls.
            self._minion_agents[config.id] = MinionAgent(
                llm_provider=None, # Not needed for agent constructor
                minion_id=config.id,
                name=config.name,
                persona_prompt=config.system_prompt_persona,
                model_id=config.model_id,
                temperature=config.params.temperature
            )

    def _get_agent(self, minion_id: str) -> Optional[MinionAgent]:
        """Retrieves an initialized MinionAgent instance."""
        return self._minion_agents.get(minion_id)

    # --- API Key Logic ---
    async def _select_api_key(self, minion_config: MinionConfig) -> SelectedKeyInfo:
        """Selects an API key based on assignment or round-robin."""
        api_keys = await storage.get_all_api_keys()
        
        if minion_config.apiKeyId:
            specific_key = next((k for k in api_keys if k.id == minion_config.apiKeyId), None)
            if specific_key:
                return SelectedKeyInfo(key=specific_key.key, name=specific_key.name, method='Assigned')
        
        if api_keys:
            key_info = api_keys[self._api_key_round_robin_index]
            self._api_key_round_robin_index = (self._api_key_round_robin_index + 1) % len(api_keys)
            return SelectedKeyInfo(key=key_info.key, name=key_info.name, method='Load Balanced')
            
        return SelectedKeyInfo(key=settings.GEMINI_API_KEY, name='Default Server Key', method='None')

    # --- Core Multi-Agent Logic ---

    async def handle_user_message(self, user_message: ChatMessageData) -> List[ChatMessageData]:
        """
        Orchestrates the entire multi-agent response to a user's message.
        This is the Python equivalent of the complex logic in legionApiService.ts.
        """
        channel_id = user_message.channelId
        await storage.save_message(user_message)
        
        active_channel = await storage.get_channel(channel_id)
        if not active_channel:
            return []

        all_minion_configs = await storage.get_all_minions()
        minions_in_channel_configs = [
            minion for minion in all_minion_configs if minion.name in active_channel.members
        ]
        
        if not minions_in_channel_configs:
            return []

        all_channel_messages = await storage.get_all_messages(channel_id)
        initial_chat_history = _format_chat_history_for_llm(all_channel_messages)
        
        # Wave 1: Simultaneous Perception
        perception_tasks: List[Coroutine] = []
        for minion_config in minions_in_channel_configs:
            agent = self._get_agent(minion_config.id)
            if agent:
                perception_tasks.append(
                    self._get_minion_perception(agent, minion_config, initial_chat_history, user_message, active_channel)
                )

        perception_results = await asyncio.gather(*perception_tasks)

        # Process results and prepare for Wave 2
        minions_who_will_speak: List[Tuple[MinionAgent, MinionConfig, PerceptionPlan]] = []
        system_log_messages: List[ChatMessageData] = []

        for result in perception_results:
            minion_config, plan, error_msg = result
            agent = self._get_agent(minion_config.id)
            if not agent: continue
            
            if error_msg or not plan:
                log = self._create_system_log(channel_id, f"Error during {agent.name}'s perception stage: {error_msg or 'No plan returned.'}", is_error=True)
                system_log_messages.append(log)
                await storage.save_message(log)
                continue

            await self._update_minion_state_from_plan(minion_config.id, plan)

            if plan.action == 'SPEAK':
                minions_who_will_speak.append((agent, minion_config, plan))
            else:
                log = self._create_system_log(channel_id, f"{agent.name} chose to remain silent.")
                system_log_messages.append(log)
                await storage.save_message(log)

        # Sort speakers by their predicted response time
        minions_who_will_speak.sort(key=lambda x: x[2].predictedResponseTime)

        # Wave 2: Sequential, Context-Aware Response Generation
        generated_ai_responses: List[ChatMessageData] = []
        dynamic_chat_history = initial_chat_history

        for agent, minion_config, plan in minions_who_will_speak:
            key_info = await self._select_api_key(minion_config)
            log = self._create_system_log(channel_id, f"{agent.name} is using key '{key_info.name}' ({key_info.method}) for Response.", is_api_key_log=True)
            system_log_messages.append(log)
            await storage.save_message(log)

            response_text, error_msg = await agent.generate_response(dynamic_chat_history, plan, key_info.key)

            if error_msg or not response_text:
                log = self._create_system_log(channel_id, f"Error during {agent.name}'s response generation: {error_msg or 'Empty response.'}", is_error=True)
                system_log_messages.append(log)
                await storage.save_message(log)
                continue

            ai_message = self._create_ai_message(channel_id, agent.name, response_text, plan)
            generated_ai_responses.append(ai_message)
            await storage.save_message(ai_message)

            # Update history for the next minion in the same turn
            dynamic_chat_history += f"\n[MINION {agent.name}]: {response_text}"

        return system_log_messages + generated_ai_responses


    async def _get_minion_perception(self, agent: MinionAgent, minion_config: MinionConfig, history: str, user_message: ChatMessageData, channel: Channel) -> Tuple[MinionConfig, Optional[PerceptionPlan], Optional[str]]:
        """Helper to run perception stage for a single minion."""
        key_info = await self._select_api_key(minion_config)
        
        # Note: In a real implementation, you might want to log this key usage
        # back to the user via a streaming response or other mechanism.
        
        if not key_info.key:
            return minion_config, None, "No API key available."
            
        last_diary_state = minion_config.lastDiaryState
        
        plan, error = await agent.get_perception_plan(
            previous_diary_json=last_diary_state.model_dump_json() if last_diary_state else '{}',
            current_opinion_scores_json=json.dumps(minion_config.opinionScores),
            channel_history_string=history,
            last_message_sender_name=user_message.senderName,
            channel_type=channel.type,
            api_key=key_info.key
        )
        return minion_config, plan, error

    async def _update_minion_state_from_plan(self, minion_id: str, plan: PerceptionPlan):
        """Updates a minion's config in storage based on a new perception plan."""
        minion_config = await storage.get_minion(minion_id)
        if minion_config:
            minion_config.opinionScores = plan.finalOpinions
            minion_config.lastDiaryState = plan
            await storage.save_minion(minion_config)

    # --- Factory methods for messages ---
    def _create_system_log(self, channel_id: str, content: str, is_error: bool = False, is_api_key_log: bool = False) -> ChatMessageData:
        return ChatMessageData(
            id=f"sys-{uuid.uuid4()}",
            channelId=channel_id,
            senderType='System',
            senderName='LegionOS',
            content=content,
            timestamp=time.time(),
            isError=is_error,
            isApiKeyLog=is_api_key_log
        )
    
    def _create_ai_message(self, channel_id: str, minion_name: str, content: str, diary: MinionDiaryState) -> ChatMessageData:
        return ChatMessageData(
            id=f"ai-{uuid.uuid4()}",
            channelId=channel_id,
            senderType='AI',
            senderName=minion_name,
            content=content,
            timestamp=time.time(),
            internalDiary=diary
        )

# Create a single, importable instance of the service.
legion_service = LegionService()