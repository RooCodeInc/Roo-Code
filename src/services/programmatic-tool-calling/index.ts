/**
 * Programmatic Tool Calling Service
 *
 * Enables models to generate Python code that calls multiple tools within a single
 * sandboxed Docker execution, reducing round-trips to the model.
 *
 * Architecture:
 * - DockerSandboxExecutor: Manages Docker container lifecycle and IPC
 * - ToolBridge: Generates Python SDK code for tool functions
 * - Types: Shared type definitions for the service
 */

export { DockerSandboxExecutor } from "./DockerSandboxExecutor"
export type { ToolApprovalCallback, ToolExecutorCallback } from "./DockerSandboxExecutor"
export { generatePythonSDK, generateExecutionScript } from "./ToolBridge"
export { SUPPORTED_PROGRAMMATIC_TOOLS, DEFAULT_SANDBOX_CONFIG, isSupportedProgrammaticTool } from "./types"
export type {
	CodeExecutionResult,
	SandboxConfig,
	SandboxToolCall,
	SandboxToolResult,
	ToolExecutionRequest,
	ToolExecutionResponse,
	SupportedProgrammaticTool,
} from "./types"
