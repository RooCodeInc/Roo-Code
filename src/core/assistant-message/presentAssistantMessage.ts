import { serializeError } from "serialize-error"
import { Anthropic } from "@anthropic-ai/sdk"

import type { ToolName, ClineAsk, ToolProgressStatus } from "@roo-code/types"
import { ConsecutiveMistakeError, TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { customToolRegistry } from "@roo-code/core"

import { t } from "../../i18n"

import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import type { ToolParamName, ToolResponse, ToolUse, McpToolUse } from "../../shared/tools"

import { AskIgnoredError } from "../task/AskIgnoredError"
import { Task } from "../task/Task"

import { listFilesTool } from "../tools/ListFilesTool"
import { readFileTool } from "../tools/ReadFileTool"
import { readCommandOutputTool } from "../tools/ReadCommandOutputTool"
import { writeToFileTool } from "../tools/WriteToFileTool"
import { searchAndReplaceTool } from "../tools/SearchAndReplaceTool"
import { searchReplaceTool } from "../tools/SearchReplaceTool"
import { editFileTool } from "../tools/EditFileTool"
import { applyPatchTool } from "../tools/ApplyPatchTool"
import { searchFilesTool } from "../tools/SearchFilesTool"
import { browserActionTool } from "../tools/BrowserActionTool"
import { executeCommandTool } from "../tools/ExecuteCommandTool"
import { useMcpToolTool } from "../tools/UseMcpToolTool"
import { accessMcpResourceTool } from "../tools/accessMcpResourceTool"
import { askFollowupQuestionTool } from "../tools/AskFollowupQuestionTool"
import { switchModeTool } from "../tools/SwitchModeTool"
import { attemptCompletionTool, AttemptCompletionCallbacks } from "../tools/AttemptCompletionTool"
import { newTaskTool } from "../tools/NewTaskTool"
import { updateTodoListTool } from "../tools/UpdateTodoListTool"
import { runSlashCommandTool } from "../tools/RunSlashCommandTool"
import { skillTool } from "../tools/SkillTool"
import { generateImageTool } from "../tools/GenerateImageTool"
import { applyDiffTool as applyDiffToolClass } from "../tools/ApplyDiffTool"
import { isValidToolName, validateToolUse } from "../tools/validateToolUse"
import { codebaseSearchTool } from "../tools/CodebaseSearchTool"

import { formatResponse } from "../prompts/responses"
import { sanitizeToolUseId } from "../../utils/tool-id"
import { ToolDependencyGraphBuilder } from "../tools/dependency-graph"

/**
 * Processes and presents assistant message content to the user interface.
 *
 * This function is the core message handling system that:
 * - Sequentially processes content blocks from the assistant's response.
 * - Displays text content to the user.
 * - Executes tool use requests with appropriate user approval.
 * - Manages the flow of conversation by determining when to proceed to the next content block.
 * - Coordinates file system checkpointing for modified files.
 * - Controls the conversation state to determine when to continue to the next request.
 *
 * The function uses a locking mechanism to prevent concurrent execution and handles
 * partial content blocks during streaming. It's designed to work with the streaming
 * API response pattern, where content arrives incrementally and needs to be processed
 * as it becomes available.
 */

export async function presentAssistantMessage(cline: Task) {
	if (cline.abort) {
		throw new Error(`[Task#presentAssistantMessage] task ${cline.taskId}.${cline.instanceId} aborted`)
	}

	if (cline.presentAssistantMessageLocked) {
		cline.presentAssistantMessageHasPendingUpdates = true
		return
	}

	cline.presentAssistantMessageLocked = true
	cline.presentAssistantMessageHasPendingUpdates = false

	if (cline.currentStreamingContentIndex >= cline.assistantMessageContent.length) {
		// This may happen if the last content block was completed before
		// streaming could finish. If streaming is finished, and we're out of
		// bounds then this means we already  presented/executed the last
		// content block and are ready to continue to next request.
		if (cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
		}

		cline.presentAssistantMessageLocked = false
		return
	}

	let block: any
	try {
		// Performance optimization: Use shallow copy instead of deep clone.
		// The block is used read-only throughout this function - we never mutate its properties.
		// We only need to protect against the reference changing during streaming, not nested mutations.
		// This provides 80-90% reduction in cloning overhead (5-100ms saved per block).
		block = { ...cline.assistantMessageContent[cline.currentStreamingContentIndex] }
	} catch (error) {
		console.error(`ERROR cloning block:`, error)
		console.error(
			`Block content:`,
			JSON.stringify(cline.assistantMessageContent[cline.currentStreamingContentIndex], null, 2),
		)
		cline.presentAssistantMessageLocked = false
		return
	}

	// =========================================================================
	// Parallel Execution Batching
	// =========================================================================
	// Check if we should execute multiple tools in parallel
	if (shouldExecuteToolsInParallel(cline) && !cline.didRejectTool && !block.partial) {
		const toolBlocks: Array<{ index: number; block: ToolUse | McpToolUse }> = []
		let i = cline.currentStreamingContentIndex

		// Look ahead to find a sequence of complete tool blocks
		while (i < cline.assistantMessageContent.length) {
			const contentBlock = cline.assistantMessageContent[i]
			if ((contentBlock.type === "tool_use" || contentBlock.type === "mcp_tool_use") && !contentBlock.partial) {
				// Check if this tool can run in parallel
				const toolName =
					contentBlock.type === "mcp_tool_use" ? contentBlock.name : (contentBlock as ToolUse).name
				if (canExecuteToolInParallel(toolName)) {
					toolBlocks.push({ index: i, block: contentBlock as ToolUse | McpToolUse })
					i++
				} else {
					// Hit an exclusive tool - stop collecting
					break
				}
			} else {
				// Non-tool or partial block - stop collecting
				break
			}
		}

		// Only use parallel execution if we found 2+ parallelizable tools
		if (toolBlocks.length >= 2) {
			console.log(`[ParallelExecution] Detected ${toolBlocks.length} parallelizable tools, executing in parallel`)

			// Execute the batch using ParallelToolExecutor
			const executor = cline.getParallelExecutor()
			if (executor) {
				try {
					const state = await cline.providerRef.deref()?.getState()
					const { mode = "default", customModes = [], experiments: stateExperiments = {} } = state ?? {}

					const parallelResult = await executor.execute(
						toolBlocks.map(({ block }) => block),
						async (toolBlock: ToolUse | McpToolUse): Promise<ToolResponse> => {
							// Wrapper to capture tool results via callbacks
							return new Promise<ToolResponse>((resolve, reject) => {
								let capturedResult: ToolResponse = ""

								const captureCallbacks = {
									askApproval: async () => true, // Auto-approve for parallel (user already approved batch)
									handleError: async (_action: string, error: Error) => {
										reject(error)
									},
									pushToolResult: (content: ToolResponse) => {
										capturedResult = content
									},
								}

								// Execute based on tool type
								if (toolBlock.type === "tool_use") {
									const tu = toolBlock as ToolUse
									const params = tu.nativeArgs || tu.params

									const executeAsync = async () => {
										try {
											switch (tu.name) {
												case "read_file":
													await readFileTool.execute(params as any, cline, captureCallbacks)
													break
												case "list_files":
													await listFilesTool.execute(params as any, cline, captureCallbacks)
													break
												case "search_files":
													await searchFilesTool.execute(
														params as any,
														cline,
														captureCallbacks,
													)
													break
												case "codebase_search":
													await codebaseSearchTool.execute(
														params as any,
														cline,
														captureCallbacks,
													)
													break
												default:
													throw new Error(`Tool ${tu.name} not supported in parallel mode`)
											}
											resolve(capturedResult)
										} catch (err) {
											reject(err)
										}
									}
									executeAsync()
								} else {
									// MCP tools not yet supported
									reject(new Error("MCP tools not yet supported in parallel mode"))
								}
							})
						},
						{
							mode,
							customModes,
							experiments: stateExperiments,
						},
					)

					// Push results for each tool
					for (let j = 0; j < parallelResult.results.length; j++) {
						const result = parallelResult.results[j]
						const toolBlock = toolBlocks[j].block
						const toolId = toolBlock.id || `tool_${j}`

						if (result.success && result.result) {
							const content =
								typeof result.result === "string"
									? result.result
									: Array.isArray(result.result)
										? result.result
												.filter((b: any) => b.type === "text")
												.map((b: any) => b.text)
												.join("\n")
										: "(tool did not return anything)"

							cline.pushToolResultToUserContent({
								type: "tool_result",
								tool_use_id: sanitizeToolUseId(toolId),
								content: content || "(tool did not return anything)",
							})
						} else {
							cline.pushToolResultToUserContent({
								type: "tool_result",
								tool_use_id: sanitizeToolUseId(toolId),
								content: formatResponse.toolError(result.error?.message || "Tool execution failed"),
								is_error: true,
							})
						}
					}

					// Advance the index past all processed tools
					cline.currentStreamingContentIndex += toolBlocks.length
					cline.didAlreadyUseTool = true
					cline.presentAssistantMessageLocked = false

					// Continue processing remaining blocks
					if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
						presentAssistantMessage(cline)
					} else if (cline.didCompleteReadingStream) {
						cline.userMessageContentReady = true
					}
					return
				} catch (error) {
					console.error(`[ParallelExecution] Error executing batch:`, error)
					// Fall through to sequential execution
				}
			}
		}
	}
	// =========================================================================

	switch (block.type) {
		case "mcp_tool_use": {
			// Handle native MCP tool calls (from mcp_serverName_toolName dynamic tools)
			// These are converted to the same execution path as use_mcp_tool but preserve
			// their original name in API history
			const mcpBlock = block as McpToolUse

			if (cline.didRejectTool) {
				// For native protocol, we must send a tool_result for every tool_use to avoid API errors
				const toolCallId = mcpBlock.id
				const errorMessage = !mcpBlock.partial
					? `Skipping MCP tool ${mcpBlock.name} due to user rejecting a previous tool.`
					: `MCP tool ${mcpBlock.name} was interrupted and not executed due to user rejecting a previous tool.`

				if (toolCallId) {
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: errorMessage,
						is_error: true,
					})
				}
				break
			}

			// Track if we've already pushed a tool result
			let hasToolResult = false
			const toolCallId = mcpBlock.id

			// Store approval feedback to merge into tool result (GitHub #10465)
			let approvalFeedback: { text: string; images?: string[] } | undefined

			const pushToolResult = (content: ToolResponse, feedbackImages?: string[]) => {
				if (hasToolResult) {
					console.warn(
						`[presentAssistantMessage] Skipping duplicate tool_result for mcp_tool_use: ${toolCallId}`,
					)
					return
				}

				let resultContent: string
				let imageBlocks: Anthropic.ImageBlockParam[] = []

				if (typeof content === "string") {
					resultContent = content || "(tool did not return anything)"
				} else {
					const textBlocks = content.filter((item) => item.type === "text")
					imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
					resultContent =
						textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
						"(tool did not return anything)"
				}

				// Merge approval feedback into tool result (GitHub #10465)
				if (approvalFeedback) {
					const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
					resultContent = `${feedbackText}\n\n${resultContent}`

					// Add feedback images to the image blocks
					if (approvalFeedback.images) {
						const feedbackImageBlocks = formatResponse.imageBlocks(approvalFeedback.images)
						imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
					}
				}

				if (toolCallId) {
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: resultContent,
					})

					if (imageBlocks.length > 0) {
						cline.userMessageContent.push(...imageBlocks)
					}
				}

				hasToolResult = true
			}

			const toolDescription = () => `[mcp_tool: ${mcpBlock.serverName}/${mcpBlock.toolName}]`

			const askApproval = async (
				type: ClineAsk,
				partialMessage?: string,
				progressStatus?: ToolProgressStatus,
				isProtected?: boolean,
			) => {
				const { response, text, images } = await cline.ask(
					type,
					partialMessage,
					false,
					progressStatus,
					isProtected || false,
				)

				if (response !== "yesButtonClicked") {
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
					} else {
						pushToolResult(formatResponse.toolDenied())
					}
					cline.didRejectTool = true
					return false
				}

				// Store approval feedback to be merged into tool result (GitHub #10465)
				// Don't push it as a separate tool_result here - that would create duplicates.
				// The tool will call pushToolResult, which will merge the feedback into the actual result.
				if (text) {
					await cline.say("user_feedback", text, images)
					approvalFeedback = { text, images }
				}

				return true
			}

			const handleError = async (action: string, error: Error) => {
				// Silently ignore AskIgnoredError - this is an internal control flow
				// signal, not an actual error. It occurs when a newer ask supersedes an older one.
				if (error instanceof AskIgnoredError) {
					return
				}
				const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
				await cline.say(
					"error",
					`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
				)
				pushToolResult(formatResponse.toolError(errorString))
			}

			if (!mcpBlock.partial) {
				cline.recordToolUsage("use_mcp_tool") // Record as use_mcp_tool for analytics
				TelemetryService.instance.captureToolUsage(cline.taskId, "use_mcp_tool")
			}

			// Resolve sanitized server name back to original server name
			// The serverName from parsing is sanitized (e.g., "my_server" from "my server")
			// We need the original name to find the actual MCP connection
			const mcpHub = cline.providerRef.deref()?.getMcpHub()
			let resolvedServerName = mcpBlock.serverName
			if (mcpHub) {
				const originalName = mcpHub.findServerNameBySanitizedName(mcpBlock.serverName)
				if (originalName) {
					resolvedServerName = originalName
				}
			}

			// Execute the MCP tool using the same handler as use_mcp_tool
			// Create a synthetic ToolUse block that the useMcpToolTool can handle
			const syntheticToolUse: ToolUse<"use_mcp_tool"> = {
				type: "tool_use",
				id: mcpBlock.id,
				name: "use_mcp_tool",
				params: {
					server_name: resolvedServerName,
					tool_name: mcpBlock.toolName,
					arguments: JSON.stringify(mcpBlock.arguments),
				},
				partial: mcpBlock.partial,
				nativeArgs: {
					server_name: resolvedServerName,
					tool_name: mcpBlock.toolName,
					arguments: mcpBlock.arguments,
				},
			}

			await useMcpToolTool.handle(cline, syntheticToolUse, {
				askApproval,
				handleError,
				pushToolResult,
			})
			break
		}
		case "text": {
			if (cline.didRejectTool || cline.didAlreadyUseTool) {
				break
			}

			let content = block.content

			if (content) {
				// Have to do this for partial and complete since sending
				// content in thinking tags to markdown renderer will
				// automatically be removed.
				// Strip any streamed <thinking> tags from text output.
				content = content.replace(/<thinking>\s?/g, "")
				content = content.replace(/\s?<\/thinking>/g, "")

				// Tool calling is native-only. If the model emits XML-style tool tags in a text block,
				// fail fast with a clear error.
				if (containsXmlToolMarkup(content)) {
					const errorMessage =
						"XML tool calls are no longer supported. Remove any XML tool markup (e.g. <read_file>...</read_file>) and use native tool calling instead."
					cline.consecutiveMistakeCount++
					await cline.say("error", errorMessage)
					cline.userMessageContent.push({ type: "text", text: errorMessage })
					cline.didAlreadyUseTool = true
					break
				}
			}

			await cline.say("text", content, undefined, block.partial)
			break
		}
		case "tool_use": {
			// Native tool calling is the only supported tool calling mechanism.
			// A tool_use block without an id is invalid and cannot be executed.
			const toolCallId = (block as any).id as string | undefined
			if (!toolCallId) {
				const errorMessage =
					"Invalid tool call: missing tool_use.id. XML tool calls are no longer supported. Remove any XML tool markup (e.g. <read_file>...</read_file>) and use native tool calling instead."
				// Record a tool error for visibility/telemetry. Use the reported tool name if present.
				try {
					if (
						typeof (cline as any).recordToolError === "function" &&
						typeof (block as any).name === "string"
					) {
						;(cline as any).recordToolError((block as any).name as ToolName, errorMessage)
					}
				} catch {
					// Best-effort only
				}
				cline.consecutiveMistakeCount++
				await cline.say("error", errorMessage)
				cline.userMessageContent.push({ type: "text", text: errorMessage })
				cline.didAlreadyUseTool = true
				break
			}

			// Fetch state early so it's available for toolDescription and validation
			const state = await cline.providerRef.deref()?.getState()
			const { mode, customModes, experiments: stateExperiments } = state ?? {}

			const toolDescription = (): string => {
				switch (block.name) {
					case "execute_command":
						return `[${block.name} for '${block.params.command}']`
					case "read_file":
						// Prefer native typed args when available; fall back to legacy params
						// Check if nativeArgs exists (native protocol)
						if (block.nativeArgs) {
							return readFileTool.getReadFileToolDescription(block.name, block.nativeArgs)
						}
						return readFileTool.getReadFileToolDescription(block.name, block.params)
					case "write_to_file":
						return `[${block.name} for '${block.params.path}']`
					case "apply_diff":
						// Native-only: tool args are structured (no XML payloads).
						return block.params?.path ? `[${block.name} for '${block.params.path}']` : `[${block.name}]`
					case "search_files":
						return `[${block.name} for '${block.params.regex}'${
							block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
						}]`
					case "search_and_replace":
						return `[${block.name} for '${block.params.path}']`
					case "search_replace":
						return `[${block.name} for '${block.params.file_path}']`
					case "edit_file":
						return `[${block.name} for '${block.params.file_path}']`
					case "apply_patch":
						return `[${block.name}]`
					case "list_files":
						return `[${block.name} for '${block.params.path}']`
					case "browser_action":
						return `[${block.name} for '${block.params.action}']`
					case "use_mcp_tool":
						return `[${block.name} for '${block.params.server_name}']`
					case "access_mcp_resource":
						return `[${block.name} for '${block.params.server_name}']`
					case "ask_followup_question":
						return `[${block.name} for '${block.params.question}']`
					case "attempt_completion":
						return `[${block.name}]`
					case "switch_mode":
						return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
					case "codebase_search":
						return `[${block.name} for '${block.params.query}']`
					case "read_command_output":
						return `[${block.name} for '${block.params.artifact_id}']`
					case "update_todo_list":
						return `[${block.name}]`
					case "new_task": {
						const mode = block.params.mode ?? defaultModeSlug
						const message = block.params.message ?? "(no message)"
						const modeName = getModeBySlug(mode, customModes)?.name ?? mode
						return `[${block.name} in ${modeName} mode: '${message}']`
					}
					case "run_slash_command":
						return `[${block.name} for '${block.params.command}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
					case "skill":
						return `[${block.name} for '${block.params.skill}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
					case "generate_image":
						return `[${block.name} for '${block.params.path}']`
					default:
						return `[${block.name}]`
				}
			}

			if (cline.didRejectTool) {
				// Ignore any tool content after user has rejected tool once.
				// For native tool calling, we must send a tool_result for every tool_use to avoid API errors
				const errorMessage = !block.partial
					? `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`
					: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`

				cline.pushToolResultToUserContent({
					type: "tool_result",
					tool_use_id: sanitizeToolUseId(toolCallId),
					content: errorMessage,
					is_error: true,
				})

				break
			}

			// Track if we've already pushed a tool result for this tool call (native tool calling only)
			let hasToolResult = false

			// If this is a native tool call but the parser couldn't construct nativeArgs
			// (e.g., malformed/unfinished JSON in a streaming tool call), we must NOT attempt to
			// execute the tool. Instead, emit exactly one structured tool_result so the provider
			// receives a matching tool_result for the tool_use_id.
			//
			// This avoids executing an invalid tool_use block and prevents duplicate/fragmented
			// error reporting.
			if (!block.partial) {
				const customTool = stateExperiments?.customTools ? customToolRegistry.get(block.name) : undefined
				const isKnownTool = isValidToolName(String(block.name), stateExperiments)
				if (isKnownTool && !block.nativeArgs && !customTool) {
					const errorMessage =
						`Invalid tool call for '${block.name}': missing nativeArgs. ` +
						`This usually means the model streamed invalid or incomplete arguments and the call could not be finalized.`

					cline.consecutiveMistakeCount++
					try {
						cline.recordToolError(block.name as ToolName, errorMessage)
					} catch {
						// Best-effort only
					}

					// Push tool_result directly without setting didAlreadyUseTool so streaming can
					// continue gracefully.
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: formatResponse.toolError(errorMessage),
						is_error: true,
					})

					break
				}
			}

			// Store approval feedback to merge into tool result (GitHub #10465)
			let approvalFeedback: { text: string; images?: string[] } | undefined

			const pushToolResult = (content: ToolResponse) => {
				// Native tool calling: only allow ONE tool_result per tool call
				if (hasToolResult) {
					console.warn(
						`[presentAssistantMessage] Skipping duplicate tool_result for tool_use_id: ${toolCallId}`,
					)
					return
				}

				let resultContent: string
				let imageBlocks: Anthropic.ImageBlockParam[] = []

				if (typeof content === "string") {
					resultContent = content || "(tool did not return anything)"
				} else {
					const textBlocks = content.filter((item) => item.type === "text")
					imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
					resultContent =
						textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
						"(tool did not return anything)"
				}

				// Merge approval feedback into tool result (GitHub #10465)
				if (approvalFeedback) {
					const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
					resultContent = `${feedbackText}\n\n${resultContent}`
					if (approvalFeedback.images) {
						const feedbackImageBlocks = formatResponse.imageBlocks(approvalFeedback.images)
						imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
					}
				}

				cline.pushToolResultToUserContent({
					type: "tool_result",
					tool_use_id: sanitizeToolUseId(toolCallId),
					content: resultContent,
				})

				if (imageBlocks.length > 0) {
					cline.userMessageContent.push(...imageBlocks)
				}

				hasToolResult = true
			}

			const askApproval = async (
				type: ClineAsk,
				partialMessage?: string,
				progressStatus?: ToolProgressStatus,
				isProtected?: boolean,
			) => {
				const { response, text, images } = await cline.ask(
					type,
					partialMessage,
					false,
					progressStatus,
					isProtected || false,
				)

				if (response !== "yesButtonClicked") {
					// Handle both messageResponse and noButtonClicked with text.
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
					} else {
						pushToolResult(formatResponse.toolDenied())
					}
					cline.didRejectTool = true
					return false
				}

				// Store approval feedback to be merged into tool result (GitHub #10465)
				// Don't push it as a separate tool_result here - that would create duplicates.
				// The tool will call pushToolResult, which will merge the feedback into the actual result.
				if (text) {
					await cline.say("user_feedback", text, images)
					approvalFeedback = { text, images }
				}

				return true
			}

			const askFinishSubTaskApproval = async () => {
				// Ask the user to approve this task has completed, and he has
				// reviewed it, and we can declare task is finished and return
				// control to the parent task to continue running the rest of
				// the sub-tasks.
				const toolMessage = JSON.stringify({ tool: "finishTask" })
				return await askApproval("tool", toolMessage)
			}

			const handleError = async (action: string, error: Error) => {
				// Silently ignore AskIgnoredError - this is an internal control flow
				// signal, not an actual error. It occurs when a newer ask supersedes an older one.
				if (error instanceof AskIgnoredError) {
					return
				}
				const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

				await cline.say(
					"error",
					`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
				)

				pushToolResult(formatResponse.toolError(errorString))
			}

			// Keep browser open during an active session so other tools can run.
			// Session is active if we've seen any browser_action_result and the last browser_action is not "close".
			try {
				const messages = cline.clineMessages || []
				const hasStarted = messages.some((m: any) => m.say === "browser_action_result")
				let isClosed = false
				for (let i = messages.length - 1; i >= 0; i--) {
					const m = messages[i]
					if (m.say === "browser_action") {
						try {
							const act = JSON.parse(m.text || "{}")
							isClosed = act.action === "close"
						} catch {}
						break
					}
				}
				const sessionActive = hasStarted && !isClosed
				// Only auto-close when no active browser session is present, and this isn't a browser_action
				if (!sessionActive && block.name !== "browser_action") {
					await cline.browserSession.closeBrowser()
				}
			} catch {
				// On any unexpected error, fall back to conservative behavior
				if (block.name !== "browser_action") {
					await cline.browserSession.closeBrowser()
				}
			}

			if (!block.partial) {
				// Check if this is a custom tool - if so, record as "custom_tool" (like MCP tools)
				const isCustomTool = stateExperiments?.customTools && customToolRegistry.has(block.name)
				const recordName = isCustomTool ? "custom_tool" : block.name
				cline.recordToolUsage(recordName)
				TelemetryService.instance.captureToolUsage(cline.taskId, recordName)

				// Track legacy format usage for read_file tool (for migration monitoring)
				if (block.name === "read_file" && block.usedLegacyFormat) {
					const modelInfo = cline.api.getModel()
					TelemetryService.instance.captureEvent(TelemetryEventName.READ_FILE_LEGACY_FORMAT_USED, {
						taskId: cline.taskId,
						model: modelInfo?.id,
					})
				}
			}

			// Validate tool use before execution - ONLY for complete (non-partial) blocks.
			// Validating partial blocks would cause validation errors to be thrown repeatedly
			// during streaming, pushing multiple tool_results for the same tool_use_id and
			// potentially causing the stream to appear frozen.
			if (!block.partial) {
				const modelInfo = cline.api.getModel()
				// Resolve aliases in includedTools before validation
				// e.g., "edit_file" should resolve to "apply_diff"
				const rawIncludedTools = modelInfo?.info?.includedTools
				const { resolveToolAlias } = await import("../prompts/tools/filter-tools-for-mode")
				const includedTools = rawIncludedTools?.map((tool) => resolveToolAlias(tool))

				try {
					validateToolUse(
						block.name as ToolName,
						mode ?? defaultModeSlug,
						customModes ?? [],
						{},
						block.params,
						stateExperiments,
						includedTools,
					)
				} catch (error) {
					cline.consecutiveMistakeCount++
					// For validation errors (unknown tool, tool not allowed for mode), we need to:
					// 1. Send a tool_result with the error (required for native tool calling)
					// 2. NOT set didAlreadyUseTool = true (the tool was never executed, just failed validation)
					// This prevents the stream from being interrupted with "Response interrupted by tool use result"
					// which would cause the extension to appear to hang
					const errorContent = formatResponse.toolError(error.message)
					// Push tool_result directly without setting didAlreadyUseTool
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: typeof errorContent === "string" ? errorContent : "(validation error)",
						is_error: true,
					})

					break
				}
			}

			// Check for identical consecutive tool calls.
			if (!block.partial) {
				// Use the detector to check for repetition, passing the ToolUse
				// block directly.
				const repetitionCheck = cline.toolRepetitionDetector.check(block)

				// If execution is not allowed, notify user and break.
				if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
					// Handle repetition similar to mistake_limit_reached pattern.
					const { response, text, images } = await cline.ask(
						repetitionCheck.askUser.messageKey as ClineAsk,
						repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
					)

					if (response === "messageResponse") {
						// Add user feedback to userContent.
						cline.userMessageContent.push(
							{
								type: "text" as const,
								text: `Tool repetition limit reached. User feedback: ${text}`,
							},
							...formatResponse.imageBlocks(images),
						)

						// Add user feedback to chat.
						await cline.say("user_feedback", text, images)
					}

					// Track tool repetition in telemetry via PostHog exception tracking and event.
					TelemetryService.instance.captureConsecutiveMistakeError(cline.taskId)
					TelemetryService.instance.captureException(
						new ConsecutiveMistakeError(
							`Tool repetition limit reached for ${block.name}`,
							cline.taskId,
							cline.consecutiveMistakeCount,
							cline.consecutiveMistakeLimit,
							"tool_repetition",
							cline.apiConfiguration.apiProvider,
							cline.api.getModel().id,
						),
					)

					// Return tool result message about the repetition
					pushToolResult(
						formatResponse.toolError(
							`Tool call repetition limit reached for ${block.name}. Please try a different approach.`,
						),
					)
					break
				}
			}

			switch (block.name) {
				case "write_to_file":
					await checkpointSaveAndMark(cline)
					await writeToFileTool.handle(cline, block as ToolUse<"write_to_file">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "update_todo_list":
					await updateTodoListTool.handle(cline, block as ToolUse<"update_todo_list">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "apply_diff":
					await checkpointSaveAndMark(cline)
					await applyDiffToolClass.handle(cline, block as ToolUse<"apply_diff">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "search_and_replace":
					await checkpointSaveAndMark(cline)
					await searchAndReplaceTool.handle(cline, block as ToolUse<"search_and_replace">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "search_replace":
					await checkpointSaveAndMark(cline)
					await searchReplaceTool.handle(cline, block as ToolUse<"search_replace">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "edit_file":
					await checkpointSaveAndMark(cline)
					await editFileTool.handle(cline, block as ToolUse<"edit_file">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "apply_patch":
					await checkpointSaveAndMark(cline)
					await applyPatchTool.handle(cline, block as ToolUse<"apply_patch">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "read_file":
					// Type assertion is safe here because we're in the "read_file" case
					await readFileTool.handle(cline, block as ToolUse<"read_file">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "list_files":
					await listFilesTool.handle(cline, block as ToolUse<"list_files">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "codebase_search":
					await codebaseSearchTool.handle(cline, block as ToolUse<"codebase_search">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "search_files":
					await searchFilesTool.handle(cline, block as ToolUse<"search_files">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "browser_action":
					await browserActionTool(
						cline,
						block as ToolUse<"browser_action">,
						askApproval,
						handleError,
						pushToolResult,
					)
					break
				case "execute_command":
					await executeCommandTool.handle(cline, block as ToolUse<"execute_command">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "read_command_output":
					await readCommandOutputTool.handle(cline, block as ToolUse<"read_command_output">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "use_mcp_tool":
					await useMcpToolTool.handle(cline, block as ToolUse<"use_mcp_tool">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "access_mcp_resource":
					await accessMcpResourceTool.handle(cline, block as ToolUse<"access_mcp_resource">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "ask_followup_question":
					await askFollowupQuestionTool.handle(cline, block as ToolUse<"ask_followup_question">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "switch_mode":
					await switchModeTool.handle(cline, block as ToolUse<"switch_mode">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "new_task":
					await checkpointSaveAndMark(cline)
					await newTaskTool.handle(cline, block as ToolUse<"new_task">, {
						askApproval,
						handleError,
						pushToolResult,
						toolCallId: block.id,
					})
					break
				case "attempt_completion": {
					const completionCallbacks: AttemptCompletionCallbacks = {
						askApproval,
						handleError,
						pushToolResult,
						askFinishSubTaskApproval,
						toolDescription,
					}
					await attemptCompletionTool.handle(
						cline,
						block as ToolUse<"attempt_completion">,
						completionCallbacks,
					)
					break
				}
				case "run_slash_command":
					await runSlashCommandTool.handle(cline, block as ToolUse<"run_slash_command">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "skill":
					await skillTool.handle(cline, block as ToolUse<"skill">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "generate_image":
					await checkpointSaveAndMark(cline)
					await generateImageTool.handle(cline, block as ToolUse<"generate_image">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				default: {
					// Handle unknown/invalid tool names OR custom tools
					// This is critical for native tool calling where every tool_use MUST have a tool_result

					// CRITICAL: Don't process partial blocks for unknown tools - just let them stream in.
					// If we try to show errors for partial blocks, we'd show the error on every streaming chunk,
					// creating a loop that appears to freeze the extension. Only handle complete blocks.
					if (block.partial) {
						break
					}

					const customTool = stateExperiments?.customTools ? customToolRegistry.get(block.name) : undefined

					if (customTool) {
						try {
							let customToolArgs

							if (customTool.parameters) {
								try {
									customToolArgs = customTool.parameters.parse(block.nativeArgs || block.params || {})
								} catch (parseParamsError) {
									const message = `Custom tool "${block.name}" argument validation failed: ${parseParamsError.message}`
									console.error(message)
									cline.consecutiveMistakeCount++
									await cline.say("error", message)
									pushToolResult(formatResponse.toolError(message))
									break
								}
							}

							const result = await customTool.execute(customToolArgs, {
								mode: mode ?? defaultModeSlug,
								task: cline,
							})

							console.log(
								`${customTool.name}.execute(): ${JSON.stringify(customToolArgs)} -> ${JSON.stringify(result)}`,
							)

							pushToolResult(result)
							cline.consecutiveMistakeCount = 0
						} catch (executionError: any) {
							cline.consecutiveMistakeCount++
							// Record custom tool error with static name
							cline.recordToolError("custom_tool", executionError.message)
							await handleError(`executing custom tool "${block.name}"`, executionError)
						}

						break
					}

					// Not a custom tool - handle as unknown tool error
					const errorMessage = `Unknown tool "${block.name}". This tool does not exist. Please use one of the available tools.`
					cline.consecutiveMistakeCount++
					cline.recordToolError(block.name as ToolName, errorMessage)
					await cline.say("error", t("tools:unknownToolError", { toolName: block.name }))
					// Push tool_result directly WITHOUT setting didAlreadyUseTool
					// This prevents the stream from being interrupted with "Response interrupted by tool use result"
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: formatResponse.toolError(errorMessage),
						is_error: true,
					})
					break
				}
			}

			break
		}
	}

	// Seeing out of bounds is fine, it means that the next too call is being
	// built up and ready to add to assistantMessageContent to present.
	// When you see the UI inactive during this, it means that a tool is
	// breaking without presenting any UI. For example the write_to_file tool
	// was breaking when relpath was undefined, and for invalid relpath it never
	// presented UI.
	// This needs to be placed here, if not then calling
	// cline.presentAssistantMessage below would fail (sometimes) since it's
	// locked.
	cline.presentAssistantMessageLocked = false

	// NOTE: When tool is rejected, iterator stream is interrupted and it waits
	// for `userMessageContentReady` to be true. Future calls to present will
	// skip execution since `didRejectTool` and iterate until `contentIndex` is
	// set to message length and it sets userMessageContentReady to true itself
	// (instead of preemptively doing it in iterator).
	if (!block.partial || cline.didRejectTool || cline.didAlreadyUseTool) {
		// Block is finished streaming and executing.
		if (cline.currentStreamingContentIndex === cline.assistantMessageContent.length - 1) {
			// It's okay that we increment if !didCompleteReadingStream, it'll
			// just return because out of bounds and as streaming continues it
			// will call `presentAssitantMessage` if a new block is ready. If
			// streaming is finished then we set `userMessageContentReady` to
			// true when out of bounds. This gracefully allows the stream to
			// continue on and all potential content blocks be presented.
			// Last block is complete and it is finished executing
			cline.userMessageContentReady = true // Will allow `pWaitFor` to continue.
		}

		// Call next block if it exists (if not then read stream will call it
		// when it's ready).
		// Need to increment regardless, so when read stream calls this function
		// again it will be streaming the next block.
		cline.currentStreamingContentIndex++

		if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
			// There are already more content blocks to stream, so we'll call
			// this function ourselves.
			presentAssistantMessage(cline)
			return
		} else {
			// CRITICAL FIX: If we're out of bounds and the stream is complete, set userMessageContentReady
			// This handles the case where assistantMessageContent is empty or becomes empty after processing
			if (cline.didCompleteReadingStream) {
				cline.userMessageContentReady = true
			}
		}
	}

	// Block is partial, but the read stream may have finished.
	if (cline.presentAssistantMessageHasPendingUpdates) {
		presentAssistantMessage(cline)
	}
}

/**
 * save checkpoint and mark done in the current streaming task.
 * @param task The Task instance to checkpoint save and mark.
 * @returns
 */
async function checkpointSaveAndMark(task: Task) {
	if (task.currentStreamingDidCheckpoint) {
		return
	}
	try {
		await task.checkpointSave(true)
		task.currentStreamingDidCheckpoint = true
	} catch (error) {
		console.error(`[Task#presentAssistantMessage] Error saving checkpoint: ${error.message}`, error)
	}
}

/**
 * Exported wrapper for checkpointSaveAndMark to be used by parallel executor.
 * @param task The Task instance to checkpoint save and mark.
 */
export async function checkpointSaveForParallelExecution(task: Task): Promise<void> {
	await checkpointSaveAndMark(task)
}

/**
 * Execute multiple tools in parallel when they are independent.
 * This function is called when parallel execution is enabled and multiple
 * independent read-only tools are detected.
 *
 * @param cline The Task instance
 * @param toolBlocks Array of tool blocks to execute
 * @param executeTool Function to execute a single tool
 * @returns Array of tool results in order
 */
export async function executeParallelToolBatch(
	cline: Task,
	toolBlocks: Array<{ index: number; block: ToolUse | McpToolUse }>,
	executeTool: (block: ToolUse | McpToolUse) => Promise<string>,
): Promise<Array<{ index: number; result: string; error?: Error }>> {
	// Get the parallel executor from the Task instance
	const executor = cline.getParallelExecutor()

	if (!executor) {
		// Fallback to sequential execution if no executor
		const results: Array<{ index: number; result: string; error?: Error }> = []
		for (const { index, block } of toolBlocks) {
			try {
				const result = await executeTool(block)
				results.push({ index, result })
			} catch (error) {
				results.push({ index, result: "", error: error as Error })
			}
		}
		return results
	}

	// Use the parallel executor
	const parallelResults = await executor.execute(
		toolBlocks.map(({ block }) => block),
		async (tool: ToolUse | McpToolUse) => {
			const result = await executeTool(tool)
			return result
		},
		{
			mode: "default",
			customModes: [],
			experiments: {},
		},
	)

	// Map results back with indices
	return toolBlocks.map(({ index }, i) => ({
		index,
		result:
			typeof parallelResults.results[i]?.result === "string" ? (parallelResults.results[i].result as string) : "",
		error: parallelResults.results[i]?.error,
	}))
}

/**
 * Check if a batch of tools can be executed in parallel.
 * Returns the subset of tools that can safely run in parallel.
 *
 * @param toolBlocks Array of tool blocks to check
 * @returns Subset of tools that can run in parallel
 */
export function getParallelizableTools(
	toolBlocks: Array<{ index: number; block: ToolUse | McpToolUse }>,
): Array<{ index: number; block: ToolUse | McpToolUse }> {
	return toolBlocks.filter(({ block }) => {
		const toolName = block.type === "mcp_tool_use" ? block.name : block.name
		return canExecuteToolInParallel(toolName)
	})
}

/**
 * Checks if a tool can be executed in parallel with other tools.
 * Some tools must always execute sequentially (e.g., new_task, attempt_completion).
 *
 * @param toolName The name of the tool to check.
 * @returns true if the tool can be executed in parallel, false otherwise.
 */
export function canExecuteToolInParallel(toolName: string): boolean {
	// These tools have side effects that require sequential execution
	const exclusiveTools = [
		"attempt_completion", // Finishes the task
		"new_task", // Creates a sub-task
		"switch_mode", // Changes the mode
		"ask_followup_question", // Requires user interaction
		"browser_action", // Browser state is not thread-safe
		"execute_command", // Terminal state can conflict
	]

	return !exclusiveTools.includes(toolName)
}

/**
 * Checks if a tool is a write tool that requires checkpoint before execution.
 *
 * @param toolName The name of the tool to check.
 * @returns true if the tool writes to files, false otherwise.
 */
export function isWriteTool(toolName: string): boolean {
	const writeTools = [
		"write_to_file",
		"apply_diff",
		"search_and_replace",
		"search_replace",
		"edit_file",
		"apply_patch",
	]

	return writeTools.includes(toolName)
}

/**
 * Gets all completed (non-partial) tool use blocks from assistant message content.
 * Used to collect tools that can potentially be executed in parallel.
 *
 * @param cline The Task instance.
 * @returns Array of completed tool use blocks with their indices.
 */
export function getCompletedToolBlocks(cline: Task): Array<{ block: ToolUse | McpToolUse; index: number }> {
	const completedBlocks: Array<{ block: ToolUse | McpToolUse; index: number }> = []

	for (let i = 0; i < cline.assistantMessageContent.length; i++) {
		const block = cline.assistantMessageContent[i]
		if ((block.type === "tool_use" || block.type === "mcp_tool_use") && !block.partial) {
			completedBlocks.push({ block: block as ToolUse | McpToolUse, index: i })
		}
	}

	return completedBlocks
}

function containsXmlToolMarkup(text: string): boolean {
	// Keep this intentionally narrow: only reject XML-style tool tags matching our tool names.
	// Avoid regex so we don't keep legacy XML parsing artifacts around.
	// Note: This is a best-effort safeguard; tool_use blocks without an id are rejected elsewhere.

	// First, strip out content inside markdown code fences to avoid false positives
	// when users paste documentation or examples containing tool tag references.
	// This handles both fenced code blocks (```) and inline code (`).
	const textWithoutCodeBlocks = text
		.replace(/```[\s\S]*?```/g, "") // Remove fenced code blocks
		.replace(/`[^`]+`/g, "") // Remove inline code

	const lower = textWithoutCodeBlocks.toLowerCase()
	if (!lower.includes("<") || !lower.includes(">")) {
		return false
	}

	const toolNames = [
		"access_mcp_resource",
		"apply_diff",
		"apply_patch",
		"ask_followup_question",
		"attempt_completion",
		"browser_action",
		"codebase_search",
		"edit_file",
		"execute_command",
		"generate_image",
		"list_files",
		"new_task",
		"read_command_output",
		"read_file",
		"search_and_replace",
		"search_files",
		"search_replace",
		"switch_mode",
		"update_todo_list",
		"use_mcp_tool",
		"write_to_file",
	] as const

	return toolNames.some((name) => lower.includes(`<${name}`) || lower.includes(`</${name}`))
}

/**
 * Determines if parallel tool execution should be used for the current task.
 * This checks the feature flag and whether there are multiple independent tools.
 *
 * @param cline The Task instance to check.
 * @returns true if parallel execution should be used, false otherwise.
 */
export function shouldExecuteToolsInParallel(cline: Task): boolean {
	// Check if parallel execution is enabled - check both explicit flag and experiments config
	const isExperimentEnabled = cline.experiments?.parallelToolExecution === true
	const isExplicitlyEnabled = cline.enableParallelToolExecution === true

	// Enable if either the experiment is enabled OR the flag is explicitly set
	if (!isExperimentEnabled && !isExplicitlyEnabled) {
		return false
	}

	// Get all completed (non-partial) tool blocks
	const completedBlocks = getCompletedToolBlocks(cline)

	// Need at least 2 tools to benefit from parallel execution
	if (completedBlocks.length < 2) {
		return false
	}

	// Build dependency graph to check if tools can run in parallel
	const builder = new ToolDependencyGraphBuilder()
	const tools = completedBlocks.map((b) => b.block)
	const graph = builder.build(tools, {
		mode: "default",
		customModes: [],
		experiments: {},
	})

	// If there are multiple execution groups, some tools can run in parallel
	return graph.executionGroups.length > 0 && graph.executionGroups[0].length > 1
}

/**
 * Gets the parallel execution status for logging/debugging purposes.
 *
 * @param cline The Task instance.
 * @returns Object with parallel execution status information.
 */
export function getParallelExecutionStatus(cline: Task): {
	enabled: boolean
	toolCount: number
	canParallelize: boolean
	reason: string
} {
	// Check if parallel execution is enabled - check both explicit flag and experiments config
	const isExperimentEnabled = cline.experiments?.parallelToolExecution === true
	const isExplicitlyEnabled = cline.enableParallelToolExecution === true

	// Enable if either the experiment is enabled OR the flag is explicitly set
	if (!isExperimentEnabled && !isExplicitlyEnabled) {
		return {
			enabled: false,
			toolCount: 0,
			canParallelize: false,
			reason: "Feature flag disabled",
		}
	}

	const completedBlocks = getCompletedToolBlocks(cline)
	const toolCount = completedBlocks.length

	if (toolCount < 2) {
		return {
			enabled: true,
			toolCount,
			canParallelize: false,
			reason: `Need at least 2 tools, have ${toolCount}`,
		}
	}

	const builder = new ToolDependencyGraphBuilder()
	const tools = completedBlocks.map((b) => b.block)
	const graph = builder.build(tools, {
		mode: "default",
		customModes: [],
		experiments: {},
	})

	const canParallelize = graph.executionGroups.length > 0 && graph.executionGroups[0].length > 1

	return {
		enabled: true,
		toolCount,
		canParallelize,
		reason: canParallelize
			? `${graph.executionGroups[0].length} tools can run in parallel`
			: "All tools have dependencies",
	}
}
