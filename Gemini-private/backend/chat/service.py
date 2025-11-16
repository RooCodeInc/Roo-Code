"""
Chat Service
Handles chat creation, message management, and AI interactions
"""
import logging
from typing import List, Dict, Any, Optional, AsyncIterator
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.shared.models import (
    ChatCreate, ChatResponse, ChatUpdate,
    MessageCreate, MessageResponse,
    ChatCompletionRequest, ChatCompletionResponse
)
from database.models import Chat, Message, User
from backend.chat.ai_client import AIClient

logger = logging.getLogger(__name__)


class ChatService:
    """Chat service"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_client = AIClient()

    async def create_chat(self, user_id: UUID, chat_data: ChatCreate) -> ChatResponse:
        """Create a new chat"""
        chat = Chat(
            id=uuid4(),
            user_id=user_id,
            title=chat_data.title or "New Chat",
            model=chat_data.model,
            system_prompt=chat_data.system_prompt,
            metadata=chat_data.metadata,
            is_archived=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        self.db.add(chat)
        await self.db.commit()
        await self.db.refresh(chat)

        return ChatResponse.model_validate(chat)

    async def get_chat(self, chat_id: UUID, user_id: UUID) -> ChatResponse:
        """Get a chat by ID"""
        result = await self.db.execute(
            select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        )
        chat = result.scalar_one_or_none()

        if not chat:
            raise ValueError("Chat not found")

        return ChatResponse.model_validate(chat)

    async def get_user_chats(
        self,
        user_id: UUID,
        include_archived: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> List[ChatResponse]:
        """Get all chats for a user"""
        query = select(Chat).where(Chat.user_id == user_id)

        if not include_archived:
            query = query.where(Chat.is_archived == False)

        query = query.order_by(Chat.updated_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(query)
        chats = result.scalars().all()

        return [ChatResponse.model_validate(chat) for chat in chats]

    async def update_chat(self, chat_id: UUID, user_id: UUID, chat_data: ChatUpdate) -> ChatResponse:
        """Update a chat"""
        result = await self.db.execute(
            select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        )
        chat = result.scalar_one_or_none()

        if not chat:
            raise ValueError("Chat not found")

        if chat_data.title is not None:
            chat.title = chat_data.title
        if chat_data.system_prompt is not None:
            chat.system_prompt = chat_data.system_prompt
        if chat_data.is_archived is not None:
            chat.is_archived = chat_data.is_archived
        if chat_data.metadata is not None:
            chat.metadata = chat_data.metadata

        chat.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(chat)

        return ChatResponse.model_validate(chat)

    async def delete_chat(self, chat_id: UUID, user_id: UUID):
        """Delete a chat"""
        result = await self.db.execute(
            select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        )
        chat = result.scalar_one_or_none()

        if not chat:
            raise ValueError("Chat not found")

        await self.db.delete(chat)
        await self.db.commit()

    async def add_message(self, message_data: MessageCreate) -> MessageResponse:
        """Add a message to a chat"""
        message = Message(
            id=uuid4(),
            chat_id=message_data.chat_id,
            role=message_data.role,
            content=message_data.content,
            model=message_data.model,
            metadata=message_data.metadata,
            created_at=datetime.utcnow()
        )

        self.db.add(message)

        # Update chat's updated_at timestamp
        result = await self.db.execute(
            select(Chat).where(Chat.id == message_data.chat_id)
        )
        chat = result.scalar_one_or_none()
        if chat:
            chat.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(message)

        return MessageResponse.model_validate(message)

    async def get_chat_messages(
        self,
        chat_id: UUID,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[MessageResponse]:
        """Get messages for a chat"""
        # Verify user owns chat
        chat_result = await self.db.execute(
            select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        )
        if not chat_result.scalar_one_or_none():
            raise ValueError("Chat not found")

        # Get messages
        result = await self.db.execute(
            select(Message)
            .where(Message.chat_id == chat_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        messages = result.scalars().all()

        return [MessageResponse.model_validate(msg) for msg in messages]

    async def chat_completion(
        self,
        user_id: UUID,
        request: ChatCompletionRequest,
        memory_context: Optional[str] = None,
        rag_context: Optional[str] = None,
        web_context: Optional[str] = None
    ) -> ChatCompletionResponse | AsyncIterator[Dict[str, Any]]:
        """
        Get AI chat completion with optional context from memory, RAG, and web grounding
        """
        # Build enhanced system prompt
        system_prompt = request.system_prompt or ""

        if memory_context:
            system_prompt += f"\n\n## User Memory Context\n{memory_context}"

        if rag_context:
            system_prompt += f"\n\n## Retrieved Documents\n{rag_context}"

        if web_context:
            system_prompt += f"\n\n## Web Search Results\n{web_context}"

        # Get completion from AI client
        result = await self.ai_client.chat_completion(
            model=request.model,
            messages=request.messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=request.stream,
            system_prompt=system_prompt if system_prompt else None,
            use_extended_thinking=request.use_extended_thinking
        )

        if request.stream:
            return result  # Return async iterator

        # Save messages to chat if chat_id provided
        if request.chat_id:
            # Save user message
            user_msg = MessageCreate(
                chat_id=request.chat_id,
                role="user",
                content=request.messages[-1]["content"]
            )
            await self.add_message(user_msg)

            # Save assistant response
            assistant_msg = MessageCreate(
                chat_id=request.chat_id,
                role="assistant",
                content=result["message"]["content"],
                model=result["model"],
                metadata={
                    "tokens_used": result["tokens_used"],
                    "finish_reason": result["finish_reason"],
                    **result.get("metadata", {})
                }
            )

            # Update tokens_used in message
            msg = await self.add_message(assistant_msg)

            # Update message with token count
            message_result = await self.db.execute(
                select(Message).where(Message.id == msg.id)
            )
            saved_message = message_result.scalar_one()
            saved_message.tokens_used = result["tokens_used"]
            await self.db.commit()

        return ChatCompletionResponse(**result)

    async def generate_chat_title(self, chat_id: UUID, user_id: UUID) -> str:
        """Generate a title for a chat based on the first few messages"""
        messages = await self.get_chat_messages(chat_id, user_id, limit=3)

        if not messages:
            return "New Chat"

        # Use first user message to generate title
        first_user_msg = next((msg for msg in messages if msg.role == "user"), None)
        if not first_user_msg:
            return "New Chat"

        # Ask AI to generate a short title
        try:
            result = await self.ai_client.chat_completion(
                model="gemini-2.5-flash",  # Use fast model for title generation
                messages=[
                    {
                        "role": "user",
                        "content": f"Generate a short (3-5 words) title for a conversation that starts with: '{first_user_msg.content[:200]}'"
                    }
                ],
                temperature=0.7,
                max_tokens=20,
                stream=False
            )
            title = result["message"]["content"].strip().strip('"').strip("'")
            return title[:100]  # Limit title length
        except Exception as e:
            logger.error(f"Failed to generate title: {e}")
            return "New Chat"
