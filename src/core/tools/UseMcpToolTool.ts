import type { ClineAskUseMcpServer, McpExecutionStatus } from "@jabberwock/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import type { ToolUse } from "../../shared/tools"
import { toolNamesMatch } from "../../utils/mcp-name"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface UseMcpToolParams {
	server_name: string
	tool_name: string
	arguments?: Record<string, unknown>
}

type ValidationResult =
	| { isValid: false }
	| {
			isValid: true
			serverName: string
			toolName: string
			parsedArguments?: Record<string, unknown>
	  }

export class UseMcpToolTool extends BaseTool<"use_mcp_tool"> {
	readonly name = "use_mcp_tool" as const

	async execute(params: UseMcpToolParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Validate parameters
			const validation = await this.validateParams(task, params, pushToolResult)
			if (!validation.isValid) {
				return
			}

			const { serverName, toolName, parsedArguments } = validation

			// Validate that the tool exists on the server
			const toolValidation = await this.validateToolExists(task, serverName, toolName, pushToolResult)
			if (!toolValidation.isValid) {
				return
			}

			// Use the resolved tool name (original name from the server) for MCP calls
			// This handles cases where models mangle hyphens to underscores
			const resolvedToolName = toolValidation.resolvedToolName ?? toolName

			// Reset mistake count on successful validation
			task.consecutiveMistakeCount = 0

			// Get user approval
			const completeMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName,
				toolName: resolvedToolName,
				arguments: params.arguments ? JSON.stringify(params.arguments) : undefined,
			} satisfies ClineAskUseMcpServer)

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()

			// Approval always uses standard MCP approval flow
			// Interactive app UI rendering happens in executeToolAndProcessResult when tool returns _meta.ui
			const didApprove = await askApproval("use_mcp_server", completeMessage)

			if (!didApprove) {
				return
			}

			// Execute the tool and process results
			await this.executeToolAndProcessResult(
				task,
				serverName,
				resolvedToolName,
				parsedArguments,
				executionId,
				pushToolResult,
			)
		} catch (error) {
			await handleError("executing MCP tool", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"use_mcp_tool">): Promise<void> {
		const params = block.params
		const partialMessage = JSON.stringify({
			type: "use_mcp_tool",
			serverName: params.server_name ?? "",
			toolName: params.tool_name ?? "",
			arguments: params.arguments,
		} satisfies ClineAskUseMcpServer)

		await task.ask("use_mcp_server", partialMessage, true).catch(() => {})
	}

	private async validateParams(
		task: Task,
		params: UseMcpToolParams,
		pushToolResult: (content: string) => void,
	): Promise<ValidationResult> {
		if (!params.server_name) {
			task.consecutiveMistakeCount++
			task.recordToolError("use_mcp_tool")
			pushToolResult(await task.sayAndCreateMissingParamError("use_mcp_tool", "server_name"))
			return { isValid: false }
		}

		if (!params.tool_name) {
			task.consecutiveMistakeCount++
			task.recordToolError("use_mcp_tool")
			pushToolResult(await task.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"))
			return { isValid: false }
		}

		// Native-only: arguments are already a structured object.
		let parsedArguments: Record<string, unknown> | undefined
		if (params.arguments !== undefined) {
			if (typeof params.arguments !== "object" || params.arguments === null || Array.isArray(params.arguments)) {
				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say("error", t("mcp:errors.invalidJsonArgument", { toolName: params.tool_name }))
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						formatResponse.invalidMcpToolArgumentError(params.server_name, params.tool_name),
					),
				)
				return { isValid: false }
			}
			parsedArguments = params.arguments
		}

		return {
			isValid: true,
			serverName: params.server_name,
			toolName: params.tool_name,
			parsedArguments,
		}
	}

	private async validateToolExists(
		task: Task,
		serverName: string,
		toolName: string,
		pushToolResult: (content: string) => void,
	): Promise<{ isValid: boolean; availableTools?: string[]; resolvedToolName?: string }> {
		try {
			// Get the MCP hub to access server information
			const provider = task.providerRef.deref()
			const mcpHub = provider?.getMcpHub()

			if (!mcpHub) {
				// If we can't get the MCP hub, we can't validate, so proceed with caution
				return { isValid: true }
			}

			// Get all servers to find the specific one
			const servers = mcpHub.getAllServers()
			const server = servers.find((s) => s.name === serverName)

			if (!server) {
				// Fail fast when server is unknown
				const availableServersArray = servers.map((s) => s.name)
				const availableServers =
					availableServersArray.length > 0 ? availableServersArray.join(", ") : "No servers available"

				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say("error", t("mcp:errors.serverNotFound", { serverName, availableServers }))
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpServerError(serverName, availableServersArray))
				return { isValid: false, availableTools: [] }
			}

			// Check if the server has tools defined
			if (!server.tools || server.tools.length === 0) {
				// No tools available on this server
				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say(
					"error",
					t("mcp:errors.toolNotFound", {
						toolName,
						serverName,
						availableTools: "No tools available",
					}),
				)
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, []))
				return { isValid: false, availableTools: [] }
			}

			// Check if the requested tool exists (using fuzzy matching to handle model mangling of hyphens)
			const tool = server.tools.find((t) => toolNamesMatch(t.name, toolName))

			if (!tool) {
				// Tool not found - provide list of available tools
				const availableToolNames = server.tools.map((tool) => tool.name)

				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say(
					"error",
					t("mcp:errors.toolNotFound", {
						toolName,
						serverName,
						availableTools: availableToolNames.join(", "),
					}),
				)
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, availableToolNames))
				return { isValid: false, availableTools: availableToolNames }
			}

			// Check if the tool is disabled (enabledForPrompt is false)
			if (tool.enabledForPrompt === false) {
				// Tool is disabled - only show enabled tools
				const enabledTools = server.tools.filter((t) => t.enabledForPrompt !== false)
				const enabledToolNames = enabledTools.map((t) => t.name)

				task.consecutiveMistakeCount++
				task.recordToolError("use_mcp_tool")
				await task.say(
					"error",
					t("mcp:errors.toolDisabled", {
						toolName,
						serverName,
						availableTools:
							enabledToolNames.length > 0 ? enabledToolNames.join(", ") : "No enabled tools available",
					}),
				)
				task.didToolFailInCurrentTurn = true

				pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, enabledToolNames))
				return { isValid: false, availableTools: enabledToolNames }
			}

			// Tool exists and is enabled - return the original tool name for use with the MCP server
			return { isValid: true, availableTools: server.tools.map((t) => t.name), resolvedToolName: tool.name }
		} catch (error) {
			// If there's an error during validation, log it but don't block the tool execution
			// The actual tool call might still fail with a proper error
			console.error("Error validating MCP tool existence:", error)
			return { isValid: true }
		}
	}

	private async sendExecutionStatus(task: Task, status: McpExecutionStatus): Promise<void> {
		const clineProvider = await task.providerRef.deref()
		clineProvider?.postMessageToWebview({
			type: "mcpExecutionStatus",
			text: JSON.stringify(status),
		})
	}

	private processToolContent(toolResult: any): { text: string; images: string[] } {
		if (!toolResult?.content || toolResult.content.length === 0) {
			return { text: "", images: [] }
		}

		const images: string[] = []

		const textContent = toolResult.content
			.map((item: any) => {
				if (item.type === "text") {
					return item.text
				}
				if (item.type === "resource") {
					const { blob: _, ...rest } = item.resource
					return JSON.stringify(rest, null, 2)
				}
				if (item.type === "image") {
					// Handle image content (MCP image content has mimeType and data properties)
					if (item.mimeType && item.data) {
						if (item.data.startsWith("data:")) {
							images.push(item.data)
						} else {
							images.push(`data:${item.mimeType};base64,${item.data}`)
						}
					}
					return ""
				}
				return ""
			})
			.filter(Boolean)
			.join("\n\n")

		return { text: textContent, images }
	}

	private async executeToolAndProcessResult(
		task: Task,
		serverName: string,
		toolName: string,
		parsedArguments: Record<string, unknown> | undefined,
		executionId: string,
		pushToolResult: (content: string | Array<any>) => void,
	): Promise<void> {
		await task.say("mcp_server_request_started")

		// Send started status
		await this.sendExecutionStatus(task, {
			executionId,
			status: "started",
			serverName,
			toolName,
		})

		const toolResult = await task.providerRef.deref()?.getMcpHub()?.callTool(serverName, toolName, parsedArguments)

		let toolResultPretty = "(No response)"
		let images: string[] = []

		if (toolResult) {
			if (toolResult._meta?.ui) {
				// Interactive App: Elicitation handling
				// Pause execution, send the UI metadata to the webview, and wait for user response
				const uiMeta = {
					...toolResult._meta.ui,
					input: parsedArguments,
				}
				const { response, text } = await task.ask("interactive_app", JSON.stringify(uiMeta))

				if (response !== "yesButtonClicked") {
					toolResultPretty = "User cancelled the interactive app."
					toolResult.isError = true
					toolResult.content = [{ type: "text", text: toolResultPretty }]
				} else {
					toolResultPretty = text || "Interactive app completed successfully."
					toolResult.content = [{ type: "text", text: toolResultPretty }]

					// Full history rewrite for `manage_todo_plan`: erase all evidence of the original plan
					// so the agent only sees the user-approved tasks and nothing else.
					if (serverName === "md-todo-mcp" && toolName === "manage_todo_plan" && typeof text === "string") {
						try {
							const newPlan = JSON.parse(text)
							const approvedTasks = newPlan.initialTasks || newPlan.tasks || []
							const history = task.apiConversationHistory

							console.log(
								`[DEBUG: TodoRewrite] Starting full history rewrite. Current history length: ${history.length}`,
							)
							console.log(
								`[DEBUG: TodoRewrite] Approved tasks (${approvedTasks.length}):`,
								JSON.stringify(
									approvedTasks.map(
										(t: { title: string; assignedTo: string }) => `${t.assignedTo}: ${t.title}`,
									),
								),
							)

							// Step 1: Extract environment_details from the first user message (workspace context)
							let environmentDetailsBlock: { type: "text"; text: string } | undefined
							const firstUserMsg = history.find((m) => m.role === "user")
							if (firstUserMsg && Array.isArray(firstUserMsg.content)) {
								const envBlock = firstUserMsg.content.find(
									(b: { type: string; text?: string }) =>
										b.type === "text" &&
										typeof b.text === "string" &&
										b.text.includes("<environment_details>"),
								)
								if (envBlock) {
									environmentDetailsBlock = {
										type: "text",
										text: (envBlock as { text: string }).text,
									}
								}
							}

							// Step 2: Find the assistant message with the manage_todo_plan tool call
							let toolUseId = "ollama-tool-0"
							for (let i = history.length - 1; i >= 0; i--) {
								const msg = history[i]
								if (msg.role === "assistant" && Array.isArray(msg.content)) {
									const toolUseBlock = msg.content.find(
										(b: { type: string; name?: string }) =>
											b.type === "tool_use" && b.name === "mcp--md-todo-mcp--manage_todo_plan",
									)
									if (toolUseBlock && (toolUseBlock as { id?: string }).id) {
										toolUseId = (toolUseBlock as { id: string }).id
										break
									}
								}
							}

							// Step 3: Synthesize a user message that ONLY describes the approved tasks
							const taskDescriptions = approvedTasks
								.map(
									(t: { assignedTo: string; title: string; description: string }) =>
										`- [${t.assignedTo}] ${t.title}: ${t.description}`,
								)
								.join("\n")
							const synthesizedUserText = `<user_message>\nExecute the following task plan:\n${taskDescriptions}\n</user_message>`

							// Step 4: Build clean 2-message history (user + assistant tool_use only)
							const userMsg = {
								role: "user" as const,
								content: [
									{ type: "text" as const, text: synthesizedUserText },
									...(environmentDetailsBlock ? [environmentDetailsBlock] : []),
								],
								ts: firstUserMsg ? (firstUserMsg as { ts?: number }).ts || Date.now() : Date.now(),
							}

							const assistantMsg = {
								role: "assistant" as const,
								content: [
									{
										type: "tool_use" as const,
										id: toolUseId,
										name: "mcp--md-todo-mcp--manage_todo_plan",
										input: { initialTasks: approvedTasks },
									},
								],
								ts: Date.now(),
							}
							// The tool_result will be added by the normal pushToolResult flow after this method returns
							const cleanHistory = [userMsg, assistantMsg]
							console.log(
								`[DEBUG: TodoRewrite] Truncated history from ${history.length} to ${cleanHistory.length} messages`,
							)
							console.log(`[DEBUG: TodoRewrite] Synthesized user message: "${synthesizedUserText}"`)

							await task.overwriteApiConversationHistory(cleanHistory as typeof history)

							// Step 5: Also rewrite the pending userMessageContent to match
							const pendingResult = task.userMessageContent.find(
								(b) =>
									b.type === "tool_result" &&
									(b as { tool_use_id?: string }).tool_use_id === toolUseId,
							)
							if (pendingResult) {
								;(pendingResult as { content: string }).content = JSON.stringify(newPlan)
								console.log("[DEBUG: TodoRewrite] Updated pending tool_result in userMessageContent")
							}

							console.log(
								"[DEBUG: TodoRewrite] History rewrite complete. Agent will only see approved tasks.",
							)
						} catch (e) {
							console.error("[DEBUG: TodoRewrite] Failed to rewrite history", e)
						}
					}
				}
			} else {
				const { text: outputText, images: extractedImages } = this.processToolContent(toolResult)
				images = extractedImages

				if (outputText || images.length > 0) {
					await this.sendExecutionStatus(task, {
						executionId,
						status: "output",
						response: outputText || (images.length > 0 ? `[${images.length} image(s)]` : ""),
					})

					toolResultPretty =
						(toolResult.isError ? "Error:\n" : "") +
						(outputText || (images.length > 0 ? `[${images.length} image(s) received]` : ""))
				}
			}

			// Send completion status
			await this.sendExecutionStatus(task, {
				executionId,
				status: toolResult.isError ? "error" : "completed",
				response: toolResultPretty,
				error: toolResult.isError ? "Error executing MCP tool" : undefined,
			})
		} else {
			// Send error status if no result
			await this.sendExecutionStatus(task, {
				executionId,
				status: "error",
				error: "No response from MCP server",
			})
		}

		await task.say("mcp_server_response", toolResultPretty, images)
		pushToolResult(formatResponse.toolResult(toolResultPretty, images))
	}
}

export const useMcpToolTool = new UseMcpToolTool()
