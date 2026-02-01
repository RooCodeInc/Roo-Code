---
"roo-cline": minor
"@roo-code/types": minor
---

Add dedicated Azure OpenAI provider using @ai-sdk/azure package

- Add new "azure" provider type to support Azure OpenAI deployments via the AI SDK
- Implement AzureHandler following the established pattern from DeepSeek, Groq, and Fireworks migrations
- Add azureSchema with Azure-specific options: azureApiKey, azureResourceName, azureDeploymentName, azureApiVersion
- Use streamText/generateText from the AI SDK for cleaner streaming implementation
- Support tool calling via tool-input-start/delta/end events
- Include cache metrics extraction from providerMetadata
