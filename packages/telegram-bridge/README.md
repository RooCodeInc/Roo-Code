# @roo-code/telegram-bridge

Telegram bridge for remote control of Roo Code. This MCP server enables you to interact with Roo Code via Telegram, allowing you to:

- **Receive messages**: Get real-time updates from Roo Code on your Telegram
- **Approve/Reject operations**: Use inline buttons to approve or deny tool operations
- **Send instructions**: Forward messages to Roo Code as new instructions
- **Monitor task status**: Track task progress remotely

## Prerequisites

1. **Create a Telegram Bot**:
   - Open Telegram and search for [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow the prompts
   - Save the bot token you receive

2. **Get your Chat ID**:
   - Start a conversation with your new bot
   - Send any message to the bot
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your `chat.id` in the response

## Installation

### As an MCP Server

Add the following to your MCP settings file (`~/.roo-code/settings/mcp_settings.json`):

```json
{
  "mcpServers": {
    "telegram-bridge": {
      "command": "node",
      "args": ["/path/to/roo-code/packages/telegram-bridge/build/index.js"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "your-bot-token",
        "TELEGRAM_CHAT_ID": "your-chat-id"
      }
    }
  }
}
```

### Build from Source

```bash
cd packages/telegram-bridge
npm install
npm run build
```

## Usage

Once the MCP server is running, you can use the following tools:

### start_bridge

Start the Telegram bridge with your credentials.

```json
{
  "botToken": "your-bot-token",
  "chatId": "your-chat-id",
  "socketPath": "/path/to/roo-code.sock",
  "enableTts": false
}
```

### stop_bridge

Stop the Telegram bridge.

### bridge_status

Get the current status of the bridge.

### send_telegram_message

Send a custom message to Telegram.

```json
{
  "message": "Hello from Roo Code!"
}
```

## Telegram Commands

Once connected, you can use these commands in Telegram:

- `/start` or `/help` - Show help message
- `/status` - Show connection status
- `/cancel` - Cancel the current task

Any other message will be forwarded to Roo Code as a new instruction.

## How It Works

1. The bridge connects to Roo Code via IPC (Inter-Process Communication)
2. It listens for task events and messages from Roo Code
3. Messages are formatted and sent to your Telegram chat
4. When approval is needed, inline buttons are shown
5. Button clicks and messages are sent back to Roo Code

## Architecture

```
┌─────────────┐     IPC      ┌──────────────────┐    Telegram API    ┌──────────┐
│  Roo Code   │◄────────────►│  Telegram Bridge │◄──────────────────►│ Telegram │
│  Extension  │              │   (MCP Server)   │                    │   App    │
└─────────────┘              └──────────────────┘                    └──────────┘
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | Yes |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | Yes |
| `ROO_CODE_SOCKET_PATH` | Custom IPC socket path | No |

## Security Considerations

- Keep your bot token secret - never commit it to version control
- The bridge only responds to messages from the configured chat ID
- Consider using a private chat or group for better security
- All communication between the bridge and Roo Code happens locally via IPC

## Troubleshooting

### Bridge not connecting

1. Ensure Roo Code is running with IPC enabled
2. Check the socket path is correct
3. Verify your bot token is valid

### Not receiving messages

1. Ensure you've started a conversation with the bot
2. Check the chat ID is correct
3. Look for errors in the MCP server logs

### Buttons not working

1. Make sure the bridge is still connected
2. Check for any error messages in Telegram
3. Try stopping and restarting the bridge

## License

Apache-2.0
