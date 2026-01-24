---
sidebar_label: Ollama
description: Set up Ollama with Roo Code to run open source language models locally for privacy, offline access, and cost-effective AI coding.
keywords:
    - Ollama
    - local models
    - Roo Code
    - open source AI
    - CodeLlama
    - Qwen
    - offline AI
    - privacy
    - context window configuration
---

import KangarooIcon from '@site/src/components/KangarooIcon';

# Using Ollama With Roo Code

Roo Code supports running models locally using Ollama. This provides privacy, offline access, and potentially lower costs, but requires more setup and a powerful computer.

**Website:** [https://ollama.com/](https://ollama.com/)

---

## Setting up Ollama

1.  **Download and Install Ollama:** Download the Ollama installer for your operating system from the [Ollama website](https://ollama.com/). Follow the installation instructions. Make sure Ollama is running

    ```bash
    ollama serve
    ```

2.  **Download a Model:** Browse [Ollama's model library](https://ollama.com/library) for all available models. To download a model, run:

    ```bash
    ollama pull <model_name>
    ```

    For example:

    ```bash
    ollama pull qwen2.5-coder:32b
    ```

3.  **Configure the Model:** Configure your model's context window in Ollama and save a copy.

    :::info Default Context Behavior
    **Roo Code automatically defers to the Modelfile's `num_ctx` setting by default.** When you use a model with Ollama, Roo Code reads the model's configured context window and uses it automatically. You don't need to configure context size in Roo Code settings - it respects what's defined in your Ollama model.
    :::

    **Option A: Interactive Configuration**

    Load the model (we will use `qwen2.5-coder:32b` as an example):

    ```bash
    ollama run qwen2.5-coder:32b
    ```

    Change context size parameter:

    ```bash
    /set parameter num_ctx 32768
    ```

    Save the model with a new name:

    ```bash
    /save your_model_name
    ```

    **Option B: Using a Modelfile (Recommended)**

    Create a `Modelfile` with your desired configuration:

    ```dockerfile
    # Example Modelfile for reduced context
    FROM qwen2.5-coder:32b

    # Set context window to 32K tokens (reduced from default)
    PARAMETER num_ctx 32768

    # Optional: Adjust temperature for more consistent output
    PARAMETER temperature 0.7

    # Optional: Set repeat penalty
    PARAMETER repeat_penalty 1.1
    ```

    Then create your custom model:

    ```bash
    ollama create qwen-32k -f Modelfile
    ```

    :::tip Override Context Window
    If you need to override the model's default context window:

    - **Permanently:** Save a new model version with your desired `num_ctx` using either method above
    - **Roo Code behavior:** Roo automatically uses whatever `num_ctx` is configured in your Ollama model
    - **Memory considerations:** Reducing `num_ctx` helps prevent out-of-memory errors on limited hardware
      :::

4.  **Configure Roo Code:**
    - Open the Roo Code sidebar (<KangarooIcon /> icon).
    - Click the settings gear icon (<Codicon name="gear" />).
    - Select "ollama" as the API Provider.
    - Enter the model tag or saved name from the previous step (e.g., `your_model_name`).
    - (Optional) Configure the base URL if you're running Ollama on a different machine. The default is `http://localhost:11434`.
    - (Optional) Enter an API Key if your Ollama server requires authentication.
    - (Advanced) Roo uses Ollama's native API by default for the "ollama" provider. An OpenAI-compatible `/v1` handler also exists but isn't required for typical setups.

---

## Tips and Notes

- **Resource Requirements:** Running large language models locally can be resource-intensive. Make sure your computer meets the minimum requirements for the model you choose.
- **Model Selection:** Experiment with different models to find the one that best suits your needs.
- **Offline Use:** Once you've downloaded a model, you can use Roo Code offline with that model.
- **Token Tracking:** Roo Code tracks token usage for models run via Ollama, helping you monitor consumption.
- **Ollama Documentation:** Refer to the [Ollama documentation](https://ollama.com/docs) for more information on installing, configuring, and using Ollama.

---

## Troubleshooting

### Out of Memory (OOM) on First Request

**Symptoms**

- First request from Roo fails with an out-of-memory error
- GPU/CPU memory usage spikes when the model first loads
- Works after you manually start the model in Ollama

**Cause**
If no model instance is running, Ollama spins one up on demand. During that cold start it may allocate a larger context window than expected. The larger context window increases memory usage and can exceed available VRAM or RAM. This is an Ollama startup behavior, not a Roo Code bug.

**Fixes**

1. **Preload the model**

    ```bash
    ollama run &lt;model-name&gt;
    ```

    Keep it running, then issue the request from Roo.

2. **Pin the context window (`num_ctx`)**

    - Option A — interactive session, then save:
        ```bash
        # inside `ollama run &lt;base-model&gt;`
        /set parameter num_ctx 32768
        /save &lt;your_model_name&gt;
        ```
    - Option B — Modelfile (recommended for reproducibility):
        ```dockerfile
        FROM &lt;base-model&gt;
        PARAMETER num_ctx 32768
        # Adjust based on your available memory:
        # 16384 for ~8GB VRAM
        # 32768 for ~16GB VRAM
        # 65536 for ~24GB+ VRAM
        ```
        Then create the model:
        ```bash
        ollama create &lt;your_model_name&gt; -f Modelfile
        ```

3. **Ensure the model's context window is pinned**
   Save your Ollama model with an appropriate `num_ctx` (via `/set` + `/save`, or preferably a Modelfile). **Roo Code automatically detects and uses the model's configured `num_ctx`** - there is no manual context size setting in Roo Code for the Ollama provider.

4. **Use smaller variants**
   If GPU memory is limited, use a smaller quant (e.g., q4 instead of q5) or a smaller parameter size (e.g., 7B/13B instead of 32B).

5. **Restart after an OOM**
    ```bash
    ollama ps
    ollama stop &lt;model-name&gt;
    ```

**Quick checklist**

- Model is running before Roo request
- `num_ctx` pinned (Modelfile or `/set` + `/save`)
- Model saved with appropriate `num_ctx` (Roo uses this automatically)
- Model fits available VRAM/RAM
- No leftover Ollama processes
