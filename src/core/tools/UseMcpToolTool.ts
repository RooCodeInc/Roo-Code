import path from "path"
import fs from "fs/promises"
import type { ClineAskUseMcpServer, McpExecutionStatus } from "@roo-code/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import type { ToolUse } from "../../shared/tools"
import { getTaskDirectoryPath } from "../../utils/storage"

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

			// Reset mistake count on successful validation
			task.consecutiveMistakeCount = 0

			// Get user approval
			const completeMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName,
				toolName,
				arguments: params.arguments ? JSON.stringify(params.arguments) : undefined,
			} satisfies ClineAskUseMcpServer)

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()
			const didApprove = await askApproval("use_mcp_server", completeMessage)

			if (!didApprove) {
				return
			}

			// Execute the tool and process results
			await this.executeToolAndProcessResult(
				task,
				serverName,
				toolName,
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
	): Promise<{ isValid: boolean; availableTools?: string[] }> {
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

			// Check if the requested tool exists
			const tool = server.tools.find((tool) => tool.name === toolName)

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

			// Tool exists and is enabled
			return { isValid: true, availableTools: server.tools.map((tool) => tool.name) }
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
			const { text: outputText, images: extractedImages } = this.processToolContent(toolResult)
			images = extractedImages

			if (outputText || images.length > 0) {
				await this.sendExecutionStatus(task, {
					executionId,
					status: "output",
					response: outputText || (images.length > 0 ? `[${images.length} image(s)]` : ""),
				})

				// Build the result text
				let resultText = outputText || ""

				// If there are images, save them to temp storage and provide file paths to the LLM
				// This avoids passing raw base64 through LLM context which causes corruption and high costs
				if (images.length > 0) {
					const savedImagePaths = await this.saveImagesToTempStorage(task, images, serverName, toolName)
					const imagePathsSection = savedImagePaths
						.map(
							(imgPath, index) =>
								`<image_${index + 1}>\n  <source_path>${imgPath}</source_path>\n</image_${index + 1}>`,
						)
						.join("\n\n")
					const imageInfo = `\n\n[${images.length} image(s) received and saved to temporary storage. Use save_image tool with source_path to save to your desired location.]\n\n${imagePathsSection}`
					resultText = resultText ? resultText + imageInfo : imageInfo.trim()
				}

				toolResultPretty = (toolResult.isError ? "Error:\n" : "") + resultText
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

	/**
	 * Save images to task-specific temp storage and return file paths.
	 * This allows passing file paths to the LLM instead of raw base64 data,
	 * which prevents data corruption and reduces token costs.
	 */
	private async saveImagesToTempStorage(
		task: Task,
		images: string[],
		serverName: string,
		toolName: string,
	): Promise<string[]> {
		const savedPaths: string[] = []

		try {
			const provider = task.providerRef.deref()
			if (!provider) {
				// Fall back to using task.cwd as temp location
				return this.saveImagesToFallbackLocation(task, images, serverName, toolName)
			}

			const globalStoragePath = provider.context?.globalStorageUri?.fsPath
			if (!globalStoragePath) {
				return this.saveImagesToFallbackLocation(task, images, serverName, toolName)
			}

			// Create a temp directory for MCP images within the task directory
			const taskDir = await getTaskDirectoryPath(globalStoragePath, task.taskId)
			const mcpImagesDir = path.join(taskDir, "mcp_images")
			await fs.mkdir(mcpImagesDir, { recursive: true })

			const timestamp = Date.now()

			for (let i = 0; i < images.length; i++) {
				const imageDataUrl = images[i]
				const { format, data } = this.parseImageDataUrl(imageDataUrl)

				if (data) {
					const filename = `${serverName}_${toolName}_${timestamp}_${i + 1}.${format}`
					const filePath = path.join(mcpImagesDir, filename)

					const imageBuffer = Buffer.from(data, "base64")
					await fs.writeFile(filePath, imageBuffer)

					savedPaths.push(filePath)
				}
			}
		} catch (error) {
			console.error("Error saving images to temp storage:", error)
			// Return empty paths array on error - the LLM will see the error and handle accordingly
		}

		return savedPaths
	}

	/**
	 * Fallback method to save images to workspace .roo/temp directory
	 */
	private async saveImagesToFallbackLocation(
		task: Task,
		images: string[],
		serverName: string,
		toolName: string,
	): Promise<string[]> {
		const savedPaths: string[] = []

		try {
			const tempDir = path.join(task.cwd, ".roo", "temp", "mcp_images")
			await fs.mkdir(tempDir, { recursive: true })

			const timestamp = Date.now()

			for (let i = 0; i < images.length; i++) {
				const imageDataUrl = images[i]
				const { format, data } = this.parseImageDataUrl(imageDataUrl)

				if (data) {
					const filename = `${serverName}_${toolName}_${timestamp}_${i + 1}.${format}`
					const filePath = path.join(tempDir, filename)

					const imageBuffer = Buffer.from(data, "base64")
					await fs.writeFile(filePath, imageBuffer)

					savedPaths.push(filePath)
				}
			}
		} catch (error) {
			console.error("Error saving images to fallback location:", error)
		}

		return savedPaths
	}

	/**
	 * Parse a data URL to extract format and base64 data
	 */
	private parseImageDataUrl(dataUrl: string): { format: string; data: string | null } {
		const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/)
		if (match) {
			const format = match[1] === "jpeg" ? "jpg" : match[1] === "svg+xml" ? "svg" : match[1]
			return { format, data: match[2] }
		}
		return { format: "png", data: null }
	}
}

export const useMcpToolTool = new UseMcpToolTool()
