---
sidebar_label: Google Gemini
description: Use Google's Gemini AI models with Roo Code. Configure Gemini Flash, Pro, and experimental models for your development workflow.
keywords:
    - google gemini
    - gemini ai
    - roo code
    - api provider
    - gemini flash
    - gemini pro
    - google ai
    - gemini models
    - ai studio
image: /img/social-share.jpg
---

# Using Google Gemini With Roo Code

Roo Code supports Google's Gemini family of models through the Google AI Gemini API.

**Website:** [https://ai.google.dev/](https://ai.google.dev/)

---

## Getting an API Key

1.  **Go to Google AI Studio:** Navigate to [https://ai.google.dev/](https://ai.google.dev/).
2.  **Sign In:** Sign in with your Google account.
3.  **Create API Key:** Click on "Create API key" in the left-hand menu.
4.  **Copy API Key:** Copy the generated API key.

---

## Supported Models

Roo Code supports the following Gemini models:

### Standard Models

- `gemini-2.5-flash-preview-05-20`
- `gemini-2.5-flash-preview-04-17`
- `gemini-2.5-flash-lite-preview-06-17`
- `gemini-2.5-pro-exp-03-25`
- `gemini-2.0-flash-001`
- `gemini-2.0-flash-lite-preview-02-05`
- `gemini-2.0-pro-exp-02-05`
- `gemini-2.0-flash-exp`
- `gemini-1.5-flash-002`
- `gemini-1.5-flash-exp-0827`
- `gemini-1.5-flash-8b-exp-0827`
- `gemini-1.5-pro-002`
- `gemini-1.5-pro-exp-0827`
- `gemini-exp-1206`

### Thinking Models

These models require reasoning budget to be enabled in Roo Code settings:

- `gemini-2.5-flash-preview-05-20:thinking`
- `gemini-2.5-flash-preview-04-17:thinking`
- `gemini-2.0-flash-thinking-exp-01-21`
- `gemini-2.0-flash-thinking-exp-1219`

:::info
**Thinking Models:** Models with `:thinking` suffix or "thinking" in their name are hybrid reasoning models that provide step-by-step reasoning capabilities. To use these models, you must enable the reasoning budget feature in Roo Code settings.
:::

Refer to the [Gemini documentation](https://ai.google.dev/models/gemini) for more details on each model.

---

## Configuration in Roo Code

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "Google Gemini" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your Gemini API key into the "Gemini API Key" field.
4.  **Select Model:** Choose your desired Gemini model from the "Model" dropdown.

---

## Advanced Features

### URL Context

Gemini models can now access and analyze web content directly through URL context. This feature allows Roo to:

- Read and understand web pages in real-time
- Analyze documentation from URLs
- Review online code repositories
- Access current information from websites

#### Enabling URL Context

1. Open Roo Code Settings
2. Navigate to the Gemini provider settings
3. Enable "URL Context" option
4. Save your settings

#### Usage Example

```
Please analyze the documentation at https://example.com/api-docs and create a TypeScript client library based on the API specification.
```

### Google Search Grounding

Enable Google Search grounding to enhance Gemini's responses with real-time search results. This provides:

- Up-to-date information from web searches
- Fact-checking capabilities
- Current event awareness
- Enhanced accuracy for technical queries

#### Enabling Search Grounding

1. Open Roo Code Settings
2. Navigate to the Gemini provider settings
3. Enable "Google Search Grounding" option
4. Save your settings

#### Usage Example

```
What are the latest best practices for React Server Components in 2025? Please search for the most recent information.
```

### Combined Usage

Both features can be used together for powerful workflows:

```
Search for the latest Node.js security vulnerabilities and then analyze my package.json file to see if I'm affected. Also check the official Node.js security page for recommendations.
```

---

## Tips and Notes

- **Pricing:** Gemini API usage is priced based on input and output tokens. URL context and search grounding may incur additional costs. Some experimental models are available for free. Refer to the [Gemini pricing page](https://ai.google.dev/pricing) for detailed information.
- **Model Selection:** Choose models based on your needs:
    - **Flash models:** Faster and more cost-effective for most tasks
    - **Pro models:** Better for complex reasoning and analysis
    - **Thinking models:** Best for tasks requiring step-by-step reasoning (requires reasoning budget)
    - **Experimental models:** Latest features, may be free but less stable
- **Context Windows:** Most Gemini models support large context windows up to 1,048,576 tokens, allowing for extensive code analysis and documentation processing.
- **Rate Limits:** URL context and search grounding features may have separate rate limits. Monitor your usage to avoid hitting limits.
- **Privacy:** When using URL context, be mindful of accessing private or sensitive URLs. Ensure you have permission to analyze the content.
- **Search Quality:** Google Search grounding works best with specific, well-formed queries. Be clear about what information you need.
