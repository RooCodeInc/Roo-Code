"""
Application configuration
"""
import os
from typing import Optional, List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "AI Chat Platform"
    APP_VERSION: str = "1.0.0"
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # API
    API_V1_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_chat_platform"
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Authentication
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Ping SSO
    PING_SSO_ENABLED: bool = os.getenv("PING_SSO_ENABLED", "false").lower() == "true"
    PING_CLIENT_ID: Optional[str] = os.getenv("PING_CLIENT_ID")
    PING_CLIENT_SECRET: Optional[str] = os.getenv("PING_CLIENT_SECRET")
    PING_AUTHORIZATION_ENDPOINT: Optional[str] = os.getenv("PING_AUTHORIZATION_ENDPOINT")
    PING_TOKEN_ENDPOINT: Optional[str] = os.getenv("PING_TOKEN_ENDPOINT")
    PING_USERINFO_ENDPOINT: Optional[str] = os.getenv("PING_USERINFO_ENDPOINT")
    PING_REDIRECT_URI: Optional[str] = os.getenv("PING_REDIRECT_URI")

    # Active Directory
    AD_ENABLED: bool = os.getenv("AD_ENABLED", "false").lower() == "true"
    AD_SERVER: Optional[str] = os.getenv("AD_SERVER")
    AD_DOMAIN: Optional[str] = os.getenv("AD_DOMAIN")
    AD_BASE_DN: Optional[str] = os.getenv("AD_BASE_DN")

    # AI Model APIs
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    GOOGLE_AI_API_KEY: Optional[str] = os.getenv("GOOGLE_AI_API_KEY")
    VERTEX_AI_PROJECT: Optional[str] = os.getenv("VERTEX_AI_PROJECT")
    VERTEX_AI_LOCATION: str = os.getenv("VERTEX_AI_LOCATION", "us-central1")

    # Model Configuration
    SUPPORTED_MODELS: List[str] = [
        "claude-sonnet-4.5",
        "claude-opus-4.1",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemma-7b",
        "gemma-2b"
    ]

    # Embeddings
    EMBEDDING_MODEL: str = "text-embedding-004"  # Vertex AI
    EMBEDDING_DIMENSION: int = 1536

    # Web Grounding
    GOOGLE_SEARCH_API_KEY: Optional[str] = os.getenv("GOOGLE_SEARCH_API_KEY")
    GOOGLE_SEARCH_ENGINE_ID: Optional[str] = os.getenv("GOOGLE_SEARCH_ENGINE_ID")

    # GCP
    GCP_PROJECT_ID: Optional[str] = os.getenv("GCP_PROJECT_ID")
    GCP_REGION: str = os.getenv("GCP_REGION", "us-central1")
    GCS_BUCKET: Optional[str] = os.getenv("GCS_BUCKET")

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # CORS
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
