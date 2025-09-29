---
sidebar_label: LiteLLM
description: Access over 100 LLMs through LiteLLM's unified OpenAI-compatible API in Roo Code. Simplify multi-model management and reduce costs.
keywords:
    - litellm
    - roo code
    - api provider
    - unified api
    - openai compatible
    - multi model
    - llm proxy
    - local deployment
    - cost management
image: /img/social-share.jpg
---

# Using LiteLLM With Roo Code

LiteLLM is a versatile tool that provides a unified interface to over 100 Large Language Models (LLMs) by offering an OpenAI-compatible API. This allows you to run a local server that can proxy requests to various model providers or serve local models, all accessible through a consistent API endpoint.

**Website:** [https://litellm.ai/](https://litellm.ai/) (Main project) & [https://docs.litellm.ai/](https://docs.litellm.ai/) (Documentation)

---

## Key Benefits

- **Unified API:** Access a wide range of LLMs (from OpenAI, Anthropic, Cohere, HuggingFace, etc.) through a single, OpenAI-compatible API.
- **Local Deployment:** Run your own LiteLLM server locally, giving you more control over model access and potentially reducing latency.
- **Simplified Configuration:** Manage credentials and model configurations in one place (your LiteLLM server) and let Roo Code connect to it.
- **Cost Management:** LiteLLM offers features for tracking costs across different models and providers.

---

## Setting Up Your LiteLLM Server

To use LiteLLM with Roo Code, you first need to set up and run a LiteLLM server.

### Installation

1. Install LiteLLM with proxy support:
    ```bash
    pip install 'litellm[proxy]'
    ```

### Configuration

2. Create a configuration file (`config.yaml`) to define your models and providers:

    ```yaml
    model_list:
        # Configure Anthropic models
        - model_name: claude-3-7-sonnet
          litellm_params:
              model: anthropic/claude-3-7-sonnet-20250219
              api_key: os.environ/ANTHROPIC_API_KEY

        # Configure OpenAI models
        - model_name: gpt-4o
          litellm_params:
              model: openai/gpt-4o
              api_key: os.environ/OPENAI_API_KEY

        # Configure Azure OpenAI
        - model_name: azure-gpt-4
          litellm_params:
              model: azure/my-deployment-name
              api_base: https://your-resource.openai.azure.com/
              api_version: "2023-05-15"
              api_key: os.environ/AZURE_API_KEY
    ```

### Starting the Server

3. Start the LiteLLM proxy server:

    ```bash
    # Using configuration file (recommended)
    litellm --config config.yaml

    # Or quick start with a single model
    export ANTHROPIC_API_KEY=your-anthropic-key
    litellm --model claude-3-7-sonnet-20250219
    ```

4. The proxy will run at `http://0.0.0.0:4000` by default (accessible as `http://localhost:4000`).
    - You can also configure an API key for your LiteLLM server itself for added security.

Refer to the [LiteLLM documentation](https://docs.litellm.ai/docs/) for detailed instructions on advanced server configuration and features.

---

## Configuration in Roo Code

Once your LiteLLM server is running, you have two options for configuring it in Roo Code:

### Option 1: Using the LiteLLM Provider (Recommended)

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "LiteLLM" from the "API Provider" dropdown.
3.  **Enter Base URL:**
    - Input the URL of your LiteLLM server.
    - Defaults to `http://localhost:4000` if left blank.
4.  **Enter API Key (Optional):**
    - If you've configured an API key for your LiteLLM server, enter it here.
    - If your LiteLLM server doesn't require an API key, Roo Code will use a default dummy key (`"dummy-key"`), which should work fine.
5.  **Select Model:**
    - Roo Code will attempt to fetch the list of available models from your LiteLLM server by querying the `${baseUrl}/v1/model/info` endpoint.
    - The models displayed in the dropdown are sourced from this endpoint.
    - Use the refresh button to update the model list if you've added new models to your LiteLLM server.
    - If no model is selected, Roo Code defaults to `anthropic/claude-3-7-sonnet-20250219` (this is `litellmDefaultModelId`). Ensure this model (or your desired default) is configured and available on your LiteLLM server.

### Option 2: Using OpenAI Compatible Provider

Alternatively, you can configure LiteLLM using the "OpenAI Compatible" provider:

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "OpenAI Compatible" from the "API Provider" dropdown.
3.  **Enter Base URL:** Input your LiteLLM proxy URL (e.g., `http://localhost:4000`).
4.  **Enter API Key:** Use any string as the API key (e.g., `"sk-1234"`) since LiteLLM handles the actual provider authentication.
5.  **Select Model:** Choose the model name you configured in your `config.yaml` file.

<img src="/img/litellm/litellm.png" alt="Roo Code LiteLLM Provider Settings" width="600" />

---

## How Roo Code Fetches and Interprets Model Information

When you configure the LiteLLM provider, Roo Code interacts with your LiteLLM server to get details about the available models:

- **Model Discovery:** Roo Code makes a GET request to `${baseUrl}/v1/model/info` on your LiteLLM server. If an API key is provided in Roo Code's settings, it's included in the `Authorization: Bearer ${apiKey}` header.
- **Model Properties:** For each model reported by your LiteLLM server, Roo Code extracts and interprets the following:
    - `model_name`: The identifier for the model.
    - `maxTokens`: Maximum output tokens. Defaults to `8192` if not specified by LiteLLM.
    - `contextWindow`: Maximum context tokens. Defaults to `200000` if not specified by LiteLLM.
    - `supportsImages`: Determined from `model_info.supports_vision` provided by LiteLLM.
    - `supportsPromptCache`: Determined from `model_info.supports_prompt_caching` provided by LiteLLM.
    - `inputPrice` / `outputPrice`: Calculated from `model_info.input_cost_per_token` and `model_info.output_cost_per_token` from LiteLLM.
    - `supportsComputerUse`: This flag is set to `true` if the underlying model identifier (from `litellm_params.model`, e.g., `openrouter/anthropic/claude-3.5-sonnet`) matches one of the Anthropic models predefined in Roo Code as suitable for "computer use" (see `COMPUTER_USE_MODELS` in technical details).

Roo Code uses default values for some of these properties if they are not explicitly provided by your LiteLLM server's `/model/info` endpoint for a given model. The defaults are:

- `maxTokens`: 8192
- `contextWindow`: 200,000
- `supportsImages`: `true`
- `supportsComputerUse`: `true` (for the default model ID)
- `supportsPromptCache`: `true`
- `inputPrice`: 3.0 (µUSD per 1k tokens)
- `outputPrice`: 15.0 (µUSD per 1k tokens)

---

## Tips and Notes

- **LiteLLM Server is Key:** The primary configuration for models, API keys for downstream providers (like OpenAI, Anthropic), and other advanced features are managed on your LiteLLM server. Roo Code acts as a client to this server.
- **Configuration Options:** You can use either the dedicated "LiteLLM" provider (recommended) for automatic model discovery, or the "OpenAI Compatible" provider for simple manual configuration.
- **Model Availability:** The models available in Roo Code's "Model" dropdown depend entirely on what your LiteLLM server exposes through its `/v1/model/info` endpoint.
- **Network Accessibility:** Ensure your LiteLLM server is running and accessible from the machine where VS Code and Roo Code are running (e.g., check firewall rules if not on `localhost`).
- **Troubleshooting:** If models aren't appearing or requests fail:
    - Verify your LiteLLM server is running and configured correctly.
    - Check the LiteLLM server logs for errors.
    - Ensure the Base URL in Roo Code settings matches your LiteLLM server's address.
    - Confirm any API key required by your LiteLLM server is correctly entered in Roo Code.
- **Computer Use Models:** The `supportsComputerUse` flag in Roo Code is primarily relevant for certain Anthropic models known to perform well with tool-use and function-calling tasks. If you are routing other models through LiteLLM, this flag might not be automatically set unless the underlying model ID matches the specific Anthropic ones Roo Code recognizes.

By leveraging LiteLLM, you can significantly expand the range of models accessible to Roo Code while centralizing their management.
