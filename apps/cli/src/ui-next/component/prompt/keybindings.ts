/**
 * Default key bindings for the prompt textarea.
 *
 * Enter submits the prompt, Option+Enter inserts a newline.
 */

import type { KeyBinding } from "@opentui/core"

/** Default key bindings: Enter submits, Option+Enter for newline */
export const PROMPT_KEYBINDINGS: KeyBinding[] = [
	{ name: "return", action: "submit" },
	{ name: "return", meta: true, action: "newline" },
]
