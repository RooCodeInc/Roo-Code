/**
 * Factory for the global keyboard handler used in the prompt.
 *
 * Creates the callback passed to opentui's `useKeyboard()`, handling:
 * - Esc: dismiss overlays or cancel the current task
 * - Ctrl+C: double-press to exit
 * - Ctrl+M: cycle through available modes
 */

import type { KeyEvent } from "@opentui/core"
import type { WebviewMessage } from "@roo-code/types"

import type { ModeResult } from "../../types.js"

/** Dependencies required by the prompt keyboard handler. */
export interface PromptKeyboardContext {
	isActive: () => boolean
	hasOverlay: () => boolean
	dismissOverlay: () => void

	// Extension state
	isLoading: () => boolean
	availableModes: () => ModeResult[]
	currentMode: () => string | null
	sendToExtension: (msg: WebviewMessage) => void

	// Toast
	toastInfo: (msg: string) => void
	toastWarning: (msg: string) => void

	// Exit
	exit: () => void
	pendingExit: () => boolean
	setPendingExit: (v: boolean) => void
	exitTimer: { current: ReturnType<typeof setTimeout> | undefined }
}

/**
 * Create the keyboard handler callback for the prompt component.
 *
 * Returns a function suitable for passing to `useKeyboard()`.
 */
export function createPromptKeyboardHandler(ctx: PromptKeyboardContext): (event: KeyEvent) => void {
	return (event: KeyEvent) => {
		if (!ctx.isActive()) return

		const hasOverlay = ctx.hasOverlay()

		// Esc — cancel task or dismiss overlay
		if (event.name === "escape") {
			if (hasOverlay) {
				ctx.dismissOverlay()
				return
			}
			// Cancel current task when loading
			if (ctx.isLoading()) {
				ctx.sendToExtension({ type: "cancelTask" })
				ctx.toastInfo("Cancelling task...")
				return
			}
		}

		// Ctrl+C — double-press to exit
		if (event.name === "c" && event.ctrl) {
			if (hasOverlay) {
				ctx.dismissOverlay()
				return
			}

			if (ctx.pendingExit()) {
				// Second press — exit
				if (ctx.exitTimer.current) clearTimeout(ctx.exitTimer.current)
				ctx.exit()
				return
			}

			// First press — show hint
			ctx.setPendingExit(true)
			ctx.toastWarning("Press Ctrl+C again to exit")
			ctx.exitTimer.current = setTimeout(() => {
				ctx.setPendingExit(false)
			}, 2000)
			return
		}

		// Ctrl+M — cycle through modes
		if (event.name === "m" && event.ctrl) {
			if (ctx.isLoading()) {
				ctx.toastWarning("Cannot switch modes while task is in progress")
				return
			}

			const modes = ctx.availableModes()
			if (modes.length < 2) return

			const currentSlug = ctx.currentMode()
			const currentIndex = modes.findIndex((m) => m.slug === currentSlug)
			const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length
			const nextMode = modes[nextIndex]

			if (nextMode) {
				ctx.sendToExtension({ type: "mode", text: nextMode.slug })
				ctx.toastInfo(`Switched to ${nextMode.label}`)
			}
			return
		}
	}
}
