import { type ToolName, toolNames, type FileEntry } from "@roo-code/types"
import { type ToolUse, type ToolParamName, toolParamNames, type NativeToolArgs } from "../../shared/tools"
import { parseJSON } from "partial-json"
import type {
	ApiStreamToolCallStartChunk,
	ApiStreamToolCallDeltaChunk,
	ApiStreamToolCallEndChunk,
} from "../../api/transform/stream"

/**
 * Helper type to extract properly typed native arguments for a given tool.
 * Returns the type from NativeToolArgs if the tool is defined there, otherwise never.
 */
type NativeArgsFor<TName extends ToolName> = TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never

/**
 * Parser for native tool calls (OpenAI-style function calling).
 * Converts native tool call format to ToolUse format for compatibility
 * with existing tool execution infrastructure.
 *
 * For tools with refactored parsers (e.g., read_file), this parser provides
 * typed arguments via nativeArgs. Tool-specific handlers should consume
 * nativeArgs directly rather than relying on synthesized legacy params.
 */
/**
 * Event types returned from raw chunk processing.
 */
export type ToolCallStreamEvent = ApiStreamToolCallStartChunk | ApiStreamToolCallDeltaChunk | ApiStreamToolCallEndChunk

/**
 * Parser for native tool calls (OpenAI-style function calling).
 * Converts native tool call format to ToolUse format for compatibility
 * with existing tool execution infrastructure.
 *
 * For tools with refactored parsers (e.g., read_file), this parser provides
 * typed arguments via nativeArgs. Tool-specific handlers should consume
 * nativeArgs directly rather than relying on synthesized legacy params.
 *
 * This class also handles raw tool call chunk processing, converting
 * provider-level raw chunks into start/delta/end events.
 */
export class NativeToolCallParser {
	// Streaming state management for argument accumulation (keyed by tool call id)
	private static streamingToolCalls = new Map<
		string,
		{
			id: string
			name: ToolName
			argumentsAccumulator: string
		}
	>()

	// Raw chunk tracking state (keyed by index from API stream)
	private static rawChunkTracker = new Map<
		number,
		{
			id: string
			name: string
			hasStarted: boolean
			deltaBuffer: string[]
		}
	>()

	/**
	 * Process a raw tool call chunk from the API stream.
	 * Handles tracking, buffering, and emits start/delta/end events.
	 *
	 * This is the entry point for providers that emit tool_call_partial chunks.
	 * Returns an array of events to be processed by the consumer.
	 */
	public static processRawChunk(chunk: {
		index: number
		id?: string
		name?: string
		arguments?: string
	}): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []
		const { index, id, name, arguments: args } = chunk

		let tracked = this.rawChunkTracker.get(index)

		// Initialize new tool call tracking when we receive an id
		if (id && !tracked) {
			tracked = {
				id,
				name: name || "",
				hasStarted: false,
				deltaBuffer: [],
			}
			this.rawChunkTracker.set(index, tracked)
		}

		if (!tracked) {
			return events
		}

		// Update name if present in chunk and not yet set
		if (name) {
			tracked.name = name
		}

		// Emit start event when we have the name
		if (!tracked.hasStarted && tracked.name) {
			events.push({
				type: "tool_call_start",
				id: tracked.id,
				name: tracked.name,
			})
			tracked.hasStarted = true

			// Flush buffered deltas
			for (const bufferedDelta of tracked.deltaBuffer) {
				events.push({
					type: "tool_call_delta",
					id: tracked.id,
					delta: bufferedDelta,
				})
			}
			tracked.deltaBuffer = []
		}

		// Emit delta event for argument chunks
		if (args) {
			if (tracked.hasStarted) {
				events.push({
					type: "tool_call_delta",
					id: tracked.id,
					delta: args,
				})
			} else {
				tracked.deltaBuffer.push(args)
			}
		}

		return events
	}

	/**
	 * Process stream finish reason.
	 * Emits end events when finish_reason is 'tool_calls'.
	 */
	public static processFinishReason(finishReason: string | null | undefined): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []

		if (finishReason === "tool_calls" && this.rawChunkTracker.size > 0) {
			for (const [, tracked] of this.rawChunkTracker.entries()) {
				events.push({
					type: "tool_call_end",
					id: tracked.id,
				})
			}
			this.rawChunkTracker.clear()
		}

		return events
	}

	/**
	 * Finalize any remaining tool calls that weren't explicitly ended.
	 * Should be called at the end of stream processing.
	 */
	public static finalizeRawChunks(): ToolCallStreamEvent[] {
		const events: ToolCallStreamEvent[] = []

		if (this.rawChunkTracker.size > 0) {
			for (const [, tracked] of this.rawChunkTracker.entries()) {
				if (tracked.hasStarted) {
					events.push({
						type: "tool_call_end",
						id: tracked.id,
					})
				}
			}
			this.rawChunkTracker.clear()
		}

		return events
	}

	/**
	 * Clear all raw chunk tracking state.
	 * Should be called when a new API request starts.
	 */
	public static clearRawChunkState(): void {
		this.rawChunkTracker.clear()
	}

	/**
	 * Start streaming a new tool call.
	 * Initializes tracking for incremental argument parsing.
	 */
	public static startStreamingToolCall(id: string, name: ToolName): void {
		this.streamingToolCalls.set(id, {
			id,
			name,
			argumentsAccumulator: "",
		})
	}

	/**
	 * Clear all streaming tool call state.
	 * Should be called when a new API request starts to prevent memory leaks
	 * from interrupted streams.
	 */
	public static clearAllStreamingToolCalls(): void {
		this.streamingToolCalls.clear()
	}

	/**
	 * Check if there are any active streaming tool calls.
	 * Useful for debugging and testing.
	 */
	public static hasActiveStreamingToolCalls(): boolean {
		return this.streamingToolCalls.size > 0
	}

	/**
	 * Process a chunk of JSON arguments for a streaming tool call.
	 * Uses partial-json-parser to extract values from incomplete JSON immediately.
	 * Returns a partial ToolUse with currently parsed parameters.
	 */
	public static processStreamingChunk(id: string, chunk: string): ToolUse | null {
		const toolCall = this.streamingToolCalls.get(id)
		if (!toolCall) {
			console.warn(`[NativeToolCallParser] Received chunk for unknown tool call: ${id}`)
			return null
		}

		// Accumulate the JSON string
		toolCall.argumentsAccumulator += chunk

		// Parse whatever we can from the incomplete JSON!
		// partial-json-parser extracts partial values (strings, arrays, objects) immediately
		try {
			const partialArgs = parseJSON(toolCall.argumentsAccumulator)

			// Create partial ToolUse with extracted values
			return this.createPartialToolUse(
				toolCall.id,
				toolCall.name,
				partialArgs || {},
				true, // partial
			)
		} catch {
			// Even partial-json-parser can fail on severely malformed JSON
			// Return null and wait for next chunk
			return null
		}
	}

	/**
	 * Finalize a streaming tool call.
	 * Parses the complete JSON and returns the final ToolUse.
	 */
	public static finalizeStreamingToolCall(id: string): ToolUse | null {
		const toolCall = this.streamingToolCalls.get(id)
		if (!toolCall) {
			console.warn(`[NativeToolCallParser] Attempting to finalize unknown tool call: ${id}`)
			return null
		}

		// Parse the complete accumulated JSON
		const finalToolUse = this.parseToolCall({
			id: toolCall.id,
			name: toolCall.name,
			arguments: toolCall.argumentsAccumulator,
		})

		// Clean up streaming state
		this.streamingToolCalls.delete(id)

		return finalToolUse
	}

	/**
	 * Create a partial ToolUse from currently parsed arguments.
	 * Used during streaming to show progress.
	 */
	private static createPartialToolUse(
		id: string,
		name: ToolName,
		partialArgs: Record<string, any>,
		partial: boolean,
	): ToolUse | null {
		// Build legacy params for display
		// NOTE: For streaming partial updates, we MUST populate params even for complex types
		// because tool.handlePartial() methods rely on params to show UI updates
		const params: Partial<Record<ToolParamName, string>> = {}

		for (const [key, value] of Object.entries(partialArgs)) {
			if (toolParamNames.includes(key as ToolParamName)) {
				params[key as ToolParamName] = typeof value === "string" ? value : JSON.stringify(value)
			}
		}

		// Build partial nativeArgs based on what we have so far
		let nativeArgs: any = undefined

		switch (name) {
			case "read_file":
				if (partialArgs.files && Array.isArray(partialArgs.files)) {
					nativeArgs = { files: partialArgs.files }
				}
				break

			case "attempt_completion":
				if (partialArgs.result) {
					nativeArgs = { result: partialArgs.result }
				}
				break

			case "execute_command":
				if (partialArgs.command) {
					nativeArgs = {
						command: partialArgs.command,
						cwd: partialArgs.cwd,
					}
				}
				break

			case "insert_content":
				// For partial tool calls, we build nativeArgs incrementally as fields arrive.
				// Unlike parseToolCall which validates all required fields, partial parsing
				// needs to show progress as each field streams in.
				if (
					partialArgs.path !== undefined ||
					partialArgs.line !== undefined ||
					partialArgs.content !== undefined
				) {
					nativeArgs = {
						path: partialArgs.path,
						line:
							typeof partialArgs.line === "number"
								? partialArgs.line
								: partialArgs.line !== undefined
									? parseInt(String(partialArgs.line), 10)
									: undefined,
						content: partialArgs.content,
					}
				}
				break

			case "write_to_file":
				if (partialArgs.path || partialArgs.content || partialArgs.line_count !== undefined) {
					nativeArgs = {
						path: partialArgs.path,
						content: partialArgs.content,
						line_count:
							typeof partialArgs.line_count === "number"
								? partialArgs.line_count
								: partialArgs.line_count
									? parseInt(String(partialArgs.line_count), 10)
									: undefined,
					}
				}
				break

			case "ask_followup_question":
				if (partialArgs.question !== undefined || partialArgs.follow_up !== undefined) {
					nativeArgs = {
						question: partialArgs.question,
						follow_up: Array.isArray(partialArgs.follow_up) ? partialArgs.follow_up : undefined,
					}
				}
				break

			case "apply_diff":
				if (partialArgs.path !== undefined || partialArgs.diff !== undefined) {
					nativeArgs = {
						path: partialArgs.path,
						diff: partialArgs.diff,
					}
				}
				break

			case "browser_action":
				if (partialArgs.action !== undefined) {
					nativeArgs = {
						action: partialArgs.action,
						url: partialArgs.url,
						coordinate: partialArgs.coordinate,
						size: partialArgs.size,
						text: partialArgs.text,
					}
				}
				break

			case "codebase_search":
				if (partialArgs.query !== undefined) {
					nativeArgs = {
						query: partialArgs.query,
						path: partialArgs.path,
					}
				}
				break

			case "fetch_instructions":
				if (partialArgs.task !== undefined) {
					nativeArgs = {
						task: partialArgs.task,
					}
				}
				break

			case "generate_image":
				if (partialArgs.prompt !== undefined || partialArgs.path !== undefined) {
					nativeArgs = {
						prompt: partialArgs.prompt,
						path: partialArgs.path,
						image: partialArgs.image,
					}
				}
				break

			case "list_code_definition_names":
				if (partialArgs.path !== undefined) {
					nativeArgs = {
						path: partialArgs.path,
					}
				}
				break

			case "run_slash_command":
				if (partialArgs.command !== undefined) {
					nativeArgs = {
						command: partialArgs.command,
						args: partialArgs.args,
					}
				}
				break

			case "search_files":
				if (partialArgs.path !== undefined || partialArgs.regex !== undefined) {
					nativeArgs = {
						path: partialArgs.path,
						regex: partialArgs.regex,
						file_pattern: partialArgs.file_pattern,
					}
				}
				break

			case "switch_mode":
				if (partialArgs.mode_slug !== undefined || partialArgs.reason !== undefined) {
					nativeArgs = {
						mode_slug: partialArgs.mode_slug,
						reason: partialArgs.reason,
					}
				}
				break

			case "update_todo_list":
				if (partialArgs.todos !== undefined) {
					nativeArgs = {
						todos: partialArgs.todos,
					}
				}
				break

			case "use_mcp_tool":
				if (partialArgs.server_name !== undefined || partialArgs.tool_name !== undefined) {
					nativeArgs = {
						server_name: partialArgs.server_name,
						tool_name: partialArgs.tool_name,
						arguments: partialArgs.arguments,
					}
				}
				break

			// Add other tools as needed
			default:
				break
		}

		return {
			type: "tool_use" as const,
			name,
			params,
			partial,
			nativeArgs,
		}
	}

	/**
	 * Convert a native tool call chunk to a ToolUse object.
	 *
	 * @param toolCall - The native tool call from the API stream
	 * @returns A properly typed ToolUse object
	 */
	public static parseToolCall<TName extends ToolName>(toolCall: {
		id: string
		name: TName
		arguments: string
	}): ToolUse<TName> | null {
		// Check if this is a dynamic MCP tool (mcp_serverName_toolName)
		if (typeof toolCall.name === "string" && toolCall.name.startsWith("mcp_")) {
			return this.parseDynamicMcpTool(toolCall) as ToolUse<TName> | null
		}

		// Validate tool name
		if (!toolNames.includes(toolCall.name as ToolName)) {
			console.error(`Invalid tool name: ${toolCall.name}`)
			console.error(`Valid tool names:`, toolNames)
			return null
		}

		try {
			// Parse the arguments JSON string
			const args = JSON.parse(toolCall.arguments)

			// Build legacy params object for backward compatibility with XML protocol and UI.
			// Native execution path uses nativeArgs instead, which has proper typing.
			const params: Partial<Record<ToolParamName, string>> = {}

			for (const [key, value] of Object.entries(args)) {
				// Skip complex parameters that have been migrated to nativeArgs.
				// For read_file, the 'files' parameter is a FileEntry[] array that can't be
				// meaningfully stringified. The properly typed data is in nativeArgs instead.
				if (toolCall.name === "read_file" && key === "files") {
					continue
				}

				// Validate parameter name
				if (!toolParamNames.includes(key as ToolParamName)) {
					console.warn(`Unknown parameter '${key}' for tool '${toolCall.name}'`)
					console.warn(`Valid param names:`, toolParamNames)
					continue
				}

				// Convert to string for legacy params format
				const stringValue = typeof value === "string" ? value : JSON.stringify(value)
				params[key as ToolParamName] = stringValue
			}

			// Build typed nativeArgs for tools that support it.
			// This switch statement serves two purposes:
			// 1. Validation: Ensures required parameters are present before constructing nativeArgs
			// 2. Transformation: Converts raw JSON to properly typed structures
			//
			// Each case validates the minimum required parameters and constructs a properly typed
			// nativeArgs object. If validation fails, nativeArgs remains undefined and the tool
			// will fall back to legacy parameter parsing if supported.
			let nativeArgs: NativeArgsFor<TName> | undefined = undefined

			switch (toolCall.name) {
				case "read_file":
					if (args.files && Array.isArray(args.files)) {
						nativeArgs = { files: args.files } as NativeArgsFor<TName>
					}
					break

				case "attempt_completion":
					if (args.result) {
						nativeArgs = { result: args.result } as NativeArgsFor<TName>
					}
					break

				case "execute_command":
					if (args.command) {
						nativeArgs = {
							command: args.command,
							cwd: args.cwd,
						} as NativeArgsFor<TName>
					}
					break

				case "insert_content":
					if (args.path !== undefined && args.line !== undefined && args.content !== undefined) {
						nativeArgs = {
							path: args.path,
							line: typeof args.line === "number" ? args.line : parseInt(String(args.line), 10),
							content: args.content,
						} as NativeArgsFor<TName>
					}
					break

				case "apply_diff":
					if (args.path !== undefined && args.diff !== undefined) {
						nativeArgs = {
							path: args.path,
							diff: args.diff,
						} as NativeArgsFor<TName>
					}
					break

				case "ask_followup_question":
					if (args.question !== undefined && args.follow_up !== undefined) {
						nativeArgs = {
							question: args.question,
							follow_up: args.follow_up,
						} as NativeArgsFor<TName>
					}
					break

				case "browser_action":
					if (args.action !== undefined) {
						nativeArgs = {
							action: args.action,
							url: args.url,
							coordinate: args.coordinate,
							size: args.size,
							text: args.text,
						} as NativeArgsFor<TName>
					}
					break

				case "codebase_search":
					if (args.query !== undefined) {
						nativeArgs = {
							query: args.query,
							path: args.path,
						} as NativeArgsFor<TName>
					}
					break

				case "fetch_instructions":
					if (args.task !== undefined) {
						nativeArgs = {
							task: args.task,
						} as NativeArgsFor<TName>
					}
					break

				case "generate_image":
					if (args.prompt !== undefined && args.path !== undefined) {
						nativeArgs = {
							prompt: args.prompt,
							path: args.path,
							image: args.image,
						} as NativeArgsFor<TName>
					}
					break

				case "list_code_definition_names":
					if (args.path !== undefined) {
						nativeArgs = {
							path: args.path,
						} as NativeArgsFor<TName>
					}
					break

				case "run_slash_command":
					if (args.command !== undefined) {
						nativeArgs = {
							command: args.command,
							args: args.args,
						} as NativeArgsFor<TName>
					}
					break

				case "search_files":
					if (args.path !== undefined && args.regex !== undefined) {
						nativeArgs = {
							path: args.path,
							regex: args.regex,
							file_pattern: args.file_pattern,
						} as NativeArgsFor<TName>
					}
					break

				case "switch_mode":
					if (args.mode_slug !== undefined && args.reason !== undefined) {
						nativeArgs = {
							mode_slug: args.mode_slug,
							reason: args.reason,
						} as NativeArgsFor<TName>
					}
					break

				case "update_todo_list":
					if (args.todos !== undefined) {
						nativeArgs = {
							todos: args.todos,
						} as NativeArgsFor<TName>
					}
					break

				case "write_to_file":
					if (args.path !== undefined && args.content !== undefined && args.line_count !== undefined) {
						nativeArgs = {
							path: args.path,
							content: args.content,
							line_count:
								typeof args.line_count === "number"
									? args.line_count
									: parseInt(String(args.line_count), 10),
						} as NativeArgsFor<TName>
					}
					break

				case "use_mcp_tool":
					if (args.server_name !== undefined && args.tool_name !== undefined) {
						nativeArgs = {
							server_name: args.server_name,
							tool_name: args.tool_name,
							arguments: args.arguments,
						} as NativeArgsFor<TName>
					}
					break

				default:
					break
			}

			const result: ToolUse<TName> = {
				type: "tool_use" as const,
				name: toolCall.name,
				params,
				partial: false, // Native tool calls are always complete when yielded
				nativeArgs,
			}

			return result
		} catch (error) {
			console.error(`Failed to parse tool call arguments:`, error)
			console.error(`Error details:`, error instanceof Error ? error.message : String(error))
			return null
		}
	}

	/**
	 * Parse dynamic MCP tools (named mcp_serverName_toolName).
	 * These are generated dynamically by getMcpServerTools() and need to be
	 * converted back to use_mcp_tool format.
	 */
	private static parseDynamicMcpTool(toolCall: {
		id: string
		name: string
		arguments: string
	}): ToolUse<"use_mcp_tool"> | null {
		try {
			const args = JSON.parse(toolCall.arguments)

			// Extract server_name and tool_name from the arguments
			// The dynamic tool schema includes these as const properties
			const serverName = args.server_name
			const toolName = args.tool_name
			const toolInputProps = args.toolInputProps

			if (!serverName || !toolName) {
				console.error(`Missing server_name or tool_name in dynamic MCP tool`)
				return null
			}

			// Build params for backward compatibility with XML protocol
			const params: Partial<Record<string, string>> = {
				server_name: serverName,
				tool_name: toolName,
			}

			if (toolInputProps) {
				params.arguments = JSON.stringify(toolInputProps)
			}

			// Build nativeArgs with properly typed structure
			const nativeArgs: NativeToolArgs["use_mcp_tool"] = {
				server_name: serverName,
				tool_name: toolName,
				arguments: toolInputProps,
			}

			const result: ToolUse<"use_mcp_tool"> = {
				type: "tool_use" as const,
				name: "use_mcp_tool",
				params,
				partial: false,
				nativeArgs,
			}

			return result
		} catch (error) {
			console.error(`Failed to parse dynamic MCP tool:`, error)
			return null
		}
	}
}
