// src/core/middleware/AgentTraceMiddleware.ts
import * as fs from "fs/promises"
import * as path from "path"
import { generateContentHash } from "../../utils/hash"
import { Task } from "../task/Task"
import type { ToolMiddleware, MiddlewareResult } from "./ToolMiddleware"

interface AgentTraceEntry {
	timestamp: string
	intent_id: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION"
	file_path: string
	content_hash: string
	related: string[] // REQ-IDs
	ranges: {
		start: number
		end: number
		content_hash: string
	}[]
}

interface AgentTraceEntry {
	timestamp: string
	intent_id: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION"
	file_path: string
	content_hash: string
	related: string[]
	ranges: {
		start: number
		end: number
		content_hash: string
	}[]
}

export class AgentTraceMiddleware implements ToolMiddleware {
	name = "agentTrace"

	async beforeExecute(params: any, task: Task, toolName: string): Promise<MiddlewareResult> {
		// No pre-execution logic needed for tracing
		return { allow: true }
	}

	async afterExecute(result: any, task: Task, toolName: string): Promise<MiddlewareResult> {
		if (toolName !== "write_to_file") {
			return { allow: true, modifiedResult: result }
		}

		try {
			// Get the last write_file tool use from the conversation
			const lastToolUse = this.findLastToolUse(task, "write_to_file")
			if (!lastToolUse) {
				return { allow: true, modifiedResult: result }
			}

			const { intent_id, mutation_class, path: filePath } = lastToolUse.params
			const contentHash = generateContentHash(lastToolUse.params.content)

			const traceEntry: AgentTraceEntry = {
				timestamp: new Date().toISOString(),
				intent_id,
				mutation_class,
				file_path: filePath,
				content_hash: contentHash,
				related: [intent_id], // Inject REQ-ID into related array
				ranges: [
					{
						start: 0,
						end: lastToolUse.params.content.length,
						content_hash: contentHash, // Inject content_hash into ranges
					},
				],
			}

			await this.appendToTraceFile(traceEntry, task.cwd)
			return { allow: true, modifiedResult: result }
		} catch (error) {
			console.error("Agent trace middleware error:", error)
			// Don't fail the operation, just log the error
			return { allow: true, modifiedResult: result }
		}
	}

	private findLastToolUse(task: Task, toolName: string): any {
		for (let i = task.apiConversationHistory.length - 1; i >= 0; i--) {
			const message = task.apiConversationHistory[i]
			if (message.role === "assistant" && Array.isArray(message?.content)) {
				const toolUse = message.content?.find(
					(block: any) => block.type === "tool_use" && block.name === toolName,
				)
				if (toolUse) {
					return toolUse
				}
			}
		}
		return null
	}

	private async appendToTraceFile(entry: AgentTraceEntry, cwd: string): Promise<void> {
		const tracePath = path.join(cwd, ".orchestration", "agent_trace.jsonl")

		try {
			await fs.mkdir(path.dirname(tracePath), { recursive: true })
			const line = JSON.stringify(entry) + "\n"
			await fs.appendFile(tracePath, line, "utf8")
		} catch (error) {
			console.error("Failed to write to agent trace:", error)
		}
	}
}
