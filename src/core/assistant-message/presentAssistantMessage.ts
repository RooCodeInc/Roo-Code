import cloneDeep from "clone-deep"
import { serializeError } from "serialize-error"

import type { ToolName, ClineAsk, ToolProgressStatus } from "@siid-code/types"
import { toolNames } from "@siid-code/types"
import { TelemetryService } from "@siid-code/telemetry"

import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import type { ToolParamName, ToolResponse } from "../../shared/tools"

import { fetchInstructionsTool } from "../tools/fetchInstructionsTool"
import { getTaskGuidesTool } from "../tools/getTaskGuidesTool"
import { listFilesTool } from "../tools/listFilesTool"
import { getReadFileToolDescription, readFileTool } from "../tools/readFileTool"
import { writeToFileTool } from "../tools/writeToFileTool"
import { applyDiffTool } from "../tools/multiApplyDiffTool"
import { insertContentTool } from "../tools/insertContentTool"
import { searchAndReplaceTool } from "../tools/searchAndReplaceTool"
import { listCodeDefinitionNamesTool } from "../tools/listCodeDefinitionNamesTool"
import { searchFilesTool } from "../tools/searchFilesTool"
import { browserActionTool } from "../tools/browserActionTool"
import { executeCommandTool } from "../tools/executeCommandTool"
import { useMcpToolTool } from "../tools/useMcpToolTool"
import { accessMcpResourceTool } from "../tools/accessMcpResourceTool"
import { askFollowupQuestionTool } from "../tools/askFollowupQuestionTool"
import { switchModeTool } from "../tools/switchModeTool"
import { attemptCompletionTool } from "../tools/attemptCompletionTool"
import { newTaskTool } from "../tools/newTaskTool"

import { updateTodoListTool } from "../tools/updateTodoListTool"

import { formatResponse } from "../prompts/responses"
import { validateToolUse } from "../tools/validateToolUse"
import { Task } from "../task/Task"
import { codebaseSearchTool } from "../tools/codebaseSearchTool"
import { experiments, EXPERIMENT_IDS } from "../../shared/experiments"
import { applyDiffToolLegacy } from "../tools/applyDiffTool"
import { retrieveSfMetadataTool } from "../tools/retrieveSfMetadataTool"

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

	// Check if multiple tool calls per message experiment is enabled
	const multiToolProvider = cline.providerRef.deref()
	console.log("[Task#presentAssistantMessage] Checking if multiple tool calls per message experiment is enabled")
	let isMultipleToolCallsEnabled = false
	if (multiToolProvider) {
		console.log("[Task#presentAssistantMessage] Provider found, getting state for experiment check")
		const state = await multiToolProvider.getState()
		isMultipleToolCallsEnabled = experiments.isEnabled(state.experiments ?? {}, EXPERIMENT_IDS.MULTIPLE_TOOL_CALLS)
	}
	console.log(
		`[Task#presentAssistantMessage] Multiple tool calls per message experiment enabled: ${isMultipleToolCallsEnabled}`,
	)

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

	const block = cloneDeep(cline.assistantMessageContent[cline.currentStreamingContentIndex]) // need to create copy bc while stream is updating the array, it could be updating the reference block properties too

	switch (block.type) {
		case "text": {
			if (cline.didRejectTool || (cline.didAlreadyUseTool && !isMultipleToolCallsEnabled)) {
				break
			}

			let content = block.content

			if (content) {
				// If the assistant embedded <thinking> tags in the text, present
				// their contents as `reasoning` messages so the UI shows them in
				// the thinking box. Handle both complete and partial tags.
				const fullTagRegex = /<thinking>\s*([\s\S]*?)\s*<\/thinking>/g
				const fullMatches: string[] = []
				let m: RegExpExecArray | null
				while ((m = fullTagRegex.exec(content)) !== null) {
					fullMatches.push(m[1])
				}

				if (fullMatches.length > 0) {
					// Remove full thinking tags from text and present remaining text
					const remaining = content.replace(fullTagRegex, "").trim()
					// Combine multiple thinking blocks into one reasoning message
					const combined = fullMatches.map((r) => r.replace(/^\n/, "").replace(/\n$/, "")).join("\n")
					const combinedTrim = combined.trim()
					// Present reasoning first, then any remaining text
					if (combinedTrim.length > 0) {
						await cline.say("reasoning", combinedTrim, undefined, block.partial)
					}
					if (remaining.length > 0) {
						await cline.say("text", remaining, undefined, block.partial)
					}

					// We've handled both text and reasoning, skip default path.
					break
				}

				// Handle an open <thinking> tag without a closing tag (partial)
				const openTag = "<thinking>"
				const openIdx = content.indexOf(openTag)
				if (openIdx !== -1 && !content.includes("</thinking>")) {
					const before = content.slice(0, openIdx).trim()
					const after = content.slice(openIdx + openTag.length).trim()

					// Treat the remainder as partial reasoning if non-empty,
					// and present reasoning before any preceding text so the
					// thinking box appears first.
					if (after.trim().length > 0) {
						await cline.say("reasoning", after.trim(), undefined, block.partial)
					}
					if (before.length > 0) {
						await cline.say("text", before, undefined, block.partial)
					}

					break
				}

				// Default: no thinking tags present. Remove any stray incomplete
				// XML-like tag at the end to avoid artifacts, same as before.
				const lastOpenBracketIndex = content.lastIndexOf("<")
				if (lastOpenBracketIndex !== -1) {
					const possibleTag = content.slice(lastOpenBracketIndex)
					const hasCloseBracket = possibleTag.includes(">")
					if (!hasCloseBracket) {
						let tagContent: string
						if (possibleTag.startsWith("</")) {
							tagContent = possibleTag.slice(2).trim()
						} else {
							tagContent = possibleTag.slice(1).trim()
						}
						const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)
						const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"
						if (isOpeningOrClosing || isLikelyTagName) {
							content = content.slice(0, lastOpenBracketIndex).trim()
						}
					}
				}

				// Remove any tool XML tags (e.g. <sf_deploy_metadata />,
				// <read_file>...</read_file>) from plain text so tool markup
				// doesn't appear outside thinking/reasoning blocks.
				if (content && Array.isArray(toolNames)) {
					for (const t of toolNames) {
						// Remove full tags with content
						const fullTagRegex = new RegExp(`<${t}>[\\s\\S]*?<\\/${t}>`, "g")
						content = content.replace(fullTagRegex, "")
						// Remove self-closing or stray opening tags
						const selfClosingRegex = new RegExp(`<${t}[^>]*\\/?>`, "g")
						content = content.replace(selfClosingRegex, "")
					}
					content = content.trim()
				}
			}

			// If the next block is an `attempt_completion` tool, it will
			// emit a `completion_result` with the final output. To avoid
			// showing the same output twice (once as `text` and once as
			// `completion_result`), skip presenting this text block when
			// the next block is `attempt_completion`.
			const nextBlock = cline.assistantMessageContent[cline.currentStreamingContentIndex + 1]
			if (!(nextBlock && nextBlock.type === "tool_use" && nextBlock.name === "attempt_completion")) {
				await cline.say("text", content, undefined, block.partial)
			}
			break
		}
		case "tool_use":
			const toolDescription = (): string => {
				switch (block.name) {
					case "execute_command":
						return `[${block.name} for '${block.params.command}']`
					case "read_file":
						return getReadFileToolDescription(block.name, block.params)
					// case "fetch_instructions":
					// 	return `[${block.name} for '${block.params.task}']`
					case "get_task_guides":
						return `[${block.name} for '${block.params.task_type}']`
					case "write_to_file":
						return `[${block.name} for '${block.params.path}']`
					case "apply_diff":
						// Handle both legacy format and new multi-file format
						if (block.params.path) {
							return `[${block.name} for '${block.params.path}']`
						} else if (block.params.args) {
							// Try to extract first file path from args for display
							const match = block.params.args.match(/<file>.*?<path>([^<]+)<\/path>/s)
							if (match) {
								const firstPath = match[1]
								// Check if there are multiple files
								const fileCount = (block.params.args.match(/<file>/g) || []).length
								if (fileCount > 1) {
									return `[${block.name} for '${firstPath}' and ${fileCount - 1} more file${fileCount > 2 ? "s" : ""}]`
								} else {
									return `[${block.name} for '${firstPath}']`
								}
							}
						}
						return `[${block.name}]`
					case "search_files":
						return `[${block.name} for '${block.params.regex}'${
							block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
						}]`
					case "insert_content":
						return `[${block.name} for '${block.params.path}']`
					case "search_and_replace":
						return `[${block.name} for '${block.params.path}']`
					case "list_files":
						return `[${block.name} for '${block.params.path}']`
					case "list_code_definition_names":
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
					case "codebase_search": // Add case for the new tool
						return `[${block.name} for '${block.params.query}']`
					case "update_todo_list":
						return `[${block.name}]`
					case "new_task": {
						const mode = block.params.mode ?? defaultModeSlug
						const message = block.params.message ?? "(no message)"
						const modeName = getModeBySlug(mode, customModes)?.name ?? mode
						return `[${block.name} in ${modeName} mode: '${message}']`
					}
					case "retrieve_sf_metadata":
						return `[${block.name} for '${block.params.metadata_type}'${block.params.metadata_name ? `: ${block.params.metadata_name}` : " (all)"}]`
					default:
						return `[${block.name}]`
				}
			}

			if (cline.didRejectTool) {
				// Ignore any tool content after user has rejected tool once.
				if (!block.partial) {
					cline.userMessageContent.push({
						type: "text",
						text: `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`,
					})
				} else {
					// Partial tool after user rejected a previous tool.
					cline.userMessageContent.push({
						type: "text",
						text: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`,
					})
				}

				break
			}

			if (cline.didAlreadyUseTool && !isMultipleToolCallsEnabled) {
				// Ignore any content after a tool has already been used (only when multi-tool is disabled).
				cline.userMessageContent.push({
					type: "text",
					text: `Tool [${block.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.`,
				})

				break
			}

			const pushToolResult = (content: ToolResponse) => {
				cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })

				if (typeof content === "string") {
					cline.userMessageContent.push({ type: "text", text: content || "(tool did not return anything)" })
				} else {
					cline.userMessageContent.push(...content)
				}

				// Once a tool result has been collected, mark that a tool has
				// been used. When multiple tool calls are enabled, this flag
				// is still set but won't block subsequent tools.
				cline.didAlreadyUseTool = true
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

				// Handle yesButtonClicked with text.
				if (text) {
					await cline.say("user_feedback", text, images)
					pushToolResult(formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text), images))
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
				const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

				await cline.say(
					"error",
					`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
				)

				pushToolResult(formatResponse.toolError(errorString))
			}

			// If block is partial, remove partial closing tag so its not
			// presented to user.
			const removeClosingTag = (tag: ToolParamName, text?: string): string => {
				if (!block.partial) {
					return text || ""
				}

				if (!text) {
					return ""
				}

				// This regex dynamically constructs a pattern to match the
				// closing tag:
				// - Optionally matches whitespace before the tag.
				// - Matches '<' or '</' optionally followed by any subset of
				//   characters from the tag name.
				const tagRegex = new RegExp(
					`\\s?<\/?${tag
						.split("")
						.map((char) => `(?:${char})?`)
						.join("")}$`,
					"g",
				)

				return text.replace(tagRegex, "")
			}

			if (block.name !== "browser_action") {
				await cline.browserSession.closeBrowser()
			}

			if (!block.partial) {
				cline.recordToolUsage(block.name)
				TelemetryService.instance.captureToolUsage(cline.taskId, block.name)
			}

			// Validate tool use before execution.
			const { mode, customModes } = (await cline.providerRef.deref()?.getState()) ?? {}

			try {
				validateToolUse(
					block.name as ToolName,
					mode ?? defaultModeSlug,
					customModes ?? [],
					{ apply_diff: cline.diffEnabled },
					block.params,
				)
			} catch (error) {
				cline.consecutiveMistakeCount++
				pushToolResult(formatResponse.toolError(error.message))
				break
			}

			// Check for identical consecutive tool calls.
			if (!block.partial) {
				// Use the detector to check for repetition, passing the ToolUse
				// block directly.
				const repetitionCheck = cline.toolRepetitionDetector.check(block)

				// If execution is not allowed, notify user and break.
				if (!repetitionCheck.allowExecution && repetitionCheck.agentHint) {
					// Add user feedback to userContent.
					cline.userMessageContent.push({
						type: "text" as const,
						text: `Tool repetition limit reached. Hint: repetitionCheck.agentHint`,
					})

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
					await writeToFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "update_todo_list":
					await updateTodoListTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "apply_diff": {
					// Get the provider and state to check experiment settings
					const provider = cline.providerRef.deref()
					let isMultiFileApplyDiffEnabled = false

					if (provider) {
						const state = await provider.getState()
						isMultiFileApplyDiffEnabled = experiments.isEnabled(
							state.experiments ?? {},
							EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
						)
					}

					if (isMultiFileApplyDiffEnabled) {
						await checkpointSaveAndMark(cline)
						await applyDiffTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					} else {
						await checkpointSaveAndMark(cline)
						await applyDiffToolLegacy(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
					}
					break
				}
				case "insert_content":
					await checkpointSaveAndMark(cline)
					await insertContentTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "search_and_replace":
					await checkpointSaveAndMark(cline)
					await searchAndReplaceTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "read_file":
					await readFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)

					break
				// case "fetch_instructions":
				// 	await fetchInstructionsTool(cline, block, askApproval, handleError, pushToolResult)
				// 	break
				case "get_task_guides":
					await getTaskGuidesTool(cline, block, askApproval, handleError, pushToolResult)
					break
				case "list_files":
					await listFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "codebase_search":
					await codebaseSearchTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "list_code_definition_names":
					await listCodeDefinitionNamesTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "search_files":
					await searchFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "browser_action":
					await browserActionTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "execute_command":
					await executeCommandTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "use_mcp_tool":
					await useMcpToolTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "access_mcp_resource":
					await accessMcpResourceTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "ask_followup_question":
					await askFollowupQuestionTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "switch_mode":
					await switchModeTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "new_task":
					await newTaskTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "attempt_completion":
					await attemptCompletionTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
						toolDescription,
						askFinishSubTaskApproval,
					)
					break
				case "retrieve_sf_metadata":
					await retrieveSfMetadataTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
			}

			break
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
