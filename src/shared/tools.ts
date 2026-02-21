export type NativeToolName =
	| "execute_command"
	| "read_file"
	| "write_to_file"
	| "apply_diff"
	| "search_files"
	| "list_files"
	| "list_code_definition_names"
	| "browser_action"
	| "use_mcp_tool"
	| "access_mcp_resource"
	| "select_active_intent"
	| "search_replace"
	| "skill"

// These exports MUST be present to fix the "reading 'tools'" runtime error
export const TOOL_GROUPS: Record<
	string,
	{ tools: NativeToolName[]; alwaysAvailable?: boolean; customTools?: NativeToolName[] }
> = {
	read: {
		tools: ["read_file", "search_files", "list_files", "list_code_definition_names"],
	},
	write: {
		tools: ["write_to_file", "apply_diff", "search_replace"],
	},
	execute: {
		tools: ["execute_command", "browser_action"],
	},
	mcp: {
		tools: ["use_mcp_tool", "access_mcp_resource"],
	},
	governance: {
		tools: ["select_active_intent"],
		alwaysAvailable: true,
	},
}

export const ALWAYS_AVAILABLE_TOOLS: NativeToolName[] = ["read_file", "list_files", "select_active_intent"]

export const TOOL_ALIASES: Record<string, NativeToolName> = {
	authorize_intent: "select_active_intent",
}

export const toolParamNames: Record<NativeToolName, string[]> = {
	execute_command: ["command"],
	read_file: ["path"],
	write_to_file: ["path", "content"],
	apply_diff: ["path", "diff"],
	search_files: ["path", "query", "recursive"],
	list_files: ["path", "recursive"],
	list_code_definition_names: ["path"],
	browser_action: ["action", "url"],
	use_mcp_tool: ["server_name", "tool_name", "arguments"],
	access_mcp_resource: ["server_name", "uri"],
	select_active_intent: ["intent_id"],
	search_replace: ["path", "old_string", "new_string"],
	skill: ["name", "arguments"],
}

// --- CORE ENGINE TYPES ---

export interface ToolUse<TName extends NativeToolName = NativeToolName> {
	type: "tool_use"
	name: TName
	params: NativeToolArgs[TName]
	partial?: boolean
	nativeArgs?: any // Required to fix the test suite errors
}

export interface ToolResponse {
	content: string | any[]
	isError?: boolean
}

export type PushToolResult = (result: ToolResponse | string | any[]) => void
export type AskApproval = (toolName: string, question: string) => Promise<boolean>
export type HandleError = (action: string, error: Error) => void

export interface NativeToolArgs {
	execute_command: { command: string }
	read_file: { path: string }
	write_to_file: { path: string; content: string }
	apply_diff: { path: string; diff: string }
	search_files: { path: string; query: string; recursive?: boolean }
	list_files: { path: string; recursive?: boolean }
	list_code_definition_names: { path: string }
	browser_action: { action: string; url?: string }
	use_mcp_tool: { server_name: string; tool_name: string; arguments?: any }
	access_mcp_resource: { server_name: string; uri: string }
	select_active_intent: { intent_id: string }
	search_replace: {
		path?: string
		file_path?: string
		old_string: string
		new_string: string
	}
	skill: { name: string; arguments: string }
}
