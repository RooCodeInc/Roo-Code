/**
 * Types for the programmatic tool calling service.
 *
 * Programmatic tool calling allows models to generate Python code that calls
 * tool functions within a sandboxed Docker container, enabling multiple tool
 * invocations in a single round-trip to the model.
 */

/**
 * Represents a single tool call made from within the Python sandbox.
 */
export interface SandboxToolCall {
	/** The tool name (e.g., "read_file", "write_to_file") */
	tool: string
	/** The tool arguments as a JSON-serializable object */
	args: Record<string, unknown>
}

/**
 * Result of a single tool call executed from the sandbox.
 */
export interface SandboxToolResult {
	/** Whether the tool call succeeded */
	success: boolean
	/** The tool result (string content) on success */
	result?: string
	/** Error message on failure */
	error?: string
}

/**
 * A request from the sandbox to execute a tool.
 * Sent from the Docker container to Roo Code via the IPC bridge.
 */
export interface ToolExecutionRequest {
	/** Unique request ID for correlating responses */
	requestId: string
	/** The tool to invoke */
	tool: string
	/** Arguments for the tool */
	args: Record<string, unknown>
}

/**
 * A response sent back to the sandbox after a tool is executed.
 */
export interface ToolExecutionResponse {
	/** The request ID this response corresponds to */
	requestId: string
	/** The result of the tool execution */
	result: SandboxToolResult
}

/**
 * Result of executing a Python code block in the sandbox.
 */
export interface CodeExecutionResult {
	/** Whether the code execution completed successfully */
	success: boolean
	/** Standard output from the code execution */
	stdout: string
	/** Standard error from the code execution */
	stderr: string
	/** The tool calls that were made during execution, with their results */
	toolCalls: Array<{
		call: SandboxToolCall
		result: SandboxToolResult
	}>
	/** Error message if execution failed */
	error?: string
	/** Execution duration in milliseconds */
	durationMs: number
}

/**
 * Configuration for the Docker sandbox.
 */
export interface SandboxConfig {
	/** Docker image to use for the sandbox (default: "python:3.12-slim") */
	image: string
	/** Memory limit in bytes (default: 256MB) */
	memoryLimit: number
	/** CPU limit as a fraction of a CPU (default: 0.5) */
	cpuLimit: number
	/** Execution timeout in milliseconds (default: 30000) */
	timeoutMs: number
	/** Whether network access is allowed (default: false) */
	networkEnabled: boolean
}

/**
 * Default sandbox configuration values.
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
	image: "python:3.12-slim",
	memoryLimit: 256 * 1024 * 1024, // 256MB
	cpuLimit: 0.5,
	timeoutMs: 30_000,
	networkEnabled: false,
}

/**
 * The subset of tools supported in the initial programmatic tool calling implementation.
 */
export const SUPPORTED_PROGRAMMATIC_TOOLS = [
	"read_file",
	"write_to_file",
	"execute_command",
	"search_files",
	"list_files",
] as const

export type SupportedProgrammaticTool = (typeof SUPPORTED_PROGRAMMATIC_TOOLS)[number]

/**
 * Check if a tool name is supported for programmatic tool calling.
 */
export function isSupportedProgrammaticTool(toolName: string): toolName is SupportedProgrammaticTool {
	return (SUPPORTED_PROGRAMMATIC_TOOLS as readonly string[]).includes(toolName)
}
