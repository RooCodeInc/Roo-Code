---
sidebar_label: SambaNova
description: Configure SambaNova's high-speed AI models in Roo Code. Experience enterprise-grade inference with competitive performance and diverse model selection.
keywords:
    - sambanova
    - sambanova ai
    - roo code
    - api provider
    - high-speed inference
    - enterprise ai
    - llm provider
    - fast inference
image: /img/social-share.jpg
---

# Using SambaNova With Roo Code

SambaNova specializes in providing high-speed inference for large language models, utilizing their Reconfigurable Dataflow Units (RDUs) through their SambaCloud portal. This delivers fast response times for supported models.

**Website:** [https://cloud.sambanova.ai/](https://cloud.sambanova.ai/)

---

## Getting an API Key

To use SambaNova with Roo Code, you'll need an API key from the [SambaCloud](https://cloud.sambanova.ai?utm_source=roocode&utm_medium=external&utm_campaign=cloud_signup). After signing up, navigate to the API Keys section in the left panel to create and copy your SambaCloud API key.

---

## Supported Models

Roo Code will attempt to fetch the list of available models from the SambaNova API. Common models available via SambaCloud include:

- `DeepSeek-R1`
- `DeepSeek-V3-0324`
- `DeepSeek-R1-Distill-Llama-70B`
- `Meta-Llama-3.3-70B-Instruct`
- `Meta-Llama-3.1-8B-Instruct`
- `Llama-4-Maverick-17B-128E-Instruct`
- `Qwen3-32B`
- `Llama-3.3-Swallow-70B-Instruct-v0.4`

Refer to the [SambaCloud Documentation](https://docs.sambanova.ai/cloud/docs/get-started/supported-models) for the most up-to-date list of supported models and their capabilities.

---

## Configuration in Roo Code

1. **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2. **Select Provider:** Choose "SambaNova" from the "API Provider" dropdown.
3. **Enter API Key:** Paste your SambaNova API key into the "SambaNova API Key" field.
4. **Select Model:** Choose your desired model from the "Model" dropdown.
5. **(Optional) Custom Base URL:** If using a private deployment, check "Use custom base URL" and enter your endpoint URL.
