---
description: Master keyboard navigation in Roo Code with customizable shortcuts, command execution, and prompt history navigation for efficient coding workflows.
keywords:
    - keyboard shortcuts
    - keyboard navigation
    - roo-cline.acceptInput
    - prompt history
    - accessibility
    - vim compatibility
image: /img/social-share.jpg
sidebar_label: Keyboard Navigation
---

# Keyboard Navigation

The Roo Code interface supports keyboard navigation and shortcuts to streamline your workflow and reduce dependence on mouse interactions.

---

## Available Keyboard Commands

Roo Code offers keyboard commands to enhance your workflow. This page focuses on the `roo-cline.acceptInput` command, but here's a quick reference to all keyboard commands:

| Command                 | Description                                  | Default Shortcut                    |
| ----------------------- | -------------------------------------------- | ----------------------------------- |
| `roo-cline.acceptInput` | Submit text or accept the primary suggestion | None (configurable)                 |
| `roo-cline.focusInput`  | Focus the Roo input box                      | None (configurable)                 |
| Add to Context          | Add selected code to Roo's context           | macOS: Cmd+Y; Windows/Linux: Ctrl+Y |
| Arrow Up/Down           | Navigate through prompt history              | Built-in                            |

### Key Benefits of Keyboard Commands

- **Keyboard-Driven Interface**: Submit text or select the primary suggestion button without mouse interaction
- **Improved Accessibility**: Essential for users with mobility limitations or those who experience discomfort with mouse usage
- **Vim/Neovim Compatibility**: Supports seamless transitions for developers coming from keyboard-centric environments
- **Workflow Efficiency**: Reduces context switching between keyboard and mouse during development tasks

---

## roo-cline.acceptInput Command

The `roo-cline.acceptInput` command lets you submit text or accept suggestions with keyboard shortcuts instead of clicking buttons or pressing Enter in the input area.

### What It Does

The `roo-cline.acceptInput` command is a general-purpose input submission command. When triggered, it:

- Submits your current text or image input when in the text input area (equivalent to pressing Enter)
- Clicks the primary (first) button when action buttons are visible (such as confirm/cancel buttons or any other action buttons)

### Detailed Setup Guide

#### Method 1: Using the VS Code UI

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Type "Preferences: Open Keyboard Shortcuts"
3. In the search box, type "roo-cline.acceptInput"
4. Locate "Roo: Accept Input/Suggestion" in the results
5. Click the + icon to the left of the command
6. Press your desired key combination (e.g., `Ctrl+Enter` or `Alt+Enter`)
7. Press Enter to confirm

#### Method 2: Editing keybindings.json directly

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Type "Preferences: Open Keyboard Shortcuts (JSON)"
3. Add the following entry to the JSON array:

```json
{
	"key": "ctrl+enter", // or your preferred key combination
	"command": "roo-cline.acceptInput",
	"when": "view == roo-cline.SidebarProvider || activeWebviewPanelId == roo-cline.TabPanelProvider"
}
```

Scoped examples:

- Sidebar Roo view only:

```json
{
	"key": "ctrl+enter",
	"command": "roo-cline.acceptInput",
	"when": "view == roo-cline.SidebarProvider"
}
```

- Editor Roo tab only:

```json
{
	"key": "ctrl+enter",
	"command": "roo-cline.acceptInput",
	"when": "activeWebviewPanelId == roo-cline.TabPanelProvider"
}
```

#### Recommended Key Combinations

Choose a key combination that doesn't conflict with existing VS Code shortcuts:

- `Alt+Enter` - Easy to press while typing
- `Ctrl+Space` - Familiar for those who use autocomplete
- `Ctrl+Enter` - Intuitive for command execution
- `Alt+A` - Mnemonic for "Accept"

## Add to Context Shortcut

- Default: macOS Cmd+Y; Windows/Linux Ctrl+Y
- Requires: when condition `editorTextFocus && editorHasSelection`
- Focus does not change automatically. To continue typing immediately, use “Roo: Focus Input” (`roo-cline.focusInput`) or click into the Roo panel.

### Practical Use Cases

#### Quick Development Workflows

- **Text Submission**: Send messages to Roo without moving your hands from the keyboard
- **Action Confirmations**: Accept operations like saving files, running commands, or applying diffs
- **Multi-Step Processes**: Move quickly through steps that require confirmation or input
- **Consecutive Tasks**: Chain multiple tasks together with minimal interruption

#### Keyboard-Centric Development

- **Vim/Neovim Workflows**: If you're coming from a Vim/Neovim background, maintain your keyboard-focused workflow
- **IDE Integration**: Use alongside other VS Code keyboard shortcuts for a seamless experience
- **Code Reviews**: Quickly accept suggestions when reviewing code with Roo
- **Documentation Writing**: Submit text and accept formatting suggestions when generating documentation

#### Accessibility Use Cases

- **Hand Mobility Limitations**: Essential for users who have difficulty using a mouse
- **Repetitive Strain Prevention**: Reduce mouse usage to prevent or manage repetitive strain injuries
- **Screen Reader Integration**: Works well with screen readers for visually impaired users
- **Voice Control Compatibility**: Can be triggered via voice commands when using voice control software

### Accessibility Benefits

The `roo-cline.acceptInput` command was designed with accessibility in mind:

- **Reduced Mouse Dependence**: Complete entire workflows without reaching for the mouse
- **Reduced Physical Strain**: Helps users who experience discomfort or pain from mouse usage
- **Alternative Input Method**: Supports users with mobility impairments who rely on keyboard navigation
- **Workflow Optimization**: Particularly valuable for users coming from keyboard-centric environments like Vim/Neovim

### Keyboard-Centric Workflows

Here are some complete workflow examples showing how to effectively use keyboard shortcuts with Roo:

#### Development Workflow Example

1. Open VS Code and navigate to your project
2. Open Roo via the sidebar
3. Type your request: "Create a REST API endpoint for user registration"
4. When Roo asks for framework preferences, use your `roo-cline.acceptInput` shortcut to select the first suggestion
5. Continue using the shortcut to accept code generation suggestions
6. When Roo offers to save the file, use the shortcut again to confirm
7. Use VS Code's built-in shortcuts to navigate through the created files

#### Code Review Workflow

1. Select code you want to review and use VS Code's "Copy" command
2. Ask Roo to review it: "Review this code for security issues"
3. As Roo asks clarifying questions about the code context, use your shortcut to accept suggestions
4. When Roo provides improvement recommendations, use the shortcut again to accept implementation suggestions

### Troubleshooting

| Issue                             | Solution                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shortcut doesn't work             | Ensure Roo is focused (click in the Roo panel first)                                                                                                 |
| Wrong suggestion selected         | The command always selects the first (primary) button; use mouse if you need a different option                                                      |
| Conflicts with existing shortcuts | Try a different key combination in VS Code keyboard settings                                                                                         |
| No visual feedback when used      | This is normal - the command silently activates the function without visual confirmation                                                             |
| Shortcut works inconsistently     | Make sure the `when` clause is properly configured (use `view == roo-cline.SidebarProvider` or `activeWebviewPanelId == roo-cline.TabPanelProvider`) |

### Technical Implementation

The `roo-cline.acceptInput` command is implemented as follows:

- Command registered as `roo-cline.acceptInput` with display title "Roo: Accept Input/Suggestion" in the command palette
- When triggered, it sends an "acceptInput" message to the active Roo webview
- The webview determines the appropriate action based on the current UI state:
    - Clicks the primary action button if action buttons are visible and enabled
    - Sends the message if the text area is enabled and contains text/images
- No default key binding - users assign their preferred shortcut

### Limitations

- Works only when the Roo interface is active
- Has no effect if no inputs or suggestions are currently available
- Prioritizes the primary (first) button when multiple options are shown

---

## Command Line Style Prompt History Navigation

Navigate your prompt history with a terminal-like experience using the arrow keys. This feature makes it easy to reuse and refine previous prompts, whether from your current conversation or past tasks.

### Key Features

- **Up/Down Arrows**: Cycle through previous prompts.
- **Context-Aware**: Switches between conversation and task history.
- **Preserves Input**: Remembers what you were typing.

### Why This Matters

**Before**: Reusing a prompt meant scrolling up, copying, and pasting.

- Tedious and slow
- Easy to lose your place
- Interrupted your workflow

**With Prompt History Navigation**: Quickly access past prompts without leaving the keyboard.

### How it Works

The navigation is designed to be intuitive and adapt to your current context.

#### In an Active Conversation

- **Arrow Up**: Shows the last prompt you sent. Keep pressing to go further back in the conversation.
- **Arrow Down**: Moves forward through the conversation history, eventually returning to the text you were typing.

#### Starting a New Chat

- **Arrow Up**: Shows the most recent prompt from your task history in the current workspace.
- **Arrow Down**: Moves forward through your task history.

#### Edge Cases

- If you start typing while navigating, the history is dismissed, and your new text is preserved.
- Navigation only works when your cursor is on the first or last line of the input box to avoid interfering with multi-line editing.

### Configuration

This feature is enabled by default. There are no settings to configure.

### Benefits

- **Faster Workflow**: Reuse prompts without using the mouse.
- **Better Context**: Easily access and build upon previous interactions.
- **Less Interruption**: Stay focused on the task at hand.

### Common Questions

**"Why doesn't anything happen when I press the up arrow?"**

- You might be in the middle of a multi-line prompt. The cursor must be on the first line.
- There might be no history available for the current context.

**"What's the difference between conversation and task history?"**

- **Conversation history** includes prompts from your current, active chat session.
- **Task history** includes the initial prompts from all previous tasks in your current workspace.
