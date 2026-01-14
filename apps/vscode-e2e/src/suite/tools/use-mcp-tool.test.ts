import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { waitFor, sleep } from "../utils"
import { setDefaultSuiteTimeout } from "../test-utils"

suite("Roo Code use_mcp_tool Tool", function () {
	// Uses the mcp-server-time MCP server via uvx
	// Provides time-related tools (get_current_time, convert_time) that don't overlap with built-in tools
	// Requires: uv installed (curl -LsSf https://astral.sh/uv/install.sh | sh)
	// Configuration is in global MCP settings, not workspace .roo/mcp.json
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFiles: {
		simple: string
		testData: string
		mcpConfig: string
	}

	// Create a temporary directory and test files
	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-mcp-"))

		// Create test files in VSCode workspace directory
		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir

		testFiles = {
			simple: path.join(workspaceDir, `mcp-test-${Date.now()}.txt`),
			testData: path.join(workspaceDir, `mcp-data-${Date.now()}.json`),
			mcpConfig: path.join(workspaceDir, ".roo", "mcp.json"),
		}

		// Copy MCP configuration from user's global settings to test environment
		// The test environment uses .vscode-test/user-data instead of ~/.config/Code
		const testUserDataDir = path.join(
			process.cwd(),
			".vscode-test",
			"user-data",
			"User",
			"globalStorage",
			"rooveterinaryinc.roo-cline",
			"settings",
		)
		const testMcpSettingsPath = path.join(testUserDataDir, "mcp_settings.json")

		// Create the directory structure
		await fs.mkdir(testUserDataDir, { recursive: true })

		// Configure the time MCP server for tests
		const mcpConfig = {
			mcpServers: {
				time: {
					command: "uvx",
					args: ["mcp-server-time"],
				},
			},
		}

		await fs.writeFile(testMcpSettingsPath, JSON.stringify(mcpConfig, null, 2))

		console.log("MCP test workspace:", workspaceDir)
		console.log("MCP settings configured at:", testMcpSettingsPath)
	})

	// Clean up temporary directory and files after tests
	suiteTeardown(async () => {
		// Cancel any running tasks before cleanup
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Clean up test files
		for (const filePath of Object.values(testFiles)) {
			try {
				await fs.unlink(filePath)
			} catch {
				// File might not exist
			}
		}

		// Clean up .roo directory
		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		const rooDir = path.join(workspaceDir, ".roo")
		try {
			await fs.rm(rooDir, { recursive: true, force: true })
		} catch {
			// Directory might not exist
		}

		await fs.rm(tempDir, { recursive: true, force: true })
	})

	// Clean up before each test
	setup(async () => {
		// Cancel any previous task
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Small delay to ensure clean state
		await sleep(100)
	})

	// Clean up after each test
	teardown(async () => {
		// Cancel the current task
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Small delay to ensure clean state
		await sleep(100)
	})

	test("Should request MCP time get_current_time tool and complete successfully", async function () {
		this.timeout(90_000) // MCP server initialization can take time
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskStarted = false
		let _taskCompleted = false
		let mcpToolRequested = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for MCP tool request
			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				console.log("MCP tool request:", message.text?.substring(0, 200))

				// Parse the MCP request to verify structure and tool name
				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
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

			// Check for MCP server response
			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
				console.log("MCP server response received:", message.text?.substring(0, 200))
			}

			// Check for attempt_completion
			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
				console.log("Attempt completion called:", message.text?.substring(0, 200))
			}

			// Log important messages for debugging
			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		// Listen for task events
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

		// Trigger MCP server refresh by executing the refresh command
		// This simulates clicking the "Refresh MCP Servers" button in the UI
		console.log("Triggering MCP server refresh...")
		try {
			// The webview needs to send a refreshAllMcpServers message
			// We can't directly call this from the E2E API, so we'll use a workaround:
			// Execute a VSCode command that might trigger MCP initialization
			await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")
			await sleep(2000)

			// Try to trigger MCP refresh through the extension's internal API
			// Since we can't directly access the webview message handler, we'll rely on
			// the MCP servers being initialized when the extension activates
			console.log("Waiting for MCP servers to initialize...")
			await sleep(10000) // Give MCP servers time to initialize
		} catch (error) {
			console.error("Failed to trigger MCP refresh:", error)
		}

		let taskId: string
		try {
			// Start task requesting to use MCP time server's get_current_time tool
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true, // Enable MCP auto-approval
					mcpEnabled: true,
				},
				text: `Use the MCP time server's get_current_time tool to get the current time in America/New_York timezone and tell me what time it is there.`,
			})

			console.log("Task ID:", taskId)
			console.log("Requesting MCP time get_current_time for America/New_York")

			// Wait for task to start
			await waitFor(() => taskStarted, { timeout: 45_000 })

			// Wait for attempt_completion to be called (indicating task finished)
			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			// Verify the MCP tool was requested
			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")

			// Verify the correct tool was used
			assert.strictEqual(mcpToolName, "get_current_time", "Should have used the get_current_time tool")

			// Verify we got a response from the MCP server
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			// Verify the response contains time data (not an error)
			const responseText = mcpServerResponse as string

			// Check for time-related content
			const hasTimeContent =
				responseText.includes("time") ||
				responseText.includes("datetime") ||
				responseText.includes("2026") || // Current year
				responseText.includes(":") || // Time format HH:MM
				responseText.includes("America/New_York") ||
				responseText.length > 10 // At least some content

			assert.ok(
				hasTimeContent,
				`MCP server response should contain time data. Got: ${responseText.substring(0, 200)}...`,
			)

			// Ensure no errors are present
			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 200)}...`,
			)

			// Verify task completed successfully
			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")

			// Check that no errors occurred
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP get_current_time tool used successfully and task completed")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should request MCP time convert_time tool and complete successfully", async function () {
		this.timeout(90_000) // MCP server initialization can take time
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let mcpToolRequested = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for MCP tool request
			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				console.log("MCP tool request:", message.text?.substring(0, 200))

				// Parse the MCP request to verify structure and tool name
				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
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

			// Check for MCP server response
			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
				console.log("MCP server response received:", message.text?.substring(0, 200))
			}

			// Check for attempt_completion
			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
				console.log("Attempt completion called:", message.text?.substring(0, 200))
			}

			// Log important messages for debugging
			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task requesting to use MCP time server's convert_time tool
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
				},
				text: `Use the MCP time server's convert_time tool to convert 14:00 from America/New_York timezone to Asia/Tokyo timezone and tell me what time it would be.`,
			})

			// Wait for attempt_completion to be called (indicating task finished)
			await waitFor(() => attemptCompletionCalled, { timeout: 60_000 })

			// Verify the MCP tool was requested
			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")

			// Verify the correct tool was used
			assert.strictEqual(mcpToolName, "convert_time", "Should have used the convert_time tool")

			// Verify we got a response from the MCP server
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			// Verify the response contains time conversion data (not an error)
			const responseText = mcpServerResponse as string

			// Check for time conversion content
			const hasConversionContent =
				responseText.includes("time") ||
				responseText.includes(":") || // Time format
				responseText.includes("Tokyo") ||
				responseText.includes("Asia/Tokyo") ||
				responseText.length > 10 // At least some content

			assert.ok(
				hasConversionContent,
				`MCP server response should contain time conversion data. Got: ${responseText.substring(0, 200)}...`,
			)

			// Ensure no errors are present
			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 200)}...`,
			)

			// Verify task completed successfully
			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")

			// Check that no errors occurred
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP convert_time tool used successfully and task completed")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test.skip("Should handle multiple MCP tool calls in sequence", async function () {
		// This test would verify that multiple MCP tools can be called in sequence
		// Skipped for initial implementation - we have 2 working MCP tests already
	})

	test.skip("Should request MCP filesystem directory_tree tool and complete successfully", async function () {
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let mcpToolRequested = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for MCP tool request
			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				console.log("MCP tool request:", message.text?.substring(0, 200))

				// Parse the MCP request to verify structure and tool name
				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName
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

			// Check for MCP server response
			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
				console.log("MCP server response received:", message.text?.substring(0, 200))
			}

			// Check for attempt_completion
			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
				console.log("Attempt completion called:", message.text?.substring(0, 200))
			}

			// Log important messages for debugging
			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task requesting MCP filesystem directory_tree tool
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
				},
				text: `Use the MCP filesystem server's directory_tree tool to show me the directory structure of the current workspace. I want to see the folder hierarchy.`,
			})

			// Wait for attempt_completion to be called (indicating task finished)
			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			// Verify the MCP tool was requested
			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")

			// Verify the correct tool was used
			assert.strictEqual(mcpToolName, "directory_tree", "Should have used the directory_tree tool")

			// Verify we got a response from the MCP server
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			// Verify the response contains directory tree structure (not an error)
			const responseText = mcpServerResponse as string

			// Check for tree structure elements (be flexible as different MCP servers format differently)
			const hasTreeStructure =
				responseText.includes("name") ||
				responseText.includes("type") ||
				responseText.includes("children") ||
				responseText.includes("file") ||
				responseText.includes("directory")

			// Check for our test files or common file extensions
			const hasTestFiles =
				responseText.includes("mcp-test-") ||
				responseText.includes("mcp-data-") ||
				responseText.includes(".roo") ||
				responseText.includes(".txt") ||
				responseText.includes(".json") ||
				responseText.length > 10 // At least some content indicating directory structure

			assert.ok(
				hasTreeStructure,
				`MCP server response should contain tree structure indicators like 'name', 'type', 'children', 'file', or 'directory'. Got: ${responseText.substring(0, 200)}...`,
			)

			assert.ok(
				hasTestFiles,
				`MCP server response should contain directory contents (test files, extensions, or substantial content). Got: ${responseText.substring(0, 200)}...`,
			)

			// Ensure no errors are present
			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 100)}...`,
			)

			// Verify task completed successfully
			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")

			// Check that no errors occurred
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP directory_tree tool used successfully and task completed")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test.skip("Should handle MCP server error gracefully and complete task", async function () {
		// Skipped: This test requires interactive approval for non-whitelisted MCP servers
		// which cannot be automated in the test environment
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let _mcpToolRequested = false
		let _errorHandled = false
		let attemptCompletionCalled = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for MCP tool request
			if (message.type === "ask" && message.ask === "use_mcp_server") {
				_mcpToolRequested = true
				console.log("MCP tool request:", message.text?.substring(0, 200))
			}

			// Check for error handling
			if (message.type === "say" && (message.say === "error" || message.say === "mcp_server_response")) {
				if (message.text && (message.text.includes("Error") || message.text.includes("not found"))) {
					_errorHandled = true
					console.log("MCP error handled:", message.text.substring(0, 100))
				}
			}

			// Check for attempt_completion
			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
				console.log("Attempt completion called:", message.text?.substring(0, 200))
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task requesting non-existent MCP server
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
				},
				text: `Use the MCP server "nonexistent-server" to perform some operation. This should trigger an error but the task should still complete gracefully.`,
			})

			// Wait for attempt_completion to be called (indicating task finished)
			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			// Verify task completed successfully even with error
			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion even with MCP error")

			console.log("Test passed! MCP error handling verified and task completed")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test.skip("Should validate MCP request message format and complete successfully", async function () {
		// Skipped: Covered by other MCP tests
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let mcpToolRequested = false
		let validMessageFormat = false
		let mcpToolName: string | null = null
		let mcpServerResponse: string | null = null
		let attemptCompletionCalled = false
		let errorOccurred: string | null = null

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for MCP tool request and validate format
			if (message.type === "ask" && message.ask === "use_mcp_server") {
				mcpToolRequested = true
				console.log("MCP tool request:", message.text?.substring(0, 200))

				// Validate the message format matches ClineAskUseMcpServer interface
				if (message.text) {
					try {
						const mcpRequest = JSON.parse(message.text)
						mcpToolName = mcpRequest.toolName

						// Check required fields
						const hasType = typeof mcpRequest.type === "string"
						const hasServerName = typeof mcpRequest.serverName === "string"
						const validType =
							mcpRequest.type === "use_mcp_tool" || mcpRequest.type === "access_mcp_resource"

						if (hasType && hasServerName && validType) {
							validMessageFormat = true
							console.log("Valid MCP message format detected:", {
								type: mcpRequest.type,
								serverName: mcpRequest.serverName,
								toolName: mcpRequest.toolName,
								hasArguments: !!mcpRequest.arguments,
							})
						}
					} catch (e) {
						console.log("Failed to parse MCP request:", e)
					}
				}
			}

			// Check for MCP server response
			if (message.type === "say" && message.say === "mcp_server_response") {
				mcpServerResponse = message.text || null
				console.log("MCP server response received:", message.text?.substring(0, 200))
			}

			// Check for attempt_completion
			if (message.type === "say" && message.say === "completion_result") {
				attemptCompletionCalled = true
				console.log("Attempt completion called:", message.text?.substring(0, 200))
			}

			// Log important messages for debugging
			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				_taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task requesting MCP filesystem get_file_info tool
			const fileName = path.basename(testFiles.simple)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
					mcpEnabled: true,
				},
				text: `Use the MCP filesystem server's get_file_info tool to get information about the file "${fileName}". This file exists in the workspace and will validate proper message formatting.`,
			})

			// Wait for attempt_completion to be called (indicating task finished)
			await waitFor(() => attemptCompletionCalled, { timeout: 45_000 })

			// Verify the MCP tool was requested with valid format
			assert.ok(mcpToolRequested, "The use_mcp_tool should have been requested")
			assert.ok(validMessageFormat, "The MCP request should have valid message format")

			// Verify the correct tool was used
			assert.strictEqual(mcpToolName, "get_file_info", "Should have used the get_file_info tool")

			// Verify we got a response from the MCP server
			assert.ok(mcpServerResponse, "Should have received a response from the MCP server")

			// Verify the response contains file information (not an error)
			const responseText = mcpServerResponse as string

			// Check for specific file metadata fields
			const hasSize = responseText.includes("size") && (responseText.includes("28") || /\d+/.test(responseText))
			const hasTimestamps =
				responseText.includes("created") ||
				responseText.includes("modified") ||
				responseText.includes("accessed")
			const hasDateInfo =
				responseText.includes("2025") || responseText.includes("GMT") || /\d{4}-\d{2}-\d{2}/.test(responseText)

			assert.ok(
				hasSize,
				`MCP server response should contain file size information. Expected 'size' with a number (like 28 bytes for our test file). Got: ${responseText.substring(0, 200)}...`,
			)

			assert.ok(
				hasTimestamps,
				`MCP server response should contain timestamp information like 'created', 'modified', or 'accessed'. Got: ${responseText.substring(0, 200)}...`,
			)

			assert.ok(
				hasDateInfo,
				`MCP server response should contain date/time information (year, GMT timezone, or ISO date format). Got: ${responseText.substring(0, 200)}...`,
			)

			// Note: get_file_info typically returns metadata only, not the filename itself
			// So we'll focus on validating the metadata structure instead of filename reference
			const hasValidMetadata =
				(hasSize && hasTimestamps) || (hasSize && hasDateInfo) || (hasTimestamps && hasDateInfo)

			assert.ok(
				hasValidMetadata,
				`MCP server response should contain valid file metadata (combination of size, timestamps, and date info). Got: ${responseText.substring(0, 200)}...`,
			)

			// Ensure no errors are present
			assert.ok(
				!responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("failed"),
				`MCP server response should not contain error messages. Got: ${responseText.substring(0, 100)}...`,
			)

			// Verify task completed successfully
			assert.ok(attemptCompletionCalled, "Task should have completed with attempt_completion")

			// Check that no errors occurred
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			console.log("Test passed! MCP message format validation successful and task completed")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
