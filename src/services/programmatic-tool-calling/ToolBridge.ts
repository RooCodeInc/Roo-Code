/**
 * ToolBridge - Maps Roo Code tools to Python function definitions for the sandbox.
 *
 * This module generates the Python SDK code that gets mounted into the Docker container.
 * It provides Python function stubs that communicate back to Roo Code via stdin/stdout
 * IPC to execute actual tool operations.
 */

import { SUPPORTED_PROGRAMMATIC_TOOLS, type SupportedProgrammaticTool } from "./types"

/**
 * Python function signatures for each supported tool.
 * These are used to generate the Python SDK that runs inside the Docker sandbox.
 */
const TOOL_PYTHON_DEFINITIONS: Record<SupportedProgrammaticTool, string> = {
	read_file: `def read_file(path: str, mode: str = "slice", offset: int = 1, limit: int = 2000) -> str:
    """Read a file and return its contents.
    
    Args:
        path: The file path relative to the workspace directory.
        mode: Reading mode - 'slice' for sequential lines (default).
        offset: 1-based line offset to start reading from (default: 1).
        limit: Maximum number of lines to return (default: 2000).
    
    Returns:
        The file contents as a string.
    """
    return _call_tool("read_file", {"path": path, "mode": mode, "offset": offset, "limit": limit})`,

	write_to_file: `def write_to_file(path: str, content: str) -> str:
    """Write content to a file. Creates the file if it doesn't exist, overwrites if it does.
    
    Args:
        path: The file path relative to the workspace directory.
        content: The complete file content to write.
    
    Returns:
        A confirmation message.
    """
    return _call_tool("write_to_file", {"path": path, "content": content})`,

	execute_command: `def execute_command(command: str, cwd: str = None) -> str:
    """Execute a CLI command on the host system.
    
    Args:
        command: The command to execute.
        cwd: Optional working directory for the command.
    
    Returns:
        The command output (stdout and stderr).
    """
    args = {"command": command}
    if cwd is not None:
        args["cwd"] = cwd
    return _call_tool("execute_command", args)`,

	search_files: `def search_files(path: str, regex: str, file_pattern: str = None) -> str:
    """Search for a regex pattern across files in a directory.
    
    Args:
        path: The directory path to search in (relative to workspace).
        regex: The regular expression pattern to search for.
        file_pattern: Optional glob pattern to filter files (e.g., '*.ts').
    
    Returns:
        Search results with context.
    """
    args = {"path": path, "regex": regex}
    if file_pattern is not None:
        args["file_pattern"] = file_pattern
    return _call_tool("search_files", args)`,

	list_files: `def list_files(path: str, recursive: bool = False) -> str:
    """List files and directories in a specified directory.
    
    Args:
        path: The directory path to list contents for (relative to workspace).
        recursive: Whether to list files recursively (default: False).
    
    Returns:
        A listing of files and directories.
    """
    return _call_tool("list_files", {"path": path, "recursive": recursive})`,
}

/**
 * Generate the complete Python SDK code that will be mounted into the Docker sandbox.
 *
 * The SDK provides:
 * - Tool function definitions (read_file, write_to_file, etc.)
 * - IPC mechanism using stdin/stdout JSON messages
 * - Error handling and result parsing
 *
 * @param enabledTools - Subset of tools to include in the SDK (defaults to all supported tools)
 * @returns The Python SDK source code as a string
 */
export function generatePythonSDK(enabledTools?: SupportedProgrammaticTool[]): string {
	const tools = enabledTools ?? [...SUPPORTED_PROGRAMMATIC_TOOLS]

	const toolDefinitions = tools.map((tool) => TOOL_PYTHON_DEFINITIONS[tool]).join("\n\n")

	return `"""
Roo Code Programmatic Tool Calling SDK

This module provides Python functions for calling Roo Code tools from within
a sandboxed environment. Each function communicates with the host Roo Code
instance via JSON IPC over stdin/stdout.

Auto-generated - do not edit manually.
"""

import json
import sys
import uuid


def _call_tool(tool_name: str, args: dict) -> str:
    """Internal: Send a tool call request to Roo Code and wait for the result.
    
    Communication protocol:
    1. Write a JSON request to stdout (flushed)
    2. Read a JSON response from stdin
    3. Parse and return the result or raise an error
    """
    request_id = str(uuid.uuid4())
    
    request = {
        "type": "tool_request",
        "requestId": request_id,
        "tool": tool_name,
        "args": args,
    }
    
    # Send request via stdout
    sys.stdout.write(json.dumps(request) + "\\n")
    sys.stdout.flush()
    
    # Read response from stdin
    response_line = sys.stdin.readline()
    if not response_line:
        raise RuntimeError(f"No response received for tool call: {tool_name}")
    
    response = json.loads(response_line)
    
    if response.get("requestId") != request_id:
        raise RuntimeError(
            f"Response ID mismatch: expected {request_id}, got {response.get('requestId')}"
        )
    
    result = response.get("result", {})
    
    if not result.get("success", False):
        error_msg = result.get("error", "Unknown error")
        raise RuntimeError(f"Tool '{tool_name}' failed: {error_msg}")
    
    return result.get("result", "")


# Tool function definitions
${toolDefinitions}


# Export list of available tools
AVAILABLE_TOOLS = [${tools.map((t) => `"${t}"`).join(", ")}]
`
}

/**
 * Generate a Python wrapper script that imports the SDK and executes user code.
 *
 * @param userCode - The Python code generated by the model
 * @returns Complete Python script to execute in the sandbox
 */
export function generateExecutionScript(userCode: string): string {
	return `"""
Roo Code Programmatic Tool Calling - Execution Wrapper
"""
import json
import sys
import traceback

# Import the tool SDK
from roo_tools import *

# Signal ready
sys.stdout.write(json.dumps({"type": "ready"}) + "\\n")
sys.stdout.flush()

# Wait for start signal
start_line = sys.stdin.readline()
start = json.loads(start_line)
if start.get("type") != "start":
    sys.exit(1)

try:
    # Execute the model-generated code
${userCode
	.split("\n")
	.map((line) => `    ${line}`)
	.join("\n")}
    
    # Signal completion
    sys.stdout.write(json.dumps({"type": "complete", "success": True}) + "\\n")
    sys.stdout.flush()
except Exception as e:
    # Signal error
    sys.stdout.write(json.dumps({
        "type": "complete",
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc(),
    }) + "\\n")
    sys.stdout.flush()
`
}
