---
description: Discover expert tips and tricks for using Roo Code effectively. Learn best practices, productivity hacks, and advanced techniques.
keywords:
    - Roo Code tips
    - productivity tips
    - best practices
    - AI coding tips
    - advanced techniques
image: /img/social-share.jpg
---

# Tips & Tricks

A collection of quick tips to help you get the most out of Roo Code.

- Drag Roo Code to the [Secondary Sidebar](https://code.visualstudio.com/api/ux-guidelines/sidebars#secondary-sidebar) so you can see the Explorer, Search, Source Control, etc.
  <img src="/img/right-column-roo.gif" alt="Put Roo on the Right Column" width="900" />
- Once you have Roo Code in a separate sidebar from the file explorer, you can drag files from the explorer into the chat window (and even multiple at once). Just make sure to hold down the shift key after you start dragging the files.
- If you're not using [MCP](/features/mcp/overview), turn it off in the <Codicon name="server" /> MCP Servers tab to significantly cut down the size of the system prompt.
- To keep your [custom modes](/features/custom-modes) on track, limit the types of files that they're allowed to edit.
- If you hit the dreaded `input length and max tokens exceed context limit` error, you can recover by deleting a message, rolling back to a previous checkpoint, or switching over to a model with a long context window like Gemini for a message.
- In general, be thoughtful about your `Max Tokens` setting for thinking models. Every token you allocate to that takes away from space available to store conversation history. Consider only using high `Max Tokens` / `Max Thinking Tokens` settings with modes like Architect and Debug, and keeping Code mode at 16k max tokens or less.
- If there's a real world job posting for something you want a custom mode to do, try asking Code mode to `Create a custom mode based on the job posting at @[url]`
- If you want to really accelerate, check out multiple copies of your repository and run Roo Code on all of them in parallel (using git to resolve any conflicts, same as with human devs).
- When using Debug mode, ask Roo to "start a new task in Debug mode with all of the necessary context needed to figure out X" so that the debugging process uses its own context window and doesn't pollute the main task
- Add your own tips by clicking "Edit this page" below!
- To manage large files and reduce context/resource usage, adjust the `File read auto-truncate threshold` setting. This setting controls the number of lines read from a file in one batch. Lower values can improve performance when working with very large files, but may require more read operations. You can find this setting in the Roo Code settings under 'Advanced Settings'.
- Set up a keyboard shortcut for the [`roo.acceptInput` command](/features/keyboard-shortcuts) to accept suggestions or submit text input without using the mouse. Perfect for keyboard-focused workflows and reducing hand strain.
- Use **Sticky Models** to assign specialized AI models to different modes (reasoning model for planning, non-reasoning model for coding). Roo automatically switches to each mode's last-used model without manual selection.
- Customize the [context reduction prompt](/features/intelligent-context-condensing#customizing-the-context-condensing-prompt) if you find that for your domain/use case it forgets particular things. You can instruct it to preserve specific types of information that are critical to your workflow.
