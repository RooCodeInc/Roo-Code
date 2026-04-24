import { serializeError } from "serialize-error"
import { Anthropic } from "@anthropic-ai/sdk"
import * as path from "path"
import * as fs from "fs/promises"

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
import { editTool } from "../tools/EditTool"
import { searchReplaceTool } from "../tools/SearchReplaceTool"
import { editFileTool } from "../tools/EditFileTool"
import { applyPatchTool } from "../tools/ApplyPatchTool"
import { searchFilesTool } from "../tools/SearchFilesTool"
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
import { HookEngine } from "../../hooks/HookEngine"
import { selectActiveIntentTool } from "../../hooks/SelectActiveIntentTool"
import { createIntentTool } from "../../hooks/CreateIntentTool"
import { recordLessonTool } from "../../hooks/RecordLessonTool"

/**
 * Processes and presents assistant message content to the user interface.
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
		if (cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
		}

		cline.presentAssistantMessageLocked = false
		return
	}

	let block: any
	try {
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

	switch (block.type) {
		case "mcp_tool_use": {
			const mcpBlock = block as McpToolUse

			if (cline.didRejectTool) {
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

			let hasToolResult = false
			const toolCallId = mcpBlock.id
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

				if (approvalFeedback) {
					const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
					resultContent = `${feedbackText}\n\n${resultContent}`
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

				if (text) {
					await cline.say("user_feedback", text, images)
					approvalFeedback = { text, images }
				}

				return true
			}

			const handleError = async (action: string, error: Error) => {
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
				cline.recordToolUsage("use_mcp_tool")
				TelemetryService.instance.captureToolUsage(cline.taskId, "use_mcp_tool")
			}

			const mcpHub = cline.providerRef.deref()?.getMcpHub()
			let resolvedServerName = mcpBlock.serverName
			if (mcpHub) {
				const originalName = mcpHub.findServerNameBySanitizedName(mcpBlock.serverName)
				if (originalName) {
					resolvedServerName = originalName
				}
			}

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
				content = content.replace(/<thinking>\s?/g, "")
				content = content.replace(/\s?<\/thinking>/g, "")
			}

			await cline.say("text", content, undefined, block.partial)
			break
		}
		case "tool_use": {
			const toolCallId = (block as any).id as string | undefined
			if (!toolCallId) {
				const errorMessage =
					"Invalid tool call: missing tool_use.id. XML tool calls are no longer supported. Remove any XML tool markup (e.g. <read_file>...</read_file>) and use native tool calling instead."
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

			const state = await cline.providerRef.deref()?.getState()
			const { mode, customModes, experiments: stateExperiments, disabledTools } = state ?? {}

			const toolDescription = (): string => {
				switch (block.name) {
					case "execute_command":
						return `[${block.name} for '${block.params.command}']`
					case "read_file":
						if (block.nativeArgs) {
							return readFileTool.getReadFileToolDescription(block.name, block.nativeArgs)
						}
						return readFileTool.getReadFileToolDescription(block.name, block.params)
					case "write_to_file":
						return `[${block.name} for '${block.params.path}']`
					case "apply_diff":
						return block.params?.path ? `[${block.name} for '${block.params.path}']` : `[${block.name}]`
					case "search_files":
						return `[${block.name} for '${block.params.regex}'${
							block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
						}]`
					case "edit":
					case "search_and_replace":
						return `[${block.name} for '${block.params.file_path}']`
					case "search_replace":
						return `[${block.name} for '${block.params.file_path}']`
					case "edit_file":
						return `[${block.name} for '${block.params.file_path}']`
					case "apply_patch":
						return `[${block.name}]`
					case "list_files":
						return `[${block.name} for '${block.params.path}']`
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

			let hasToolResult = false

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

					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: formatResponse.toolError(errorMessage),
						is_error: true,
					})

					break
				}
			}

			let approvalFeedback: { text: string; images?: string[] } | undefined

			const pushToolResult = (content: ToolResponse) => {
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
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
					} else {
						pushToolResult(formatResponse.toolDenied())
					}
					cline.didRejectTool = true
					return false
				}

				if (text) {
					await cline.say("user_feedback", text, images)
					approvalFeedback = { text, images }
				}

				return true
			}

			const askFinishSubTaskApproval = async () => {
				const toolMessage = JSON.stringify({ tool: "finishTask" })
				return await askApproval("tool", toolMessage)
			}

			const handleError = async (action: string, error: Error) => {
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

			if (!block.partial) {
				const isCustomTool = stateExperiments?.customTools && customToolRegistry.has(block.name)
				const recordName = isCustomTool ? "custom_tool" : block.name
				cline.recordToolUsage(recordName)
				TelemetryService.instance.captureToolUsage(cline.taskId, recordName)

				if (block.name === "read_file" && block.usedLegacyFormat) {
					const modelInfo = cline.api.getModel()
					TelemetryService.instance.captureEvent(TelemetryEventName.READ_FILE_LEGACY_FORMAT_USED, {
						taskId: cline.taskId,
						model: modelInfo?.id,
					})
				}
			}

			// Validate tool use before execution
			if (!block.partial) {
				const modelInfo = cline.api.getModel()
				const rawIncludedTools = modelInfo?.info?.includedTools
				const { resolveToolAlias } = await import("../prompts/tools/filter-tools-for-mode")
				const includedTools = rawIncludedTools?.map((tool) => resolveToolAlias(tool))

				try {
					const toolRequirements =
						disabledTools?.reduce(
							(acc: Record<string, boolean>, tool: string) => {
								acc[tool] = false
								const resolvedToolName = resolveToolAlias(tool)
								acc[resolvedToolName] = false
								return acc
							},
							{} as Record<string, boolean>,
						) ?? {}

					validateToolUse(
						block.name as ToolName,
						mode ?? defaultModeSlug,
						customModes ?? [],
						toolRequirements,
						block.params,
						stateExperiments,
						includedTools,
					)
				} catch (error) {
					cline.consecutiveMistakeCount++
					const errorContent = formatResponse.toolError(error.message)
					cline.pushToolResultToUserContent({
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: typeof errorContent === "string" ? errorContent : "(validation error)",
						is_error: true,
					})

					break
				}
			}

			// Check for identical consecutive tool calls
			if (!block.partial) {
				const repetitionCheck = cline.toolRepetitionDetector.check(block)

				if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
					const { response, text, images } = await cline.ask(
						repetitionCheck.askUser.messageKey as ClineAsk,
						repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
					)

					if (response === "messageResponse") {
						cline.userMessageContent.push(
							{
								type: "text" as const,
								text: `Tool repetition limit reached. User feedback: ${text}`,
							},
							...formatResponse.imageBlocks(images),
						)
						await cline.say("user_feedback", text, images)
					}

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

					pushToolResult(
						formatResponse.toolError(
							`Tool call repetition limit reached for ${block.name}. Please try a different approach.`,
						),
					)
					break
				}
			}

			// Initialize (and persist) hook engine for this task session.
			// This preserves Phase 4 state like optimistic-locking file hash cache across tool calls.
			const hookEngineKey = "__hookEngine" as const
			let hookEngine = (cline as any)[hookEngineKey] as HookEngine | undefined
			if (!hookEngine) {
				hookEngine = new HookEngine(cline.cwd)
				;(cline as any)[hookEngineKey] = hookEngine
			}
			await hookEngine.initialize()

			// Pre-Hook: Intercept tool execution
			console.log(`[PRESENT ASSISTANT] Calling preHook for tool: ${block.name}`)
			const preHookResult = await hookEngine.preHook(block.name as ToolName, block, cline)
			console.log(`[PRESENT ASSISTANT] preHook result - shouldProceed: ${preHookResult.shouldProceed}`)
			if (!preHookResult.shouldProceed) {
				console.log(`[PRESENT ASSISTANT] Blocking tool execution - hook returned shouldProceed: false`)
				if (preHookResult.structuredError) {
					pushToolResult(JSON.stringify(preHookResult.structuredError, null, 2))
				} else {
					pushToolResult(
						formatResponse.toolError(preHookResult.errorMessage || "Tool execution blocked by hook"),
					)
				}
				break
			}

			switch (block.name) {
				case "select_active_intent":
					await selectActiveIntentTool.handle(cline, block as ToolUse<"select_active_intent">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "create_intent":
					await createIntentTool.handle(cline, block as ToolUse<"create_intent">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "record_lesson":
					await recordLessonTool.handle(cline, block as ToolUse<"record_lesson">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "write_to_file": {
					await checkpointSaveAndMark(cline)
					let wtfSuccess = false
					let wtfResult: string | undefined
					try {
						await writeToFileTool.handle(cline, block as ToolUse<"write_to_file">, {
							askApproval,
							handleError,
							pushToolResult: (result) => {
								wtfResult = typeof result === "string" ? result : JSON.stringify(result)
								pushToolResult(result)
							},
						})
						wtfSuccess = true
					} catch (error) {
						wtfSuccess = false
					}
					await hookEngine.postHook(block.name as ToolName, block, cline, wtfSuccess, wtfResult)
					break
				}
				case "update_todo_list":
					await updateTodoListTool.handle(cline, block as ToolUse<"update_todo_list">, {
						askApproval,
						handleError,
						pushToolResult,
					})
					break
				case "apply_diff": {
					await checkpointSaveAndMark(cline)
					let adSuccess = false
					let adResult: string | undefined
					try {
						await applyDiffToolClass.handle(cline, block as ToolUse<"apply_diff">, {
							askApproval,
							handleError,
							pushToolResult: (result) => {
								adResult = typeof result === "string" ? result : JSON.stringify(result)
								pushToolResult(result)
							},
						})
						adSuccess = true
					} catch (error) {
						adSuccess = false
					}
					await hookEngine.postHook(block.name as ToolName, block, cline, adSuccess, adResult)
					break
				}
				case "edit":
				case "search_and_replace": {
					await checkpointSaveAndMark(cline)
					let etSuccess = false
					let etResult: string | undefined
					try {
						await editTool.handle(cline, block as ToolUse<"edit">, {
							askApproval,
							handleError,
							pushToolResult: (result) => {
								etResult = typeof result === "string" ? result : JSON.stringify(result)
								pushToolResult(result)
							},
						})
						etSuccess = true
					} catch (error) {
						etSuccess = false
					}
					await hookEngine.postHook(block.name as ToolName, block, cline, etSuccess, etResult)
					break
				}
				case "search_replace": {
					await checkpointSaveAndMark(cline)
					let srSuccess = false
					let srResult: string | undefined
					try {
						await searchReplaceTool.handle(cline, block as ToolUse<"search_replace">, {
							askApproval,
							handleError,
							pushToolResult: (result) => {
								srResult = typeof result === "string" ? result : JSON.stringify(result)
								pushToolResult(result)
							},
						})
						srSuccess = true
					} catch (error) {
						srSuccess = false
					}
					await hookEngine.postHook(block.name as ToolName, block, cline, srSuccess, srResult)
					break
				}
				case "edit_file": {
					await checkpointSaveAndMark(cline)
					let efSuccess = false
					let efResult: string | undefined
					try {
						await editFileTool.handle(cline, block as ToolUse<"edit_file">, {
							askApproval,
							handleError,
							pushToolResult: (result) => {
								efResult = typeof result === "string" ? result : JSON.stringify(result)
								pushToolResult(result)
							},
						})
						efSuccess = true
					} catch (error) {
						efSuccess = false
					}
					await hookEngine.postHook(block.name as ToolName, block, cline, efSuccess, efResult)
					break
				}
				case "apply_patch": {
					await checkpointSaveAndMark(cline)
					let apSuccess = false
					let apResult: string | undefined
					try {
						await applyPatchTool.handle(cline, block as ToolUse<"apply_patch">, {
							askApproval,
							handleError,
							pushToolResult: (result) => {
								apResult = typeof result === "string" ? result : JSON.stringify(result)
								pushToolResult(result)
							},
						})
						apSuccess = true
					} catch (error) {
						apSuccess = false
					}
					await hookEngine.postHook(block.name as ToolName, block, cline, apSuccess, apResult)
					break
				}
				case "read_file": {
					// Phase 4: Track file hash when file is read (for optimistic locking)
					const nativeArgs = (block as any).nativeArgs
					const params = block.params as any
					const filePath = (nativeArgs?.path || params?.path) as string | undefined

					await readFileTool.handle(cline, block as ToolUse<"read_file">, {
						askApproval,
						handleError,
						pushToolResult,
					})

					// Track file hash after read completes (for optimistic locking)
					if (filePath) {
						try {
							const absolutePath = path.resolve(cline.cwd, filePath)
							const fileContent = await fs.readFile(absolutePath, "utf-8")
							hookEngine.trackFileRead(filePath, fileContent)
						} catch {
							// File might not exist or be unreadable - ignore
						}
					}
					break
				}
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
				case "execute_command": {
					let ecSuccess = false
					let ecResult: string | undefined
					try {
						await executeCommandTool.handle(cline, block as ToolUse<"execute_command">, {
							askApproval,
							handleError,
							pushToolResult: (result) => {
								ecResult = typeof result === "string" ? result : JSON.stringify(result)
								pushToolResult(result)
							},
						})
						ecSuccess = true
					} catch (error) {
						ecSuccess = false
					}
					await hookEngine.postHook(block.name as ToolName, block, cline, ecSuccess, ecResult)
					break
				}
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
							cline.recordToolError("custom_tool", executionError.message)
							await handleError(`executing custom tool "${block.name}"`, executionError)
						}

						break
					}

					const errorMessage = `Unknown tool "${block.name}". This tool does not exist. Please use one of the available tools.`
					cline.consecutiveMistakeCount++
					cline.recordToolError(block.name as ToolName, errorMessage)
					await cline.say("error", t("tools:unknownToolError", { toolName: block.name }))
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

	cline.presentAssistantMessageLocked = false

	if (!block.partial || cline.didRejectTool || cline.didAlreadyUseTool) {
		if (cline.currentStreamingContentIndex === cline.assistantMessageContent.length - 1) {
			cline.userMessageContentReady = true
		}

		cline.currentStreamingContentIndex++

		if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
			presentAssistantMessage(cline)
			return
		} else {
			if (cline.didCompleteReadingStream) {
				cline.userMessageContentReady = true
			}
		}
	}

	if (cline.presentAssistantMessageHasPendingUpdates) {
		presentAssistantMessage(cline)
	}
}

/**
 * save checkpoint and mark done in the current streaming task.
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
