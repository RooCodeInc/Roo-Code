---
sidebar_label: "Footgun Prompting"
description: Advanced guide to overriding system prompts in Roo Code. Learn how to customize AI behavior with caution using system prompt overrides.
keywords:
    - footgun prompting
    - system prompt override
    - advanced customization
    - Roo Code configuration
    - custom prompts
image: /img/social-share.jpg
---

# Footgun Prompting: Override System Prompts

Footgun Prompting (System Prompt Override) lets you replace the default system prompt for a specific Roo Code mode. This offers granular control but bypasses built-in safeguards. Use with caution.

<img src="/img/footgun-prompting/footgun-prompting-1.png" alt="Warning indicator for active system prompt override" width="600" />
**Warning Indicator:** When a system prompt override is active for the current mode, Roo Code will display a warning icon in the chat input area to remind you that the default behavior has been modified.

:::info **footgun** _(noun)_

1.  _(programming slang, humorous, derogatory)_ Any feature likely to lead to the programmer shooting themself in the foot.

> The System Prompt Override is considered a footgun because modifying the core instructions without a deep understanding can lead to unexpected or broken behavior, especially regarding tool usage and response consistency.

:::

---

## How It Works

1.  **Override File:** Create a file named `.roo/system-prompt-{mode-slug}` in your workspace root (e.g., `.roo/system-prompt-code` for the Code mode).
2.  **Content:** The content of this file becomes the new system prompt for that specific mode.
3.  **Activation:** Roo Code automatically detects this file. When present, it replaces most of the standard system prompt sections.
4.  **Preserved Sections:** Only the core `roleDefinition` and any `customInstructions` you've set for the mode are kept alongside your override content. Standard sections like tool descriptions, rules, and capabilities are bypassed.
5.  **Construction:** The final prompt sent to the model looks like this:

    ```
    ${roleDefinition}

    ${content_of_your_override_file}

    ${customInstructions}
    ```

---

## Accessing the Feature

Find the option and instructions in the Roo Code UI:

1.  Click the <Codicon name="notebook" /> icon in the Roo Code top menu bar.
2.  Expand the **"Advanced: Override System Prompt"** section.
3.  Clicking the file path link within the explanation will open or create the correct override file for the currently selected mode in VS Code.

<img src="/img/footgun-prompting/footgun-prompting.png" alt="UI showing the Advanced: Override System Prompt section" width="500" />

---

## Using Context Variables

When creating your custom system prompt file, you can use special variables (placeholders) that Roo Code will automatically replace with relevant information about the current environment. This allows you to make your prompts more dynamic and context-aware.

Here are the available variables:

- `{{mode}}`: The slug (short name) of the current Roo Code mode being used (e.g., `code`, `chat-mode`).
- `{{language}}`: The display language configured in VS Code (e.g., `en`, `es`).
- `{{shell}}`: The default terminal shell configured in VS Code (e.g., `/bin/bash`, `powershell.exe`).
- `{{operatingSystem}}`: The type of operating system your computer is running (e.g., `Linux`, `Darwin` for macOS, `Windows_NT`).
- `{{workspace}}`: The file path to the root of your current project workspace.

**Example Usage:**

You can include these variables directly in your prompt file content like this:

```
You are assisting a user in the '{{mode}}' mode.
Their operating system is {{operatingSystem}} and their default shell is {{shell}}.
The project is located at: {{workspace}}.
Please respond in {{language}}.
```

Roo Code substitutes these placeholders before sending the prompt to the model.

---

## Key Considerations & Warnings

- **Intended Audience:** Best suited for users deeply familiar with Roo Code's prompting system and the implications of modifying core instructions.
- **Impact on Functionality:** Custom prompts override standard instructions, including those for tool usage and response consistency. This can cause unexpected behavior or errors if not managed carefully.
- **Mode-Specific:** Each override file applies only to the mode specified in its filename (`{mode-slug}`).
- **No File, No Override:** If the `.roo/system-prompt-{mode-slug}` file doesn't exist, Roo Code uses the standard system prompt generation process for that mode.
- **Blank Files Ignored:** If the override file exists but is empty (blank), it will be ignored and the default system prompt will be used.
- **Directory Creation:** Roo Code ensures the `.roo` directory exists before attempting to read or create the override file.
  Use this feature cautiously. Incorrect implementation can significantly degrade Roo Code's performance and reliability for the affected mode.
