/**
 * Smart Condensation Provider - Pass-Based Architecture (Spec 004)
 *
 * Multi-pass architecture with content-type granularity:
 * - Lossless prelude (optional) for free optimizations
 * - Sequential passes with conditional execution
 * - 4 operations per content type: keep, suppress, truncate, summarize
 * - Batch and individual processing modes
 */

import Anthropic from "@anthropic-ai/sdk"
import { BaseCondensationProvider } from "../../BaseProvider"
import type {
	CondensationContext,
	CondensationOptions,
	CondensationResult,
	SmartProviderConfig,
	PassConfig,
	PassResult,
	DecomposedMessage,
	ContentOperation,
	ContentTypeOperations,
	PassMetrics,
} from "../../types"
import { ApiMessage } from "../../../task-persistence/apiMessages"
import { LosslessCondensationProvider } from "../lossless"
import { NativeCondensationProvider } from "../NativeProvider"
import { TruncationCondensationProvider } from "../truncation"
import { BALANCED_CONFIG } from "./configs"

/**
 * SmartCondensationProvider implements multi-pass condensation with granular control
 * over different content types (message text, tool parameters, tool results).
 *
 * Architecture:
 * 1. Optional lossless prelude for free optimizations
 * 2. Sequential passes with:
 *    - Selection strategy (which messages to process)
 *    - Processing mode (batch vs individual)
 *    - Content-type operations (keep/suppress/truncate/summarize)
 *    - Execution condition (always vs conditional)
 * 3. Early exit when target token count reached
 *
 * Performance: Variable (0ms to 5s) depending on configuration
 */
export class SmartCondensationProvider extends BaseCondensationProvider {
	readonly id = "smart"
	readonly name = "Smart Provider (Pass-Based)"
	readonly description = "Multi-pass condensation with granular content-type control"

	private config: SmartProviderConfig
	private losslessProvider: LosslessCondensationProvider
	private nativeProvider: NativeCondensationProvider
	private truncationProvider: TruncationCondensationProvider

	constructor(config?: SmartProviderConfig) {
		super()

		// Use BALANCED_CONFIG as default
		this.config = config || BALANCED_CONFIG

		// Initialize delegate providers
		this.losslessProvider = new LosslessCondensationProvider()
		this.nativeProvider = new NativeCondensationProvider()
		this.truncationProvider = new TruncationCondensationProvider()
	}

	/**
	 * Main condensation logic with multi-pass architecture
	 */
	protected async condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult> {
		const startTime = Date.now()
		let workingMessages = [...context.messages]
		const operations: string[] = []
		let totalCost = 0
		const passMetrics: PassMetrics[] = []

		// Step 1: Optional lossless prelude
		if (this.config.losslessPrelude?.enabled) {
			const preludeStart = Date.now()
			const tokensBefore = this.estimateMessagesTokens(workingMessages)

			const preludeResult = await this.losslessProvider.condense(
				{ ...context, messages: workingMessages },
				options,
			)
			workingMessages = preludeResult.messages
			totalCost += preludeResult.cost
			operations.push("lossless_prelude")

			// Capture prelude metrics
			passMetrics.push({
				passId: "lossless_prelude",
				passType: "quality",
				operationsApplied: ["lossless"],
				tokensBefore,
				tokensAfter: this.estimateMessagesTokens(workingMessages),
				timeElapsed: Date.now() - preludeStart,
				apiCalls: 0,
				cost: preludeResult.cost,
				errors: preludeResult.error ? [preludeResult.error] : undefined,
			})
		}

		// Step 2: Execute passes sequentially
		for (const pass of this.config.passes) {
			// Check if pass should execute
			if (!(await this.shouldExecutePass(pass, workingMessages, context))) {
				continue
			}

			const passStart = Date.now()
			const tokensBefore = this.estimateMessagesTokens(workingMessages)

			// Execute pass
			const passResult = await this.executePass(pass, workingMessages, context, options)
			workingMessages = passResult.messages
			totalCost += passResult.cost
			operations.push(`pass_${pass.id}`)

			// Capture pass metrics
			passMetrics.push({
				passId: pass.id,
				passType: pass.mode === "batch" ? "batch" : "individual",
				operationsApplied: this.getOperationsForPass(pass),
				tokensBefore,
				tokensAfter: this.estimateMessagesTokens(workingMessages),
				timeElapsed: Date.now() - passStart,
				apiCalls: this.getApiCallsForPass(pass),
				cost: passResult.cost,
				errors: passResult.errors,
			})

			// Early exit if target reached
			if (await this.isTargetReached(workingMessages, context)) {
				break
			}
		}

		// Step 3: Calculate final metrics
		const timeElapsed = Date.now() - startTime
		const originalTokens = this.estimateMessagesTokens(context.messages)
		const condensedTokens = this.estimateMessagesTokens(workingMessages)
		const tokensSaved = originalTokens - condensedTokens

		return {
			messages: workingMessages,
			cost: totalCost,
			newContextTokens: condensedTokens,
			metrics: {
				providerId: this.id,
				timeElapsed,
				tokensSaved,
				originalTokens,
				condensedTokens,
				reductionPercentage: originalTokens > 0 ? (tokensSaved / originalTokens) * 100 : 0,
				operationsApplied: operations,
				passes: passMetrics,
			},
		}
	}

	/**
	 * Check if pass should execute based on its execution condition
	 */
	private async shouldExecutePass(
		pass: PassConfig,
		currentMessages: ApiMessage[],
		context: CondensationContext,
	): Promise<boolean> {
		// Always execute if type is "always"
		if (pass.execution.type === "always") {
			return true
		}

		// Conditional execution
		if (pass.execution.type === "conditional" && pass.execution.condition) {
			const { tokenThreshold, reductionPercentage, reductionRelativeTo } = pass.execution.condition

			// Legacy absolute token threshold
			if (tokenThreshold) {
				const currentTokens = this.estimateMessagesTokens(currentMessages)
				return currentTokens > tokenThreshold
			}

			// New percentage-based reduction condition
			if (reductionPercentage !== undefined) {
				const currentTokens = this.estimateMessagesTokens(currentMessages)
				const initialTokens = context.prevContextTokens
				const triggerTokens = this.getTriggerThreshold(context)

				let referenceTokens: number
				if (reductionRelativeTo === "trigger") {
					referenceTokens = triggerTokens
				} else {
					// Default to "initial"
					referenceTokens = initialTokens
				}

				// Calculate current reduction percentage
				const currentReduction = ((referenceTokens - currentTokens) / referenceTokens) * 100
				
				// Execute if we haven't achieved the target reduction
				return currentReduction < reductionPercentage
			}
		}

		return false
	}

	/**
	 * Get the trigger threshold for condensation
	 */
	private getTriggerThreshold(context: CondensationContext): number {
		// Use profileThresholds if available, otherwise use a default
		if (context.targetTokens) {
			return context.targetTokens
		}
		
		// Default to 80% of initial context as trigger point
		return Math.floor(context.prevContextTokens * 0.8)
	}

	/**
	 * Check if target token count has been reached
	 */
	private async isTargetReached(currentMessages: ApiMessage[], context: CondensationContext): Promise<boolean> {
		if (!context.targetTokens) {
			return false
		}

		const currentTokens = this.estimateMessagesTokens(currentMessages)
		return currentTokens <= context.targetTokens
	}

	/**
	 * Execute a single pass
	 */
	private async executePass(
		pass: PassConfig,
		messages: ApiMessage[],
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<PassResult & { errors?: string[] }> {
		// Apply selection strategy
		const { selectedMessages, preservedMessages } = this.applySelection(pass.selection, messages)

		// Execute based on mode
		let processedMessages: ApiMessage[]
		let cost = 0
		const errors: string[] = []

		try {
			if (pass.mode === "batch") {
				const batchResult = await this.executeBatchPass(pass, selectedMessages, context, options)
				processedMessages = batchResult.messages
				cost = batchResult.cost
			} else {
				const individualResult = await this.executeIndividualPass(pass, selectedMessages, context, options)
				processedMessages = individualResult.messages
				cost = individualResult.cost
			}
		} catch (error) {
			// Capture error but don't fail the entire pass
			errors.push(error instanceof Error ? error.message : String(error))
			processedMessages = selectedMessages // Fallback to original messages
		}

		// Combine preserved and processed messages
		const finalMessages = [...preservedMessages, ...processedMessages]

		// Calculate tokens saved
		const originalTokens = this.estimateMessagesTokens(messages)
		const finalTokens = this.estimateMessagesTokens(finalMessages)
		const tokensSaved = originalTokens - finalTokens

		return {
			messages: finalMessages,
			cost,
			tokensSaved,
			passId: pass.id,
			errors: errors.length > 0 ? errors : undefined,
		}
	}

	/**
	 * Apply selection strategy to determine which messages to process
	 */
	private applySelection(
		selection: PassConfig["selection"],
		messages: ApiMessage[],
	): { selectedMessages: ApiMessage[]; preservedMessages: ApiMessage[] } {
		if (selection.type === "preserve_recent") {
			// Use nullish coalescing (??) instead of logical OR (||) to handle keepCount=0 correctly
			// Because 0 || 10 evaluates to 10 (0 is falsy), but we want 0 to mean "process all messages"
			const keepCount = selection.keepRecentCount ?? 10

			// Special case: if keepCount is 0, select all messages for processing
			// slice(0, -0) would return [] instead of all messages due to JavaScript semantics
			if (keepCount === 0) {
				return { selectedMessages: messages, preservedMessages: [] }
			}

			const preservedMessages = messages.slice(-keepCount)
			const selectedMessages = messages.slice(0, -keepCount)
			return { selectedMessages, preservedMessages }
		}

		if (selection.type === "preserve_percent") {
			const keepPercentage = selection.keepPercentage ?? 30
			const keepCount = Math.floor(messages.length * (keepPercentage / 100))
			const preservedMessages = messages.slice(-keepCount)
			const selectedMessages = messages.slice(0, -keepCount)
			return { selectedMessages, preservedMessages }
		}

		if (selection.type === "custom" && selection.customSelector) {
			const selectedMessages = selection.customSelector(messages)
			const preservedMessages = messages.filter((msg) => !selectedMessages.includes(msg))
			return { selectedMessages, preservedMessages }
		}

		// Default: process all messages
		return { selectedMessages: messages, preservedMessages: [] }
	}

	/**
	 * Execute batch pass - delegates to Native Provider
	 */
	private async executeBatchPass(
		pass: PassConfig,
		messages: ApiMessage[],
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<{ messages: ApiMessage[]; cost: number }> {
		if (!pass.batchConfig) {
			return { messages, cost: 0 }
		}

		// Batch mode: keep or summarize
		if (pass.batchConfig.operation === "keep") {
			return { messages, cost: 0 }
		}

		// Summarize using Native Provider
		if (pass.batchConfig.operation === "summarize") {
			const result = await this.nativeProvider.condense(
				{
					...context,
					messages,
				},
				options,
			)
			return { messages: result.messages, cost: result.cost }
		}

		return { messages, cost: 0 }
	}

	/**
	 * Execute individual pass - process each message with content-type granularity
	 */
	private async executeIndividualPass(
		pass: PassConfig,
		messages: ApiMessage[],
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<{ messages: ApiMessage[]; cost: number }> {
		if (!pass.individualConfig) {
			return { messages, cost: 0 }
		}

		let totalCost = 0
		const processedMessages: ApiMessage[] = []

		// Process each message independently
		for (let i = 0; i < messages.length; i++) {
			const message = messages[i]

			// Get operations for this message (defaults + overrides)
			const operations = this.getOperationsForMessage(i, pass.individualConfig)

			// Decompose message
			const decomposed = this.decomposeMessage(message, i)

			// Apply operations to each content type
			let processedText = decomposed.messageText
			let processedParams = decomposed.toolParameters
			let processedResults = decomposed.toolResults
			let messageCost = 0

			// Get token thresholds for this message (Phase 4.5)
			const thresholds = this.getThresholdsForMessage(i, pass.individualConfig)

			// Process message text (with threshold check)
			if (decomposed.messageText !== null) {
				const shouldProcess = this.shouldProcessContent(
					decomposed.messageText,
					"messageText",
					thresholds.messageText,
				)

				if (shouldProcess) {
					const textResult = await this.applyOperation(
						decomposed.messageText,
						operations.messageText,
						"messageText",
						context,
						options,
					)
					processedText = textResult.content as string | null
					messageCost += textResult.cost
				}
				// else: keep as-is (processedText already = decomposed.messageText)
			}

			// Process tool parameters (with threshold check)
			if (decomposed.toolParameters !== null) {
				const shouldProcess = this.shouldProcessContent(
					decomposed.toolParameters,
					"toolParameters",
					thresholds.toolParameters,
				)

				if (shouldProcess) {
					const paramsResult = await this.applyOperation(
						decomposed.toolParameters,
						operations.toolParameters,
						"toolParameters",
						context,
						options,
					)
					processedParams = paramsResult.content as any[] | null
					messageCost += paramsResult.cost
				}
				// else: keep as-is (processedParams already = decomposed.toolParameters)
			}

			// Process tool results (with threshold check)
			if (decomposed.toolResults !== null) {
				const shouldProcess = this.shouldProcessContent(
					decomposed.toolResults,
					"toolResults",
					thresholds.toolResults,
				)

				if (shouldProcess) {
					const resultsResult = await this.applyOperation(
						decomposed.toolResults,
						operations.toolResults,
						"toolResults",
						context,
						options,
					)
					processedResults = resultsResult.content as any[] | null
					messageCost += resultsResult.cost
				}
				// else: keep as-is (processedResults already = decomposed.toolResults)
			}

			// Recompose message
			const recomposed = this.recomposeMessage(message, processedText, processedParams, processedResults)
			processedMessages.push(recomposed)
			totalCost += messageCost
		}

		return { messages: processedMessages, cost: totalCost }
	}

	/**
	 * Get operations for a specific message (defaults + overrides)
	 */
	private getOperationsForMessage(
		messageIndex: number,
		config: PassConfig["individualConfig"],
	): ContentTypeOperations {
		if (!config) {
			// Fallback: keep everything
			return {
				messageText: { operation: "keep" },
				toolParameters: { operation: "keep" },
				toolResults: { operation: "keep" },
			}
		}

		// Start with defaults
		let operations = { ...config.defaults }

		// Apply overrides if any
		if (config.overrides) {
			const override = config.overrides.find((o) => o.messageIndex === messageIndex)
			if (override) {
				operations = {
					...operations,
					...override.operations,
				}
			}
		}

		return operations
	}

	/**
	 * Get token thresholds for a specific message (defaults + overrides) - Phase 4.5
	 */
	private getThresholdsForMessage(
		messageIndex: number,
		config: PassConfig["individualConfig"],
	): { messageText?: number; toolParameters?: number; toolResults?: number } {
		if (!config) {
			return {}
		}

		// Start with defaults
		let thresholds = config.messageTokenThresholds ? { ...config.messageTokenThresholds } : {}

		// Apply override thresholds if any
		if (config.overrides) {
			const override = config.overrides.find((o) => o.messageIndex === messageIndex)
			if (override?.messageTokenThresholds) {
				thresholds = {
					...thresholds,
					...override.messageTokenThresholds,
				}
			}
		}

		return thresholds
	}

	/**
	 * Check if content should be processed based on token threshold - Phase 4.5
	 * @returns true if should process (no threshold OR content exceeds threshold), false to keep as-is
	 */
	private shouldProcessContent(
		content: string | any[] | null,
		contentType: "messageText" | "toolParameters" | "toolResults",
		threshold?: number,
	): boolean {
		// No threshold defined: always process
		if (threshold === undefined || threshold === null) {
			return true
		}

		// No content: don't process
		if (content === null) {
			return false
		}

		// Estimate tokens for this content
		let tokens = 0

		if (contentType === "messageText" && typeof content === "string") {
			tokens = this.countTokens(content)
		} else if (contentType === "toolParameters" && Array.isArray(content)) {
			tokens = this.countTokens(JSON.stringify(content))
		} else if (contentType === "toolResults" && Array.isArray(content)) {
			// For toolResults, count only the actual content, not metadata
			tokens = content.reduce((total, result) => {
				const resultContent = result.content
				if (typeof resultContent === "string") {
					return total + this.countTokens(resultContent)
				} else if (Array.isArray(resultContent)) {
					return total + this.countTokens(JSON.stringify(resultContent))
				}
				return total
			}, 0)
		}

		// Process only if exceeds threshold
		return tokens >= threshold
	}

	/**
	 * Decompose message into 3 content types (spec 004, lines 2292-2360)
	 */
	private decomposeMessage(message: ApiMessage, messageIndex: number): DecomposedMessage {
		const result: DecomposedMessage = {
			messageIndex,
			originalMessage: message,
			messageText: null,
			toolParameters: null,
			toolResults: null,
		}

		// Simple string content
		if (typeof message.content === "string") {
			result.messageText = message.content
			return result
		}

		// Complex array content
		if (Array.isArray(message.content)) {
			const textBlocks: string[] = []
			const toolUseBlocks: any[] = []
			const toolResultBlocks: any[] = []

			for (const block of message.content) {
				switch (block.type) {
					case "text":
						textBlocks.push(block.text)
						break

					case "tool_use":
						toolUseBlocks.push({
							id: block.id,
							name: block.name,
							input: block.input,
						})
						break

					case "tool_result":
						toolResultBlocks.push({
							tool_use_id: block.tool_use_id,
							content: block.content,
							is_error: block.is_error,
						})
						break
				}
			}

			// Consolidate results
			if (textBlocks.length > 0) {
				result.messageText = textBlocks.join("\n\n")
			}
			if (toolUseBlocks.length > 0) {
				result.toolParameters = toolUseBlocks
			}
			if (toolResultBlocks.length > 0) {
				result.toolResults = toolResultBlocks
			}
		}

		return result
	}

	/**
	 * Recompose message from processed content types (spec 004, lines 2410-2480)
	 */
	private recomposeMessage(
		original: ApiMessage,
		messageText: string | null,
		toolParameters: any[] | null,
		toolResults: any[] | null,
	): ApiMessage {
		// If everything is null, return message with empty content
		if (!messageText && !toolParameters && !toolResults) {
			return {
				...original,
				content: "",
			}
		}

		// If only text, use simple format
		if (messageText && !toolParameters && !toolResults) {
			return {
				...original,
				content: messageText,
			}
		}

		// Complex format with blocks
		const content: any[] = []

		if (messageText) {
			content.push({ type: "text", text: messageText })
		}

		if (toolParameters && Array.isArray(toolParameters)) {
			content.push(
				...toolParameters.map((p) => ({
					type: "tool_use",
					id: p.id,
					name: p.name,
					input: p.input,
				})),
			)
		}

		if (toolResults && Array.isArray(toolResults)) {
			content.push(
				...toolResults.map((r) => ({
					type: "tool_result",
					tool_use_id: r.tool_use_id,
					content: r.content,
					is_error: r.is_error,
				})),
			)
		}

		return {
			...original,
			content,
		}
	}

	/**
	 * Apply operation to content
	 */
	private async applyOperation(
		content: string | any[] | null,
		operation: ContentOperation,
		contentType: "messageText" | "toolParameters" | "toolResults",
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<{ content: string | any[] | null; cost: number }> {
		if (content === null) {
			return { content: null, cost: 0 }
		}

		switch (operation.operation) {
			case "keep":
				return this.applyKeepOperation(content)

			case "suppress":
				return this.applySuppressOperation(content, contentType)

			case "truncate":
				return this.applyTruncateOperation(content, operation.params, contentType)

			case "summarize":
				return this.applySummarizeOperation(content, operation.params, contentType, context, options)

			default:
				return { content, cost: 0 }
		}
	}

	/**
	 * KEEP operation - return content unchanged
	 */
	private applyKeepOperation(content: string | any[]): Promise<{ content: string | any[]; cost: number }> {
		return Promise.resolve({ content, cost: 0 })
	}

	/**
	 * SUPPRESS operation - replace with marker text
	 */
	private applySuppressOperation(
		content: string | any[],
		contentType: "messageText" | "toolParameters" | "toolResults",
	): Promise<{ content: string | any[] | null; cost: number }> {
		// For array content (toolParameters, toolResults), return array with suppression marker
		if (Array.isArray(content)) {
			let marker = ""
			switch (contentType) {
				case "toolParameters":
					marker = "[Tool parameters suppressed]"
					// Return array format expected by recomposeMessage
					return Promise.resolve({
						content: [{ id: "suppressed", name: "suppressed", input: { note: marker } }],
						cost: 0,
					})
				case "toolResults":
					marker = "[Tool results suppressed]"
					// Return array format expected by recomposeMessage
					return Promise.resolve({
						content: [{ tool_use_id: "suppressed", content: marker, is_error: false }],
						cost: 0,
					})
				default:
					return Promise.resolve({ content: marker, cost: 0 })
			}
		}

		// For string content (messageText), return string marker
		const marker = "[Content suppressed]"
		return Promise.resolve({ content: marker, cost: 0 })
	}

	/**
	 * TRUNCATE operation - truncate by maxChars or maxLines
	 */
	private applyTruncateOperation(
		content: string | any[],
		params: { maxChars?: number; maxLines?: number; addEllipsis?: boolean },
		contentType: "messageText" | "toolParameters" | "toolResults",
	): Promise<{ content: string | any[]; cost: number }> {
		const { maxChars, maxLines, addEllipsis = true } = params

		// Convert to string for truncation
		const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2)

		let truncated = contentStr

		// Truncate by lines
		if (maxLines) {
			const lines = contentStr.split("\n")
			if (lines.length > maxLines) {
				truncated = lines.slice(0, maxLines).join("\n")
				if (addEllipsis) {
					truncated += "\n..."
				}
			}
		}

		// Truncate by chars
		if (maxChars && truncated.length > maxChars) {
			truncated = truncated.substring(0, maxChars)
			if (addEllipsis) {
				truncated += "..."
			}
		}

		return Promise.resolve({ content: truncated, cost: 0 })
	}

	/**
	 * SUMMARIZE operation - call LLM to summarize content
	 */
	private async applySummarizeOperation(
		content: string | any[],
		params: { apiProfile?: string; maxTokens?: number; customPrompt?: string },
		contentType: "messageText" | "toolParameters" | "toolResults",
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<{ content: string; cost: number }> {
		const { customPrompt } = params

		// Convert to string
		const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2)

		// Build summarization prompt
		const prompt = customPrompt || this.buildSummarizationPrompt(contentType, contentStr)

		// Call LLM
		try {
			const apiHandler = options.condensingApiHandler || options.apiHandler

			const stream = apiHandler.createMessage(prompt, [
				{
					role: "user",
					content: prompt,
				},
			])

			// Extract text from stream
			let summaryText = ""
			let cost = 0

			for await (const chunk of stream) {
				if (chunk.type === "text") {
					summaryText += chunk.text
				} else if (chunk.type === "usage") {
					cost = chunk.totalCost ?? 0
				}
			}

			return { content: summaryText.trim(), cost }
		} catch (error) {
			// Fallback to truncation if LLM fails
			const fallbackResult = await this.applyTruncateOperation(content, { maxChars: 200 }, contentType)
			return { content: fallbackResult.content as string, cost: 0 }
		}
	}

	/**
	 * Build summarization prompt for content type
	 */
	private buildSummarizationPrompt(
		contentType: "messageText" | "toolParameters" | "toolResults",
		content: string,
	): string {
		switch (contentType) {
			case "messageText":
				return `Summarize this conversation message concisely:\n\n${content}\n\nProvide a brief summary capturing the key points.`

			case "toolParameters":
				return `Summarize these tool parameters concisely:\n\n${content}\n\nProvide a brief description of what the tool was called with.`

			case "toolResults":
				return `Summarize these tool results concisely:\n\n${content}\n\nProvide a brief summary of the key outcomes.`

			default:
				return `Summarize this content concisely:\n\n${content}`
		}
	}

	/**
	 * Estimate cost - depends on configuration
	 */
	async estimateCost(context: CondensationContext): Promise<number> {
		// Rough estimation: lossless prelude is free
		let estimatedCost = 0

		// Check for summarize operations in passes
		for (const pass of this.config.passes) {
			if (pass.mode === "batch" && pass.batchConfig?.operation === "summarize") {
				// Batch summarization uses Native Provider
				estimatedCost += 0.02 // Rough estimate
			} else if (pass.mode === "individual" && pass.individualConfig) {
				// Check for summarize operations in individual config
				const ops = pass.individualConfig.defaults
				const hasSummarize =
					ops.messageText.operation === "summarize" ||
					ops.toolParameters.operation === "summarize" ||
					ops.toolResults.operation === "summarize"

				if (hasSummarize) {
					// Rough estimate per message
					estimatedCost += 0.001 * context.messages.length
				}
			}
		}

		return estimatedCost
	}

	/**
	 * Estimate tokens in messages
	 */
	private estimateMessagesTokens(messages: ApiMessage[]): number {
		let total = 0

		messages.forEach((message) => {
			if (typeof message.content === "string") {
				total += this.countTokens(message.content)
			} else if (Array.isArray(message.content)) {
				message.content.forEach((block) => {
					if (block.type === "text") {
						total += this.countTokens(block.text)
					} else if (block.type === "tool_result") {
						const content = block.content
						if (typeof content === "string") {
							total += this.countTokens(content)
						} else if (Array.isArray(content)) {
							content.forEach((c) => {
								if (c.type === "text") {
									total += this.countTokens(c.text)
								}
							})
						}
					} else if (block.type === "tool_use") {
						if (block.input) {
							total += this.countTokens(JSON.stringify(block.input))
						}
					}
				})
			}
		})

		return total
	}

	/**
	 * Get operations applied in a pass for telemetry
	 */
	private getOperationsForPass(pass: PassConfig): string[] {
		const operations: string[] = []

		if (pass.mode === "batch") {
			if (pass.batchConfig) {
				operations.push(pass.batchConfig.operation)
			}
		} else if (pass.mode === "individual" && pass.individualConfig) {
			const config = pass.individualConfig
			if (config.defaults.messageText.operation !== "keep") {
				operations.push(`messageText:${config.defaults.messageText.operation}`)
			}
			if (config.defaults.toolParameters.operation !== "keep") {
				operations.push(`toolParameters:${config.defaults.toolParameters.operation}`)
			}
			if (config.defaults.toolResults.operation !== "keep") {
				operations.push(`toolResults:${config.defaults.toolResults.operation}`)
			}
		}

		return operations.length > 0 ? operations : ["keep"]
	}

	/**
	 * Estimate API calls for a pass for telemetry
	 */
	private getApiCallsForPass(pass: PassConfig): number {
		if (pass.mode === "batch") {
			// Batch mode makes 1 API call if summarizing
			return pass.batchConfig?.operation === "summarize" ? 1 : 0
		}

		// Individual mode: count summarize operations
		if (pass.individualConfig) {
			const config = pass.individualConfig
			let apiCalls = 0

			if (config.defaults.messageText.operation === "summarize") apiCalls++
			if (config.defaults.toolParameters.operation === "summarize") apiCalls++
			if (config.defaults.toolResults.operation === "summarize") apiCalls++

			return apiCalls
		}

		return 0
	}
}
