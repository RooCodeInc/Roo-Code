/**
 * PostToolUseHook - Post-tool-use interceptor implementation
 * Handles trace recording, spatial map updates, and result validation
 */

import type { PostHook } from "../HookEngine"
import type { HookContext, PostHookResult } from "../types/HookResult"
import type { TraceLedger, SpatialMap, TraceEntry } from "../types/TraceTypes"
import { IntentStore } from "../intent-store/IntentStore"
import { createHash } from "crypto"

export interface PostToolUseConfig {
	intentStore: IntentStore
	traceLedger: TraceLedger
	spatialMap: SpatialMap
}

export class PostToolUseHook implements PostHook {
	name = "PostToolUseHook"
	private config: PostToolUseConfig

	constructor(config: PostToolUseConfig) {
		this.config = config
	}

	async execute(context: HookContext, result: unknown): Promise<PostHookResult> {
		const { tool_name, tool_args, intent_id, timestamp } = context

		// Calculate hashes for traceability
		const inputHash = this.hashObject(tool_args)
		const outputHash = this.hashObject(result)

		// Record in trace ledger
		const traceEntry: TraceEntry = {
			timestamp,
			tool_name,
			intent_id,
			input_hash: inputHash,
			output_hash: outputHash,
			duration_ms: 0, // Will be calculated by caller
			success: this.isSuccess(result),
		}

		// Update spatial map for file operations
		if (this.isFileOperation(tool_name)) {
			this.updateSpatialMap(tool_name, tool_args, intent_id, timestamp)
		}

		return {
			action: "allow",
			shouldProceed: true,
			trace_entry: traceEntry,
		}
	}

	/**
	 * Check if tool operation was successful
	 */
	private isSuccess(result: unknown): boolean {
		if (result === null || result === undefined) {
			return true
		}

		if (typeof result === "object" && result !== null) {
			const obj = result as Record<string, unknown>
			if ("error" in obj || "failure" in obj) {
				return false
			}
		}

		return true
	}

	/**
	 * Check if tool is a file operation
	 */
	private isFileOperation(toolName: string): boolean {
		const fileTools = [
			"read_file",
			"write_to_file",
			"edit_file",
			"edit",
			"search_replace",
			"apply_patch",
			"apply_diff",
			"search_files",
		]
		return fileTools.includes(toolName)
	}

	/**
	 * Update spatial map with file operation
	 */
	private updateSpatialMap(
		toolName: string,
		toolArgs: Record<string, unknown>,
		intent_id: string | undefined,
		timestamp: string,
	): void {
		const filePath = this.extractFilePath(toolName, toolArgs)
		if (!filePath || !intent_id) {
			return
		}

		const operationType = this.getOperationType(toolName)
		const lineRange = this.extractLineRange(toolArgs)

		this.config.spatialMap.add({
			file_path: filePath,
			intent_id,
			operation_type: operationType,
			timestamp,
			line_range: lineRange,
		})
	}

	/**
	 * Get operation type from tool name
	 */
	private getOperationType(toolName: string): "read" | "write" | "modify" {
		switch (toolName) {
			case "read_file":
			case "search_files":
				return "read"
			case "write_to_file":
				return "write"
			case "edit_file":
			case "edit":
			case "search_replace":
			case "apply_patch":
			case "apply_diff":
				return "modify"
			default:
				return "read"
		}
	}

	/**
	 * Extract file path from tool arguments
	 */
	private extractFilePath(toolName: string, toolArgs: Record<string, unknown>): string | null {
		const pathFields = ["path", "file_path", "filePath"]
		for (const field of pathFields) {
			if (toolArgs[field] && typeof toolArgs[field] === "string") {
				return toolArgs[field] as string
			}
		}
		return null
	}

	/**
	 * Extract line range from tool arguments if present
	 */
	private extractLineRange(toolArgs: Record<string, unknown>): { start: number; end: number } | undefined {
		if (toolArgs.start_line !== undefined && toolArgs.end_line !== undefined) {
			return {
				start: Number(toolArgs.start_line),
				end: Number(toolArgs.end_line),
			}
		}
		return undefined
	}

	/**
	 * Create hash of an object for traceability
	 */
	private hashObject(obj: unknown): string {
		const str = JSON.stringify(obj)
		return createHash("sha256").update(str).digest("hex").substring(0, 16)
	}
}
