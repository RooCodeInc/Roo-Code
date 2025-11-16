"""
Main FastAPI Application
API Gateway for all microservices
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List

from backend.shared.config import settings
from backend.shared.database import get_db, init_db, close_db
from backend.shared.models import *
from backend.auth.service import AuthService
from backend.chat.service import ChatService
from backend.memory.service import MemoryService
from backend.rag.service import RAGService
from backend.grounding.service import WebGroundingService

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info("Starting application...")
    await init_db()
    yield
    logger.info("Shutting down application...")
    await close_db()


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)


# ============================================================================
# Authentication Dependency
# ============================================================================

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> UUID:
    """Get current user from JWT token"""
    try:
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme"
            )

        auth_service = AuthService(db)
        user_id = await auth_service.verify_token(token)
        return user_id

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": settings.APP_VERSION}


# ============================================================================
# Authentication Routes
# ============================================================================

@app.post(f"{settings.API_V1_PREFIX}/auth/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    try:
        auth_service = AuthService(db)
        return await auth_service.register_user(user_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post(f"{settings.API_V1_PREFIX}/auth/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with username/password"""
    try:
        auth_service = AuthService(db)
        return await auth_service.authenticate_user(login_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@app.get(f"{settings.API_V1_PREFIX}/auth/sso/login")
async def sso_login(
    redirect_uri: str,
    db: AsyncSession = Depends(get_db)
):
    """Initiate SSO login"""
    try:
        auth_service = AuthService(db)
        return await auth_service.initiate_sso_login(redirect_uri)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post(f"{settings.API_V1_PREFIX}/auth/sso/callback", response_model=TokenResponse)
async def sso_callback(
    callback_data: OAuth2CallbackRequest,
    db: AsyncSession = Depends(get_db)
):
    """Handle SSO callback"""
    try:
        auth_service = AuthService(db)
        return await auth_service.handle_sso_callback(callback_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post(f"{settings.API_V1_PREFIX}/auth/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token"""
    try:
        auth_service = AuthService(db)
        return await auth_service.refresh_access_token(refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@app.post(f"{settings.API_V1_PREFIX}/auth/logout")
async def logout(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    """Logout user"""
    scheme, token = authorization.split()
    auth_service = AuthService(db)
    await auth_service.logout(token)
    return {"message": "Logged out successfully"}


# ============================================================================
# Chat Routes
# ============================================================================

@app.post(f"{settings.API_V1_PREFIX}/chats", response_model=ChatResponse)
async def create_chat(
    chat_data: ChatCreate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new chat"""
    chat_service = ChatService(db)
    return await chat_service.create_chat(user_id, chat_data)


@app.get(f"{settings.API_V1_PREFIX}/chats", response_model=List[ChatResponse])
async def get_chats(
    include_archived: bool = False,
    limit: int = 50,
    offset: int = 0,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's chats"""
    chat_service = ChatService(db)
    return await chat_service.get_user_chats(user_id, include_archived, limit, offset)


@app.get(f"{settings.API_V1_PREFIX}/chats/{{chat_id}}", response_model=ChatResponse)
async def get_chat(
    chat_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific chat"""
    try:
        chat_service = ChatService(db)
        return await chat_service.get_chat(chat_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@app.patch(f"{settings.API_V1_PREFIX}/chats/{{chat_id}}", response_model=ChatResponse)
async def update_chat(
    chat_id: UUID,
    chat_data: ChatUpdate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a chat"""
    try:
        chat_service = ChatService(db)
        return await chat_service.update_chat(chat_id, user_id, chat_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@app.delete(f"{settings.API_V1_PREFIX}/chats/{{chat_id}}")
async def delete_chat(
    chat_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat"""
    try:
        chat_service = ChatService(db)
        await chat_service.delete_chat(chat_id, user_id)
        return {"message": "Chat deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@app.get(f"{settings.API_V1_PREFIX}/chats/{{chat_id}}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_id: UUID,
    limit: int = 100,
    offset: int = 0,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get messages for a chat"""
    try:
        chat_service = ChatService(db)
        return await chat_service.get_chat_messages(chat_id, user_id, limit, offset)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@app.post(f"{settings.API_V1_PREFIX}/chat/completions")
async def chat_completion(
    request: ChatCompletionRequest,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI chat completion"""
    chat_service = ChatService(db)
    memory_service = MemoryService(db)
    rag_service = RAGService(db)
    grounding_service = WebGroundingService()

    # Get context from various sources
    memory_context = None
    rag_context = None
    web_context = None

    last_message = request.messages[-1]["content"] if request.messages else ""

    if request.use_rag:
        rag_context = await rag_service.get_rag_context_for_query(user_id, last_message)

    if request.use_web_grounding:
        web_context = await grounding_service.get_grounding_context(last_message)

    # Always get relevant memories
    memory_context = await memory_service.get_relevant_memories_for_query(
        user_id, last_message, request.chat_id
    )

    # Get completion
    result = await chat_service.chat_completion(
        user_id, request, memory_context, rag_context, web_context
    )

    if request.stream:
        async def generate():
            async for chunk in result:
                yield chunk

        return StreamingResponse(generate(), media_type="text/event-stream")
    else:
        return result


# ============================================================================
# Memory Routes
# ============================================================================

@app.post(f"{settings.API_V1_PREFIX}/memories", response_model=MemoryResponse)
async def create_memory(
    memory_data: MemoryCreate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new memory"""
    memory_service = MemoryService(db)
    memory_data.user_id = user_id  # Ensure user_id matches authenticated user
    return await memory_service.create_memory(memory_data)


@app.get(f"{settings.API_V1_PREFIX}/memories", response_model=List[MemoryResponse])
async def get_memories(
    memory_type: Optional[str] = None,
    chat_id: Optional[UUID] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's memories"""
    memory_service = MemoryService(db)
    return await memory_service.get_user_memories(user_id, memory_type, chat_id, limit, offset)


@app.post(f"{settings.API_V1_PREFIX}/memories/search", response_model=List[MemoryResponse])
async def search_memories(
    search_request: MemorySearchRequest,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search memories"""
    memory_service = MemoryService(db)
    return await memory_service.search_memories(user_id, search_request)


@app.delete(f"{settings.API_V1_PREFIX}/memories/{{memory_id}}")
async def delete_memory(
    memory_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a memory"""
    try:
        memory_service = MemoryService(db)
        await memory_service.delete_memory(memory_id, user_id)
        return {"message": "Memory deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ============================================================================
# Document/RAG Routes
# ============================================================================

@app.post(f"{settings.API_V1_PREFIX}/documents", response_model=DocumentResponse)
async def create_document(
    document_data: DocumentCreate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new document"""
    rag_service = RAGService(db)
    document_data.user_id = user_id
    return await rag_service.create_document(document_data)


@app.get(f"{settings.API_V1_PREFIX}/documents", response_model=List[DocumentResponse])
async def get_documents(
    limit: int = 50,
    offset: int = 0,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's documents"""
    rag_service = RAGService(db)
    return await rag_service.get_user_documents(user_id, limit, offset)


@app.delete(f"{settings.API_V1_PREFIX}/documents/{{document_id}}")
async def delete_document(
    document_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a document"""
    try:
        rag_service = RAGService(db)
        await rag_service.delete_document(document_id, user_id)
        return {"message": "Document deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
