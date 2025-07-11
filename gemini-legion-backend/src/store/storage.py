# gemini-legion-backend/src/store/storage.py

from adk.store.store import Store, Document
from adk.store.file_system_store import FileSystemStore
from typing import List, Optional, Dict, Any

from src.models.api_models import MinionConfig, Channel, ChatMessageData

# This module provides a layer of abstraction over the ADK Store
# for managing the application's persistent data.

class LegionStore:
    """
    Handles all database operations for the Gemini Legion application,
    using the ADK's Store abstraction.
    """
    def __init__(self, store: Store):
        self._store = store
        self._minions_collection = "minions"
        self._channels_collection = "channels"
        self._messages_collection = "messages"
        self._apikeys_collection = "api_keys"

    # --- Minion Methods ---
    async def save_minion(self, minion_config: MinionConfig) -> None:
        """Saves or updates a minion's configuration."""
        doc = Document(id=minion_config.id, data=minion_config.model_dump(by_alias=True))
        await self._store.put(self._minions_collection, [doc])

    async def get_minion(self, minion_id: str) -> Optional[MinionConfig]:
        """Retrieves a single minion by its ID."""
        doc = await self._store.get(self._minions_collection, minion_id)
        return MinionConfig(**doc.data) if doc else None

    async def get_all_minions(self) -> List[MinionConfig]:
        """Retrieves all minion configurations."""
        docs = await self._store.query(self._minions_collection, query={})
        return [MinionConfig(**doc.data) for doc in docs]

    async def delete_minion(self, minion_id: str) -> None:
        """Deletes a minion by its ID."""
        await self._store.delete(self._minions_collection, minion_id)

    # --- Channel Methods ---
    async def save_channel(self, channel: Channel) -> None:
        """Saves or updates a channel's configuration."""
        doc = Document(id=channel.id, data=channel.model_dump(by_alias=True))
        await self._store.put(self._channels_collection, [doc])

    async def get_channel(self, channel_id: str) -> Optional[Channel]:
        """Retrieves a single channel by its ID."""
        doc = await self._store.get(self._channels_collection, channel_id)
        return Channel(**doc.data) if doc else None

    async def get_all_channels(self) -> List[Channel]:
        """Retrieves all channel configurations."""
        docs = await self._store.query(self._channels_collection, query={})
        return [Channel(**doc.data) for doc in docs]

    async def delete_channel(self, channel_id: str) -> None:
        """Deletes a channel and all its associated messages."""
        await self._store.delete(self._channels_collection, channel_id)
        # Also delete messages for that channel
        messages_to_delete = await self.get_all_messages(channel_id)
        message_ids = [msg.id for msg in messages_to_delete]
        if message_ids:
            await self._store.delete(self._messages_collection, message_ids)

    # --- Message Methods ---
    async def save_message(self, message: ChatMessageData) -> None:
        """Saves or updates a single chat message."""
        # Use a composite key for messages if needed, or ensure IDs are unique
        doc = Document(id=message.id, data=message.model_dump(by_alias=True))
        await self._store.put(self._messages_collection, [doc])

    async def get_all_messages(self, channel_id: str) -> List[ChatMessageData]:
        """Retrieves all messages for a specific channel, sorted by timestamp."""
        # ADK's query doesn't support sorting directly, so we filter and sort in memory.
        # For a real database, you'd use a more efficient query.
        docs = await self._store.query(self._messages_collection, query={"channelId": channel_id})
        messages = [ChatMessageData(**doc.data) for doc in docs]
        messages.sort(key=lambda m: m.timestamp)
        return messages

    async def delete_message(self, message_id: str) -> None:
        """Deletes a single message by its ID."""
        await self._store.delete(self._messages_collection, message_id)

# --- Singleton Store Instance ---
# Initialize the store. Using FileSystemStore for simple, local persistence.
# The data will be stored in a 'legion_db' directory in the project root.
_store_instance = FileSystemStore(root_path="./legion_db")
legion_storage = LegionStore(_store_instance)