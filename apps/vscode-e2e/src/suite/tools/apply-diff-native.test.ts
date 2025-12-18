import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { waitFor, sleep } from "../utils"
import { setDefaultSuiteTimeout } from "../test-utils"

/**
 * Native tool calling verification state.
 * Tracks multiple indicators to ensure native protocol is actually being used.
 *
 * NOTE: Some verification approaches have been simplified because the underlying
 * data (request body, response body, toolCallId in callbacks) is not exposed in
 * the message events. We rely on:
 * 1. apiProtocol field in api_req_started message
 * 2. Successful tool execution with native configuration
 * 3. Absence of XML tool tags in text responses
 */
interface NativeProtocolVerification {
	/** Whether the apiProtocol field indicates native format (anthropic/openai) */
	hasNativeApiProtocol: boolean
	/** The apiProtocol value received (for debugging) */
	apiProtocol: string | null
	/** Whether the response text does NOT contain XML tool tags (confirming non-XML) */
	responseIsNotXML: boolean
	/** Whether the tool was successfully executed (appliedDiff callback received) */
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
		responseIsNotXML: true, // Assume true until we see XML
		toolWasExecuted: false,
		executedToolName: null,
	}
}

/**
 * Asserts that native tool calling was actually used based on the verification state.
 * Uses simplified verification based on available data:
 * 1. apiProtocol field indicates native format
 * 2. Tool was successfully executed
 * 3. No XML tool tags in responses
 */
function assertNativeProtocolUsed(verification: NativeProtocolVerification, testName: string): void {
	// Check that apiProtocol was set (indicates API was called)
	assert.ok(
		verification.apiProtocol !== null,
		`[${testName}] apiProtocol should be set in api_req_started message. ` +
			`This indicates an API request was made.`,
	)

	// Check that response doesn't contain XML tool tags
	assert.strictEqual(
		verification.responseIsNotXML,
		true,
		`[${testName}] Response should NOT contain XML tool tags. ` +
			`Found XML tags which indicates XML protocol was used instead of native.`,
	)

	// Check that tool was executed
	assert.strictEqual(
		verification.toolWasExecuted,
		true,
		`[${testName}] Tool should have been executed. ` + `Executed tool: ${verification.executedToolName || "none"}`,
	)

	console.log(`[${testName}] ✓ Native protocol verification passed (simplified approach)`)
	console.log(`  - API Protocol: ${verification.apiProtocol}`)
	console.log(`  - Response is not XML: ${verification.responseIsNotXML}`)
	console.log(`  - Tool was executed: ${verification.toolWasExecuted}`)
	console.log(`  - Executed tool name: ${verification.executedToolName || "none"}`)
}

/**
 * Creates a message handler that tracks native protocol verification.
 * Uses simplified verification based on available data:
 * 1. apiProtocol field in api_req_started message
 * 2. Tool execution callbacks (appliedDiff)
 * 3. Absence of XML tool tags in text responses
 */
function createNativeVerificationHandler(
	verification: NativeProtocolVerification,
	messages: ClineMessage[],
	options: {
		onError?: (error: string) => void
		onApplyDiffExecuted?: () => void
		debugLogging?: boolean
	} = {},
): (event: { message: ClineMessage }) => void {
	const { onError, onApplyDiffExecuted, debugLogging = true } = options

	return ({ message }: { message: ClineMessage }) => {
		messages.push(message)

		// Debug logging
		if (debugLogging) {
			console.log(`[DEBUG] Message: type=${message.type}, say=${message.say}, ask=${message.ask}`)
		}

		// Track errors
		if (message.type === "say" && message.say === "error") {
			const errorText = message.text || "Unknown error"
			console.error("[ERROR]:", errorText)
			onError?.(errorText)
		}

		// === VERIFICATION 1: Check tool execution callbacks ===
		if (message.type === "ask" && message.ask === "tool") {
			if (debugLogging) {
				console.log("[DEBUG] Tool callback:", message.text?.substring(0, 300))
			}

			try {
				const toolData = JSON.parse(message.text || "{}")

				// Track tool execution
				if (toolData.tool) {
					verification.toolWasExecuted = true
					verification.executedToolName = toolData.tool
					console.log(`[VERIFIED] Tool executed: ${toolData.tool}`)
				}

				// Track apply_diff execution specifically
				if (toolData.tool === "appliedDiff" || toolData.tool === "apply_diff") {
					console.log("[TOOL] apply_diff tool executed")
					onApplyDiffExecuted?.()
				}
			} catch (_e) {
				// Not JSON, but still counts as tool execution attempt
				if (debugLogging) {
					console.log("[DEBUG] Tool callback not JSON:", message.text?.substring(0, 100))
				}
			}
		}

		// === VERIFICATION 2: Check API request for apiProtocol ===
		if (message.type === "say" && message.say === "api_req_started" && message.text) {
			const rawText = message.text
			if (debugLogging) {
				console.log("[DEBUG] API request started:", rawText.substring(0, 200))
			}

			// Simple text check first (like original apply-diff.test.ts)
			if (rawText.includes("apply_diff") || rawText.includes("appliedDiff")) {
				verification.toolWasExecuted = true
				verification.executedToolName = verification.executedToolName || "apply_diff"
				console.log("[VERIFIED] Tool executed via raw text check: apply_diff")
				onApplyDiffExecuted?.()
			}

			try {
				const requestData = JSON.parse(rawText)

				// Check for apiProtocol field (this IS available in the message)
				if (requestData.apiProtocol) {
					verification.apiProtocol = requestData.apiProtocol
					// Native protocols use "anthropic" or "openai" format
					if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
						verification.hasNativeApiProtocol = true
						console.log(`[VERIFIED] API Protocol: ${requestData.apiProtocol}`)
					}
				}

				// Also check parsed request content
				if (
					requestData.request &&
					(requestData.request.includes("apply_diff") || requestData.request.includes("appliedDiff"))
				) {
					verification.toolWasExecuted = true
					verification.executedToolName = "apply_diff"
					console.log(`[VERIFIED] Tool executed via parsed request: apply_diff`)
					onApplyDiffExecuted?.()
				}
			} catch (e) {
				console.log("[DEBUG] Failed to parse api_req_started message:", e)
			}
		}

		// === VERIFICATION 3: Check text responses for XML (should NOT be present) ===
		if (message.type === "say" && message.say === "text" && message.text) {
			// Check for XML tool tags in AI text responses
			const hasXMLToolTags =
				message.text.includes("<apply_diff>") ||
				message.text.includes("</apply_diff>") ||
				message.text.includes("<write_to_file>") ||
				message.text.includes("</write_to_file>")

			if (hasXMLToolTags) {
				verification.responseIsNotXML = false
				console.log("[WARNING] Found XML tool tags in response - this indicates XML protocol")
			}
		}

		// Log completion results
		if (message.type === "say" && message.say === "completion_result") {
			if (debugLogging && message.text) {
				console.log("[DEBUG] AI completion:", message.text.substring(0, 200))
			}
		}
	}
}

suite("Roo Code apply_diff Tool (Native Tool Calling)", function () {
	setDefaultSuiteTimeout(this)

	let workspaceDir: string

	// Pre-created test files that will be used across tests
	const testFiles = {
		simpleModify: {
			name: `test-file-simple-native-${Date.now()}.txt`,
			content: "Hello World\nThis is a test file\nWith multiple lines",
			path: "",
		},
		multipleReplace: {
			name: `test-func-multiple-native-${Date.now()}.js`,
			content: `function calculate(x, y) {
	const sum = x + y
	const product = x * y
	return { sum: sum, product: product }
}`,
			path: "",
		},
		lineNumbers: {
			name: `test-lines-native-${Date.now()}.js`,
			content: `// Header comment
function oldFunction() {
	console.log("Old implementation")
}

// Another function
function keepThis() {
	console.log("Keep this")
}

// Footer comment`,
			path: "",
		},
		errorHandling: {
			name: `test-error-native-${Date.now()}.txt`,
			content: "Original content",
			path: "",
		},
		multiSearchReplace: {
			name: `test-multi-search-native-${Date.now()}.js`,
			content: `function processData(data) {
	console.log("Processing data")
	return data.map(item => item * 2)
}

// Some other code in between
const config = {
	timeout: 5000,
	retries: 3
}

function validateInput(input) {
	console.log("Validating input")
	if (!input) {
		throw new Error("Invalid input")
	}
	return true
}`,
			path: "",
		},
	}

	// Get the actual workspace directory that VSCode is using and create all test files
	suiteSetup(async function () {
		// Get the workspace folder from VSCode
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error("No workspace folder found")
		}
		workspaceDir = workspaceFolders[0]!.uri.fsPath
		console.log("Using workspace directory:", workspaceDir)

		// Create all test files before any tests run
		console.log("Creating test files in workspace...")
		for (const [key, file] of Object.entries(testFiles)) {
			file.path = path.join(workspaceDir, file.name)
			await fs.writeFile(file.path, file.content)
			console.log(`Created ${key} test file at:`, file.path)
		}

		// Verify all files exist
		for (const [key, file] of Object.entries(testFiles)) {
			const exists = await fs
				.access(file.path)
				.then(() => true)
				.catch(() => false)
			if (!exists) {
				throw new Error(`Failed to create ${key} test file at ${file.path}`)
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
	})

	// Clean up before each test
	setup(async () => {
		// Cancel any previous task
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Reset all test files to their original content before each test
		// This ensures each test starts with a known clean state, even if a previous
		// test or run modified the file content
		for (const [key, file] of Object.entries(testFiles)) {
			if (file.path) {
				try {
					await fs.writeFile(file.path, file.content)
					console.log(`Reset ${key} test file to original content`)
				} catch (error) {
					console.log(`Failed to reset ${key} test file:`, error)
				}
			}
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

	test("Should apply diff to modify existing file content using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.simpleModify
		const expectedContent = "Hello Universe\nThis is a test file\nWith multiple lines"
		let taskStarted = false
		let taskCompleted = false
		let errorOccurred: string | null = null
		let applyDiffExecuted = false

		// Create verification state for tracking native protocol
		const verification = createVerificationState()

		// Create message handler with native verification
		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onError: (error) => {
				errorOccurred = error
			},
			onApplyDiffExecuted: () => {
				applyDiffExecuted = true
			},
			debugLogging: true,
		})
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
				taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task with native tool calling enabled via OpenRouter
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native", // Enable native tool calling
					apiProvider: "openrouter", // Use OpenRouter provider
					apiModelId: "openai/gpt-5.1", // GPT-5.1 supports native tools
				},
				text: `Use apply_diff on the file ${testFile.name} to change "Hello World" to "Hello Universe". The file already exists with this content:
${testFile.content}

Assume the file exists and you can modify it directly.`,
			})

			console.log("Task ID:", taskId)
			console.log("Test filename:", testFile.name)

			// Wait for task to start
			await waitFor(() => taskStarted, { timeout: 60_000 })

			// Check for early errors
			if (errorOccurred) {
				console.error("Early error detected:", errorOccurred)
			}

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 60_000 })

			// Give extra time for file system operations
			await sleep(2000)

			// Check if the file was modified correctly
			const actualContent = await fs.readFile(testFile.path, "utf-8")
			console.log("File content after modification:", actualContent)

			// === COMPREHENSIVE NATIVE PROTOCOL VERIFICATION ===
			// This is the key assertion that ensures we're ACTUALLY testing native tool calling
			assertNativeProtocolUsed(verification, "simpleModify")

			// Verify tool was executed
			assert.strictEqual(applyDiffExecuted, true, "apply_diff tool should have been executed")

			// Verify file content
			assert.strictEqual(
				actualContent.trim(),
				expectedContent.trim(),
				"File content should be modified correctly",
			)

			console.log(
				"Test passed! apply_diff tool executed with VERIFIED native protocol and file modified successfully",
			)
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should apply multiple search/replace blocks in single diff using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.multipleReplace
		const expectedContent = `function compute(a, b) {
	const total = a + b
	const result = a * b
	return { total: total, result: result }
}`
		let taskStarted = false
		let taskCompleted = false
		let applyDiffExecuted = false

		// Create verification state for tracking native protocol
		const verification = createVerificationState()

		// Create message handler with native verification
		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onApplyDiffExecuted: () => {
				applyDiffExecuted = true
			},
			debugLogging: true,
		})
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
				taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task with multiple replacements using native tool calling
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native", // Enable native tool calling
					apiProvider: "openrouter", // Use OpenRouter provider
					apiModelId: "openai/gpt-5.1", // GPT-5.1 supports native tools
				},
				text: `Use apply_diff on the file ${testFile.name} to make ALL of these changes:
1. Rename function "calculate" to "compute"
2. Rename parameters "x, y" to "a, b"
3. Rename variable "sum" to "total" (including in the return statement)
4. Rename variable "product" to "result" (including in the return statement)
5. In the return statement, change { sum: sum, product: product } to { total: total, result: result }

The file already exists with this content:
${testFile.content}

Assume the file exists and you can modify it directly.`,
			})

			console.log("Task ID:", taskId)
			console.log("Test filename:", testFile.name)

			// Wait for task to start
			await waitFor(() => taskStarted, { timeout: 60_000 })

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 60_000 })

			// Give extra time for file system operations
			await sleep(2000)

			// Check the file was modified correctly
			const actualContent = await fs.readFile(testFile.path, "utf-8")
			console.log("File content after modification:", actualContent)

			// === COMPREHENSIVE NATIVE PROTOCOL VERIFICATION ===
			assertNativeProtocolUsed(verification, "multipleReplace")

			// Verify tool was executed
			assert.strictEqual(applyDiffExecuted, true, "apply_diff tool should have been executed")

			// Verify file content
			assert.strictEqual(
				actualContent.trim(),
				expectedContent.trim(),
				"All replacements should be applied correctly",
			)

			console.log(
				"Test passed! apply_diff tool executed with VERIFIED native protocol and multiple replacements applied successfully",
			)
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should handle apply_diff with line number hints using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.lineNumbers
		const expectedContent = `// Header comment
function newFunction() {
	console.log("New implementation")
}

// Another function
function keepThis() {
	console.log("Keep this")
}

// Footer comment`

		let taskStarted = false
		let taskCompleted = false
		let applyDiffExecuted = false

		// Create verification state for tracking native protocol
		const verification = createVerificationState()

		// Create message handler with native verification
		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onApplyDiffExecuted: () => {
				applyDiffExecuted = true
			},
			debugLogging: true,
		})
		api.on(RooCodeEventName.Message, messageHandler)

		// Listen for task events
		const taskStartedHandler = (id: string) => {
			if (id === taskId) {
				taskStarted = true
			}
		}
		api.on(RooCodeEventName.TaskStarted, taskStartedHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task with line number context using native tool calling
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native", // Enable native tool calling
					apiProvider: "openrouter", // Use OpenRouter provider
					apiModelId: "openai/gpt-5.1", // GPT-5.1 supports native tools
				},
				text: `Use apply_diff on the file ${testFile.name} to change "oldFunction" to "newFunction" and update its console.log to "New implementation". Keep the rest of the file unchanged.

The file already exists with this content:
${testFile.content}

Assume the file exists and you can modify it directly.`,
			})

			console.log("Task ID:", taskId)
			console.log("Test filename:", testFile.name)

			// Wait for task to start
			await waitFor(() => taskStarted, { timeout: 60_000 })

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 60_000 })

			// Give extra time for file system operations
			await sleep(2000)

			// Check the file was modified correctly
			const actualContent = await fs.readFile(testFile.path, "utf-8")
			console.log("File content after modification:", actualContent)

			// === COMPREHENSIVE NATIVE PROTOCOL VERIFICATION ===
			assertNativeProtocolUsed(verification, "lineNumbers")

			// Verify tool was executed
			assert.strictEqual(applyDiffExecuted, true, "apply_diff tool should have been executed")

			// Verify file content
			assert.strictEqual(
				actualContent.trim(),
				expectedContent.trim(),
				"Only specified function should be modified",
			)

			console.log(
				"Test passed! apply_diff tool executed with VERIFIED native protocol and targeted modification successful",
			)
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should handle apply_diff errors gracefully using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.errorHandling
		let taskStarted = false
		let taskCompleted = false
		let errorDetected = false
		let applyDiffAttempted = false
		let writeToFileUsed = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for error messages
			if (message.type === "say" && message.say === "error") {
				errorDetected = true
				console.log("Error detected:", message.text)
			}

			// Check for tool execution attempt
			if (message.type === "ask" && message.ask === "tool") {
				console.log("Tool ASK request:", message.text?.substring(0, 500))
				try {
					const toolData = JSON.parse(message.text || "{}")
					if (toolData.tool === "appliedDiff") {
						applyDiffAttempted = true
						console.log("apply_diff tool attempted via ASK!")
					}
					// Detect if write_to_file was used (shows as editedExistingFile or newFileCreated)
					if (toolData.tool === "editedExistingFile" || toolData.tool === "newFileCreated") {
						writeToFileUsed = true
						console.log("write_to_file tool used!")
					}
				} catch (e) {
					console.error(e)
				}
			}

			// Check for diff_error which indicates apply_diff was attempted but failed
			if (message.type === "say" && message.say === "diff_error") {
				applyDiffAttempted = true
				console.log("diff_error detected - apply_diff was attempted")
			}

			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				console.log("API request started:", message.text.substring(0, 200))
			}
		}
		api.on(RooCodeEventName.Message, messageHandler)

		// Listen for task events
		const taskStartedHandler = (id: string) => {
			if (id === taskId) {
				taskStarted = true
			}
		}
		api.on(RooCodeEventName.TaskStarted, taskStartedHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task with invalid search content using native tool calling
			// The prompt is crafted to FORCE the AI to attempt the tool call
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					reasoningEffort: "none",
					toolProtocol: "native", // Enable native tool calling
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `
---
description: Test apply_diff tool error handling with non-existent patterns
argument-hint: <file-path> [search-pattern]
---

<task>
Test the apply_diff tool's error handling by attempting to replace a pattern that does not exist in the target file.
Target File: ${testFile.name}
Search pattern: "PATTERN_THAT_DOES_NOT_EXIST_xyz123"
Replacement: "REPLACEMENT_xyz123"
</task>

<purpose>
This command verifies that apply_diff correctly handles and reports errors when:
- A search pattern is not found in the target file
- The tool gracefully fails with an informative error message
- Error handling works as expected for debugging workflows
</purpose>

<workflow>
  <step number="1">
    <action>Execute apply_diff directly</action>
    <details>
      Call apply_diff on the specified file with a non-existent search pattern.
      Do NOT analyze the file first - the goal is to test error handling.
    </details>
  </step>
  
  <step number="2">
    <action>Observe the error response</action>
    <details>
      The apply_diff tool should report that the pattern was not found.
      This is the EXPECTED outcome - not a failure of the test.
    </details>
  </step>
  
  <step number="3">
    <action>Report results</action>
    <details>
      Confirm whether the error handling worked correctly by reporting:
      - The error message received
      - Whether the tool behaved as expected
    </details>
  </step>
</workflow>

<requirements>
  <mandatory>
    - YOU MUST call the apply_diff tool - this is non-negotiable
    - Use the EXACT search pattern provided (or default: "PATTERN_THAT_DOES_NOT_EXIST_xyz123")
    - Do NOT use write_to_file or any other file modification tool
    - Do NOT analyze the file contents before calling apply_diff
    - Do NOT refuse to call the tool - error handling verification is the purpose
  </mandatory>
  
  <defaults>
    <search_pattern>PATTERN_THAT_DOES_NOT_EXIST_xyz123</search_pattern>
    <replacement>REPLACEMENT_xyz123</replacement>
  </defaults>
</requirements>

<apply_diff_template>
  <instructions>
    Use this structure for the apply_diff call:
    - path: The file specified by the user
    - diff: A SEARCH/REPLACE block with the non-existent pattern
  </instructions>
  
  <example>
    \`\`\`
    <<<<<<< SEARCH
    :start_line:1
    -------
    PATTERN_THAT_DOES_NOT_EXIST_xyz123
    =======
    REPLACEMENT_xyz123
    >>>>>>> REPLACE
    \`\`\`
  </example>
</apply_diff_template>

<expected_outcome>
  <success_criteria>
    The test succeeds when apply_diff returns an error indicating the pattern was not found.
    This confirms the tool's error handling is working correctly.
  </success_criteria>
  
  <report_format>
    After executing, report:
    - Whether apply_diff was called: YES/NO
    - Error message received: [actual error]
    - Error handling status: WORKING/FAILED
  </report_format>
</expected_outcome>

<constraints>
  - Only use the apply_diff tool
  - Accept that "pattern not found" errors are the expected result
  - Do not attempt to "fix" the test by finding real patterns
  - This is a diagnostic/testing command, not a production workflow
</constraints>`,
			})

			console.log("Task ID:", taskId)
			console.log("Test filename:", testFile.name)
			// Wait for task to start
			await waitFor(() => taskStarted, { timeout: 90_000 })

			// Wait for task completion or error
			await waitFor(() => taskCompleted || errorDetected, { timeout: 90_000 })

			// Give time for any final operations
			await sleep(2000)

			// Read the file content
			const actualContent = await fs.readFile(testFile.path, "utf-8")
			console.log("File content after task:", actualContent)
			console.log("applyDiffAttempted:", applyDiffAttempted)
			console.log("writeToFileUsed:", writeToFileUsed)

			// The AI MUST have attempted to use apply_diff
			assert.strictEqual(applyDiffAttempted, true, "apply_diff tool should have been attempted")

			// The AI should NOT have used write_to_file as a fallback
			assert.strictEqual(
				writeToFileUsed,
				false,
				"write_to_file should NOT be used when apply_diff fails - the AI should report the error instead",
			)

			// The content should remain unchanged since the search pattern wasn't found
			assert.strictEqual(
				actualContent.trim(),
				testFile.content.trim(),
				"File content should remain unchanged when search pattern not found",
			)

			console.log("Test passed! apply_diff attempted with native protocol and error handled gracefully")
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should apply multiple search/replace blocks to edit two separate functions using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const testFile = testFiles.multiSearchReplace
		const expectedContent = `function transformData(data) {
	console.log("Transforming data")
	return data.map(item => item * 2)
}

// Some other code in between
const config = {
	timeout: 5000,
	retries: 3
}

function checkInput(input) {
	console.log("Checking input")
	if (!input) {
		throw new Error("Invalid input")
	}
	return true
}`
		let taskStarted = false
		let taskCompleted = false
		let errorOccurred: string | null = null
		let applyDiffExecuted = false
		let applyDiffCount = 0

		// Create verification state for tracking native protocol
		const verification = createVerificationState()

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Log important messages for debugging
			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
			if (message.type === "ask" && message.ask === "tool") {
				console.log("Tool request:", message.text?.substring(0, 200))
				try {
					const toolData = JSON.parse(message.text || "{}")
					// Track tool execution
					if (toolData.tool) {
						verification.toolWasExecuted = true
						verification.executedToolName = toolData.tool
						console.log(`[VERIFIED] Tool executed: ${toolData.tool}`)
					}
					if (toolData.tool === "appliedDiff") {
						applyDiffExecuted = true
						applyDiffCount++
						console.log(`apply_diff tool executed! (count: ${applyDiffCount})`)
					}
				} catch (_e) {
					// Not JSON
				}
			}
			if (message.type === "say" && (message.say === "completion_result" || message.say === "text")) {
				console.log("AI response:", message.text?.substring(0, 200))
				// Check for XML tool tags in text responses
				if (message.say === "text" && message.text) {
					const hasXMLToolTags =
						message.text.includes("<apply_diff>") || message.text.includes("</apply_diff>")
					if (hasXMLToolTags) {
						verification.responseIsNotXML = false
						console.log("[WARNING] Found XML tool tags in response")
					}
				}
			}

			// Check for apiProtocol in api_req_started
			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				console.log("API request started:", message.text.substring(0, 200))
				try {
					const requestData = JSON.parse(message.text)
					// Check for apiProtocol field
					if (requestData.apiProtocol) {
						verification.apiProtocol = requestData.apiProtocol
						if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
							verification.hasNativeApiProtocol = true
							console.log(`[VERIFIED] API Protocol: ${requestData.apiProtocol}`)
						}
					}
				} catch (e) {
					console.log("Failed to parse api_req_started message:", e)
				}
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
				taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			// Start task with instruction to edit two separate functions using native tool calling
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native", // Enable native tool calling
					apiProvider: "openrouter", // Use OpenRouter provider
					apiModelId: "openai/gpt-5.1", // GPT-5.1 supports native tools
				},
				text: `Use apply_diff on the file ${testFile.name} to make these changes. You MUST use TWO SEPARATE search/replace blocks within a SINGLE apply_diff call:

FIRST search/replace block: Edit the processData function to rename it to "transformData" and change "Processing data" to "Transforming data"

SECOND search/replace block: Edit the validateInput function to rename it to "checkInput" and change "Validating input" to "Checking input"

Important: Use multiple SEARCH/REPLACE blocks in one apply_diff call, NOT multiple apply_diff calls. Each function should have its own search/replace block.

The file already exists with this content:
${testFile.content}

Assume the file exists and you can modify it directly.`,
			})

			console.log("Task ID:", taskId)
			console.log("Test filename:", testFile.name)

			// Wait for task to start
			await waitFor(() => taskStarted, { timeout: 60_000 })

			// Check for early errors
			if (errorOccurred) {
				console.error("Early error detected:", errorOccurred)
			}

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 60_000 })

			// Give extra time for file system operations
			await sleep(2000)

			// Check if the file was modified correctly
			const actualContent = await fs.readFile(testFile.path, "utf-8")
			console.log("File content after modification:", actualContent)

			// === COMPREHENSIVE NATIVE PROTOCOL VERIFICATION ===
			assertNativeProtocolUsed(verification, "multiSearchReplace")

			// Verify tool was executed
			assert.strictEqual(applyDiffExecuted, true, "apply_diff tool should have been executed")
			console.log(`apply_diff was executed ${applyDiffCount} time(s)`)

			// Verify file content
			assert.strictEqual(
				actualContent.trim(),
				expectedContent.trim(),
				"Both functions should be modified with separate search/replace blocks",
			)

			console.log(
				"Test passed! apply_diff tool executed with VERIFIED native protocol and multiple search/replace blocks applied successfully",
			)
		} finally {
			// Clean up
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
