/**
 * Context Tracking Integration
 *
 * Integrates the Context Engine behavioral tracking with VS Code events.
 * This enables the Context Engine to learn user behavior patterns for
 * better context building and suggestions.
 */

import * as vscode from "vscode"
import { ContextEngineService } from "../../services/context-engine"

/**
 * Setup context tracking for behavioral analysis
 * This should be called during extension activation
 */
export function setupContextTracking(context: vscode.ExtensionContext): void {
	const contextEngine = ContextEngineService.getInstance()
	if (!contextEngine) {
		console.log("[ContextTracking] ContextEngineService not available, skipping behavioral tracking setup")
		return
	}

	// Track active file changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				contextEngine.trackFileAccess(editor.document.uri.fsPath, "switch")
			}
		}),
	)

	// Track file open/close
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((document) => {
			if (document.uri.scheme === "file") {
				contextEngine.trackFileAccess(document.uri.fsPath, "open")
			}
		}),
	)

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((document) => {
			if (document.uri.scheme === "file") {
				contextEngine.trackFileAccess(document.uri.fsPath, "close")
			}
		}),
	)

	// Track cursor position changes (debounced)
	let cursorDebounceTimer: NodeJS.Timeout | undefined
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection((event) => {
			if (cursorDebounceTimer) {
				clearTimeout(cursorDebounceTimer)
			}

			cursorDebounceTimer = setTimeout(() => {
				if (event.textEditor && event.selections.length > 0) {
					const pos = event.selections[0].active
					contextEngine.trackCursor(
						{ line: pos.line, character: pos.character },
						event.textEditor.document.uri.fsPath,
					)
				}
			}, 500) // Debounce to 500ms to avoid excessive tracking
		}),
	)

	// Cleanup timer on deactivation
	context.subscriptions.push({
		dispose: () => {
			if (cursorDebounceTimer) {
				clearTimeout(cursorDebounceTimer)
			}
		},
	})

	console.log("[ContextTracking] Behavioral tracking setup complete")
}

/**
 * Get the current context engine instance
 */
export function getContextEngineService(): ContextEngineService | null {
	return ContextEngineService.getInstance()
}
