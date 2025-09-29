---
description: Access Google Gemini and Anthropic Claude models through GCP Vertex AI in Roo Code. Configure authentication and start using enterprise AI.
keywords:
    - Vertex AI
    - GCP
    - Google Cloud
    - Roo Code
    - Gemini
    - Claude
    - AI models
    - machine learning
    - cloud AI
image: /img/social-share.jpg
sidebar_label: GCP Vertex AI
---

# Using GCP Vertex AI With Roo Code

Roo Code supports accessing models through Google Cloud Platform's Vertex AI, a managed machine learning platform that provides access to various foundation models, including Anthropic's Claude family.

**Website:** [https://cloud.google.com/vertex-ai](https://cloud.google.com/vertex-ai)

---

## Prerequisites

- **Google Cloud Account:** You need an active Google Cloud Platform (GCP) account.
- **Project:** You need a GCP project with the Vertex AI API enabled.
- **Model Access:** You must request and be granted access to the specific Claude models on Vertex AI you want to use. See the [Google Cloud documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#before_you_begin) for instructions.
- **Application Default Credentials (ADC):** Roo Code uses Application Default Credentials to authenticate with Vertex AI. The easiest way to set this up is to:
    1.  Install the Google Cloud CLI: [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)
    2.  Authenticate using: `gcloud auth application-default login`
- **Service Account Key (Alternative):** Alternatively, you can authenticate using a Google Cloud Service Account key file. You'll need to generate this key in your GCP project. See the [Google Cloud documentation on creating service account keys](https://cloud.google.com/iam/docs/creating-managing-service-account-keys).

---

## Supported Models

Roo Code supports the following models through Vertex AI:

### Default Model

If no model is specified, Roo Code defaults to `claude-sonnet-4@20250514`.

### Google Gemini Models

#### Standard Models

- `gemini-2.5-flash` - Production version with prompt caching support
- `gemini-2.5-flash-preview-05-20` - Preview with 1M context window
- `gemini-2.5-flash-preview-04-17` - Preview without caching
- `gemini-2.5-flash-lite-preview-06-17` - Lite version with lower pricing
- `gemini-2.5-pro` - Production version with reasoning support
- `gemini-2.5-pro-preview-03-25` - Pro preview version
- `gemini-2.5-pro-preview-05-06` - Pro preview version
- `gemini-2.5-pro-preview-06-05` - Pro preview with reasoning support
- `gemini-2.5-pro-exp-03-25` - Experimental version (free)
- `gemini-2.0-flash-001` - 2.0 Flash model
- `gemini-2.0-flash-lite-001` - 2.0 Flash lite version
- `gemini-2.0-flash-thinking-exp-01-21` - Thinking/reasoning model
- `gemini-2.0-pro-exp-02-05` - 2.0 Pro experimental
- `gemini-1.5-flash-002` - 1.5 Flash model
- `gemini-1.5-pro-002` - 1.5 Pro model

#### Thinking/Reasoning Models

These models support enhanced reasoning capabilities with the `:thinking` suffix:

- `gemini-2.5-flash-preview-05-20:thinking`
- `gemini-2.5-flash-preview-04-17:thinking`

:::info
**Thinking Models:** Models with `:thinking` suffix enable step-by-step reasoning. The suffix is stripped before sending to the API but enables reasoning features in Roo Code. You'll need to enable the reasoning budget in settings to use these models effectively.
:::

### Anthropic Claude Models

- `claude-opus-4-1@20250805`
- `claude-opus-4@20250514`
- `claude-sonnet-4@20250514` (Default)
- `claude-3-7-sonnet@20250219`
- `claude-3-7-sonnet@20250219:thinking` - With reasoning support
- `claude-3-5-sonnet-v2@20241022`
- `claude-3-5-sonnet@20240620`
- `claude-3-5-haiku@20241022`
- `claude-3-opus@20240229`
- `claude-3-haiku@20240307`

### Other Models

- `llama-4-maverick-17b-128e-instruct-maas` - Meta Llama 4 model with 128K context window

Refer to the [Google Cloud documentation on Vertex AI Models](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models) for the most up-to-date list of available models and their IDs.

---

## Configuration in Roo Code

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "GCP Vertex AI" from the "API Provider" dropdown.
3.  **Configure Authentication:**

    Roo Code uses the following authentication priority:

    1. **Google Cloud Credentials (JSON):** If provided, this takes precedence
    2. **Google Cloud Key File Path:** If provided and no JSON credentials, this is used
    3. **Application Default Credentials (ADC):** Used as fallback when neither above is provided

    **Option 1 - Using ADC (Simplest):**

    - Install the Google Cloud CLI and run `gcloud auth application-default login`
    - No further configuration needed in Roo Code

    **Option 2 - Using Service Account Key:**

    - Either paste the JSON content directly into **Google Cloud Credentials** field
    - Or provide the file path in **Google Cloud Key File Path** field

4.  **Enter Project ID:** Enter your Google Cloud Project ID.
5.  **Select Region:** Choose the region where your Vertex AI resources are located (e.g., `us-east5`).
6.  **Select Model:** Choose your desired model from the "Model" dropdown.

---

## Advanced Features

### Gemini-Specific Features

When using Gemini models through Vertex AI, additional grounding features become available:

#### URL Context

Enable URL context to allow Gemini models to access and analyze web content directly. This feature allows Roo to:

- Read and understand web pages in real-time
- Analyze documentation from URLs
- Review online code repositories
- Access current information from websites

**Enabling URL Context:**

1. Select a Gemini model in your Vertex AI configuration
2. Enable the "URL Context" option that appears
3. Save your settings

#### Google Search Grounding

Enable Google Search grounding to enhance Gemini's responses with real-time search results. This provides:

- Up-to-date information from web searches
- Fact-checking capabilities
- Current event awareness
- Enhanced accuracy for technical queries

**Enabling Search Grounding:**

1. Select a Gemini model in your Vertex AI configuration
2. Enable the "Google Search Grounding" option that appears
3. Save your settings

:::note
URL Context and Google Search Grounding options only appear when a Gemini model is selected. These features may incur additional costs.
:::

---

## Tips and Notes

- **Permissions:** Ensure your Google Cloud account has the necessary permissions to access Vertex AI and the specific models you want to use.
- **Pricing:** Refer to the [Vertex AI pricing](https://cloud.google.com/vertex-ai/pricing) page for details.
