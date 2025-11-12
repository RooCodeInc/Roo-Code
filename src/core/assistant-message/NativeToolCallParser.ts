import { type ToolName, toolNames } from "@roo-code/types"
import { type ToolUse, type ToolParamName, toolParamNames, type NativeToolArgs } from "../../shared/tools"
import type { FileEntry } from "../tools/ReadFileTool"

/**
 * Parser for native tool calls (OpenAI-style function calling).
 * Converts native tool call format to ToolUse format for compatibility
 * with existing tool execution infrastructure.
 *
 * For tools with refactored parsers (e.g., read_file), this parser provides
 * typed arguments via nativeArgs. Tool-specific handlers should consume
 * nativeArgs directly rather than relying on synthesized legacy params.
 */
export class NativeToolCallParser {
	/**
	 * Convert a native tool call chunk to a ToolUse object.
	 *
	 * For refactored tools (read_file, etc.), native arguments are properly typed
	 * based on the NativeToolArgs type map. For tools not yet migrated, nativeArgs
	 * will be undefined and the tool will use parseLegacy() for backward compatibility.
	 *
	 * @param toolCall - The native tool call from the API stream
	 * @returns A properly typed ToolUse object
	 */
	public static parseToolCall<TName extends ToolName>(toolCall: {
		id: string
		name: TName
		arguments: string
	}): ToolUse<TName> | null {
		console.log(`[NATIVE_TOOL] Parser received:`, {
			id: toolCall.id,
			name: toolCall.name,
			arguments: toolCall.arguments,
		})

		// Validate tool name
		if (!toolNames.includes(toolCall.name as ToolName)) {
			console.error(`[NATIVE_TOOL] Invalid tool name: ${toolCall.name}`)
			console.error(`[NATIVE_TOOL] Valid tool names:`, toolNames)
			return null
		}

		console.log(`[NATIVE_TOOL] Tool name validated: ${toolCall.name}`)

		try {
			// Parse the arguments JSON string
			console.log(`[NATIVE_TOOL] Parsing arguments JSON:`, toolCall.arguments)
			const args = JSON.parse(toolCall.arguments)
			console.log(`[NATIVE_TOOL] Parsed args:`, args)

			// Convert arguments to params format (for backward-compat/UI), but primary path uses nativeArgs
			const params: Partial<Record<ToolParamName, string>> = {}

			for (const [key, value] of Object.entries(args)) {
				console.log(`[NATIVE_TOOL] Processing param: ${key} =`, value)

				// For read_file native calls, do not synthesize params.files – nativeArgs carries typed data
				if (toolCall.name === "read_file" && key === "files") {
					continue
				}

				// Validate parameter name
				if (!toolParamNames.includes(key as ToolParamName)) {
					console.warn(`[NATIVE_TOOL] Unknown parameter '${key}' for tool '${toolCall.name}'`)
					console.warn(`[NATIVE_TOOL] Valid param names:`, toolParamNames)
					continue
				}

				// Keep legacy string params for compatibility (not used by native execution path)
				const stringValue = typeof value === "string" ? value : JSON.stringify(value)
				params[key as ToolParamName] = stringValue
				console.log(`[NATIVE_TOOL] Added param: ${key} = "${stringValue}"`)
			}

			// Build typed nativeArgs for tools that support it
			let nativeArgs: (TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never) | undefined = undefined

			switch (toolCall.name) {
				case "read_file":
					// Handle both single-file and multi-file formats
					if (args.files && Array.isArray(args.files)) {
						// Multi-file format: {"files": [{path: "...", line_ranges: [...]}, ...]}
						nativeArgs = args.files as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
					} else if (args.path) {
						// Single-file format: {"path": "..."} - convert to array format
						const fileEntry: FileEntry = {
							path: args.path,
							lineRanges: [],
						}
						nativeArgs = [fileEntry] as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
					}
					break

				case "attempt_completion":
					if (args.result) {
						nativeArgs = { result: args.result } as TName extends keyof NativeToolArgs
							? NativeToolArgs[TName]
							: never
					}
					break

				case "execute_command":
					if (args.command) {
						nativeArgs = {
							command: args.command,
							cwd: args.cwd,
						} as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
					}
					break

				case "insert_content":
					if (args.path !== undefined && args.line !== undefined && args.content !== undefined) {
						nativeArgs = {
							path: args.path,
							line: typeof args.line === "number" ? args.line : parseInt(String(args.line), 10),
							content: args.content,
						} as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
					}
					break

				case "apply_diff":
					if (args.path !== undefined && args.diff !== undefined) {
						nativeArgs = {
							path: args.path,
							diff: args.diff,
						} as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
					}
					break

				case "ask_followup_question":
					if (args.question !== undefined && args.follow_up !== undefined) {
						nativeArgs = {
							question: args.question,
							follow_up: args.follow_up,
						} as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
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
						} as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
					}
					break

				case "codebase_search":
					if (args.query !== undefined) {
						nativeArgs = {
							query: args.query,
							path: args.path,
						} as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
					}
					break

				case "fetch_instructions":
					if (args.task !== undefined) {
						nativeArgs = {
							task: args.task,
						} as TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
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

			console.log(`[NATIVE_TOOL] Parser returning ToolUse:`, result)
			return result
		} catch (error) {
			console.error(`[NATIVE_TOOL] Failed to parse tool call arguments:`, error)
			console.error(`[NATIVE_TOOL] Error details:`, error instanceof Error ? error.message : String(error))
			return null
		}
	}
}
