"""
Memory Service
Handles long-term user and chat memory with semantic search
"""
import logging
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.shared.models import MemoryCreate, MemoryResponse, MemoryUpdate, MemorySearchRequest
from database.models import Memory
from backend.chat.ai_client import AIClient

logger = logging.getLogger(__name__)


class MemoryService:
    """Memory service for long-term storage and retrieval"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_client = AIClient()

    async def create_memory(self, memory_data: MemoryCreate) -> MemoryResponse:
        """Create a new memory with embedding"""
        # Generate embedding for the content
        try:
            embedding = await self.ai_client.generate_embedding(memory_data.content)
        except Exception as e:
            logger.warning(f"Failed to generate embedding: {e}")
            embedding = None

        memory = Memory(
            id=uuid4(),
            user_id=memory_data.user_id,
            chat_id=memory_data.chat_id,
            memory_type=memory_data.memory_type,
            content=memory_data.content,
            embedding=embedding,
            importance_score=memory_data.importance_score,
            metadata=memory_data.metadata,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        self.db.add(memory)
        await self.db.commit()
        await self.db.refresh(memory)

        return MemoryResponse.model_validate(memory)

    async def get_memory(self, memory_id: UUID, user_id: UUID) -> MemoryResponse:
        """Get a specific memory"""
        result = await self.db.execute(
            select(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
        )
        memory = result.scalar_one_or_none()

        if not memory:
            raise ValueError("Memory not found")

        return MemoryResponse.model_validate(memory)

    async def get_user_memories(
        self,
        user_id: UUID,
        memory_type: Optional[str] = None,
        chat_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[MemoryResponse]:
        """Get memories for a user"""
        query = select(Memory).where(Memory.user_id == user_id)

        if memory_type:
            query = query.where(Memory.memory_type == memory_type)

        if chat_id:
            query = query.where(Memory.chat_id == chat_id)

        query = query.order_by(
            Memory.importance_score.desc(),
            Memory.created_at.desc()
        ).limit(limit).offset(offset)

        result = await self.db.execute(query)
        memories = result.scalars().all()

        return [MemoryResponse.model_validate(memory) for memory in memories]

    async def update_memory(
        self,
        memory_id: UUID,
        user_id: UUID,
        memory_data: MemoryUpdate
    ) -> MemoryResponse:
        """Update a memory"""
        result = await self.db.execute(
            select(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
        )
        memory = result.scalar_one_or_none()

        if not memory:
            raise ValueError("Memory not found")

        if memory_data.content is not None:
            memory.content = memory_data.content
            # Regenerate embedding
            try:
                embedding = await self.ai_client.generate_embedding(memory_data.content)
                memory.embedding = embedding
            except Exception as e:
                logger.warning(f"Failed to generate embedding: {e}")

        if memory_data.importance_score is not None:
            memory.importance_score = memory_data.importance_score

        if memory_data.metadata is not None:
            memory.metadata = memory_data.metadata

        memory.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(memory)

        return MemoryResponse.model_validate(memory)

    async def delete_memory(self, memory_id: UUID, user_id: UUID):
        """Delete a memory"""
        result = await self.db.execute(
            select(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
        )
        memory = result.scalar_one_or_none()

        if not memory:
            raise ValueError("Memory not found")

        await self.db.delete(memory)
        await self.db.commit()

    async def search_memories(
        self,
        user_id: UUID,
        search_request: MemorySearchRequest
    ) -> List[MemoryResponse]:
        """Search memories using semantic similarity"""
        # Generate query embedding
        try:
            query_embedding = await self.ai_client.generate_embedding(search_request.query)
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            return []

        # Build base query
        query = select(Memory).where(Memory.user_id == user_id)

        if search_request.memory_type:
            query = query.where(Memory.memory_type == search_request.memory_type)

        if search_request.chat_id:
            query = query.where(Memory.chat_id == search_request.chat_id)

        # Add vector similarity search using pgvector
        # Using cosine similarity: 1 - (embedding <=> query_embedding)
        from sqlalchemy import func, text

        query = query.order_by(
            text(f"embedding <=> '{query_embedding}'")
        ).limit(search_request.limit)

        result = await self.db.execute(query)
        memories = result.scalars().all()

        # Filter by minimum score if needed
        # Note: In production, you'd calculate actual similarity scores
        return [MemoryResponse.model_validate(memory) for memory in memories]

    async def extract_memories_from_conversation(
        self,
        user_id: UUID,
        chat_id: UUID,
        messages: List[dict]
    ) -> List[MemoryResponse]:
        """
        Automatically extract important memories from conversation
        Uses AI to identify key facts, preferences, and important information
        """
        # Build conversation context
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}" for msg in messages[-10:]  # Last 10 messages
        ])

        # Ask AI to extract memories
        extraction_prompt = f"""Analyze this conversation and extract important information about the user that should be remembered for future conversations.
Extract:
1. User facts (personal information, background)
2. User preferences (likes, dislikes, settings)
3. Important context (projects, goals, concerns)

Format each memory as a separate line starting with the type [FACT], [PREFERENCE], or [CONTEXT]:

Conversation:
{conversation_text}

Memories:"""

        try:
            result = await self.ai_client.chat_completion(
                model="gemini-2.5-flash",
                messages=[{"role": "user", "content": extraction_prompt}],
                temperature=0.3,
                max_tokens=500,
                stream=False
            )

            memories_text = result["message"]["content"]
            extracted_memories = []

            # Parse extracted memories
            for line in memories_text.split('\n'):
                line = line.strip()
                if not line:
                    continue

                memory_type = "user_fact"
                content = line

                if line.startswith("[FACT]"):
                    memory_type = "user_fact"
                    content = line[6:].strip()
                elif line.startswith("[PREFERENCE]"):
                    memory_type = "preference"
                    content = line[12:].strip()
                elif line.startswith("[CONTEXT]"):
                    memory_type = "chat"
                    content = line[9:].strip()

                if content and len(content) > 10:  # Filter out too short memories
                    memory_data = MemoryCreate(
                        user_id=user_id,
                        chat_id=chat_id,
                        memory_type=memory_type,
                        content=content,
                        importance_score=0.7,
                        metadata={"auto_extracted": True}
                    )
                    memory = await self.create_memory(memory_data)
                    extracted_memories.append(memory)

            return extracted_memories

        except Exception as e:
            logger.error(f"Failed to extract memories: {e}")
            return []

    async def get_relevant_memories_for_query(
        self,
        user_id: UUID,
        query: str,
        chat_id: Optional[UUID] = None,
        limit: int = 5
    ) -> str:
        """
        Get relevant memories for a query and format as context
        """
        # Search for global and chat-specific memories
        search_request = MemorySearchRequest(
            query=query,
            chat_id=chat_id,
            limit=limit,
            min_score=0.0
        )

        memories = await self.search_memories(user_id, search_request)

        if not memories:
            return ""

        # Format memories as context
        context_parts = []
        for memory in memories:
            context_parts.append(f"- {memory.content} (type: {memory.memory_type})")

        return "\n".join(context_parts)
