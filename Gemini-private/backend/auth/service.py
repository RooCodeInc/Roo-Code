"""
Authentication Service
Handles user authentication, SSO integration, and session management
"""
import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID, uuid4
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.shared.models import (
    UserCreate, UserResponse, LoginRequest, TokenResponse,
    OAuth2CallbackRequest
)
from backend.shared.utils import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, generate_state_token
)
from backend.shared.config import settings

logger = logging.getLogger(__name__)


class AuthService:
    """Authentication service"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_user(self, user_data: UserCreate) -> UserResponse:
        """Register a new user with local authentication"""
        from database.models import User, UserProfile, UserSettings, UserRole, Role

        # Check if user exists
        existing = await self.db.execute(
            select(User).where(
                (User.email == user_data.email) | (User.username == user_data.username)
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User with this email or username already exists")

        # Hash password for local auth
        password_hash = None
        if user_data.auth_provider == 'local':
            if not user_data.password:
                raise ValueError("Password required for local authentication")
            password_hash = hash_password(user_data.password)

        # Create user
        user = User(
            id=uuid4(),
            email=user_data.email,
            username=user_data.username,
            password_hash=password_hash,
            auth_provider=user_data.auth_provider,
            external_id=user_data.external_id,
            is_active=True,
            is_verified=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(user)

        # Create default profile
        profile = UserProfile(
            id=uuid4(),
            user_id=user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(profile)

        # Create default settings
        settings_obj = UserSettings(
            id=uuid4(),
            user_id=user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(settings_obj)

        # Assign default 'user' role
        role = await self.db.execute(select(Role).where(Role.name == 'user'))
        role = role.scalar_one_or_none()
        if role:
            user_role = UserRole(
                id=uuid4(),
                user_id=user.id,
                role_id=role.id,
                created_at=datetime.utcnow()
            )
            self.db.add(user_role)

        await self.db.commit()
        await self.db.refresh(user)

        return UserResponse.model_validate(user)

    async def authenticate_user(self, login_data: LoginRequest) -> TokenResponse:
        """Authenticate user with username/password"""
        from database.models import User, Session

        # Find user
        result = await self.db.execute(
            select(User).where(
                (User.username == login_data.username) | (User.email == login_data.username)
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("Invalid credentials")

        if not user.is_active:
            raise ValueError("User account is inactive")

        # Verify password
        if user.auth_provider != 'local':
            raise ValueError("Please use SSO to log in")

        if not user.password_hash or not verify_password(login_data.password, user.password_hash):
            raise ValueError("Invalid credentials")

        # Update last login
        user.last_login = datetime.utcnow()

        # Create tokens
        access_token = create_access_token({"sub": str(user.id), "username": user.username})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        # Create session
        session = Session(
            id=uuid4(),
            user_id=user.id,
            session_token=access_token,
            refresh_token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        self.db.add(session)

        await self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    async def initiate_sso_login(self, redirect_uri: str) -> Dict[str, str]:
        """Initiate SSO login flow (Ping/OAuth2)"""
        if not settings.PING_SSO_ENABLED:
            raise ValueError("SSO is not enabled")

        state = generate_state_token()

        # Store state in Redis with TTL
        # In production, store in Redis: await redis.setex(f"oauth_state:{state}", 300, redirect_uri)

        auth_url = (
            f"{settings.PING_AUTHORIZATION_ENDPOINT}"
            f"?client_id={settings.PING_CLIENT_ID}"
            f"&response_type=code"
            f"&redirect_uri={settings.PING_REDIRECT_URI}"
            f"&state={state}"
            f"&scope=openid profile email"
        )

        return {
            "authorization_url": auth_url,
            "state": state
        }

    async def handle_sso_callback(self, callback_data: OAuth2CallbackRequest) -> TokenResponse:
        """Handle SSO callback and create/login user"""
        from database.models import User, Session

        # Verify state (in production, check Redis)
        # state_valid = await redis.get(f"oauth_state:{callback_data.state}")
        # if not state_valid:
        #     raise ValueError("Invalid state parameter")

        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                settings.PING_TOKEN_ENDPOINT,
                data={
                    "grant_type": "authorization_code",
                    "code": callback_data.code,
                    "redirect_uri": callback_data.redirect_uri,
                    "client_id": settings.PING_CLIENT_ID,
                    "client_secret": settings.PING_CLIENT_SECRET,
                }
            )
            token_data = token_response.json()

            # Get user info
            userinfo_response = await client.get(
                settings.PING_USERINFO_ENDPOINT,
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            userinfo = userinfo_response.json()

        # Find or create user
        result = await self.db.execute(
            select(User).where(User.external_id == userinfo['sub'])
        )
        user = result.scalar_one_or_none()

        if not user:
            # Create new SSO user
            user_create = UserCreate(
                email=userinfo['email'],
                username=userinfo.get('preferred_username', userinfo['email']),
                auth_provider='ping_sso',
                external_id=userinfo['sub']
            )
            user_response = await self.register_user(user_create)
            user = await self.db.get(User, user_response.id)
        else:
            # Update last login
            user.last_login = datetime.utcnow()

        # Create our own tokens
        access_token = create_access_token({"sub": str(user.id), "username": user.username})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        # Create session
        session = Session(
            id=uuid4(),
            user_id=user.id,
            session_token=access_token,
            refresh_token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        self.db.add(session)

        await self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """Refresh access token using refresh token"""
        from database.models import Session

        # Verify refresh token
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise ValueError("Invalid token type")
            user_id = UUID(payload["sub"])
        except ValueError as e:
            raise ValueError(f"Invalid refresh token: {e}")

        # Find session
        result = await self.db.execute(
            select(Session).where(Session.refresh_token == refresh_token)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError("Session not found")

        if session.expires_at < datetime.utcnow():
            raise ValueError("Session expired")

        # Create new access token
        access_token = create_access_token({"sub": str(user_id)})

        # Update session
        session.session_token = access_token
        session.last_activity = datetime.utcnow()

        await self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    async def logout(self, access_token: str):
        """Logout user and invalidate session"""
        from database.models import Session

        result = await self.db.execute(
            select(Session).where(Session.session_token == access_token)
        )
        session = result.scalar_one_or_none()

        if session:
            await self.db.delete(session)
            await self.db.commit()

    async def verify_token(self, token: str) -> UUID:
        """Verify access token and return user ID"""
        try:
            payload = decode_token(token)
            user_id = UUID(payload["sub"])
            return user_id
        except ValueError as e:
            raise ValueError(f"Invalid token: {e}")
