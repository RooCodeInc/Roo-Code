"""
RAG (Retrieval-Augmented Generation) Service
Handles document ingestion, chunking, embedding, and retrieval
"""
import logging
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.shared.models import DocumentCreate, DocumentResponse, DocumentUpdate
from backend.shared.utils import chunk_text
from database.models import Document, DocumentChunk
from backend.chat.ai_client import AIClient

logger = logging.getLogger(__name__)


class RAGService:
    """RAG service for document management and retrieval"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_client = AIClient()

    async def create_document(
        self,
        document_data: DocumentCreate,
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> DocumentResponse:
        """
        Create a new document and generate embeddings for chunks
        """
        # Create document
        document = Document(
            id=uuid4(),
            user_id=document_data.user_id,
            title=document_data.title,
            content=document_data.content,
            mime_type=document_data.mime_type,
            size_bytes=len(document_data.content.encode('utf-8')),
            metadata=document_data.metadata,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        self.db.add(document)
        await self.db.flush()

        # Chunk the document
        chunks = chunk_text(document_data.content, chunk_size, chunk_overlap)

        # Create chunks with embeddings
        for idx, chunk_content in enumerate(chunks):
            try:
                embedding = await self.ai_client.generate_embedding(chunk_content)
            except Exception as e:
                logger.warning(f"Failed to generate embedding for chunk {idx}: {e}")
                embedding = None

            chunk = DocumentChunk(
                id=uuid4(),
                document_id=document.id,
                chunk_index=idx,
                content=chunk_content,
                embedding=embedding,
                metadata={"chunk_size": len(chunk_content)},
                created_at=datetime.utcnow()
            )
            self.db.add(chunk)

        await self.db.commit()
        await self.db.refresh(document)

        return DocumentResponse.model_validate(document)

    async def get_document(self, document_id: UUID, user_id: UUID) -> DocumentResponse:
        """Get a document by ID"""
        result = await self.db.execute(
            select(Document).where(Document.id == document_id, Document.user_id == user_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError("Document not found")

        return DocumentResponse.model_validate(document)

    async def get_user_documents(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[DocumentResponse]:
        """Get all documents for a user"""
        result = await self.db.execute(
            select(Document)
            .where(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        documents = result.scalars().all()

        return [DocumentResponse.model_validate(doc) for doc in documents]

    async def update_document(
        self,
        document_id: UUID,
        user_id: UUID,
        document_data: DocumentUpdate
    ) -> DocumentResponse:
        """Update a document"""
        result = await self.db.execute(
            select(Document).where(Document.id == document_id, Document.user_id == user_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError("Document not found")

        if document_data.title is not None:
            document.title = document_data.title

        if document_data.content is not None:
            document.content = document_data.content
            document.size_bytes = len(document_data.content.encode('utf-8'))

            # Re-chunk and re-embed
            await self._rechunk_document(document)

        if document_data.metadata is not None:
            document.metadata = document_data.metadata

        document.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(document)

        return DocumentResponse.model_validate(document)

    async def delete_document(self, document_id: UUID, user_id: UUID):
        """Delete a document"""
        result = await self.db.execute(
            select(Document).where(Document.id == document_id, Document.user_id == user_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError("Document not found")

        await self.db.delete(document)
        await self.db.commit()

    async def _rechunk_document(self, document: Document):
        """Re-chunk and re-embed a document"""
        # Delete existing chunks
        await self.db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )

        # Create new chunks
        chunks = chunk_text(document.content)

        for idx, chunk_content in enumerate(chunks):
            try:
                embedding = await self.ai_client.generate_embedding(chunk_content)
            except Exception as e:
                logger.warning(f"Failed to generate embedding for chunk {idx}: {e}")
                embedding = None

            chunk = DocumentChunk(
                id=uuid4(),
                document_id=document.id,
                chunk_index=idx,
                content=chunk_content,
                embedding=embedding,
                metadata={"chunk_size": len(chunk_content)},
                created_at=datetime.utcnow()
            )
            self.db.add(chunk)

    async def search_documents(
        self,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        """
        Search documents using semantic similarity
        Returns matching chunks with their parent documents
        """
        # Generate query embedding
        try:
            query_embedding = await self.ai_client.generate_embedding(query)
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            return []

        # Search using vector similarity
        from sqlalchemy import text, join

        # Join chunks with documents and filter by user
        query_sql = text("""
            SELECT
                dc.id as chunk_id,
                dc.content as chunk_content,
                dc.chunk_index,
                d.id as document_id,
                d.title as document_title,
                d.metadata as document_metadata,
                (1 - (dc.embedding <=> :query_embedding)) as similarity
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.user_id = :user_id
                AND dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> :query_embedding
            LIMIT :limit
        """)

        result = await self.db.execute(
            query_sql,
            {
                "query_embedding": str(query_embedding),
                "user_id": str(user_id),
                "limit": limit
            }
        )

        chunks = []
        for row in result:
            chunks.append({
                "chunk_id": row.chunk_id,
                "chunk_content": row.chunk_content,
                "chunk_index": row.chunk_index,
                "document_id": row.document_id,
                "document_title": row.document_title,
                "document_metadata": row.document_metadata,
                "similarity": row.similarity
            })

        return chunks

    async def get_rag_context_for_query(
        self,
        user_id: UUID,
        query: str,
        max_chunks: int = 5
    ) -> str:
        """
        Get RAG context for a query, formatted for inclusion in AI prompt
        """
        chunks = await self.search_documents(user_id, query, limit=max_chunks)

        if not chunks:
            return ""

        # Format chunks as context
        context_parts = []
        for chunk in chunks:
            context_parts.append(
                f"From '{chunk['document_title']}' (similarity: {chunk['similarity']:.2f}):\n{chunk['chunk_content']}"
            )

        return "\n\n".join(context_parts)
