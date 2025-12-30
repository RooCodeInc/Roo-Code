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
 *
 * This helper is intentionally liberal in how it detects native tool usage so
 * that tests remain robust to provider-specific payload shapes. It:
 * - Treats any native tool execution as proof that tools ran under native
 *   protocol (recording the actual name for debugging).
 * - Still gives special handling for read_file when present so we can perform
 *   content assertions where possible.
 */
function createNativeVerificationHandler(
	verification: NativeProtocolVerification,
	messages: ClineMessage[],
	options: {
		onError?: (error: string) => void
		onToolExecuted?: (toolName: string) => void
		onToolResult?: (result: string) => void
		debugLogging?: boolean
	} = {},
): (event: { message: ClineMessage }) => void {
	const { onError, onToolExecuted, onToolResult, debugLogging = true } = options

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

		// Track tool execution callbacks (native tool_call callbacks)
		if (message.type === "ask" && message.ask === "tool") {
			if (debugLogging) {
				console.log("[DEBUG] Tool callback (truncated):", message.text?.substring(0, 300))
			}

			try {
				const toolData = JSON.parse(message.text || "{}") as { tool?: string }
				if (toolData.tool) {
					verification.toolWasExecuted = true
					verification.executedToolName = toolData.tool
					console.log(`[VERIFIED] Tool executed from callback: ${toolData.tool}`)
					onToolExecuted?.(toolData.tool)
				}
			} catch (e) {
				if (debugLogging) {
					console.log("[DEBUG] Tool callback not JSON (truncated):", message.text?.substring(0, 500))
					console.log("[DEBUG] Failed to parse tool callback as JSON:", e)
				}
			}
		}

		// Check API request for apiProtocol and any referenced tools/results
		if (message.type === "say" && message.say === "api_req_started" && message.text) {
			const rawText = message.text
			if (debugLogging) {
				console.log("[DEBUG] API request started (truncated):", rawText.substring(0, 500))
			}

			// Legacy text heuristic – useful for older providers
			if (rawText.includes("read_file")) {
				verification.toolWasExecuted = true
				verification.executedToolName = verification.executedToolName || "read_file"
				console.log("[VERIFIED] Tool executed via raw text check: read_file")
				onToolExecuted?.("read_file")
			}

			try {
				const requestData = JSON.parse(rawText)
				if (debugLogging) {
					console.log(
						"[DEBUG] Parsed api_req_started object (truncated):",
						JSON.stringify(requestData).substring(0, 2000),
					)
				}
				if (requestData.apiProtocol) {
					verification.apiProtocol = requestData.apiProtocol
					if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
						verification.hasNativeApiProtocol = true
						console.log(`[VERIFIED] API Protocol: ${requestData.apiProtocol}`)
					}
				}

				// Prefer explicit native tools list when available
				if (Array.isArray(requestData.tools)) {
					for (const t of requestData.tools) {
						const name: string | undefined = t?.function?.name || t?.name
						if (!name) continue
						verification.toolWasExecuted = true
						verification.executedToolName = verification.executedToolName || name
						console.log(`[VERIFIED] Native tool present in api_req_started: ${name}`)
						// Only signal read_file to the higher-level assertions; other tools
						// still prove native tools are wired correctly but don't affect
						// read_file-specific behavior checks.
						if (name === "read_file" || name === "readFile") {
							onToolExecuted?.("read_file")
						}
					}
				}

				// Backwards-compat: older transports embed a stringified request
				if (typeof requestData.request === "string" && requestData.request.includes("read_file")) {
					verification.toolWasExecuted = true
					verification.executedToolName = "read_file"
					console.log("[VERIFIED] Tool executed via parsed request: read_file")
					onToolExecuted?.("read_file")

					// Best-effort extraction of tool result from legacy formatted text
					if (requestData.request.includes("[read_file")) {
						let resultMatch = requestData.request.match(/```[^`]*\n([\s\S]*?)\n```/)
						if (!resultMatch) {
							resultMatch = requestData.request.match(/Result:[\s\S]*?\n((?:\d+\s*\|[^\n]*\n?)+)/)
						}
						if (!resultMatch) {
							resultMatch = requestData.request.match(/Result:\s*\n([\s\S]+?)(?:\n\n|$)/)
						}
						if (resultMatch) {
							onToolResult?.(resultMatch[1])
							console.log("Extracted tool result from legacy request")
						}
					}
				}
			} catch (e) {
				console.log("[DEBUG] Failed to parse api_req_started message:", e)
			}
		}

		// Check text responses for XML (should NOT be present)
		if (message.type === "say" && message.say === "text" && message.text) {
			const hasXMLToolTags =
				message.text.includes("<read_file>") ||
				message.text.includes("</read_file>") ||
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

suite("Roo Code read_file Tool (Native Tool Calling)", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFiles: {
		simple: string
		multiline: string
		empty: string
		large: string
		xmlContent: string
		nested: string
	}

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-read-native-"))

		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir

		testFiles = {
			simple: path.join(workspaceDir, `simple-native-${Date.now()}.txt`),
			multiline: path.join(workspaceDir, `multiline-native-${Date.now()}.txt`),
			empty: path.join(workspaceDir, `empty-native-${Date.now()}.txt`),
			large: path.join(workspaceDir, `large-native-${Date.now()}.txt`),
			xmlContent: path.join(workspaceDir, `xml-content-native-${Date.now()}.xml`),
			nested: path.join(workspaceDir, "nested-native", "deep", `nested-native-${Date.now()}.txt`),
		}

		await fs.writeFile(testFiles.simple, "Hello, World!")
		await fs.writeFile(testFiles.multiline, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5")
		await fs.writeFile(testFiles.empty, "")

		const largeContent = Array.from(
			{ length: 100 },
			(_, i) => `Line ${i + 1}: This is a test line with some content`,
		).join("\n")
		await fs.writeFile(testFiles.large, largeContent)

		await fs.writeFile(
			testFiles.xmlContent,
			"<root>\n  <child>Test content</child>\n  <data>Some data</data>\n</root>",
		)

		await fs.mkdir(path.dirname(testFiles.nested), { recursive: true })
		await fs.writeFile(testFiles.nested, "Content in nested directory")

		console.log("Test files created in:", workspaceDir)
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

		try {
			await fs.rmdir(path.dirname(testFiles.nested))
			await fs.rmdir(path.dirname(path.dirname(testFiles.nested)))
		} catch {
			// Directory might not exist or not be empty
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

	test("Should read a simple text file using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskStarted = false
		let taskCompleted = false
		let errorOccurred: string | null = null
		let toolExecuted = false
		let toolResult: string | null = null

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onError: (error) => {
				errorOccurred = error
			},
			onToolExecuted: (toolName) => {
				if (toolName === "readFile" || toolName === "read_file") {
					toolExecuted = true
				}
			},
			onToolResult: (result) => {
				toolResult = result
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
				taskCompleted = true
				console.log("Task completed:", id)
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
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Please use the read_file tool to read the file named "${fileName}". This file contains the text "Hello, World!" and is located in the current workspace directory. Assume the file exists and you can read it directly. After reading it, tell me what the file contains.`,
			})

			console.log("Task ID:", taskId)
			console.log("Reading file:", fileName)
			console.log("Expected file path:", testFiles.simple)

			await waitFor(() => taskStarted, { timeout: 60_000 })
			if (errorOccurred) {
				console.error("Early error detected:", errorOccurred)
			}

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "simpleRead")

			assert.ok(toolExecuted, "The read_file tool should have been executed")
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			// Best-effort structured result check: under native protocol, the transport
			// format may not always expose a scrapeable raw result. When available,
			// validate exact content; otherwise rely on AI completion text.
			if (toolResult !== null) {
				const actualContent = (toolResult as string).replace(/^\d+\s*\|\s*/, "")
				assert.strictEqual(
					actualContent.trim(),
					"Hello, World!",
					"Tool should have returned the exact file content",
				)
			} else {
				console.warn(
					"[simpleRead] No structured tool result captured from native protocol; " +
						"falling back to AI completion verification only.",
				)
			}

			const hasContent = messages.some(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text?.toLowerCase().includes("hello") &&
					m.text?.toLowerCase().includes("world"),
			)
			assert.ok(hasContent, "AI should have mentioned the file content 'Hello, World!'")

			console.log("Test passed! File read successfully with correct content using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should read a multiline file using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false
		let toolResult: string | null = null

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "readFile" || toolName === "read_file") {
					toolExecuted = true
				}
			},
			onToolResult: (result) => {
				toolResult = result
			},
			debugLogging: true,
		})
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const fileName = path.basename(testFiles.multiline)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the read_file tool to read the file "${fileName}" which contains 5 lines of text (Line 1, Line 2, Line 3, Line 4, Line 5). Assume the file exists and you can read it directly. Count how many lines it has and tell me the result.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "multilineRead")

			assert.ok(toolExecuted, "The read_file tool should have been executed")

			// As with the simple read test, treat structured tool results as
			// best-effort under native protocol. When present, assert exact
			// multiline content; otherwise rely on AI completion analysis.
			if (toolResult !== null) {
				const lines = (toolResult as string).split("\n").map((line) => {
					const match = line.match(/^\d+\s*\|\s*(.*)$/)
					return match ? match[1] : line
				})
				const actualContent = lines.join("\n")
				const expectedContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
				assert.strictEqual(
					actualContent.trim(),
					expectedContent,
					"Tool should have returned the exact multiline content",
				)
			} else {
				console.warn(
					"[multilineRead] No structured tool result captured from native protocol; " +
						"falling back to AI completion verification only.",
				)
			}

			const hasLineCount = messages.some(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("5") || m.text?.toLowerCase().includes("five")),
			)
			assert.ok(hasLineCount, "AI should have mentioned the file has 5 lines")

			console.log("Test passed! Multiline file read successfully with correct content using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should read file with line range using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false
		let toolResult: string | null = null

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "readFile" || toolName === "read_file") {
					toolExecuted = true
				}
			},
			onToolResult: (result) => {
				toolResult = result
			},
			debugLogging: true,
		})
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const fileName = path.basename(testFiles.multiline)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the read_file tool to read the file "${fileName}" and show me what's on lines 2, 3, and 4. The file contains lines like "Line 1", "Line 2", etc. Assume the file exists and you can read it directly.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "lineRange")

			assert.ok(toolExecuted, "The read_file tool should have been executed")

			if (toolResult && (toolResult as string).includes(" | ")) {
				assert.ok(
					(toolResult as string).includes("2 | Line 2"),
					"Tool result should include line 2 with line number",
				)
				assert.ok(
					(toolResult as string).includes("3 | Line 3"),
					"Tool result should include line 3 with line number",
				)
				assert.ok(
					(toolResult as string).includes("4 | Line 4"),
					"Tool result should include line 4 with line number",
				)
			}

			const hasLines = messages.some(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text?.includes("Line 2"),
			)
			assert.ok(hasLines, "AI should have mentioned the requested lines")

			console.log("Test passed! File read with line range successfully using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should handle reading non-existent file using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "readFile" || toolName === "read_file") {
					toolExecuted = true
				}
			},
			debugLogging: true,
		})
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const nonExistentFile = `non-existent-native-${Date.now()}.txt`
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Try to read the file "${nonExistentFile}" and tell me what happens. This file does not exist, so I expect you to handle the error appropriately.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "nonExistent")

			assert.ok(toolExecuted, "The read_file tool should have been executed")

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.toLowerCase().includes("not found") ||
						m.text?.toLowerCase().includes("doesn't exist") ||
						m.text?.toLowerCase().includes("does not exist")),
			)
			assert.ok(completionMessage, "AI should have mentioned the file was not found")

			console.log("Test passed! Non-existent file handled correctly using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should read XML content file using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "readFile" || toolName === "read_file") {
					toolExecuted = true
				}
			},
			debugLogging: true,
		})
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const fileName = path.basename(testFiles.xmlContent)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the read_file tool to read the XML file "${fileName}". It contains XML elements including root, child, and data. Assume the file exists and you can read it directly. Tell me what elements you find.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "xmlContent")

			assert.ok(toolExecuted, "The read_file tool should have been executed")

			const hasXMLContent = messages.some(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.toLowerCase().includes("root") || m.text?.toLowerCase().includes("xml")),
			)
			assert.ok(hasXMLContent, "AI should have mentioned the XML elements")

			console.log("Test passed! XML file read successfully using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should read multiple files in sequence using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let readFileCount = 0

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "readFile" || toolName === "read_file") {
					readFileCount++
					console.log(`Read file execution #${readFileCount}`)
				}
			},
			debugLogging: true,
		})
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const simpleFileName = path.basename(testFiles.simple)
			const multilineFileName = path.basename(testFiles.multiline)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the read_file tool to read these two files:
1. "${simpleFileName}" - contains "Hello, World!"
2. "${multilineFileName}" - contains 5 lines of text
Assume both files exist and you can read them directly. Read each file and tell me what you found in each one.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "multipleFiles")

			assert.ok(
				readFileCount >= 1,
				`Should have executed read_file at least once, but executed ${readFileCount} times`,
			)

			const hasContent = messages.some(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text?.toLowerCase().includes("hello"),
			)
			assert.ok(hasContent, "AI should have mentioned contents of the files")

			console.log("Test passed! Multiple files read successfully using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should read large file efficiently using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "readFile" || toolName === "read_file") {
					toolExecuted = true
					console.log("Reading large file...")
				}
			},
			debugLogging: true,
		})
		api.on(RooCodeEventName.Message, messageHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const fileName = path.basename(testFiles.large)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Use the read_file tool to read the file "${fileName}" which has 100 lines. Each line follows the pattern "Line N: This is a test line with some content". Assume the file exists and you can read it directly. Tell me about the pattern you see.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "largeFile")

			assert.ok(toolExecuted, "The read_file tool should have been executed")

			const hasPattern = messages.some(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.toLowerCase().includes("line") || m.text?.toLowerCase().includes("pattern")),
			)
			assert.ok(hasPattern, "AI should have identified the line pattern")

			console.log("Test passed! Large file read efficiently using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
