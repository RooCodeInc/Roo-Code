import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { waitFor, sleep } from "../utils"
import { setDefaultSuiteTimeout } from "../test-utils"

/**
 * Native tool calling verification state.
 * Tracks multiple indicators to ensure native protocol is actually being used.
 */
interface NativeProtocolVerification {
	/** Whether the apiProtocol field indicates native format (anthropic/openai) */
	hasNativeApiProtocol: boolean
	/** The apiProtocol value received (for debugging) */
	apiProtocol: string | null
	/** Whether the response text does NOT contain XML tool tags (confirming non-XML) */
	responseIsNotXML: boolean
	/** Whether the tool was successfully executed */
	toolWasExecuted: boolean
	/** Tool name that was executed (for debugging) */
	executedToolName: string | null
}

/**
 * Creates a fresh verification state for tracking native protocol usage.
 */
function createVerificationState(): NativeProtocolVerification {
	return {
		hasNativeApiProtocol: false,
		apiProtocol: null,
		responseIsNotXML: true,
		toolWasExecuted: false,
		executedToolName: null,
	}
}

/**
 * Asserts that native tool calling was actually used based on the verification state.
 */
function assertNativeProtocolUsed(verification: NativeProtocolVerification, testName: string): void {
	assert.ok(verification.apiProtocol !== null, `[${testName}] apiProtocol should be set in api_req_started message.`)

	assert.strictEqual(
		verification.hasNativeApiProtocol,
		true,
		`[${testName}] Native API protocol should be used. Expected apiProtocol to be "anthropic" or "openai", but got: ${verification.apiProtocol}`,
	)

	assert.strictEqual(verification.responseIsNotXML, true, `[${testName}] Response should NOT contain XML tool tags.`)
	console.log(`[${testName}] ✓ Native protocol verification passed`)
	console.log(`  - API Protocol: ${verification.apiProtocol}`)
	console.log(`  - Response is not XML: ${verification.responseIsNotXML}`)
	console.log(`  - Tool was executed: ${verification.toolWasExecuted}`)
	console.log(`  - Executed tool name: ${verification.executedToolName || "none"}`)
}

suite("Roo Code use_mcp_tool Tool (Native Tool Calling)", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFiles: {
		simple: string
		testData: string
		mcpConfig: string
	}

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-mcp-native-"))

		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir

		testFiles = {
			simple: path.join(workspaceDir, `mcp-test-native-${Date.now()}.txt`),
			testData: path.join(workspaceDir, `mcp-data-native-${Date.now()}.json`),
			mcpConfig: path.join(workspaceDir, ".roo", "mcp.json"),
		}

		await fs.writeFile(testFiles.simple, "Initial content for MCP native test")
		await fs.writeFile(testFiles.testData, JSON.stringify({ test: "data", value: 42 }, null, 2))

		const rooDir = path.join(workspaceDir, ".roo")
		await fs.mkdir(rooDir, { recursive: true })

		const mcpConfig = {
			mcpServers: {
				filesystem: {
					command: "npx",
					args: ["-y", "@modelcontextprotocol/server-filesystem", workspaceDir],
					alwaysAllow: [],
				},
			},
		}
		await fs.writeFile(testFiles.mcpConfig, JSON.stringify(mcpConfig, null, 2))

		console.log("MCP test files created in:", workspaceDir)
		console.log("Test files:", testFiles)
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		for (const filePath of Object.values(testFiles)) {
			try {
				await fs.unlink(filePath)
			} catch {
				// File might not exist
			}
		}

		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		const rooDir = path.join(workspaceDir, ".roo")
		try {
			await fs.rm(rooDir, { recursive: true, force: true })
		} catch {
			// Directory might not exist
		}

		await fs.rm(tempDir, { recursive: true, force: true })
	})

	setup(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}
		await sleep(100)
	})

	teardown(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}
		await sleep(100)
	})

	test("Should request MCP filesystem read_file tool using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskStarted = false
		let _taskCompleted = false
		let mcpToolRequested = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		const verification = createVerificationState()

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			console.log(`[DEBUG] Message: type=${message.type}, say=${message.say}, ask=${message.ask}`)

			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				verification.toolWasExecuted = true
				console.log("MCP tool request:", message.text?.substring(0, 200))

				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
						verification.executedToolName = mcpRequest.toolName
						console.log("MCP request parsed:", {
							type: mcpRequest.type,
							serverName: mcpRequest.serverName,
							toolName: mcpRequest.toolName,
							hasArguments: !!mcpRequest.arguments,
						})
					} catch (e) {
						console.log("Failed to parse MCP request:", e)
					}
				}
			}

			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
				console.log("MCP server response received:", message.text?.substring(0, 200))
			}

			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
				console.log("Attempt completion called:", message.text?.substring(0, 200))
			}

			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}

			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const requestData = JSON.parse(message.text)
					if (requestData.apiProtocol) {
						verification.apiProtocol = requestData.apiProtocol
						if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
							verification.hasNativeApiProtocol = true
							console.log(`[VERIFIED] API Protocol: ${requestData.apiProtocol}`)
						}
					}
				} catch (e) {
					console.log("Failed to parse api_req_started:", e)
				}
			}

			if (message.type === "say" && message.say === "text" && message.text) {
				const hasXMLToolTags =
					message.text.includes("<use_mcp_tool>") || message.text.includes("</use_mcp_tool>")

				if (hasXMLToolTags) {
					verification.responseIsNotXML = false
					console.log("[WARNING] Found XML tool tags in response")
				}
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		const taskStartedHandler = (id: string) => {
			if (id === taskId) {
				taskStarted = true
				console.log("Task started:", id)
			}
		}
		api.on(RooCodeEventName.TaskStarted, taskStartedHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		await sleep(2000)

		console.log("Triggering MCP server detection by modifying the config file...")
		try {
			const mcpConfigUri = vscode.Uri.file(testFiles.mcpConfig)
			const document = await vscode.workspace.openTextDocument(mcpConfigUri)
			const editor = await vscode.window.showTextDocument(document)

			const edit = new vscode.WorkspaceEdit()
			const currentContent = document.getText()
			const modifiedContent = currentContent.replace(
				'"alwaysAllow": []',
				'"alwaysAllow": ["read_file", "read_multiple_files", "write_file", "edit_file", "create_directory", "list_directory", "directory_tree", "move_file", "search_files", "get_file_info", "list_allowed_directories"]',
			)

			const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))

			edit.replace(mcpConfigUri, fullRange, modifiedContent)
			await vscode.workspace.applyEdit(edit)

			await editor.document.save()

			await vscode.commands.executeCommand("workbench.action.closeActiveEditor")

			console.log("MCP config file modified and saved successfully")
		} catch (error) {
			console.error("Failed to modify/save MCP config file:", error)
		}

		await sleep(5000)
		let taskId: string
		try {
			const fileName = path.basename(testFiles.simple)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the MCP filesystem server's read_file tool to read the file "${fileName}". The file exists in the workspace and contains "Initial content for MCP native test".`,
			})

			console.log("Task ID:", taskId)
			console.log("Requesting MCP filesystem read_file for:", fileName)

			await waitFor(() => taskStarted, { timeout: 45_000 })
			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			assertNativeProtocolUsed(verification, "mcpReadFile")

			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")
			assert.strictEqual(mcpToolName, "read_file", "Should have used the read_file tool")
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			const responseText = mcpServerResponse as string
			assert.ok(
				responseText.includes("Initial content for MCP native test"),
				`MCP server response should contain the exact file content. Got: ${responseText.substring(0, 100)}...`,
			)

			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 100)}...`,
			)

			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP read_file tool used successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should request MCP filesystem write_file tool using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let mcpToolRequested = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		const verification = createVerificationState()

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				verification.toolWasExecuted = true
				console.log("MCP tool request:", message.text?.substring(0, 200))

				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
						verification.executedToolName = mcpRequest.toolName
					} catch (e) {
						console.log("Failed to parse MCP request:", e)
					}
				}
			}

			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
			}

			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
			}

			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
			}

			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const requestData = JSON.parse(message.text)
					if (requestData.apiProtocol) {
						verification.apiProtocol = requestData.apiProtocol
						if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
							verification.hasNativeApiProtocol = true
						}
					}
				} catch (_e) {
					// Ignore
				}
			}

			if (message.type === "say" && message.say === "text" && message.text) {
				if (message.text.includes("<use_mcp_tool>") || message.text.includes("</use_mcp_tool>")) {
					verification.responseIsNotXML = false
				}
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const newFileName = `mcp-write-test-native-${Date.now()}.txt`
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the MCP filesystem server's write_file tool to create a new file called "${newFileName}" with the content "Hello from MCP native!".`,
			})

			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			assertNativeProtocolUsed(verification, "mcpWriteFile")

			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested for writing")
			assert.strictEqual(mcpToolName, "write_file", "Should have used the write_file tool")
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			const responseText = mcpServerResponse as string
			const hasSuccessKeyword =
				responseText.toLowerCase().includes("success") ||
				responseText.toLowerCase().includes("created") ||
				responseText.toLowerCase().includes("written") ||
				responseText.toLowerCase().includes("successfully")

			const hasFileName = responseText.includes(newFileName) || responseText.includes("mcp-write-test-native")

			assert.ok(
				hasSuccessKeyword || hasFileName,
				`MCP server response should indicate successful file creation. Got: ${responseText.substring(0, 150)}...`,
			)

			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 100)}...`,
			)

			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP write_file tool used successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should request MCP filesystem list_directory tool using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let mcpToolRequested = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		const verification = createVerificationState()

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				verification.toolWasExecuted = true
				console.log("MCP tool request:", message.text?.substring(0, 300))

				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
						verification.executedToolName = mcpRequest.toolName
					} catch (e) {
						console.log("Failed to parse MCP request:", e)
					}
				}
			}

			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
			}

			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
			}

			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
			}

			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const requestData = JSON.parse(message.text)
					if (requestData.apiProtocol) {
						verification.apiProtocol = requestData.apiProtocol
						if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
							verification.hasNativeApiProtocol = true
						}
					}
				} catch (_e) {
					// Ignore
				}
			}

			if (message.type === "say" && message.say === "text" && message.text) {
				if (message.text.includes("<use_mcp_tool>") || message.text.includes("</use_mcp_tool>")) {
					verification.responseIsNotXML = false
				}
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the MCP filesystem server's list_directory tool to list the contents of the current directory. I want to see the files in the workspace.`,
			})

			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			assertNativeProtocolUsed(verification, "mcpListDirectory")

			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")
			assert.strictEqual(mcpToolName, "list_directory", "Should have used the list_directory tool")
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			const responseText = mcpServerResponse as string
			const hasTestFile =
				responseText.includes("mcp-test-native-") || responseText.includes(path.basename(testFiles.simple))
			const hasDataFile =
				responseText.includes("mcp-data-native-") || responseText.includes(path.basename(testFiles.testData))
			const hasRooDir = responseText.includes(".roo")

			assert.ok(
				hasTestFile || hasDataFile || hasRooDir,
				`MCP server response should contain our test files or .roo directory. Got: ${responseText.substring(0, 200)}...`,
			)

			const hasDirectoryStructure =
				responseText.includes("name") ||
				responseText.includes("type") ||
				responseText.includes("file") ||
				responseText.includes("directory") ||
				responseText.includes(".txt") ||
				responseText.includes(".json")

			assert.ok(
				hasDirectoryStructure,
				`MCP server response should contain directory structure indicators. Got: ${responseText.substring(0, 200)}...`,
			)

			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 100)}...`,
			)

			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP list_directory tool used successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test.skip("Should request MCP filesystem directory_tree tool using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let mcpToolRequested = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		const verification = createVerificationState()

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				verification.toolWasExecuted = true

				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
						verification.executedToolName = mcpRequest.toolName
					} catch (e) {
						console.log("Failed to parse MCP request:", e)
					}
				}
			}

			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
			}

			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
			}

			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
			}

			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const requestData = JSON.parse(message.text)
					if (requestData.apiProtocol) {
						verification.apiProtocol = requestData.apiProtocol
						if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
							verification.hasNativeApiProtocol = true
						}
					}
				} catch (_e) {
					// Ignore
				}
			}

			if (message.type === "say" && message.say === "text" && message.text) {
				if (message.text.includes("<use_mcp_tool>") || message.text.includes("</use_mcp_tool>")) {
					verification.responseIsNotXML = false
				}
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the MCP filesystem server's directory_tree tool to show me the directory structure of the current workspace. I want to see the folder hierarchy.`,
			})

			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			assertNativeProtocolUsed(verification, "mcpDirectoryTree")

			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")
			assert.strictEqual(mcpToolName, "directory_tree", "Should have used the directory_tree tool")
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			const responseText = mcpServerResponse as string
			const hasTreeStructure =
				responseText.includes("name") ||
				responseText.includes("type") ||
				responseText.includes("children") ||
				responseText.includes("file") ||
				responseText.includes("directory")

			const hasTestFiles =
				responseText.includes("mcp-test-native-") ||
				responseText.includes("mcp-data-native-") ||
				responseText.includes(".roo") ||
				responseText.includes(".txt") ||
				responseText.includes(".json") ||
				responseText.length > 10

			assert.ok(
				hasTreeStructure,
				`MCP server response should contain tree structure indicators. Got: ${responseText.substring(0, 200)}...`,
			)
			assert.ok(
				hasTestFiles,
				`MCP server response should contain directory contents. Got: ${responseText.substring(0, 200)}...`,
			)

			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 100)}...`,
			)

			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP directory_tree tool used successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test.skip("Should handle MCP server error gracefully using native tool calling", async function () {
		// Skipped: This test requires interactive approval for non-whitelisted MCP servers
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let _mcpToolRequested = false
		let _errorHandled = false
		let attemptCompletionCalled = false

		const verification = createVerificationState()

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			if (message.type === "ask" && message.ask === "use_mcp_server") {
				_mcpToolRequested = true
				verification.toolWasExecuted = true
			}

			if (message.type === "say" && (message.say === "error" || message.say === "mcp_server_response")) {
				if (message.text && (message.text.includes("Error") || message.text.includes("not found"))) {
					_errorHandled = true
				}
			}

			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
			}

			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const requestData = JSON.parse(message.text)
					if (requestData.apiProtocol) {
						verification.apiProtocol = requestData.apiProtocol
						if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
							verification.hasNativeApiProtocol = true
						}
					}
				} catch (_e) {
					// Ignore
				}
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the MCP server "nonexistent-server-native" to perform some operation. This should trigger an error but the task should still complete gracefully.`,
			})

			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion even with MCP error")

			console.log("Test passed! MCP error handling verified with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test.skip("Should validate MCP request message format using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let mcpToolRequested = false
		let validMessageFormat = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		const verification = createVerificationState()

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				verification.toolWasExecuted = true

				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
						verification.executedToolName = mcpRequest.toolName

						const hasType = typeof mcpRequest.type === "string"
						const hasServerName = typeof mcpRequest.serverName === "string"
						const validType =
							mcpRequest.type === "use_mcp_tool" || mcpRequest.type === "access_mcp_resource"

						if (hasType && hasServerName && validType) {
							validMessageFormat = true
						}
					} catch (e) {
						console.log("Failed to parse MCP request:", e)
					}
				}
			}

			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
			}

			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
			}

			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
			}

			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const requestData = JSON.parse(message.text)
					if (requestData.apiProtocol) {
						verification.apiProtocol = requestData.apiProtocol
						if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
							verification.hasNativeApiProtocol = true
						}
					}
				} catch (_e) {
					// Ignore
				}
			}

			if (message.type === "say" && message.say === "text" && message.text) {
				if (message.text.includes("<use_mcp_tool>") || message.text.includes("</use_mcp_tool>")) {
					verification.responseIsNotXML = false
				}
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const fileName = path.basename(testFiles.simple)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the MCP filesystem server's get_file_info tool to get information about the file "${fileName}". This file exists in the workspace and will validate proper message formatting.`,
			})

			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			assertNativeProtocolUsed(verification, "mcpMessageFormat")

			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")
			assert.ok(validMessageFormat, "The MCP request should have valid message format")
			assert.strictEqual(mcpToolName, "get_file_info", "Should have used the get_file_info tool")
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			const responseText = mcpServerResponse as string
			const hasSize = responseText.includes("size") && (responseText.includes("28") || /\d+/.test(responseText))
			const hasTimestamps =
				responseText.includes("created") ||
				responseText.includes("modified") ||
				responseText.includes("accessed")
			const hasDateInfo =
				responseText.includes("2025") || responseText.includes("GMT") || /\d{4}-\d{2}-\d{2}/.test(responseText)

			assert.ok(
				hasSize,
				`MCP server response should contain file size information. Got: ${responseText.substring(0, 200)}...`,
			)
			assert.ok(
				hasTimestamps,
				`MCP server response should contain timestamp information. Got: ${responseText.substring(0, 200)}...`,
			)
			assert.ok(
				hasDateInfo,
				`MCP server response should contain date/time information. Got: ${responseText.substring(0, 200)}...`,
			)

			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 100)}...`,
			)

			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP message format validation successful with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
