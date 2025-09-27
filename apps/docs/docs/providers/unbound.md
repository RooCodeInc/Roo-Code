---
description: Configure Unbound in Roo Code for secure access to multiple LLMs through a single API. Enterprise-grade security and compliance features.
keywords:
    - Unbound
    - Roo Code
    - LLM gateway
    - enterprise AI
    - secure AI
    - API provider
    - Anthropic
    - OpenAI
    - compliance
image: /img/social-share.jpg
sidebar_label: Unbound
---

# Using Unbound With Roo Code

Roo Code supports accessing models through [Unbound](https://getunbound.ai/), a platform that focuses on providing secure and reliable access to a variety of large language models (LLMs). Unbound acts as a gateway, allowing you to use models from providers like Anthropic and OpenAI without needing to manage multiple API keys and configurations directly. They emphasize security and compliance features for enterprise use.

**Website:** [https://getunbound.ai/](https://getunbound.ai/)

---

## Creating an Account

1.  **Sign Up/Sign In:** Go to the [Unbound gateway](https://gateway.getunbound.ai). Create an account or sign in.
2.  **Create an Application:** Go to the [Applications](https://gateway.getunbound.ai/ai-gateway-applications) page and hit the "Create Application" button.
3.  **Copy the API Key:** Copy the API key to your clipboard.

---

## Supported Models

Unbound allows you configure a list of supported models in your application, and Roo Code will automatically fetch the list of available models from the Unbound API.

---

## Configuration in Roo Code

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "Unbound" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your Unbound API key into the "Unbound API Key" field.
4.  **Select Model:** Choose your desired model from the "Model" dropdown.

---

## Tips and Notes

- **Security Focus:** Unbound emphasizes security features for enterprise use. If your organization has strict security requirements for AI usage, Unbound might be a good option.
- **Model List Refresh:** Roo Code includes a refresh button specifically for the Unbound provider in the settings. This allows you to easily update the list of available models from your Unbound application and get immediate feedback on your API key's validity.
