# gemini-legion-backend/src/models/api_models.py

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal

# This file is the Python equivalent of the 'types.ts' file.
# It defines the data structures for API communication using Pydantic,
# ensuring type safety and validation between the frontend and backend.

# --- NEW: Specific model for Opinion Updates. Fixes the Pydantic error. ---
class OpinionUpdate(BaseModel):
    participantName: str
    newScore: int
    reasonForChange: str

class ApiKey(BaseModel):
    id: str
    name: str
    key: str # The actual API key value, will not be exposed in most responses

# --- NEW: Added definition for SelectedKeyInfo ---
class SelectedKeyInfo(BaseModel):
    key: str
    name: str
    method: Literal['Assigned', 'Load Balanced', 'None']

class MinionParams(BaseModel):
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)

class MinionDiaryState(BaseModel):
    perceptionAnalysis: str
    opinionUpdates: List[OpinionUpdate] # <-- FIXED: Was List[Dict[str, any]]
    finalOpinions: Dict[str, int]
    selectedResponseMode: str
    personalNotes: Optional[str] = None

class PerceptionPlan(MinionDiaryState):
    action: Literal['SPEAK', 'STAY_SILENT']
    responsePlan: str
    predictedResponseTime: int

class MinionConfig(BaseModel):
    id: str
    name: str
    provider: Literal['google'] = 'google'
    model_id: str
    model_name: Optional[str] = None
    system_prompt_persona: str
    params: MinionParams = Field(default_factory=MinionParams)
    apiKeyId: Optional[str] = Field(default=None, alias='apiKeyId')
    opinionScores: Dict[str, int] = Field(default_factory=dict)
    lastDiaryState: Optional[MinionDiaryState] = None
    status: Optional[str] = 'Idle'
    currentTask: Optional[str] = None

# For creating/updating minions, ID is optional
class MinionConfigPayload(BaseModel):
    id: Optional[str] = None
    name: str
    model_id: str
    model_name: Optional[str] = None
    system_prompt_persona: str
    params: MinionParams = Field(default_factory=MinionParams)
    apiKeyId: Optional[str] = Field(default=None, alias='apiKeyId')

class MessageSender(BaseModel):
    User: Literal['User'] = 'User'
    AI: Literal['AI'] = 'AI'
    System: Literal['System'] = 'System'

class ChatMessageData(BaseModel):
    id: str
    channelId: str
    senderType: Literal['User', 'AI', 'System']
    senderName: str
    content: str
    timestamp: float = Field(default_factory=float)
    internalDiary: Optional[MinionDiaryState] = None
    isError: Optional[bool] = False
    replyToMessageId: Optional[str] = None
    isProcessing: Optional[bool] = False
    isApiKeyLog: Optional[bool] = False

class Channel(BaseModel):
    id: str
    name: str
    description: Optional[str] = ''
    type: Literal['user_minion_group', 'minion_minion_auto', 'system_log']
    members: List[str] = Field(default_factory=list)
    isPrivate: Optional[bool] = False
    isAutoModeActive: Optional[bool] = False
    autoModeDelayType: Optional[Literal['fixed', 'random']] = 'fixed'
    autoModeFixedDelay: Optional[int] = 5
    autoModeRandomDelay: Optional[Dict[str, int]] = Field(default={'min': 3, 'max': 10})

# For creating/updating channels, some fields are optional
class ChannelPayload(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ''
    type: Literal['user_minion_group', 'minion_minion_auto', 'system_log']
    members: List[str] = Field(default_factory=list)

# For user sending a new message
class UserMessagePayload(BaseModel):
    channelId: str
    userInput: str