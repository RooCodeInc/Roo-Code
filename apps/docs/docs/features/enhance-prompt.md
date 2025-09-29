---
description: Improve your AI interactions with Roo Code's Enhance Prompt feature. Automatically refine prompts for clarity, context, and better results with one click.
keywords:
    - enhance prompt
    - prompt optimization
    - AI prompts
    - prompt engineering
    - chat enhancement
    - prompt refinement
    - wand icon
image: /img/social-share.jpg
---

# Enhance Prompt

The "Enhance Prompt" feature in Roo Code helps you improve the quality and effectiveness of your prompts before sending them to the AI model. By clicking the wand icon in the chat input, you can automatically refine your initial request, making it clearer, more specific, and more likely to produce the desired results.

---

## Why Use Enhance Prompt?

- **Improved Clarity:** Roo Code can rephrase your prompt to make it more understandable for the AI model.
- **Added Context:** The enhancement process can add relevant context to your prompt, such as the current file path or selected code.
- **Better Instructions:** Roo Code can add instructions to guide the AI towards a more helpful response (e.g., requesting specific formatting or a particular level of detail).
- **Reduced Ambiguity:** Enhance Prompt helps to eliminate ambiguity and ensure that Roo Code understands your intent.
- **Consistency**: Roo will consistently format prompts the same way to the AI.
- **Context-Aware Suggestions:** When enabled, uses your recent conversation history to generate more relevant and accurate enhancements.

---

## How to Use Enhance Prompt

1.  **Type your initial prompt:** Enter your request in the Roo Code chat input box as you normally would. This can be a simple question, a complex task description, or anything in between.
2.  **Click the Wand Icon:** Instead of pressing Enter, click the wand icon located in the top right corner of the chat input box. While Roo processes your enhancement request, the wand icon will spin to indicate it's working.
3.  **Review the Enhanced Prompt:** Roo Code will replace your original prompt with an enhanced version. Review the enhanced prompt to make sure it accurately reflects your intent. You can further refine the enhanced prompt before sending. Changed your mind? You can undo the enhancement using Ctrl+Z (Cmd+Z on Mac) to restore your original prompt.
4.  **Send the Enhanced Prompt:** Press Enter or click the Send icon (<Codicon name="send" />) to send the enhanced prompt to Roo Code.

---

## Special Behaviors

### Empty Prompt Enhancement

If you click the enhance button with an empty prompt, Roo will show you a helpful message explaining how the feature works. This is a great way to learn about the enhancement feature if you're new to it.

### Message Queueing Support

The enhance button remains enabled even when message sending is disabled. This allows you to enhance prompts that will be queued for later sending.

---

## Customizing the Enhancement Process

The "Enhance Prompt" feature uses a customizable prompt template. You can modify this template to tailor the enhancement process to your specific needs.

### Accessing Prompts Settings

1.  **Open Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel or use the settings command.
2.  **Navigate to Prompts:** Go to the "Prompts" tab in the settings.
3.  **Select "ENHANCE":** From the dropdown menu, select "ENHANCE" to view and edit the enhancement prompt.

### Editing the Enhancement Prompt

The default enhancement prompt template is:

```
Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):

${userInput}
```

The `${userInput}` placeholder will be replaced with your original prompt. You can modify this template to fit your needs and the model's prompt format.

### Testing Your Custom Prompt

The Prompts settings include a test area where you can preview how your custom enhancement prompt works:

1. After editing your enhancement prompt, look for the "Test Enhancement" section
2. Enter a sample prompt to test
3. Click "Test" to see how your custom prompt would enhance it
4. Adjust your enhancement prompt as needed based on the results

---

## API Configuration

The API configuration used for Enhance Prompt is, by default, the same one that is selected for Roo Code tasks, but it can be changed:

1.  **Open Settings:** Navigate to Roo Code settings
2.  **Go to Prompts Tab:** Select the "Prompts" tab
3.  **Select "ENHANCE":** Choose "ENHANCE" from the dropdown
4.  **Configure API:** You'll see an "API Configuration" dropdown where you can choose an existing configuration. Future Enhance Prompt requests will be sent to that configured provider/model.

---

## Context-Aware Enhancement

The Enhance Prompt feature can now use your conversation history to generate more relevant suggestions. This helps reduce hallucinations and provides more accurate enhancements based on what you've been working on.

### How It Works

When enabled, the enhancement process includes your last 10 messages from the current conversation as context. This allows the AI to:

- Understand what you've been working on
- Maintain consistency with previous discussions
- Avoid suggesting unrelated or incorrect enhancements
- Provide more targeted and useful prompt improvements

### Enabling Task History Context

To enable or disable the use of conversation history in prompt enhancement:

1. **Open Settings:** Navigate to Roo Code settings
2. **Go to Prompts Tab:** Select the "Prompts" tab
3. **Select "ENHANCE":** Choose "ENHANCE" from the dropdown
4. **Toggle History Option:** Check or uncheck "Include task history in enhancement" for better context

When disabled, the enhancement will only consider your current prompt without any conversation context.

---

## Visual Feedback and UI Elements

### Button Appearance

- The wand icon appears semi-transparent (60% opacity) by default
- Becomes fully opaque (100%) when you hover over it
- Located in the top-right corner of the chat input box
- Has a focus ring for keyboard accessibility

### Loading State

- While processing your enhancement request, the wand icon spins
- This provides clear visual feedback that Roo is working on your prompt

### Tooltip

- Hovering over the button shows: "Enhance prompt with additional context"
- Helps new users understand the button's purpose

---

## Limitations and Best Practices

- **Experimental Feature:** Prompt enhancement is an experimental feature. The quality of the enhanced prompt may vary depending on the complexity of your request and the capabilities of the underlying model.
- **Review Carefully:** Always review the enhanced prompt before sending it. Roo Code may make changes that don't align with your intentions.
- **Iterative Process:** You can use the "Enhance Prompt" feature multiple times to iteratively refine your prompt.
- **Not a Replacement for Clear Instructions:** While "Enhance Prompt" can help, it's still important to write clear and specific prompts from the start.

By using the "Enhance Prompt" feature, you can improve the quality of your interactions with Roo Code and get more accurate and helpful responses.
