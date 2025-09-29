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
image: /img/social-share.jpg
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

The IO Intelligence provider supports the following models:

- `llama-3-70b`
- `deepseek-coder-v2`
- `qwen-2-72b`
- `mistral-large`

You can specify which model to use in your API configuration profiles.
