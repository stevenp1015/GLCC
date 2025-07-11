# gemini-legion-backend/main.py

import uvicorn
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from src.models.api_models import (
    MinionConfig, MinionConfigPayload, ApiKey, Channel,
    ChannelPayload, ChatMessageData, UserMessagePayload
)
from src.services.legion_service import legion_service as service
from src.core.config import settings

app = FastAPI(
    title="Gemini Legion C&C Backend",
    description="The Python ADK-powered backend for managing the Legion of AI Minions.",
    version="1.0.0"
)

# --- CORS Middleware ---
# This allows the React frontend (running on a different port/domain)
# to communicate with this backend.
origins = [
    "http://localhost",
    "http://localhost:3000",
    # Add the URL of your frontend if it's different
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Server Lifecycle Events ---
@app.on_event("startup")
async def startup_event():
    """Initializes the Legion Service and its agents on server startup."""
    await service.initialize_agents()


# --- Root Endpoint ---
@app.get("/")
async def root():
    return {"message": f"Welcome to the Gemini Legion C&C Backend, Commander {settings.LEGION_COMMANDER_NAME}!"}


# --- API Key Endpoints ---
@app.get("/api/keys", response_model=List[ApiKey])
async def get_api_keys():
    return await service.get_all_api_keys()

@app.post("/api/keys", response_model=ApiKey, status_code=201)
async def add_api_key(payload: ApiKey = Body(...)):
    return await service.add_api_key(payload)

@app.delete("/api/keys/{key_id}", status_code=204)
async def delete_api_key(key_id: str):
    await service.delete_api_key(key_id)
    return None


# --- Minion Endpoints ---
@app.get("/api/minions", response_model=List[MinionConfig])
async def get_all_minions():
    return await service.get_all_minions()

@app.post("/api/minions", response_model=MinionConfig, status_code=201)
async def create_minion(payload: MinionConfigPayload = Body(...)):
    return await service.add_minion(payload)

@app.put("/api/minions/{minion_id}", response_model=MinionConfig)
async def update_minion(minion_id: str, payload: MinionConfigPayload = Body(...)):
    # Pydantic models expect all fields, so we need to fetch the original
    # to merge with the payload. The service layer handles this logic.
    updated_minion = await service.update_minion(minion_id, payload)
    if not updated_minion:
        raise HTTPException(status_code=404, detail=f"Minion with ID '{minion_id}' not found.")
    return updated_minion

@app.delete("/api/minions/{minion_id}", status_code=204)
async def delete_minion(minion_id: str):
    await service.delete_minion(minion_id)
    return None


# --- Channel Endpoints ---
@app.get("/api/channels", response_model=List[Channel])
async def get_all_channels():
    return await service.get_all_channels()

@app.post("/api/channels", response_model=Channel, status_code=201)
async def create_channel(payload: ChannelPayload = Body(...)):
    return await service.add_channel(payload)

@app.put("/api/channels/{channel_id}", response_model=Channel)
async def update_channel(channel_id: str, payload: ChannelPayload = Body(...)):
    updated_channel = await service.update_channel(channel_id, payload)
    if not updated_channel:
        raise HTTPException(status_code=404, detail=f"Channel with ID '{channel_id}' not found.")
    return updated_channel


# --- Message Endpoints ---
@app.get("/api/messages/{channel_id}", response_model=List[ChatMessageData])
async def get_messages(channel_id: str):
    # This endpoint could be extended to support pagination in the future
    return await service.get_all_messages(channel_id)

@app.post("/api/messages", response_model=List[ChatMessageData])
async def post_message(payload: UserMessagePayload = Body(...)):
    """
    This is the main endpoint for user interaction.
    It returns a list of all AI and System messages generated in response.
    """
    return await service.handle_user_message(payload.channelId, payload.userInput)
    
# NOTE: The current implementation does not support streaming over REST.
# For a real-time typing effect, this would need to be re-architected
# to use WebSockets, which is a significant but powerful upgrade.


# --- Main entry point for running the server ---
if __name__ == "__main__":
    print("--- Starting Gemini Legion C&C Backend ---")
    if not settings.GEMINI_API_KEY:
        print("\n!!! CRITICAL WARNING: GEMINI_API_KEY is not set in your .env file.")
        print("!!! The application will NOT function without it.\n")
    
    # Uvicorn is a high-performance ASGI server.
    # --reload will automatically restart the server when you change the code.
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)