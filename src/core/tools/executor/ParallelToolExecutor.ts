/**
 * ParallelToolExecutor
 *
 * Executes tools in parallel according to their dependency graph.
 * Uses a semaphore to control maximum concurrent executions.
 */

import type { ToolUse, McpToolUse, ToolResponse } from "../../../shared/tools"
import {
	ToolDependencyGraphBuilder,
	type DependencyGraph,
	type ToolNode,
	type BuildGraphOptions,
} from "../dependency-graph"

/**
 * Semaphore for controlling concurrent tool execution
 */
export class Semaphore {
	private permits: number
	private waiters: Array<{ resolve: () => void }> = []

	constructor(permits: number) {
		this.permits = permits
	}

	/**
	 * Acquire a permit. Blocks if none available.
	 */
	async acquire(): Promise<void> {
		if (this.permits > 0) {
			this.permits--
			return Promise.resolve()
		}

		return new Promise((resolve) => {
			this.waiters.push({ resolve })
		})
	}

	/**
	 * Release a permit, potentially unblocking a waiter.
	 */
	release(): void {
		if (this.waiters.length > 0) {
			const waiter = this.waiters.shift()!
			waiter.resolve()
		} else {
			this.permits++
		}
	}

	/**
	 * Get the current number of available permits
	 */
	getAvailablePermits(): number {
		return this.permits
	}

	/**
	 * Get the number of waiters
	 */
	getWaitersCount(): number {
		return this.waiters.length
	}
}

/**
 * Result of a single tool execution
 */
export interface ToolExecutionResult {
	/** Tool use ID from the API response */
	toolUseId: string
	/** Name of the tool that was executed */
	toolName: string
	/** Whether execution was successful */
	success: boolean
	/** Result content if successful */
	result?: ToolResponse
	/** Error if execution failed */
	error?: Error
	/** Execution duration in milliseconds */
	duration: number
	/** Whether a checkpoint was saved before execution */
	checkpointSaved: boolean
	/** Whether the tool was rejected by the user */
	wasRejected: boolean
}

/**
 * Result of parallel tool execution
 */
export interface ParallelExecutionResult {
	/** Results for each tool, in original order */
	results: ToolExecutionResult[]
	/** Total execution duration in milliseconds */
	totalDuration: number
	/** Whether all tools completed successfully */
	allSuccessful: boolean
	/** Whether any tools failed */
	hasFailures: boolean
	/** Whether any tools were rejected */
	hasRejections: boolean
	/** Whether execution was aborted */
	wasAborted: boolean
}

/**
 * Configuration for parallel execution
 */
export interface ParallelExecutorConfig {
	/** Maximum number of tools to run concurrently (default: 3) */
	maxConcurrentTools: number
	/** Timeout per tool in milliseconds (default: 60000) */
	timeoutPerTool: number
	/** Whether to save checkpoint before write tools (default: true) */
	checkpointBeforeWriteTools: boolean
	/** Whether to preserve result order (default: true) */
	preserveResultOrder: boolean
	/** Whether to continue execution on error (default: false) */
	continueOnError: boolean
}

/**
 * Tool executor function type
 */
export type ToolExecutorFn = (tool: ToolUse | McpToolUse) => Promise<ToolResponse>

/**
 * Checkpoint save function type
 */
export type CheckpointSaveFn = () => Promise<void>

/**
 * Default executor configuration
 */
const DEFAULT_CONFIG: ParallelExecutorConfig = {
	maxConcurrentTools: 3,
	timeoutPerTool: 60000,
	checkpointBeforeWriteTools: true,
	preserveResultOrder: true,
	continueOnError: false,
}

/**
 * Tools that require a checkpoint before execution
 */
const WRITE_TOOLS: ReadonlySet<string> = new Set([
	"write_to_file",
	"apply_diff",
	"edit_file",
	"apply_patch",
	"search_and_replace",
	"search_replace",
	"generate_image",
])

/**
 * Executes tools in parallel with dependency awareness
 */
export class ParallelToolExecutor {
	private graphBuilder: ToolDependencyGraphBuilder
	private semaphore: Semaphore
	private config: ParallelExecutorConfig
	private abortController: AbortController
	private isAborted: boolean = false

	// Static registry for emergency abort
	private static instances: Set<ParallelToolExecutor> = new Set()

	constructor(config?: Partial<ParallelExecutorConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.graphBuilder = new ToolDependencyGraphBuilder()
		this.semaphore = new Semaphore(this.config.maxConcurrentTools)
		this.abortController = new AbortController()

		ParallelToolExecutor.instances.add(this)
	}

	/**
	 * Execute multiple tools in parallel according to their dependencies
	 * @param toolUses Array of tool use blocks to execute
	 * @param executor Function to execute a single tool
	 * @param options Build options including mode and experiments
	 * @param checkpointSave Optional function to save checkpoints
	 * @returns Execution results
	 */
	async execute(
		toolUses: Array<ToolUse | McpToolUse>,
		executor: ToolExecutorFn,
		options: BuildGraphOptions,
		checkpointSave?: CheckpointSaveFn,
	): Promise<ParallelExecutionResult> {
		const startTime = Date.now()
		const results: Map<string, ToolExecutionResult> = new Map()

		// Build dependency graph
		const graph = this.graphBuilder.build(toolUses, options)

		// If sequential execution is required or there's only one tool, fall back
		if (graph.requiresSequentialExecution || toolUses.length <= 1) {
			return this.executeSequentially(toolUses, executor, results, startTime, checkpointSave)
		}

		// Execute groups in order
		for (const group of graph.executionGroups) {
			if (this.isAborted) {
				break
			}

			// Execute all tools in this group in parallel
			const groupPromises = group.map((node) =>
				this.executeWithSemaphore(node, executor, results, checkpointSave),
			)

			await Promise.all(groupPromises)

			// Check if we should stop due to an error
			if (!this.config.continueOnError) {
				const hasError = Array.from(results.values()).some((r) => !r.success)
				if (hasError) {
					break
				}
			}
		}

		// Return results in original order
		return this.buildResult(toolUses, results, startTime)
	}

	/**
	 * Execute a single tool with semaphore control
	 */
	private async executeWithSemaphore(
		node: ToolNode,
		executor: ToolExecutorFn,
		results: Map<string, ToolExecutionResult>,
		checkpointSave?: CheckpointSaveFn,
	): Promise<void> {
		await this.semaphore.acquire()

		try {
			if (this.isAborted) {
				results.set(node.id, this.createAbortedResult(node))
				return
			}

			const result = await this.executeSingleTool(node, executor, checkpointSave)
			results.set(node.id, result)
		} finally {
			this.semaphore.release()
		}
	}

	/**
	 * Execute a single tool
	 */
	private async executeSingleTool(
		node: ToolNode,
		executor: ToolExecutorFn,
		checkpointSave?: CheckpointSaveFn,
	): Promise<ToolExecutionResult> {
		const startTime = Date.now()
		let checkpointSaved = false

		try {
			// Save checkpoint before write operations
			if (this.config.checkpointBeforeWriteTools && WRITE_TOOLS.has(node.toolName) && checkpointSave) {
				await checkpointSave()
				checkpointSaved = true
			}

			// Execute with timeout
			const result = await this.executeWithTimeout(node.toolUse, executor, this.config.timeoutPerTool)

			return {
				toolUseId: node.toolUseId,
				toolName: node.toolName,
				success: true,
				result,
				duration: Date.now() - startTime,
				checkpointSaved,
				wasRejected: false,
			}
		} catch (error) {
			return {
				toolUseId: node.toolUseId,
				toolName: node.toolName,
				success: false,
				error: error instanceof Error ? error : new Error(String(error)),
				duration: Date.now() - startTime,
				checkpointSaved,
				wasRejected: false,
			}
		}
	}

	/**
	 * Execute a tool with timeout
	 */
	private async executeWithTimeout(
		tool: ToolUse | McpToolUse,
		executor: ToolExecutorFn,
		timeout: number,
	): Promise<ToolResponse> {
		return Promise.race([
			executor(tool),
			new Promise<ToolResponse>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Tool execution timed out after ${timeout}ms`))
				}, timeout)
			}),
		])
	}

	/**
	 * Execute tools sequentially (fallback for exclusive tools)
	 */
	private async executeSequentially(
		toolUses: Array<ToolUse | McpToolUse>,
		executor: ToolExecutorFn,
		results: Map<string, ToolExecutionResult>,
		startTime: number,
		checkpointSave?: CheckpointSaveFn,
	): Promise<ParallelExecutionResult> {
		for (let i = 0; i < toolUses.length; i++) {
			const tool = toolUses[i]
			const toolId = tool.id || `tool_${i}`

			if (this.isAborted) {
				results.set(
					toolId,
					this.createAbortedResult({
						id: toolId,
						toolUseId: toolId,
						toolName: tool.type === "mcp_tool_use" ? tool.name : tool.name,
						toolUse: tool,
					} as ToolNode),
				)
				continue
			}

			const node: ToolNode = {
				id: toolId,
				toolUseId: toolId,
				toolName: tool.type === "mcp_tool_use" ? tool.name : tool.name,
				params: tool.type === "mcp_tool_use" ? tool.arguments || {} : { ...tool.params },
				dependencies: new Set(),
				dependents: new Set(),
				canRunInParallel: false,
				priority: i,
				isExclusive: true,
				toolUse: tool,
			}

			const result = await this.executeSingleTool(node, executor, checkpointSave)
			results.set(toolId, result)

			// Stop on first error if not continueOnError
			if (!this.config.continueOnError && !result.success) {
				break
			}
		}

		return this.buildResult(toolUses, results, startTime)
	}

	/**
	 * Build the final result object
	 */
	private buildResult(
		toolUses: Array<ToolUse | McpToolUse>,
		results: Map<string, ToolExecutionResult>,
		startTime: number,
	): ParallelExecutionResult {
		const orderedResults = toolUses.map((tool, i) => {
			const toolId = tool.id || `tool_${i}`
			return results.get(toolId) || this.createMissingResult(tool, toolId)
		})

		return {
			results: orderedResults,
			totalDuration: Date.now() - startTime,
			allSuccessful: orderedResults.every((r) => r.success),
			hasFailures: orderedResults.some((r) => !r.success),
			hasRejections: orderedResults.some((r) => r.wasRejected),
			wasAborted: this.isAborted,
		}
	}

	/**
	 * Create a result for an aborted tool
	 */
	private createAbortedResult(node: ToolNode): ToolExecutionResult {
		return {
			toolUseId: node.toolUseId,
			toolName: node.toolName,
			success: false,
			error: new Error("Execution aborted"),
			duration: 0,
			checkpointSaved: false,
			wasRejected: false,
		}
	}

	/**
	 * Create a result for a missing tool
	 */
	private createMissingResult(tool: ToolUse | McpToolUse, toolId: string): ToolExecutionResult {
		return {
			toolUseId: toolId,
			toolName: tool.type === "mcp_tool_use" ? tool.name : tool.name,
			success: false,
			error: new Error("Tool was not executed"),
			duration: 0,
			checkpointSaved: false,
			wasRejected: false,
		}
	}

	/**
	 * Abort all running tool executions
	 */
	abort(): void {
		this.isAborted = true
		this.abortController.abort()
	}

	/**
	 * Check if executor was aborted
	 */
	wasAborted(): boolean {
		return this.isAborted
	}

	/**
	 * Dispose this executor
	 */
	dispose(): void {
		ParallelToolExecutor.instances.delete(this)
	}

	/**
	 * Abort all running executors (emergency rollback)
	 */
	static abortAll(): void {
		for (const instance of ParallelToolExecutor.instances) {
			instance.abort()
		}
	}

	/**
	 * Get the number of active executors
	 */
	static getActiveCount(): number {
		return ParallelToolExecutor.instances.size
	}
}
