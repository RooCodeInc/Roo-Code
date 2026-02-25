/**
 * JoeInlineCompletionProvider — Ghost text inline completions powered by Joe AI.
 *
 * Registers as a VSCode InlineCompletionItemProvider for all languages.
 * On every keystroke (debounced 400ms), it:
 *   1. Captures the surrounding code context (200 lines window)
 *   2. Pulls in AugmentEngine's smart context (relevant files from the index)
 *   3. Calls the configured LLM with a fill-in-the-middle prompt
 *   4. Returns the predicted continuation as ghost text
 *
 * Supports: Anthropic (native), OpenAI-compatible providers.
 * Requires the user to have an API key configured in Joe Code settings.
 */

import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { AugmentEngine } from "./AugmentEngine"

const DEBOUNCE_MS = 400
const MAX_TOKENS = 80 // Keep completions short — one logical unit
const CONTEXT_LINES_BEFORE = 100
const CONTEXT_LINES_AFTER = 20
const MAX_PROMPT_CHARS = 6000

/** Model used for inline completions — fast and cheap */
const COMPLETION_MODEL = "claude-haiku-4-5-20251001"

export class JoeInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
	private debounceTimer: ReturnType<typeof setTimeout> | null = null
	private lastRequestId = 0
	private lastResult: vscode.InlineCompletionItem[] = []

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspacePath: string,
	) {}

	async provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken,
	): Promise<vscode.InlineCompletionList | null> {
		// Only trigger on manual invocation or auto-trigger when typing
		// Skip for very short files or at start of document
		if (position.line < 1) return null

		const requestId = ++this.lastRequestId

		// Debounce: wait for typing to pause
		if (this.debounceTimer) clearTimeout(this.debounceTimer)

		return new Promise((resolve) => {
			this.debounceTimer = setTimeout(async () => {
				if (token.isCancellationRequested || requestId !== this.lastRequestId) {
					resolve(null)
					return
				}

				try {
					const items = await this._generateCompletion(document, position, requestId, token)
					resolve(items ? new vscode.InlineCompletionList(items) : null)
				} catch {
					resolve(null)
				}
			}, DEBOUNCE_MS)
		})
	}

	// ─── Private ──────────────────────────────────────────────────────────────

	private async _generateCompletion(
		document: vscode.TextDocument,
		position: vscode.Position,
		requestId: number,
		token: vscode.CancellationToken,
	): Promise<vscode.InlineCompletionItem[] | null> {
		// Get API credentials
		const apiKey = await this.context.secrets.get("apiKey")
		if (!apiKey) {
			// No API key configured — silently skip
			return null
		}

		const prefix = this._getPrefix(document, position)
		const suffix = this._getSuffix(document, position)

		if (!prefix.trim()) return null

		// Build augment context (best-effort; skip if engine not ready)
		let augmentContext = ""
		try {
			const engine = AugmentEngine.getInstance(this.workspacePath)
			if (engine) {
				const query = this._extractQueryFromPrefix(prefix)
				const enriched = await engine.buildEnrichedContext(query, document.uri.fsPath)
				augmentContext = enriched.formattedForPrompt.slice(0, 1500) // Limit context size
			}
		} catch {
			// Augment engine not ready — proceed without extra context
		}

		if (token.isCancellationRequested || requestId !== this.lastRequestId) return null

		const systemPrompt = [
			"You are an expert code completion engine embedded in Joe AI.",
			"Your ONLY task is to predict and output the most likely code continuation at the cursor position.",
			"Rules:",
			"- Output ONLY the completion text — no explanations, no markdown fences, no extra text.",
			"- Complete one logical unit: one line, or a short multi-line block if the context clearly requires it.",
			"- Match the existing indentation, language style, and naming conventions exactly.",
			"- If the cursor is in the middle of a statement, complete that statement.",
			"- If there is nothing useful to suggest, output an empty string.",
			augmentContext ? "\n\nRelevant codebase context:\n" + augmentContext : "",
		]
			.filter(Boolean)
			.join("\n")

		const userMessage = [
			`Language: ${document.languageId}`,
			`File: ${vscode.workspace.asRelativePath(document.uri)}`,
			"",
			"Complete the code at <CURSOR>:",
			"",
			"```",
			prefix + "<CURSOR>" + suffix,
			"```",
			"",
			"Output ONLY the completion text that should replace <CURSOR> (no backticks, no explanation):",
		].join("\n")

		try {
			const client = new Anthropic({ apiKey })

			const response = await client.messages.create({
				model: COMPLETION_MODEL,
				max_tokens: MAX_TOKENS,
				system: systemPrompt,
				messages: [{ role: "user", content: userMessage }],
			})

			if (token.isCancellationRequested || requestId !== this.lastRequestId) return null

			const completion = this._extractCompletion(response)
			if (!completion) return null

			return [
				new vscode.InlineCompletionItem(
					completion,
					new vscode.Range(position, position),
				),
			]
		} catch (error: any) {
			// Suppress rate limit / auth errors silently — don't disrupt the editor
			if (error?.status === 401 || error?.status === 403) {
				console.warn("[JoeInlineCompletion] API key invalid or unauthorized")
			} else if (error?.status === 429) {
				// Rate limited — just skip
			} else {
				console.debug("[JoeInlineCompletion] Completion failed:", error?.message ?? error)
			}
			return null
		}
	}

	/**
	 * Get the code BEFORE the cursor (prefix), capped at CONTEXT_LINES_BEFORE lines.
	 * Also limited by MAX_PROMPT_CHARS total.
	 */
	private _getPrefix(document: vscode.TextDocument, position: vscode.Position): string {
		const startLine = Math.max(0, position.line - CONTEXT_LINES_BEFORE)
		const range = new vscode.Range(new vscode.Position(startLine, 0), position)
		const text = document.getText(range)
		// Trim from left if too long
		return text.length > MAX_PROMPT_CHARS ? text.slice(text.length - MAX_PROMPT_CHARS) : text
	}

	/**
	 * Get the code AFTER the cursor (suffix), capped at CONTEXT_LINES_AFTER lines.
	 */
	private _getSuffix(document: vscode.TextDocument, position: vscode.Position): string {
		const endLine = Math.min(document.lineCount - 1, position.line + CONTEXT_LINES_AFTER)
		const range = new vscode.Range(position, new vscode.Position(endLine, document.lineAt(endLine).text.length))
		const text = document.getText(range)
		return text.length > 800 ? text.slice(0, 800) : text
	}

	/**
	 * Extract a short query from the code prefix for AugmentEngine context lookup.
	 */
	private _extractQueryFromPrefix(prefix: string): string {
		// Use the last non-empty line as the query hint
		const lines = prefix.split("\n").map((l) => l.trim()).filter(Boolean)
		const last = lines[lines.length - 1] ?? ""
		return last.slice(0, 120) || "inline completion context"
	}

	/**
	 * Extract the plain completion string from the Anthropic API response.
	 */
	private _extractCompletion(response: Anthropic.Message): string {
		const block = response.content[0]
		if (!block || block.type !== "text") return ""

		let text = block.text.trim()

		// Strip markdown fences if the model accidentally added them
		text = text.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "")

		// Remove leading/trailing blank lines
		text = text.replace(/^\n+/, "").replace(/\n+$/, "")

		return text
	}

	dispose(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}
	}
}

/**
 * Register the Joe AI inline completion provider for all languages.
 * Call from extension.ts activate().
 *
 * @param context VSCode extension context (for secrets access)
 * @param workspacePath Primary workspace folder path (for AugmentEngine)
 * @returns Disposable to clean up on deactivation
 */
export function registerJoeInlineCompletionProvider(
	context: vscode.ExtensionContext,
	workspacePath: string,
): vscode.Disposable {
	const provider = new JoeInlineCompletionProvider(context, workspacePath)

	const disposable = vscode.languages.registerInlineCompletionItemProvider(
		// Register for all document types
		{ pattern: "**/*" },
		provider,
	)

	// Also register explicit dispose
	context.subscriptions.push({ dispose: () => provider.dispose() })

	console.log("[JoeInlineCompletion] Registered inline completion provider")
	return disposable
}
