import * as fs from "fs/promises"
import * as path from "path"
import * as crypto from "crypto"
import { Task } from "../task/Task"
import { generateContentHash } from "../../utils/hash"
import type { ToolMiddleware, MiddlewareResult } from "./ToolMiddleware"

interface AgentTraceEntry {
	id: string
	timestamp: string
	vcs: {
		revision_id: string
	}
	files: Array<{
		relative_path: string
		conversations: Array<{
			url: string
			contributor: {
				entity_type: "AI"
				model_identifier: string
			}
			ranges: Array<{
				start_line: number
				end_line: number
				content_hash: string
			}>
			related: Array<{
				type: "specification"
				value: string
			}>
		}>
	}>
}

export class AgentTraceMiddleware implements ToolMiddleware {
	name = "agentTrace"

	async beforeExecute(_params: any, _task: Task, _toolName: string): Promise<MiddlewareResult> {
		return { allow: true }
	}

	async afterExecute(result: any, task: Task, toolName: string): Promise<MiddlewareResult> {
		if (toolName !== "write_to_file") {
			return { allow: true, modifiedResult: result }
		}

		try {
			const lastToolUse = this.findLastToolUse(task, "write_to_file")
			if (!lastToolUse) {
				return { allow: true, modifiedResult: result }
			}

			const { intent_id, mutation_class, path: filePath, content } = lastToolUse.params
			const contentHash = generateContentHash(content)

			const traceEntry: AgentTraceEntry = {
				id: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
				vcs: {
					revision_id: await this.getGitSha(task.cwd),
				},
				files: [
					{
						relative_path: filePath,
						conversations: [
							{
								url: task.taskId, // session_log_id
								contributor: {
									entity_type: "AI",
									model_identifier: await this.getModelIdentifier(task),
								},
								ranges: [
									{
										start_line: 1,
										end_line: content.split("\n").length,
										content_hash: `sha256:${contentHash}`,
									},
								],
								related: [
									{
										type: "specification",
										value: intent_id, // REQ-ID injection
									},
								],
							},
						],
					},
				],
			}

			await this.appendToTraceFile(traceEntry, task.cwd)
			return { allow: true, modifiedResult: result }
		} catch (error) {
			console.error("Agent trace middleware error:", error)
			return { allow: true, modifiedResult: result }
		}
	}

	private async getGitSha(cwd: string): Promise<string> {
		try {
			const { execSync } = require("child_process")
			const gitSha = execSync("git rev-parse HEAD", {
				cwd,
				encoding: "utf8",
			}).trim()
			return gitSha || "unknown"
		} catch {
			return "unknown"
		}
	}

	private async getModelIdentifier(task: Task): Promise<string> {
		try {
			const provider = task.providerRef.deref()
			if (!provider) return "unknown"

			const state = await provider.getState()
			const apiConfiguration = state?.apiConfiguration

			if (apiConfiguration) {
				switch (apiConfiguration.apiProvider) {
					case "anthropic":
						return apiConfiguration.apiModelId || "unknown"
					case "openrouter":
						return apiConfiguration.openRouterModelId || "unknown"
					case "openai":
						return apiConfiguration.openAiModelId || "unknown"
					case "lmstudio":
						return apiConfiguration.lmStudioModelId || "unknown"
					default:
						return "unknown"
				}
			}

			return "unknown"
		} catch {
			return "unknown"
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
