import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { sleep, waitUntilCompleted } from "../utils"
import { setDefaultSuiteTimeout } from "../test-utils"

suite.skip("Roo Code execute_command Tool", function () {
	// NOTE: These tests are currently skipped because the AI is not using the execute_command tool
	// The tests complete but the tool is never executed, suggesting the prompts need refinement
	// or the AI prefers other approaches (like write_to_file) over execute_command
	// TODO: Investigate why AI doesn't use execute_command and refine prompts
	setDefaultSuiteTimeout(this)

	let workspaceDir: string

	// Pre-created test files that will be used across tests
	const testFiles = {
		simpleEcho: {
			name: `test-echo-${Date.now()}.txt`,
			content: "",
			path: "",
		},
		multiCommand: {
			name: `test-multi-${Date.now()}.txt`,
			content: "",
			path: "",
		},
		cwdTest: {
			name: `test-cwd-${Date.now()}.txt`,
			content: "",
			path: "",
		},
		longRunning: {
			name: `test-long-${Date.now()}.txt`,
			content: "",
			path: "",
		},
	}

	// Create test files before all tests
	suiteSetup(async () => {
		// Get workspace directory
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error("No workspace folder found")
		}
		workspaceDir = workspaceFolders[0]!.uri.fsPath
		console.log("Workspace directory:", workspaceDir)

		// Create test files
		for (const [key, file] of Object.entries(testFiles)) {
			file.path = path.join(workspaceDir, file.name)
			if (file.content) {
				await fs.writeFile(file.path, file.content)
				console.log(`Created ${key} test file at:`, file.path)
			}
		}
	})

	// Clean up after all tests
	suiteTeardown(async () => {
		// Cancel any running tasks before cleanup
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Clean up all test files
		console.log("Cleaning up test files...")
		for (const [key, file] of Object.entries(testFiles)) {
			try {
				await fs.unlink(file.path)
				console.log(`Cleaned up ${key} test file`)
			} catch (error) {
				console.log(`Failed to clean up ${key} test file:`, error)
			}
		}

		// Clean up subdirectory if created
		try {
			const subDir = path.join(workspaceDir, "test-subdir")
			await fs.rmdir(subDir)
		} catch {
			// Directory might not exist
		}
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

	test("Should execute simple echo command", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.simpleEcho
		let _taskCompleted = false
		let toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool request
			if (message.type === "ask" && message.ask === "tool") {
				toolExecuted = true
				console.log("Tool requested")
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
			// Start task with execute_command instruction
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
				},
				text: `Use the execute_command tool to run this command: echo "Hello from test" > ${testFile.name}

Then use the attempt_completion tool to complete the task.`,
			})

			console.log("Task ID:", taskId)

			// Wait for task completion
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			// Verify tool was executed
			assert.ok(toolExecuted, "The execute_command tool should have been executed")

			// Give time for file system operations
			await sleep(1000)

			// Verify file was created with correct content
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.ok(content.includes("Hello from test"), "File should contain the echoed text")

			console.log("Test passed! Command executed successfully")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should execute command with custom working directory", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false

		// Create subdirectory
		const subDir = path.join(workspaceDir, "test-subdir")
		await fs.mkdir(subDir, { recursive: true })

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool request
			if (message.type === "ask" && message.ask === "tool") {
				toolExecuted = true
				console.log("Tool requested")
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
			// Start task with execute_command instruction using cwd parameter
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
				},
				text: `Use the execute_command tool with these parameters:
- command: echo "Test in subdirectory" > output.txt
- cwd: test-subdir

The subdirectory test-subdir exists in the workspace.`,
			})

			console.log("Task ID:", taskId)

			// Wait for task completion
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			// Verify tool was executed
			assert.ok(toolExecuted, "The execute_command tool should have been executed")

			// Give time for file system operations
			await sleep(1000)

			// Verify file was created in subdirectory
			const outputPath = path.join(subDir, "output.txt")
			const content = await fs.readFile(outputPath, "utf-8")
			assert.ok(content.includes("Test in subdirectory"), "File should contain the echoed text")

			// Clean up created file
			await fs.unlink(outputPath)

			console.log("Test passed! Command executed in custom directory")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)

			// Clean up subdirectory
			try {
				await fs.rmdir(subDir)
			} catch {
				// Directory might not be empty
			}
		}
	})

	test("Should execute multiple commands sequentially", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.multiCommand
		let _taskCompleted = false
		let toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool request
			if (message.type === "ask" && message.ask === "tool") {
				toolExecuted = true
				console.log("Tool requested")
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
			// Start task with multiple commands
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
				},
				text: `Use the execute_command tool to create a file with multiple lines. Execute these commands:
1. echo "Line 1" > ${testFile.name}
2. echo "Line 2" >> ${testFile.name}

Execute each command separately using the execute_command tool, then use attempt_completion.`,
			})

			console.log("Task ID:", taskId)

			// Wait for task completion with increased timeout
			await waitUntilCompleted({ api, taskId, timeout: 90_000 })

			// Verify tool was executed
			assert.ok(toolExecuted, "The execute_command tool should have been executed")

			// Give time for file system operations
			await sleep(1000)

			// Verify file contains outputs
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.ok(content.includes("Line 1"), "Should contain first line")
			assert.ok(content.includes("Line 2"), "Should contain second line")

			console.log("Test passed! Multiple commands executed successfully")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should handle long-running commands", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool request
			if (message.type === "ask" && message.ask === "tool") {
				toolExecuted = true
				console.log("Tool requested")
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
			// Platform-specific sleep command
			const sleepCommand = process.platform === "win32" ? "timeout /t 2 /nobreak" : "sleep 2"

			// Start task with long-running command
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["*"],
					terminalShellIntegrationDisabled: true,
				},
				text: `Use the execute_command tool to run: ${sleepCommand} && echo "Command completed after delay"`,
			})

			console.log("Task ID:", taskId)

			// Wait for task completion
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			// Verify tool was executed
			assert.ok(toolExecuted, "The execute_command tool should have been executed")

			console.log("Test passed! Long-running command handled successfully")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
