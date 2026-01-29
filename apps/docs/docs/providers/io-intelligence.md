---
description: This page explains how to configure and use the IO Intelligence provider with Roo Code.
keywords:
    - io intelligence
    - provider
    - ai models
    - llama
    - deepseek
    - qwen
    - mistral
sidebar_label: IO Intelligence
---

# IO Intelligence Provider

The IO Intelligence provider gives you access to a wide range of AI models, including those from Llama, DeepSeek, Qwen, and Mistral, through a unified API.

## Configuration

To use the IO Intelligence provider, you will need to add it to your `~/.roo/config.json` file.

1.  **Get your API key**: You can get an API key from the [IO Intelligence website](https://io.net/).
2.  **Add the provider to your config**: Add the following to your `config.json` file:

```json
{
	"providers": [
		{
			"id": "io-intelligence",
			"apiKey": "YOUR_IO_INTELLIGENCE_API_KEY"
		}
	]
}
```

## Available Models

The IO Intelligence provider supports multiple AI models including Llama, DeepSeek, Qwen, and Mistral.

For the current model list and specifications, see [IO Intelligence's documentation](https://io.net/).

Models can be specified in your API configuration profiles in [`~/.roo/config.json`](#configuration).
