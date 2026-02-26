import { generatePythonSDK, generateExecutionScript } from "../ToolBridge"
import { SUPPORTED_PROGRAMMATIC_TOOLS } from "../types"

describe("ToolBridge", () => {
	describe("generatePythonSDK", () => {
		it("should generate valid Python code", () => {
			const sdk = generatePythonSDK()
			expect(sdk).toContain("import json")
			expect(sdk).toContain("import sys")
			expect(sdk).toContain("import uuid")
		})

		it("should include the _call_tool helper function", () => {
			const sdk = generatePythonSDK()
			expect(sdk).toContain("def _call_tool(tool_name: str, args: dict) -> str:")
		})

		it("should include all supported tool functions by default", () => {
			const sdk = generatePythonSDK()
			expect(sdk).toContain("def read_file(")
			expect(sdk).toContain("def write_to_file(")
			expect(sdk).toContain("def execute_command(")
			expect(sdk).toContain("def search_files(")
			expect(sdk).toContain("def list_files(")
		})

		it("should include AVAILABLE_TOOLS list with all tools", () => {
			const sdk = generatePythonSDK()
			expect(sdk).toContain("AVAILABLE_TOOLS")
			for (const tool of SUPPORTED_PROGRAMMATIC_TOOLS) {
				expect(sdk).toContain(`"${tool}"`)
			}
		})

		it("should generate SDK with only specified tools when filtered", () => {
			const sdk = generatePythonSDK(["read_file", "list_files"])
			expect(sdk).toContain("def read_file(")
			expect(sdk).toContain("def list_files(")
			expect(sdk).not.toContain("def write_to_file(")
			expect(sdk).not.toContain("def execute_command(")
			expect(sdk).not.toContain("def search_files(")
		})

		it("should include the IPC protocol implementation", () => {
			const sdk = generatePythonSDK()
			// Should write JSON to stdout
			expect(sdk).toContain("sys.stdout.write(json.dumps(request)")
			// Should read JSON from stdin
			expect(sdk).toContain("sys.stdin.readline()")
			// Should use request IDs
			expect(sdk).toContain("uuid.uuid4()")
		})

		it("should include proper docstrings for tool functions", () => {
			const sdk = generatePythonSDK()
			expect(sdk).toContain('"""Read a file and return its contents.')
			expect(sdk).toContain('"""Write content to a file.')
			expect(sdk).toContain('"""Execute a CLI command')
			expect(sdk).toContain('"""Search for a regex pattern')
			expect(sdk).toContain('"""List files and directories')
		})
	})

	describe("generateExecutionScript", () => {
		it("should wrap user code in the execution template", () => {
			const userCode = 'result = read_file("test.txt")\nprint(result)'
			const script = generateExecutionScript(userCode)

			// Should import the tool SDK
			expect(script).toContain("from roo_tools import *")

			// Should include the user code (indented)
			expect(script).toContain('    result = read_file("test.txt")')
			expect(script).toContain("    print(result)")
		})

		it("should send ready signal on startup", () => {
			const script = generateExecutionScript("pass")
			expect(script).toContain('"type": "ready"')
		})

		it("should wait for start signal before executing", () => {
			const script = generateExecutionScript("pass")
			expect(script).toContain('!= "start"')
		})

		it("should send completion signal with success status", () => {
			const script = generateExecutionScript("pass")
			expect(script).toContain('"type": "complete"')
			expect(script).toContain('"success": True')
		})

		it("should handle exceptions and report errors", () => {
			const script = generateExecutionScript("pass")
			expect(script).toContain("except Exception as e")
			expect(script).toContain('"success": False')
			expect(script).toContain("traceback.format_exc()")
		})

		it("should properly indent multi-line user code", () => {
			const userCode = "for i in range(3):\n    print(i)\n    read_file(f'file_{i}.txt')"
			const script = generateExecutionScript(userCode)

			expect(script).toContain("    for i in range(3):")
			expect(script).toContain("        print(i)")
			expect(script).toContain("        read_file(f'file_{i}.txt')")
		})
	})
})
