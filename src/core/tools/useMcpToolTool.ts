import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskUseMcpServer } from "../../shared/ExtensionMessage"
import { McpExecutionStatus } from "@roo-code/types"
import { t } from "../../i18n"
import {
	SUPPORTED_IMAGE_TYPES,
	DEFAULT_MCP_IMAGE_LIMITS,
	isSupportedImageType,
	isValidBase64Image,
	calculateBase64Size,
	bytesToMB,
	extractMimeType,
} from "./mcpImageConstants"

interface McpToolParams {
	server_name?: string
	tool_name?: string
	arguments?: string
}

type ValidationResult =
	| { isValid: false }
	| {
			isValid: true
			serverName: string
			toolName: string
			parsedArguments?: Record<string, unknown>
	  }

async function handlePartialRequest(
	cline: Task,
	params: McpToolParams,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const partialMessage = JSON.stringify({
		type: "use_mcp_tool",
		serverName: removeClosingTag("server_name", params.server_name),
		toolName: removeClosingTag("tool_name", params.tool_name),
		arguments: removeClosingTag("arguments", params.arguments),
	} satisfies ClineAskUseMcpServer)

	await cline.ask("use_mcp_server", partialMessage, true).catch(() => {})
}

async function validateParams(
	cline: Task,
	params: McpToolParams,
	pushToolResult: PushToolResult,
): Promise<ValidationResult> {
	if (!params.server_name) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("use_mcp_tool")
		pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "server_name"))
		return { isValid: false }
	}

	if (!params.tool_name) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("use_mcp_tool")
		pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"))
		return { isValid: false }
	}

	let parsedArguments: Record<string, unknown> | undefined

	if (params.arguments) {
		try {
			parsedArguments = JSON.parse(params.arguments)
		} catch (error) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say("error", t("mcp:errors.invalidJsonArgument", { toolName: params.tool_name }))

			pushToolResult(
				formatResponse.toolError(
					formatResponse.invalidMcpToolArgumentError(params.server_name, params.tool_name),
				),
			)
			return { isValid: false }
		}
	}

	return {
		isValid: true,
		serverName: params.server_name,
		toolName: params.tool_name,
		parsedArguments,
	}
}

async function validateToolExists(
	cline: Task,
	serverName: string,
	toolName: string,
	pushToolResult: PushToolResult,
): Promise<{ isValid: boolean; availableTools?: string[] }> {
	try {
		// Get the MCP hub to access server information
		const provider = cline.providerRef.deref()
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

			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say("error", t("mcp:errors.serverNotFound", { serverName, availableServers }))

			pushToolResult(formatResponse.unknownMcpServerError(serverName, availableServersArray))
			return { isValid: false, availableTools: [] }
		}

		// Check if the server has tools defined
		if (!server.tools || server.tools.length === 0) {
			// No tools available on this server
			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say(
				"error",
				t("mcp:errors.toolNotFound", {
					toolName,
					serverName,
					availableTools: "No tools available",
				}),
			)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, []))
			return { isValid: false, availableTools: [] }
		}

		// Check if the requested tool exists
		const tool = server.tools.find((tool) => tool.name === toolName)

		if (!tool) {
			// Tool not found - provide list of available tools
			const availableToolNames = server.tools.map((tool) => tool.name)

			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say(
				"error",
				t("mcp:errors.toolNotFound", {
					toolName,
					serverName,
					availableTools: availableToolNames.join(", "),
				}),
			)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, availableToolNames))
			return { isValid: false, availableTools: availableToolNames }
		}

		// Check if the tool is disabled (enabledForPrompt is false)
		if (tool.enabledForPrompt === false) {
			// Tool is disabled - only show enabled tools
			const enabledTools = server.tools.filter((t) => t.enabledForPrompt !== false)
			const enabledToolNames = enabledTools.map((t) => t.name)

			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say(
				"error",
				t("mcp:errors.toolDisabled", {
					toolName,
					serverName,
					availableTools:
						enabledToolNames.length > 0 ? enabledToolNames.join(", ") : "No enabled tools available",
				}),
			)

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

async function sendExecutionStatus(cline: Task, status: McpExecutionStatus): Promise<void> {
	const clineProvider = await cline.providerRef.deref()
	clineProvider?.postMessageToWebview({
		type: "mcpExecutionStatus",
		text: JSON.stringify(status),
	})
}

interface ProcessedContent {
	text: string
	images: string[]
	errors: string[]
}

function processToolContent(
	toolResult: any,
	maxImages: number = DEFAULT_MCP_IMAGE_LIMITS.maxImagesPerResponse,
	maxSizeMB: number = DEFAULT_MCP_IMAGE_LIMITS.maxImageSizeMB,
): ProcessedContent {
	const result: ProcessedContent = {
		text: "",
		images: [],
		errors: [],
	}

	if (!toolResult?.content || toolResult.content.length === 0) {
		return result
	}

	const textParts: string[] = []

	for (const item of toolResult.content) {
		if (item.type === "text") {
			textParts.push(item.text)
		} else if (item.type === "image") {
			// Handle image content
			const imageData = item.data || item.base64
			const mimeType = item.mimeType || extractMimeType(imageData)

			if (!imageData) {
				result.errors.push("Image data is missing")
				continue
			}

			// Check if we've reached the image limit
			if (result.images.length >= maxImages) {
				result.errors.push(`Maximum number of images (${maxImages}) exceeded`)
				continue
			}

			// Validate MIME type
			if (mimeType && !isSupportedImageType(mimeType)) {
				result.errors.push(
					`Unsupported image type: ${mimeType}. Supported types: ${SUPPORTED_IMAGE_TYPES.join(", ")}`,
				)
				continue
			}

			// Validate base64 data
			if (!isValidBase64Image(imageData)) {
				result.errors.push("Invalid or corrupted base64 image data")
				continue
			}

			// Check image size
			const sizeBytes = calculateBase64Size(imageData)
			const sizeMB = bytesToMB(sizeBytes)

			if (sizeMB > maxSizeMB) {
				result.errors.push(`Image size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`)
				continue
			}

			// Add data URL prefix if not present
			let fullImageData = imageData
			if (!imageData.startsWith("data:")) {
				const type = mimeType || "image/png"
				fullImageData = `data:${type};base64,${imageData}`
			}

			result.images.push(fullImageData)
		} else if (item.type === "resource") {
			const { blob: _, ...rest } = item.resource
			textParts.push(JSON.stringify(rest, null, 2))
		}
	}

	result.text = textParts.filter(Boolean).join("\n\n")
	return result
}

async function executeToolAndProcessResult(
	cline: Task,
	serverName: string,
	toolName: string,
	parsedArguments: Record<string, unknown> | undefined,
	executionId: string,
	pushToolResult: PushToolResult,
): Promise<void> {
	await cline.say("mcp_server_request_started")

	// Send started status
	await sendExecutionStatus(cline, {
		executionId,
		status: "started",
		serverName,
		toolName,
	})

	// Get configuration for image limits
	const provider = cline.providerRef.deref()
	const maxImages = provider?.getValue("mcpMaxImagesPerResponse") ?? DEFAULT_MCP_IMAGE_LIMITS.maxImagesPerResponse
	const maxSizeMB = provider?.getValue("mcpMaxImageSizeMB") ?? DEFAULT_MCP_IMAGE_LIMITS.maxImageSizeMB

	const toolResult = await provider?.getMcpHub()?.callTool(serverName, toolName, parsedArguments)

	let toolResultPretty = "(No response)"
	let images: string[] = []

	if (toolResult) {
		const processedContent = processToolContent(toolResult, maxImages, maxSizeMB)

		// Log any errors encountered during processing
		if (processedContent.errors.length > 0) {
			console.warn("MCP image processing warnings:", processedContent.errors)
			// Include errors in the response for transparency
			const errorText = processedContent.errors.map((e) => `⚠️ ${e}`).join("\n")
			processedContent.text = processedContent.text ? `${processedContent.text}\n\n${errorText}` : errorText
		}

		if (processedContent.text || processedContent.images.length > 0) {
			// Send text output first
			if (processedContent.text) {
				await sendExecutionStatus(cline, {
					executionId,
					status: "output",
					response: processedContent.text,
				})
			}

			// Prepare the complete response
			toolResultPretty = (toolResult.isError ? "Error:\n" : "") + processedContent.text

			// Store images for later use
			images = processedContent.images

			// Include image count in response if images are present
			if (images.length > 0) {
				const imageInfo = `\n\n📷 ${images.length} image${images.length > 1 ? "s" : ""} included in response`
				toolResultPretty += imageInfo
			}
		}

		// Send completion status
		await sendExecutionStatus(cline, {
			executionId,
			status: toolResult.isError ? "error" : "completed",
			response: toolResultPretty,
			error: toolResult.isError ? "Error executing MCP tool" : undefined,
			images: images.length > 0 ? images : undefined,
		})
	} else {
		// Send error status if no result
		await sendExecutionStatus(cline, {
			executionId,
			status: "error",
			error: "No response from MCP server",
		})
	}

	// Include images in the response message
	if (images.length > 0) {
		await cline.say("mcp_server_response", toolResultPretty, images)
	} else {
		await cline.say("mcp_server_response", toolResultPretty)
	}

	pushToolResult(formatResponse.toolResult(toolResultPretty, images))
}

export async function useMcpToolTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		const params: McpToolParams = {
			server_name: block.params.server_name,
			tool_name: block.params.tool_name,
			arguments: block.params.arguments,
		}

		// Handle partial requests
		if (block.partial) {
			await handlePartialRequest(cline, params, removeClosingTag)
			return
		}

		// Validate parameters
		const validation = await validateParams(cline, params, pushToolResult)
		if (!validation.isValid) {
			return
		}

		const { serverName, toolName, parsedArguments } = validation

		// Validate that the tool exists on the server
		const toolValidation = await validateToolExists(cline, serverName, toolName, pushToolResult)
		if (!toolValidation.isValid) {
			return
		}

		// Reset mistake count on successful validation
		cline.consecutiveMistakeCount = 0

		// Get user approval
		const completeMessage = JSON.stringify({
			type: "use_mcp_tool",
			serverName,
			toolName,
			arguments: params.arguments,
		} satisfies ClineAskUseMcpServer)

		const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()
		const didApprove = await askApproval("use_mcp_server", completeMessage)

		if (!didApprove) {
			return
		}

		// Execute the tool and process results
		await executeToolAndProcessResult(cline, serverName!, toolName!, parsedArguments, executionId, pushToolResult)
	} catch (error) {
		await handleError("executing MCP tool", error)
	}
}
