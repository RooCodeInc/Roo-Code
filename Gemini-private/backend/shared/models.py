"""
Shared data models using Pydantic for validation
"""
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, EmailStr, Field, validator
from uuid import UUID


# ============================================================================
# User Models
# ============================================================================

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=255)

class UserCreate(UserBase):
    password: Optional[str] = Field(None, min_length=8)
    auth_provider: Literal['local', 'ping_sso', 'ad', 'oauth2'] = 'local'
    external_id: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: UUID
    auth_provider: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================================
# User Profile Models
# ============================================================================

class UserProfileBase(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    timezone: str = 'UTC'
    language: str = 'en'

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(UserProfileBase):
    pass

class UserProfileResponse(UserProfileBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# User Settings Models
# ============================================================================

class UserSettingsBase(BaseModel):
    default_model: str = 'claude-sonnet-4.5'
    enable_web_grounding: bool = False
    enable_extended_thinking: bool = False
    enable_rag: bool = False
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(4000, ge=1, le=100000)
    theme: Literal['light', 'dark', 'auto'] = 'light'
    settings_json: Dict[str, Any] = {}

class UserSettingsUpdate(UserSettingsBase):
    pass

class UserSettingsResponse(UserSettingsBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Chat Models
# ============================================================================

class ChatBase(BaseModel):
    title: Optional[str] = None
    model: str
    system_prompt: Optional[str] = None
    metadata: Dict[str, Any] = {}

class ChatCreate(ChatBase):
    pass

class ChatUpdate(BaseModel):
    title: Optional[str] = None
    system_prompt: Optional[str] = None
    is_archived: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None

class ChatResponse(ChatBase):
    id: UUID
    user_id: UUID
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Message Models
# ============================================================================

class MessageBase(BaseModel):
    role: Literal['user', 'assistant', 'system']
    content: str

class MessageCreate(MessageBase):
    chat_id: UUID
    model: Optional[str] = None
    metadata: Dict[str, Any] = {}

class MessageResponse(MessageBase):
    id: UUID
    chat_id: UUID
    model: Optional[str]
    tokens_used: Optional[int]
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Memory Models
# ============================================================================

class MemoryBase(BaseModel):
    content: str
    memory_type: Literal['global', 'chat', 'user_fact', 'preference']
    importance_score: float = Field(0.5, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = {}

class MemoryCreate(MemoryBase):
    user_id: UUID
    chat_id: Optional[UUID] = None

class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    importance_score: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class MemoryResponse(MemoryBase):
    id: UUID
    user_id: UUID
    chat_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MemorySearchRequest(BaseModel):
    query: str
    memory_type: Optional[Literal['global', 'chat', 'user_fact', 'preference']] = None
    chat_id: Optional[UUID] = None
    limit: int = Field(10, ge=1, le=100)
    min_score: float = Field(0.0, ge=0.0, le=1.0)


# ============================================================================
# Document Models
# ============================================================================

class DocumentBase(BaseModel):
    title: str
    content: str
    mime_type: Optional[str] = None
    metadata: Dict[str, Any] = {}

class DocumentCreate(DocumentBase):
    user_id: UUID

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class DocumentResponse(DocumentBase):
    id: UUID
    user_id: UUID
    file_path: Optional[str]
    size_bytes: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Sharing Models
# ============================================================================

class ShareResourceRequest(BaseModel):
    resource_type: Literal['chat', 'memory', 'document']
    resource_id: UUID
    shared_with_user_id: Optional[UUID] = None
    shared_with_group_id: Optional[UUID] = None
    permission_level: Literal['read', 'write', 'admin'] = 'read'
    expires_at: Optional[datetime] = None

    @validator('shared_with_user_id', 'shared_with_group_id')
    def validate_share_target(cls, v, values):
        user_id = values.get('shared_with_user_id')
        group_id = values.get('shared_with_group_id')
        if user_id is None and group_id is None:
            raise ValueError('Must specify either shared_with_user_id or shared_with_group_id')
        if user_id is not None and group_id is not None:
            raise ValueError('Cannot specify both shared_with_user_id and shared_with_group_id')
        return v

class ShareResourceResponse(BaseModel):
    id: UUID
    resource_type: str
    resource_id: UUID
    owner_id: UUID
    shared_with_user_id: Optional[UUID]
    shared_with_group_id: Optional[UUID]
    permission_level: str
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================================
# Role & Permission Models
# ============================================================================

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleResponse(RoleBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    resource: str
    action: str

class PermissionResponse(PermissionBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Chat Completion Models
# ============================================================================

class ChatCompletionRequest(BaseModel):
    chat_id: Optional[UUID] = None
    model: str = 'claude-sonnet-4.5'
    messages: List[Dict[str, str]]
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(4000, ge=1, le=100000)
    stream: bool = False
    use_web_grounding: bool = False
    use_extended_thinking: bool = False
    use_rag: bool = False
    system_prompt: Optional[str] = None

class ChatCompletionResponse(BaseModel):
    id: str
    model: str
    message: Dict[str, str]
    tokens_used: int
    finish_reason: str
    metadata: Dict[str, Any] = {}


# ============================================================================
# Authentication Models
# ============================================================================

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = 'bearer'
    expires_in: int

class LoginRequest(BaseModel):
    username: str
    password: str

class OAuth2CallbackRequest(BaseModel):
    code: str
    state: str
    redirect_uri: str


# ============================================================================
# Error Models
# ============================================================================

class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
