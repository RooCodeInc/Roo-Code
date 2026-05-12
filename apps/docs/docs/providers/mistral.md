---
sidebar_label: Mistral AI
description: Configure Roo Code to use Mistral AI models including Codestral for code generation, with support for function calling and vision.
keywords:
    - Mistral AI
    - Codestral
    - Roo Code
    - AI models
    - code generation
    - Pixtral
    - Ministral
    - function calling
    - La Plateforme
---

# Using Mistral AI With Roo Code

Roo Code supports accessing models through the Mistral AI API, including both standard Mistral models and the code-specialized Codestral model.

**Website:** [https://mistral.ai/](https://mistral.ai/)

---

## Getting an API Key

1.  **Sign Up/Sign In:** Go to the [Mistral Platform](https://console.mistral.ai/). Create an account or sign in. You may need to go through a verification process.
2.  **Create an API Key:**
    - [La Plateforme API Key](https://console.mistral.ai/api-keys/) and/or
    - [Codestral API Key](https://console.mistral.ai/codestral)

---

## Available Models

Roo Code supports all models available through Mistral AI's API.

For the complete, up-to-date model list and capabilities, see [Mistral's model documentation](https://docs.mistral.ai/getting-started/models/models_overview/).

---

## Configuration in Roo Code

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "Mistral" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your Mistral API key into the "Mistral API Key" field if you're using a `mistral` model. If you intend to use `codestral-latest`, see the "Codestral" section below.
4.  **Select Model:** Choose your desired model from the "Model" dropdown.

---

## Using Codestral

[Codestral](https://docs.mistral.ai/capabilities/code_generation/) is a model specifically designed for code generation and interaction.
Only for Codestral you could use different endpoints (Default: codestral.mistral.ai).
For the La Platforme API Key change the **Codestral Base Url** to: https://api.mistral.ai

To use Codestral:

1.  **Select "Mistral" as the API Provider.**
2.  **Select a Codestral Model**
3.  **Enter your Codestral (codestral.mistral.ai) or La Plateforme (api.mistral.ai) API Key.**
