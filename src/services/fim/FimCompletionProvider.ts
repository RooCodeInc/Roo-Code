/**
 * VS Code InlineCompletionItemProvider for FIM-based code completions.
 *
 * Provides ghost-text-style inline suggestions as the user types,
 * similar to GitHub Copilot. Uses a FIM-compatible API to generate
 * completions based on the prefix/suffix context around the cursor.
 */

import * as vscode from "vscode"

import { requestFimCompletion, type FimRequestOptions } from "./FimApiClient"

/** Default debounce delay in milliseconds */
const DEFAULT_DEBOUNCE_MS = 300

/** Default max tokens for completions */
const DEFAULT_MAX_TOKENS = 128

/** Default base URLs per provider */
const DEFAULT_BASE_URLS: Record<string, string> = {
	"openai-compatible": "http://localhost:1234",
	deepseek: "https://api.deepseek.com",
	mistral: "https://api.mistral.ai",
	ollama: "http://localhost:11434",
}

export interface FimProviderConfig {
	enabled: boolean
	provider: "openai-compatible" | "deepseek" | "mistral" | "ollama"
	modelId: string
	baseUrl?: string
	apiKey?: string
	debounceMs?: number
	maxTokens?: number
}

/**
 * Simple completion cache to avoid redundant API calls for identical contexts.
 */
interface CacheEntry {
	completion: string
	timestamp: number
}

const CACHE_TTL_MS = 10_000 // 10 seconds
const MAX_CACHE_SIZE = 50

export class FimCompletionProvider implements vscode.InlineCompletionItemProvider {
	private config: FimProviderConfig
	private cache = new Map<string, CacheEntry>()
	private pendingRequest: AbortController | null = null

	constructor(config: FimProviderConfig) {
		this.config = config
	}

	/**
	 * Update the provider configuration. Called when settings change.
	 */
	updateConfig(config: FimProviderConfig): void {
		this.config = config
		this.cache.clear()
	}

	/**
	 * Provide inline completion items for the given position.
	 */
	async provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken,
	): Promise<vscode.InlineCompletionItem[] | undefined> {
		if (!this.config.enabled) {
			return undefined
		}

		// Don't trigger on empty documents
		if (document.getText().trim().length === 0) {
			return undefined
		}

		// Cancel any pending request
		if (this.pendingRequest) {
			this.pendingRequest.abort()
			this.pendingRequest = null
		}

		// Debounce: wait before making the request
		const debounceMs = this.config.debounceMs ?? DEFAULT_DEBOUNCE_MS
		if (debounceMs > 0) {
			const cancelled = await this.debounce(debounceMs, token)
			if (cancelled) {
				return undefined
			}
		}

		// Extract prefix and suffix from the document
		const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position))
		const suffix = document.getText(new vscode.Range(position, document.lineAt(document.lineCount - 1).range.end))

		// Check cache
		const cacheKey = this.buildCacheKey(prefix, suffix)
		const cached = this.getFromCache(cacheKey)
		if (cached) {
			return [new vscode.InlineCompletionItem(cached)]
		}

		// Prepare the request
		const abortController = new AbortController()
		this.pendingRequest = abortController

		// Also abort when the token is cancelled
		const disposable = token.onCancellationRequested(() => {
			abortController.abort()
		})

		try {
			const requestOptions: FimRequestOptions = {
				provider: this.config.provider,
				baseUrl:
					this.config.baseUrl ??
					DEFAULT_BASE_URLS[this.config.provider] ??
					DEFAULT_BASE_URLS["openai-compatible"],
				apiKey: this.config.apiKey,
				modelId: this.config.modelId,
				prefix,
				suffix,
				maxTokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
				signal: abortController.signal,
			}

			const response = await requestFimCompletion(requestOptions)

			// Filter empty or whitespace-only completions
			const completion = response.completion.trimEnd()
			if (!completion || completion.trim().length === 0) {
				return undefined
			}

			// Cache the result
			this.addToCache(cacheKey, completion)

			return [new vscode.InlineCompletionItem(completion)]
		} catch (error: unknown) {
			// Don't log abort errors (expected during cancellation)
			if (error instanceof Error && error.name === "AbortError") {
				return undefined
			}
			// Log other errors but don't show to user (silent failure for inline completions)
			console.warn("[FIM] Completion request failed:", error instanceof Error ? error.message : String(error))
			return undefined
		} finally {
			disposable.dispose()
			if (this.pendingRequest === abortController) {
				this.pendingRequest = null
			}
		}
	}

	/**
	 * Debounce helper that resolves after a delay unless the token is cancelled.
	 * Returns true if cancelled, false if the delay completed.
	 */
	private debounce(ms: number, token: vscode.CancellationToken): Promise<boolean> {
		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				disposable.dispose()
				resolve(false)
			}, ms)

			const disposable = token.onCancellationRequested(() => {
				clearTimeout(timeout)
				resolve(true)
			})
		})
	}

	/**
	 * Build a cache key from the prefix and suffix context.
	 * Uses the last N characters to keep keys manageable.
	 */
	private buildCacheKey(prefix: string, suffix: string): string {
		const prefixTail = prefix.slice(-500)
		const suffixHead = suffix.slice(0, 200)
		return `${prefixTail}|||${suffixHead}`
	}

	/**
	 * Get a completion from the cache if it's still valid.
	 */
	private getFromCache(key: string): string | undefined {
		const entry = this.cache.get(key)
		if (!entry) {
			return undefined
		}
		if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
			this.cache.delete(key)
			return undefined
		}
		return entry.completion
	}

	/**
	 * Add a completion to the cache, evicting old entries if needed.
	 */
	private addToCache(key: string, completion: string): void {
		// Evict oldest entries if cache is full
		if (this.cache.size >= MAX_CACHE_SIZE) {
			const firstKey = this.cache.keys().next().value
			if (firstKey !== undefined) {
				this.cache.delete(firstKey)
			}
		}
		this.cache.set(key, { completion, timestamp: Date.now() })
	}

	/**
	 * Dispose of any pending requests and clear the cache.
	 */
	dispose(): void {
		if (this.pendingRequest) {
			this.pendingRequest.abort()
			this.pendingRequest = null
		}
		this.cache.clear()
	}
}
