---
sidebar_label: Human Relay
description: Use ChatGPT, Claude, or other web-based AI models in Roo Code without API keys. Manually relay messages between Roo Code and web interfaces.
keywords:
    - human relay
    - roo code
    - no api key
    - chatgpt web
    - claude web
    - manual relay
    - web ai models
    - free ai access
image: /img/social-share.jpg
---

# Human Relay Provider

The Human Relay provider allows you to use Roo Code with web-based AI models like ChatGPT or Claude without needing an API key. Instead, it relies on you to manually relay messages between Roo Code and the AI's web interface.

---

## How it Works

1.  **Select Human Relay**: Choose "Human Relay" as your API provider in Roo Code's settings. No API key is required.
2.  **Initiate a Request**: Start a chat or task with Roo Code as usual.
3.  **Dialog Prompt**: A dialog box will appear in VS Code. Your message to the AI is automatically copied to your clipboard.
4.  **Paste to Web AI**: Go to the web interface of your chosen AI (e.g., chat.openai.com, claude.ai) and paste the message from your clipboard into the chat input.
5.  **Copy AI Response**: Once the AI responds, copy its complete response text.
6.  **Paste Back to Roo Code**: Return to the dialog box in VS Code, paste the AI's response into the designated field, and click "Confirm".
7.  **Continue**: Roo Code will process the response as if it came directly from an API.

---

## Use Cases

This provider is useful if:

- You want to use models that don't offer direct API access.
- You prefer not to manage API keys.
- You need to leverage the specific capabilities or context available only in the web UI of certain AI models.

---

## Limitations

- **Manual Effort**: Requires constant copy-pasting between VS Code and your browser.
- **Slower Interaction**: The back-and-forth process is significantly slower than direct API integration.
- **Potential for Errors**: Manual copying and pasting can introduce errors or omissions.

Choose this provider when the benefits of using a specific web AI outweigh the inconvenience of the manual relay process.
