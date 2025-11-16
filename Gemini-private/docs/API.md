# API Documentation

Complete API reference for the AI Chat Platform.

## Base URL

```
Production: https://api.your-domain.com/api/v1
Development: http://localhost:8000/api/v1
```

## Authentication

All API requests (except login and registration) require authentication using JWT Bearer tokens.

### Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Getting a Token

**POST** `/auth/login`

Request:
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

## Endpoints

### Authentication

#### Register User
**POST** `/auth/register`

Request:
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePassword123!",
  "auth_provider": "local"
}
```

#### Login
**POST** `/auth/login`

#### SSO Login
**GET** `/auth/sso/login?redirect_uri=<uri>`

#### Refresh Token
**POST** `/auth/refresh`

Request:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Logout
**POST** `/auth/logout`

### Chats

#### Create Chat
**POST** `/chats`

Request:
```json
{
  "title": "My Chat",
  "model": "claude-sonnet-4.5",
  "system_prompt": "You are a helpful assistant",
  "metadata": {}
}
```

Response:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "123e4567-e89b-12d3-a456-426614174001",
  "title": "My Chat",
  "model": "claude-sonnet-4.5",
  "is_archived": false,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### Get Chats
**GET** `/chats?include_archived=false&limit=50&offset=0`

#### Get Chat
**GET** `/chats/{chat_id}`

#### Update Chat
**PATCH** `/chats/{chat_id}`

Request:
```json
{
  "title": "Updated Title",
  "is_archived": false
}
```

#### Delete Chat
**DELETE** `/chats/{chat_id}`

#### Get Messages
**GET** `/chats/{chat_id}/messages?limit=100&offset=0`

Response:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174002",
    "chat_id": "123e4567-e89b-12d3-a456-426614174000",
    "role": "user",
    "content": "Hello!",
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "chat_id": "123e4567-e89b-12d3-a456-426614174000",
    "role": "assistant",
    "content": "Hi! How can I help you?",
    "model": "claude-sonnet-4.5",
    "tokens_used": 25,
    "created_at": "2024-01-15T10:30:01Z"
  }
]
```

### Chat Completions

#### Send Message
**POST** `/chat/completions`

Request:
```json
{
  "chat_id": "123e4567-e89b-12d3-a456-426614174000",
  "model": "claude-sonnet-4.5",
  "messages": [
    {"role": "user", "content": "What is AI?"}
  ],
  "temperature": 0.7,
  "max_tokens": 4000,
  "stream": false,
  "use_web_grounding": false,
  "use_extended_thinking": false,
  "use_rag": false
}
```

Response:
```json
{
  "id": "cmpl-123",
  "model": "claude-sonnet-4.5",
  "message": {
    "role": "assistant",
    "content": "AI (Artificial Intelligence) is..."
  },
  "tokens_used": 150,
  "finish_reason": "stop"
}
```

### Memories

#### Create Memory
**POST** `/memories`

Request:
```json
{
  "content": "User prefers dark mode",
  "memory_type": "preference",
  "importance_score": 0.8,
  "metadata": {}
}
```

#### Get Memories
**GET** `/memories?memory_type=global&limit=50&offset=0`

#### Search Memories
**POST** `/memories/search`

Request:
```json
{
  "query": "dark mode",
  "memory_type": "preference",
  "limit": 10
}
```

#### Delete Memory
**DELETE** `/memories/{memory_id}`

### Documents

#### Upload Document
**POST** `/documents`

Request:
```json
{
  "title": "API Documentation",
  "content": "# API Docs\n\nThis document...",
  "mime_type": "text/markdown",
  "metadata": {"source": "manual"}
}
```

#### Get Documents
**GET** `/documents?limit=50&offset=0`

#### Delete Document
**DELETE** `/documents/{document_id}`

## Models

Available models:

- `claude-sonnet-4.5` - Claude Sonnet 4.5 (Anthropic)
- `claude-opus-4.1` - Claude Opus 4.1 (Anthropic)
- `gemini-2.5-flash` - Gemini 2.5 Flash (Google)
- `gemini-2.5-pro` - Gemini 2.5 Pro (Google)
- `gemma-7b` - Gemma 7B (Google)
- `gemma-2b` - Gemma 2B (Google)

## Rate Limits

- **Per Minute**: 60 requests
- **Per Hour**: 1000 requests

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642252800
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "bad_request",
  "message": "Invalid request parameters",
  "details": {"field": "validation error"}
}
```

### 401 Unauthorized
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

### 404 Not Found
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests"
}
```

### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

## Interactive Documentation

Visit `/docs` for Swagger UI with interactive API testing.

## Code Examples

### Python

```python
import requests

# Login
response = requests.post(
    "https://api.your-domain.com/api/v1/auth/login",
    json={"username": "user@example.com", "password": "password"}
)
token = response.json()["access_token"]

# Send message
response = requests.post(
    "https://api.your-domain.com/api/v1/chat/completions",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "model": "claude-sonnet-4.5",
        "messages": [{"role": "user", "content": "Hello!"}]
    }
)
print(response.json())
```

### JavaScript

```javascript
// Login
const loginRes = await fetch('https://api.your-domain.com/api/v1/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username: 'user@example.com', password: 'password'})
});
const {access_token} = await loginRes.json();

// Send message
const chatRes = await fetch('https://api.your-domain.com/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4.5',
    messages: [{role: 'user', content: 'Hello!'}]
  })
});
console.log(await chatRes.json());
```

### cURL

```bash
# Login
TOKEN=$(curl -X POST https://api.your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password"}' \
  | jq -r '.access_token')

# Send message
curl -X POST https://api.your-domain.com/api/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Webhooks

Configure webhooks to receive real-time events.

### Events

- `chat.created`
- `chat.deleted`
- `message.created`
- `memory.created`
- `document.uploaded`

### Webhook Payload

```json
{
  "event": "message.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174002",
    "chat_id": "123e4567-e89b-12d3-a456-426614174000",
    "content": "Hello!"
  }
}
```
