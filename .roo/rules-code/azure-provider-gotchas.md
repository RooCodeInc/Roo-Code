# Azure Provider Gotchas & Forward Compatibility Notes

## Endpoint Patterns

- **Azure OpenAI:**  
  `{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}`  
  - `deployment` is required and maps to a user-created deployment, not just a model name.
  - `api-version` must be specified and should be forward-compatible with new Azure API releases.

- **Azure AI Foundry:**  
  `{endpoint}/api/v1/{deployment}/chat/completions?api-version={api_version}`  
  - Used for Foundry models (e.g., DeepSeek, Qwen, etc.).
  - Endpoint and deployment logic is distinct from Azure OpenAI.

## Authentication

- **API Key:**  
  - Use the `api-key` header for all requests.
  - Key must match the resource region and type.

- **Azure Active Directory (AAD):**  
  - If `azureUseAAD` is enabled and all credentials are present, a Bearer token is acquired using `@azure/identity`'s `ClientSecretCredential`.
  - The token is injected as `Authorization: Bearer ...` and takes precedence over `api-key`.
  - The resource scope is typically `https://cognitiveservices.azure.com/.default`.
  - If token acquisition fails, provider construction will throw.

## Model Registry & Forward Compatibility

- The provider registry accepts any model ID, including all current and future GPT-5 variants (e.g., `gpt-5-pro`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-ultra`, etc.).
- Unknown model IDs default to a safe fallback config, ensuring forward compatibility with new Azure/Foundry models.
- Model selection is always by deployment name, not just model name.

## Error Handling

- Azure-specific errors are normalized to user-friendly messages:
  - 429: Rate limit exceeded
  - 401: Authentication failed
  - 403: Permission denied
  - 404: Deployment/model not found
  - Quota/limit: Quota exceeded
- All other errors are surfaced with a provider-specific prefix.

## Testing

- Tests must mock both API key and AAD authentication flows.
- Endpoint URL construction must be validated for both OpenAI and Foundry patterns.
- Model registry logic must be tested for both known and unknown (future) model IDs.
- Error normalization must be tested for all major Azure error types.

## Other Notes

- API versioning is critical; always allow user override and default to the latest stable version.
- The provider is designed to be robust against future Azure API changes and model releases.
- If adding new Azure/Foundry models, no code changes are required—just update the deployment/model ID in the config/profile.
