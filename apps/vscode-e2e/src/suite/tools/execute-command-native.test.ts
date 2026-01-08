import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { waitFor, sleep, waitUntilCompleted } from "../utils"
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

	assert.strictEqual(
		verification.toolWasExecuted,
		true,
		`[${testName}] Tool should have been executed. Executed tool: ${verification.executedToolName || "none"}`,
	)

	console.log(`[${testName}] ✓ Native protocol verification passed`)
	console.log(`  - API Protocol: ${verification.apiProtocol}`)
	console.log(`  - Response is not XML: ${verification.responseIsNotXML}`)
	console.log(`  - Tool was executed: ${verification.toolWasExecuted}`)
	console.log(`  - Executed tool name: ${verification.executedToolName || "none"}`)
}

/**
 * Creates a message handler that tracks native protocol verification.
 */
function createNativeVerificationHandler(
	verification: NativeProtocolVerification,
	messages: ClineMessage[],
	options: {
		onError?: (error: string) => void
		onToolExecuted?: (toolName: string) => void
		debugLogging?: boolean
	} = {},
): (event: { message: ClineMessage }) => void {
	const { onError, onToolExecuted, debugLogging = true } = options

	return ({ message }: { message: ClineMessage }) => {
		messages.push(message)

		if (debugLogging) {
			console.log(`[DEBUG] Message: type=${message.type}, say=${message.say}, ask=${message.ask}`)
		}

		if (message.type === "say" && message.say === "error") {
			const errorText = message.text || "Unknown error"
			console.error("[ERROR]:", errorText)
			onError?.(errorText)
		}

		// Track tool execution callbacks (ask === "tool" messages)
		if (message.type === "ask" && message.ask === "tool") {
			if (debugLogging) {
				console.log("[DEBUG] Tool callback:", message.text?.substring(0, 300))
			}

			try {
				const toolData = JSON.parse(message.text || "{}")
				if (toolData.tool) {
					verification.toolWasExecuted = true
					verification.executedToolName = toolData.tool
					console.log(`[VERIFIED] Tool executed via ask: ${toolData.tool}`)
					onToolExecuted?.(toolData.tool)
				}
			} catch (_e) {
				if (debugLogging) {
					console.log("[DEBUG] Tool callback not JSON:", message.text?.substring(0, 100))
				}
			}
		}

		// Also detect tool execution via command_output messages (indicates execute_command ran)
		if (message.type === "say" && message.say === "command_output") {
			verification.toolWasExecuted = true
			verification.executedToolName = verification.executedToolName || "execute_command"
			console.log("[VERIFIED] Tool executed via command_output message")
			onToolExecuted?.("execute_command")
		}

		// Also detect via ask === "command" messages
		if (message.type === "ask" && message.ask === "command") {
			verification.toolWasExecuted = true
			verification.executedToolName = verification.executedToolName || "execute_command"
			console.log("[VERIFIED] Tool executed via ask command message")
			onToolExecuted?.("execute_command")
		}

		// Check API request for apiProtocol AND tool execution
		if (message.type === "say" && message.say === "api_req_started" && message.text) {
			const rawText = message.text
			if (debugLogging) {
				console.log("[DEBUG] API request started:", rawText.substring(0, 200))
			}

			// Simple text check first (like original execute-command.test.ts)
			if (rawText.includes("execute_command")) {
				verification.toolWasExecuted = true
				verification.executedToolName = verification.executedToolName || "execute_command"
				console.log("[VERIFIED] Tool executed via raw text check: execute_command")
				onToolExecuted?.("execute_command")
			}

			try {
				const requestData = JSON.parse(rawText)
				if (requestData.apiProtocol) {
					verification.apiProtocol = requestData.apiProtocol
					if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
						verification.hasNativeApiProtocol = true
						console.log(`[VERIFIED] API Protocol: ${requestData.apiProtocol}`)
					}
				}
				// Also detect tool execution via parsed request content
				if (requestData.request && requestData.request.includes("execute_command")) {
					verification.toolWasExecuted = true
					verification.executedToolName = "execute_command"
					console.log(`[VERIFIED] Tool executed via parsed request: execute_command`)
					onToolExecuted?.("execute_command")
				}
			} catch (e) {
				console.log("[DEBUG] Failed to parse api_req_started message:", e)
			}
		}

		// Check text responses for XML (should NOT be present)
		if (message.type === "say" && message.say === "text" && message.text) {
			const hasXMLToolTags =
				message.text.includes("<execute_command>") ||
				message.text.includes("</execute_command>") ||
				message.text.includes("<write_to_file>") ||
				message.text.includes("</write_to_file>")

			if (hasXMLToolTags) {
				verification.responseIsNotXML = false
				console.log("[WARNING] Found XML tool tags in response")
			}
		}

		if (message.type === "say" && message.say === "completion_result") {
			if (debugLogging && message.text) {
				console.log("[DEBUG] AI completion:", message.text.substring(0, 200))
			}
		}
	}
}

suite("Roo Code execute_command Tool (Native Tool Calling)", function () {
	setDefaultSuiteTimeout(this)

	let workspaceDir: string

	const testFiles = {
		simpleEcho: {
			name: `test-echo-native-${Date.now()}.txt`,
			content: "",
			path: "",
		},
		multiCommand: {
			name: `test-multi-native-${Date.now()}.txt`,
			content: "",
			path: "",
		},
		cwdTest: {
			name: `test-cwd-native-${Date.now()}.txt`,
			content: "",
			path: "",
		},
		longRunning: {
			name: `test-long-native-${Date.now()}.txt`,
			content: "",
			path: "",
		},
	}

	suiteSetup(async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error("No workspace folder found")
		}
		workspaceDir = workspaceFolders[0]!.uri.fsPath
		console.log("Workspace directory:", workspaceDir)

		for (const [key, file] of Object.entries(testFiles)) {
			file.path = path.join(workspaceDir, file.name)
			if (file.content) {
				await fs.writeFile(file.path, file.content)
				console.log(`Created ${key} test file at:`, file.path)
			}
		}
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		console.log("Cleaning up test files...")
		for (const [key, file] of Object.entries(testFiles)) {
			// Only try to delete if file path is set and file exists
			if (file.path) {
				try {
					await fs.access(file.path) // Check if file exists first
					await fs.unlink(file.path)
					console.log(`Cleaned up ${key} test file`)
				} catch (error: unknown) {
					// Only log if it's not an ENOENT error (file doesn't exist is fine)
					if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
						console.log(`Failed to clean up ${key} test file:`, error)
					}
				}
			}
		}

		try {
			const subDir = path.join(workspaceDir, "test-subdir")
			await fs.access(subDir) // Check if directory exists first
			await fs.rmdir(subDir)
		} catch {
			// Directory might not exist - that's fine
		}
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

	test("Should execute simple echo command using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.simpleEcho
		let taskStarted = false
		let _taskCompleted = false
		let errorOccurred: string | null = null
		let executeCommandToolCalled = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onError: (error) => {
				errorOccurred = error
			},
			onToolExecuted: (toolName) => {
				if (toolName === "command" || toolName === "execute_command") {
					executeCommandToolCalled = true
					console.log("execute_command tool called!")
				}
			},
			debugLogging: true,
		})
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

		let taskId: string
		try {
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the execute_command tool to run this command: echo "Hello from test" > ${testFile.name}

The file ${testFile.name} will be created in the current workspace directory. Assume you can execute this command directly.

Then use the attempt_completion tool to complete the task. Do not suggest any commands in the attempt_completion.`,
			})

			console.log("Task ID:", taskId)
			console.log("Test file:", testFile.name)

			await waitFor(() => taskStarted, { timeout: 45_000 })
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			assertNativeProtocolUsed(verification, "simpleEcho")

			assert.strictEqual(errorOccurred, null, `Error occurred: ${errorOccurred}`)
			assert.ok(executeCommandToolCalled, "execute_command tool should have been called")

			const content = await fs.readFile(testFile.path, "utf-8")
			assert.ok(content.includes("Hello from test"), "File should contain the echoed text")

			console.log("Test passed! Command executed successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should execute command with custom working directory using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskStarted = false
		let _taskCompleted = false
		let errorOccurred: string | null = null
		let executeCommandToolCalled = false

		const subDir = path.join(workspaceDir, "test-subdir")
		await fs.mkdir(subDir, { recursive: true })

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onError: (error) => {
				errorOccurred = error
			},
			onToolExecuted: (toolName) => {
				if (toolName === "command" || toolName === "execute_command") {
					executeCommandToolCalled = true
				}
			},
			debugLogging: true,
		})
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

		let taskId: string
		try {
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the execute_command tool with these exact parameters:
- command: echo "Test in subdirectory" > output.txt
- cwd: ${subDir}

The subdirectory ${subDir} exists in the workspace. Assume you can execute this command directly with the specified working directory.

Avoid at all costs suggesting a command when using the attempt_completion tool`,
			})

			console.log("Task ID:", taskId)
			console.log("Subdirectory:", subDir)

			await waitFor(() => taskStarted, { timeout: 45_000 })
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			assertNativeProtocolUsed(verification, "cwdTest")

			assert.strictEqual(errorOccurred, null, `Error occurred: ${errorOccurred}`)
			assert.ok(executeCommandToolCalled, "execute_command tool should have been called")

			const outputPath = path.join(subDir, "output.txt")
			const content = await fs.readFile(outputPath, "utf-8")
			assert.ok(content.includes("Test in subdirectory"), "File should contain the echoed text")

			await fs.unlink(outputPath)

			console.log("Test passed! Command executed in custom directory with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)

			try {
				await fs.rmdir(subDir)
			} catch {
				// Directory might not be empty
			}
		}
	})

	test("Should execute multiple commands sequentially using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.multiCommand
		let taskStarted = false
		let _taskCompleted = false
		let errorOccurred: string | null = null
		let executeCommandCallCount = 0

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onError: (error) => {
				errorOccurred = error
			},
			onToolExecuted: (toolName) => {
				if (toolName === "command" || toolName === "execute_command") {
					executeCommandCallCount++
					console.log(`execute_command tool call #${executeCommandCallCount}`)
				}
			},
			debugLogging: true,
		})
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

		let taskId: string
		try {
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the execute_command tool to create a file with multiple lines. Execute these commands one by one:
1. echo "Line 1" > ${testFile.name}
2. echo "Line 2" >> ${testFile.name}

The file ${testFile.name} will be created in the current workspace directory. Assume you can execute these commands directly.

Important: Use only the echo command which is available on all Unix platforms. Execute each command separately using the execute_command tool.

After both commands are executed, use the attempt_completion tool to complete the task.`,
			})

			console.log("Task ID:", taskId)
			console.log("Test file:", testFile.name)

			await waitFor(() => taskStarted, { timeout: 90_000 })
			await waitUntilCompleted({ api, taskId, timeout: 90_000 })

			assertNativeProtocolUsed(verification, "multiCommand")

			assert.strictEqual(errorOccurred, null, `Error occurred: ${errorOccurred}`)
			assert.ok(
				executeCommandCallCount >= 2,
				`execute_command tool should have been called at least 2 times, was called ${executeCommandCallCount} times`,
			)

			const content = await fs.readFile(testFile.path, "utf-8")
			assert.ok(content.includes("Line 1"), "Should contain first line")
			assert.ok(content.includes("Line 2"), "Should contain second line")

			console.log("Test passed! Multiple commands executed successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should handle long-running commands using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskStarted = false
		let _taskCompleted = false
		let errorOccurred: string | null = null
		let executeCommandToolCalled = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onError: (error) => {
				errorOccurred = error
			},
			onToolExecuted: (toolName) => {
				if (toolName === "command" || toolName === "execute_command") {
					executeCommandToolCalled = true
				}
			},
			debugLogging: true,
		})
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

		let taskId: string
		try {
			// Use ping for delay on Windows (timeout command has interactive output that confuses AI)
			// ping -n 4 waits ~3 seconds (1 second between each of 4 pings)
			const sleepCommand =
				process.platform === "win32"
					? 'ping -n 4 127.0.0.1 > nul && echo "Command completed after delay"'
					: 'sleep 3 && echo "Command completed after delay"'

			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the execute_command tool to run this exact command: ${sleepCommand}

This command will wait for a few seconds then print a message. Execute it directly without any modifications.

After the command completes successfully, immediately use attempt_completion to report success. Do NOT ask any followup questions or suggest additional commands.`,
			})

			console.log("Task ID:", taskId)

			await waitFor(() => taskStarted, { timeout: 60_000 })
			await waitUntilCompleted({ api, taskId, timeout: 90_000 })
			await sleep(1000)

			assertNativeProtocolUsed(verification, "longRunning")

			assert.strictEqual(errorOccurred, null, `Error occurred: ${errorOccurred}`)
			assert.ok(executeCommandToolCalled, "execute_command tool should have been called")

			console.log("Test passed! Long-running command handled successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
