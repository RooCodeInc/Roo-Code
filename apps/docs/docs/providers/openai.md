---
sidebar_label: OpenAI
description: Connect Roo Code to OpenAI's official API for access to GPT-5, GPT-4o, o1, and o3 models with advanced reasoning capabilities and verbosity control.
keywords:
    - OpenAI
    - GPT-5
    - GPT-4o
    - o1 models
    - o3-mini
    - Roo Code
    - AI integration
    - reasoning models
    - API key
    - official OpenAI API
    - verbosity
    - reasoning effort
image: /img/social-share.jpg
---

# Using OpenAI With Roo Code

Roo Code supports accessing models directly through the official OpenAI API, including the latest GPT-5 family with advanced features like reasoning effort control and verbosity settings.

**Website:** [https://openai.com/](https://openai.com/)

---

## Getting an API Key

1.  **Sign Up/Sign In:** Go to the [OpenAI Platform](https://platform.openai.com/). Create an account or sign in.
2.  **Navigate to API Keys:** Go to the [API keys](https://platform.openai.com/api-keys) page.
3.  **Create a Key:** Click "Create new secret key". Give your key a descriptive name (e.g., "Roo Code").
4.  **Copy the Key:** **Important:** Copy the API key _immediately_. You will not be able to see it again. Store it securely.

---

## Supported Models

### GPT-5 Family (Latest)

The GPT-5 models are OpenAI's most advanced, offering superior coding capabilities and agentic task performance:

- **`gpt-5-2025-08-07`** (default) - Best model for coding and agentic tasks
- **`gpt-5-mini-2025-08-07`** - Faster, cost-efficient for well-defined tasks
- **`gpt-5-nano-2025-08-07`** - Fastest, most cost-efficient option

### GPT-4.1 Family

Advanced multimodal models with balanced capabilities:

- `gpt-4.1` - Advanced multimodal model
- `gpt-4.1-mini` - Balanced performance
- `gpt-4.1-nano` - Lightweight option

### o3 Reasoning Models

Models with configurable reasoning effort for complex problem-solving:

- `o3`, `o3-high`, `o3-low` - Different reasoning effort presets
- `o3-mini` (medium reasoning effort)
- `o3-mini-high` (high reasoning effort)
- `o3-mini-low` (low reasoning effort)

### o4 Models

Latest mini reasoning models:

- `o4-mini`, `o4-mini-high`, `o4-mini-low`

### o1 Family

Original reasoning models:

- `o1` - Original reasoning model
- `o1-preview` - Preview version
- `o1-mini` - Smaller variant

### GPT-4o Family

Optimized GPT-4 models:

- `gpt-4.5-preview`
- `gpt-4o` - Optimized GPT-4
- `gpt-4o-mini` - Smaller optimized variant

Refer to the [OpenAI Models documentation](https://platform.openai.com/docs/models) for the most up-to-date list of models and capabilities.

---

## Configuration in Roo Code

### Setup

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "OpenAI" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your OpenAI API key into the "OpenAI API Key" field.
4.  **Select Model:** Choose your desired model from the "Model" dropdown (defaults to `gpt-5-2025-08-07`).
5.  **(Optional) Base URL:** If you need to use a custom base URL, enter the URL. Most people won't need to adjust this.

---

## Advanced Features

### Reasoning Effort Control

For models that support reasoning (GPT-5, o1, o3, o4 families), you can control how deeply the model thinks:

**GPT-5 Models:**

- `minimal` - Fastest responses with basic reasoning
- `low` - Quick responses with light reasoning
- `medium` (default) - Balanced reasoning and response time
- `high` - Deep reasoning for complex problems

**o1/o3/o4 Models:**

- `low` - Minimal thinking time
- `medium` - Balanced approach
- `high` - Maximum thinking for complex problems

Some models have preset reasoning levels (e.g., `o3-high` always uses high reasoning).

### Verbosity Control

Available for GPT-5 models and select others, verbosity controls the detail level of responses:

- `low` - Concise, direct responses
- `medium` (default) - Balanced detail
- `high` - Comprehensive, detailed responses

### Temperature Settings

Temperature controls output randomness (0.0 to 2.0):

- **GPT-5 models:** Default 1.0 for balanced creativity
- **Other models:** Default 0.0 for deterministic output
- **Note:** Not available for o1/o3 reasoning models

### Conversation Continuity (GPT-5)

GPT-5 models maintain conversation context efficiently through response IDs, reducing token usage while preserving context. This happens automatically - no configuration needed.

---

## Tips and Notes

- **Pricing:** Refer to the [OpenAI Pricing](https://openai.com/pricing) page for details on model costs.
- **Azure OpenAI Service:** If you'd like to use the Azure OpenAI service, please see our section on [OpenAI-compatible](/providers/openai-compatible) providers.
