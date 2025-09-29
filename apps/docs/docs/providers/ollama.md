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
image: /img/social-share.jpg
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

2.  **Download a Model:** Ollama supports many different models. You can find a list of available models on the [Ollama website](https://ollama.com/library). Some recommended models for coding tasks include:

    - `codellama:7b-code` (good starting point, smaller)
    - `codellama:13b-code` (better quality, larger)
    - `codellama:34b-code` (even better quality, very large)
    - `qwen2.5-coder:32b`
    - `mistralai/Mistral-7B-Instruct-v0.1` (good general-purpose model)
    - `deepseek-coder:6.7b-base` (good for coding tasks)
    - `llama3:8b-instruct-q5_1` (good for general tasks)

    To download a model, open your terminal and run:

    ```bash
    ollama pull <model_name>
    ```

    For example:

    ```bash
    ollama pull qwen2.5-coder:32b
    ```

3.  **Configure the Model:** Configure your model’s context window in Ollama and save a copy. Roo automatically reads the model’s reported context window from Ollama and passes it as `num_ctx`; no Roo-side context size setting is required for the Ollama provider.

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
    - Option B — Modelfile:
        ```text
        PARAMETER num_ctx 32768
        ```
        Then re-create the model:
        ```bash
        ollama create &lt;your_model_name&gt; -f Modelfile
        ```

3. **Ensure the model's context window is pinned**
   Save your Ollama model with an appropriate `num_ctx` (e.g., via `/set` + `/save`, or a Modelfile). Roo reads this automatically and passes it as `num_ctx`; there is no Roo-side context size setting for the Ollama provider.

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
