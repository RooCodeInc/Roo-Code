---
sidebar_label: Qwen Code CLI
description: Access Qwen3 Coder models through OAuth authentication. 1M context windows with automatic token refresh.
keywords:
    - qwen code
    - qwen cli
    - qwen3 coder
    - roo code
    - api provider
    - oauth
    - alibaba
    - dashscope
image: /img/social-share.jpg
---

# Qwen Code CLI Provider

Access Alibaba's Qwen3 Coder models through OAuth authentication with automatic token refresh. Features massive 1M token context windows optimized for large codebases.

:::info Setup Required

1. **Install Qwen Client**: Download from the official website
2. **Authenticate**: Run the client and sign in to create OAuth credentials
3. **Configure in Roo Code**: Select "Qwen Code CLI API" as your provider
    - Default path `~/.qwen/oauth_creds.json` works automatically
    - Or specify a custom credentials path if needed
      :::

**Website:** [https://chat.qwen.ai](https://chat.qwen.ai)

---

## Supported Models

Both models offer 1M context windows and 65K max output tokens (currently free):

- **qwen3-coder-plus** (Default) - High-performance coding model
- **qwen3-coder-flash** - Speed-optimized variant

---

## Configuration

### OAuth Credentials Path

- **Default**: `~/.qwen/oauth_creds.json`
- **Custom paths supported**: Both absolute and `~/` prefixed paths
- Created automatically when you authenticate with the Qwen client

---

## Key Features

- **OAuth 2.0**: Secure authentication with automatic token refresh
- **1M Context**: Handle entire codebases in a single conversation
- **Auto-refresh**: Tokens refresh transparently with 30-second buffer
- **Free Tier**: 2,000 requests/day and 60 requests/minute with no token limits, available during a promotional period.
- **Reasoning Support**: Full support for thinking blocks

---

## Common Issues

**"Cannot find credentials file"**

- Ensure you've authenticated with the Qwen client
- Check file exists at `~/.qwen/oauth_creds.json`

**"Token refresh failed"**

- Check network connectivity
- Re-authenticate with the Qwen client

**"401 Unauthorized"**

- Provider should auto-refresh (check logs)
- If persistent, delete credentials and re-authenticate
