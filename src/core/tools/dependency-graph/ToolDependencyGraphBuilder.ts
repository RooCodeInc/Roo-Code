/**
 * ToolDependencyGraphBuilder
 *
 * Builds a dependency graph for tool execution to determine
 * which tools can run in parallel and which must be sequential.
 *
 * ## Dependency Rules:
 *
 * 1. File-based dependencies:
 *    - write_to_file → read_file (same file)
 *    - apply_diff → read_file (same file)
 *    - edit_file → read_file (same file)
 *
 * 2. Tool-specific dependencies:
 *    - new_task: must be last (triggers delegation)
 *    - attempt_completion: must be last
 *    - checkpoint_save: must be after write operations
 *
 * 3. Exclusive tools (only one at a time):
 *    - browser_action: only one browser action at a time
 *    - execute_command: only one at a time (per terminal)
 *    - use_mcp_tool: external server dependencies
 *    - access_mcp_resource: external server dependencies
 */

import type { ToolName } from "@roo-code/types"
import type { ToolUse, McpToolUse } from "../../../shared/tools"

/**
 * Represents a node in the tool dependency graph
 */
export interface ToolNode {
	/** Unique identifier for this node */
	id: string
	/** Tool use ID from the API response */
	toolUseId: string
	/** The name of the tool */
	toolName: ToolName | string
	/** Tool parameters */
	params: Record<string, unknown>
	/** IDs of tools this tool depends on (must complete before this can start) */
	dependencies: Set<string>
	/** IDs of tools that depend on this tool */
	dependents: Set<string>
	/** Whether this tool can run in parallel with others */
	canRunInParallel: boolean
	/** Execution priority (lower = earlier, based on original order) */
	priority: number
	/** Whether this tool requires exclusive execution (no other tools can run with it) */
	isExclusive: boolean
	/** The original tool use object */
	toolUse: ToolUse | McpToolUse
}

/**
 * The complete dependency graph for a set of tools
 */
export interface DependencyGraph {
	/** Map of node ID to ToolNode */
	nodes: Map<string, ToolNode>
	/** Groups of tools that can run in parallel, in execution order */
	executionGroups: ToolNode[][]
	/** Total number of tools in the graph */
	totalTools: number
	/** Whether any exclusive tools are present */
	hasExclusiveTools: boolean
	/** Whether sequential execution is required (due to exclusive tools or complex dependencies) */
	requiresSequentialExecution: boolean
}

/**
 * Options for building the dependency graph
 */
export interface BuildGraphOptions {
	/** Current mode slug */
	mode: string
	/** Custom mode configurations */
	customModes: Array<{ slug: string; [key: string]: unknown }>
	/** Experimental features configuration */
	experiments: Record<string, boolean>
}

/**
 * Tools that must run exclusively (one at a time, no parallel execution)
 */
const EXCLUSIVE_TOOLS: ReadonlySet<string> = new Set([
	"new_task",
	"attempt_completion",
	"browser_action",
	"execute_command",
	"use_mcp_tool",
	"access_mcp_resource",
	"update_todo_list",
	"switch_mode",
	"run_slash_command",
	"skill",
	"generate_image",
])

/**
 * Tools that write to files (may create dependencies with read operations)
 */
const FILE_WRITING_TOOLS: ReadonlySet<string> = new Set([
	"write_to_file",
	"apply_diff",
	"edit_file",
	"apply_patch",
	"search_and_replace",
	"search_replace",
])

/**
 * Tools that read from files
 */
const FILE_READING_TOOLS: ReadonlySet<string> = new Set(["read_file", "list_files", "search_files", "codebase_search"])

/**
 * Tools that must run after all other tools complete
 */
const TERMINAL_TOOLS: ReadonlySet<string> = new Set(["new_task", "attempt_completion"])

/**
 * Builds a dependency graph for parallel tool execution
 */
export class ToolDependencyGraphBuilder {
	private nodes: Map<string, ToolNode> = new Map()

	/**
	 * Build dependency graph from tool use blocks
	 * @param toolUses Array of tool use blocks from the API response
	 * @param options Build options including mode and experiments
	 * @returns The constructed dependency graph
	 */
	build(toolUses: Array<ToolUse | McpToolUse>, options: BuildGraphOptions): DependencyGraph {
		// Clear previous state
		this.nodes.clear()

		// Handle empty input
		if (toolUses.length === 0) {
			return {
				nodes: new Map(),
				executionGroups: [],
				totalTools: 0,
				hasExclusiveTools: false,
				requiresSequentialExecution: false,
			}
		}

		// Step 1: Create nodes for all tools
		this.createNodes(toolUses, options)

		// Step 2: Analyze and add dependencies
		this.analyzeDependencies()

		// Step 3: Build execution groups
		const executionGroups = this.buildExecutionGroups()

		// Step 4: Check for exclusive tools
		const hasExclusiveTools = this.checkForExclusiveTools()

		// Determine if sequential execution is required
		const requiresSequentialExecution = hasExclusiveTools || executionGroups.length === toolUses.length

		return {
			nodes: new Map(this.nodes),
			executionGroups,
			totalTools: this.nodes.size,
			hasExclusiveTools,
			requiresSequentialExecution,
		}
	}

	/**
	 * Create graph nodes from tool use blocks
	 */
	private createNodes(toolUses: Array<ToolUse | McpToolUse>, _options: BuildGraphOptions): void {
		for (const [index, tool] of toolUses.entries()) {
			const toolName = this.getToolName(tool)
			const toolId = this.getToolId(tool, index)

			const node: ToolNode = {
				id: toolId,
				toolUseId: toolId,
				toolName,
				params: this.getToolParams(tool),
				dependencies: new Set(),
				dependents: new Set(),
				canRunInParallel: this.canRunInParallel(toolName),
				priority: index,
				isExclusive: this.isExclusiveTool(toolName),
				toolUse: tool,
			}

			this.nodes.set(toolId, node)
		}
	}

	/**
	 * Get tool name from either ToolUse or McpToolUse
	 */
	private getToolName(tool: ToolUse | McpToolUse): string {
		if (tool.type === "mcp_tool_use") {
			return tool.name
		}
		return tool.name
	}

	/**
	 * Get tool ID, generating one if not present
	 */
	private getToolId(tool: ToolUse | McpToolUse, index: number): string {
		return tool.id || `tool_${index}`
	}

	/**
	 * Get tool parameters as a record
	 */
	private getToolParams(tool: ToolUse | McpToolUse): Record<string, unknown> {
		if (tool.type === "mcp_tool_use") {
			return tool.arguments || {}
		}
		// For regular ToolUse, combine params and nativeArgs
		return { ...tool.params, ...(tool.nativeArgs || {}) }
	}

	/**
	 * Analyze dependencies between all nodes
	 */
	private analyzeDependencies(): void {
		const nodesArray = Array.from(this.nodes.values())

		for (const node of nodesArray) {
			// Terminal tools depend on ALL previous tools
			if (TERMINAL_TOOLS.has(node.toolName)) {
				for (const otherNode of nodesArray) {
					if (otherNode.priority < node.priority) {
						node.dependencies.add(otherNode.id)
						otherNode.dependents.add(node.id)
					}
				}
				continue
			}

			// Check for file-based dependencies
			for (const otherNode of nodesArray) {
				if (otherNode.id === node.id) continue
				if (otherNode.priority >= node.priority) continue // Only check earlier tools

				if (this.hasDependency(node, otherNode)) {
					node.dependencies.add(otherNode.id)
					otherNode.dependents.add(node.id)
				}
			}
		}
	}

	/**
	 * Check if sourceNode depends on targetNode
	 */
	private hasDependency(sourceNode: ToolNode, targetNode: ToolNode): boolean {
		// File-based dependencies: if target writes to a file that source reads
		if (FILE_WRITING_TOOLS.has(targetNode.toolName) && FILE_READING_TOOLS.has(sourceNode.toolName)) {
			const targetFile = this.getFilePath(targetNode)
			const sourceFile = this.getFilePath(sourceNode)

			if (targetFile && sourceFile && this.pathsMatch(targetFile, sourceFile)) {
				return true
			}
		}

		// Write-after-write dependencies: if both write to the same file
		if (FILE_WRITING_TOOLS.has(targetNode.toolName) && FILE_WRITING_TOOLS.has(sourceNode.toolName)) {
			const targetFile = this.getFilePath(targetNode)
			const sourceFile = this.getFilePath(sourceNode)

			if (targetFile && sourceFile && this.pathsMatch(targetFile, sourceFile)) {
				return true
			}
		}

		// Read-after-write dependencies
		if (FILE_READING_TOOLS.has(targetNode.toolName) && FILE_WRITING_TOOLS.has(sourceNode.toolName)) {
			const targetFile = this.getFilePath(targetNode)
			const sourceFile = this.getFilePath(sourceNode)

			if (targetFile && sourceFile && this.pathsMatch(targetFile, sourceFile)) {
				return true
			}
		}

		return false
	}

	/**
	 * Extract file path from tool parameters
	 */
	private getFilePath(node: ToolNode): string | null {
		const pathParams = ["path", "file_path", "filepath"]
		for (const param of pathParams) {
			const value = node.params[param]
			if (typeof value === "string") {
				return value
			}
		}
		return null
	}

	/**
	 * Check if two file paths match (including directory containment)
	 */
	private pathsMatch(path1: string, path2: string): boolean {
		// Normalize paths
		const normalize = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "")
		const p1 = normalize(path1)
		const p2 = normalize(path2)

		// Exact match
		if (p1 === p2) return true

		// Check if one is a directory containing the other
		if (p1.startsWith(p2 + "/") || p2.startsWith(p1 + "/")) return true

		return false
	}

	/**
	 * Build execution groups - tools in each group can run in parallel
	 */
	private buildExecutionGroups(): ToolNode[][] {
		const groups: ToolNode[][] = []
		const completed = new Set<string>()
		const remaining = new Set(this.nodes.keys())

		while (remaining.size > 0) {
			const group: ToolNode[] = []

			// Find all nodes whose dependencies are satisfied
			for (const nodeId of remaining) {
				const node = this.nodes.get(nodeId)!

				// Check if all dependencies are completed
				const dependenciesSatisfied = Array.from(node.dependencies).every((depId) => completed.has(depId))

				if (dependenciesSatisfied) {
					// Exclusive tools must be alone in their group
					if (node.isExclusive) {
						if (group.length === 0) {
							group.push(node)
							break // This group can only have this one tool
						}
						// Skip this tool for now, it will be in the next group
						continue
					}

					// Non-exclusive tools can be grouped together
					group.push(node)
				}
			}

			// If no progress was made but there are remaining nodes, there's a cycle
			if (group.length === 0 && remaining.size > 0) {
				// Break the cycle by adding the first remaining node
				const firstRemaining = remaining.values().next().value
				if (firstRemaining) {
					const node = this.nodes.get(firstRemaining)
					if (node) {
						group.push(node)
					}
				}
			}

			// Mark group nodes as completed and remove from remaining
			for (const node of group) {
				completed.add(node.id)
				remaining.delete(node.id)
			}

			if (group.length > 0) {
				groups.push(group)
			}
		}

		return groups
	}

	/**
	 * Check if a tool can run in parallel with others
	 */
	private canRunInParallel(toolName: string): boolean {
		return !this.isExclusiveTool(toolName)
	}

	/**
	 * Check if a tool requires exclusive execution
	 */
	private isExclusiveTool(toolName: string): boolean {
		return EXCLUSIVE_TOOLS.has(toolName)
	}

	/**
	 * Check if any exclusive tools are in the graph
	 */
	private checkForExclusiveTools(): boolean {
		return Array.from(this.nodes.values()).some((node) => node.isExclusive)
	}
}
