---
sidebar_label: Doubao
description: Configure ByteDance's Doubao AI models in Roo Code. Access competitive language models with full integration and internationalized support.
keywords:
    - doubao
    - bytedance
    - bytedance ai
    - roo code
    - api provider
    - doubao models
    - chinese ai
    - language models
image: /img/social-share.jpg
---

# Using Doubao With Roo Code

Doubao is ByteDance's Chinese AI service, offering competitive language models for various development tasks. The provider includes full API integration with embedding support and internationalized prompts.

**Website:** [https://www.volcengine.com/](https://www.volcengine.com/)

---

## Getting an API Key

1. **Sign Up/Sign In:** Visit the [Volcano Engine Console](https://console.volcengine.com/). Create an account or sign in.
2. **Navigate to Model Service:** Access the AI model service section in the console.
3. **Create API Key:** Generate a new API key for the Doubao service.
4. **Copy the Key:** **Important:** Copy the API key immediately and store it securely. You may not be able to view it again.

---

## Supported Models

Roo Code supports the following Doubao models:

- `doubao-seed-1-6-250615` (Default) - General purpose
- `doubao-seed-1-6-thinking-250715` - Enhanced reasoning
- `doubao-seed-1-6-flash-250715` - Speed optimized

All models support:

- 128,000 token context window
- 32,768 max output tokens
- Image inputs
- Prompt caching with 80% discount on cached reads

---

## Configuration in Roo Code

1. **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2. **Select Provider:** Choose "Doubao" from the "API Provider" dropdown.
3. **Enter API Key:** Paste your Doubao API key into the "Doubao API Key" field.
4. **Select Model:** Choose your desired model from the "Model" dropdown.

**Note:** Doubao uses the base URL `https://ark.cn-beijing.volces.com/api/v3` and servers are located in Beijing, China.
