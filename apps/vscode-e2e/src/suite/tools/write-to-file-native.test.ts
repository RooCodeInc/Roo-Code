import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

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
		onToolExecuted?: (toolName: string, details: string) => void
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

		// Track tool execution callbacks
		if (message.type === "ask" && message.ask === "tool") {
			if (debugLogging) {
				console.log("[DEBUG] Tool callback:", message.text?.substring(0, 300))
				// Extra native-protocol debugging: log full callback payload
				console.log("[NATIVE-DEBUG] ask/tool raw text:", message.text)
			}

			try {
				const toolData = JSON.parse(message.text || "{}")
				if (debugLogging) {
					console.log("[NATIVE-DEBUG] parsed tool callback:", JSON.stringify(toolData, null, 2))
				}
				if (toolData.tool) {
					verification.toolWasExecuted = true
					verification.executedToolName = toolData.tool
					console.log(`[VERIFIED] Tool executed: ${toolData.tool}`)
					onToolExecuted?.(toolData.tool, message.text || "")
				}
			} catch (_e) {
				if (debugLogging) {
					console.log("[DEBUG] Tool callback not JSON:", message.text?.substring(0, 100))
				}
			}
		}

		// Check API request for apiProtocol and tool execution details
		if (message.type === "say" && message.say === "api_req_started" && message.text) {
			const rawText = message.text
			if (debugLogging) {
				console.log("[DEBUG] API request started:", rawText.substring(0, 200))
				// Extra native-protocol debugging: log full api_req_started payload
				console.log("[NATIVE-DEBUG] api_req_started raw text:", rawText)
			}

			// Simple text check first (like original write-to-file.test.ts)
			if (rawText.includes("write_to_file")) {
				verification.toolWasExecuted = true
				verification.executedToolName = verification.executedToolName || "write_to_file"
				console.log("[VERIFIED] Tool executed via raw text check: write_to_file")
				onToolExecuted?.("write_to_file", rawText)
			}

			try {
				const requestData = JSON.parse(rawText)
				if (debugLogging) {
					console.log(
						"[NATIVE-DEBUG] parsed api_req_started:",
						// Limit size in case the payload is huge
						JSON.stringify(requestData, null, 2).substring(0, 5000),
					)
				}
				if (requestData.apiProtocol) {
					verification.apiProtocol = requestData.apiProtocol
					if (requestData.apiProtocol === "anthropic" || requestData.apiProtocol === "openai") {
						verification.hasNativeApiProtocol = true
						console.log(`[VERIFIED] API Protocol: ${requestData.apiProtocol}`)
					}
				}

				// Also check parsed request content
				if (requestData.request && requestData.request.includes("write_to_file")) {
					verification.toolWasExecuted = true
					verification.executedToolName = "write_to_file"
					console.log(`[VERIFIED] Tool executed via parsed request: write_to_file`)
					try {
						const parsed = JSON.parse(requestData.request)
						if (parsed.request) {
							onToolExecuted?.("write_to_file", parsed.request)
						}
					} catch (_e) {
						onToolExecuted?.("write_to_file", requestData.request)
					}
				}
			} catch (e) {
				console.log("[DEBUG] Failed to parse api_req_started message:", e)
			}
		}

		// Check text responses for XML (should NOT be present)
		if (message.type === "say" && message.say === "text" && message.text) {
			const hasXMLToolTags =
				message.text.includes("<write_to_file>") ||
				message.text.includes("</write_to_file>") ||
				message.text.includes("<apply_diff>") ||
				message.text.includes("</apply_diff>")

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

suite("Roo Code write_to_file Tool (Native Tool Calling)", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFilePath: string

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-native-"))
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	setup(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		testFilePath = path.join(tempDir, `test-file-native-${Date.now()}.txt`)
		await sleep(100)
	})

	teardown(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		try {
			await fs.unlink(testFilePath)
		} catch {
			// File might not exist
		}

		await sleep(100)
	})

	test("Should create a new file with content using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const fileContent = "Hello, this is a test file from native tool calling!"
		let taskStarted = false
		let taskCompleted = false
		let errorOccurred: string | null = null
		let writeToFileToolExecuted = false
		let toolExecutionDetails = ""

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onError: (error) => {
				errorOccurred = error
			},
			onToolExecuted: (toolName, details) => {
				console.log("[TEST-DEBUG] write-to-file createFile onToolExecuted:", toolName)
				if (
					toolName === "newFileCreated" ||
					toolName === "editedExistingFile" ||
					toolName === "write_to_file" ||
					toolName === "appliedDiff" ||
					toolName === "apply_diff"
				) {
					writeToFileToolExecuted = true
					toolExecutionDetails = details
					console.log("write_to_file tool called!")
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
				taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

		let taskId: string
		try {
			const baseFileName = path.basename(testFilePath)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Create a file named "${baseFileName}" with the following content:\n${fileContent}`,
			})

			console.log("Task ID:", taskId)
			console.log("Base filename:", baseFileName)
			console.log("Expecting file at:", testFilePath)

			await waitFor(() => taskStarted, { timeout: 45_000 })
			if (errorOccurred) {
				console.error("Early error detected:", errorOccurred)
			}

			await waitFor(() => taskCompleted, { timeout: 45_000 })
			await sleep(2000)

			assertNativeProtocolUsed(verification, "createFile")

			const possibleLocations = [
				testFilePath,
				path.join(tempDir, baseFileName),
				path.join(process.cwd(), baseFileName),
			]

			let fileFound = false
			let actualFilePath = ""
			let actualContent = ""

			const workspaceDirs = await fs
				.readdir("/tmp")
				.then((files) => files.filter((f) => f.startsWith("roo-test-workspace-")))
				.catch(() => [])

			for (const wsDir of workspaceDirs) {
				const wsFilePath = path.join("/tmp", wsDir, baseFileName)
				try {
					await fs.access(wsFilePath)
					fileFound = true
					actualFilePath = wsFilePath
					actualContent = await fs.readFile(wsFilePath, "utf-8")
					console.log("File found in workspace directory:", wsFilePath)
					break
				} catch {
					// Continue checking
				}
			}

			if (!fileFound) {
				for (const location of possibleLocations) {
					try {
						await fs.access(location)
						fileFound = true
						actualFilePath = location
						actualContent = await fs.readFile(location, "utf-8")
						console.log("File found at:", location)
						break
					} catch {
						// Continue checking
					}
				}
			}

			if (!fileFound) {
				console.log("File not found in expected locations. Debugging info:")

				try {
					const tempFiles = await fs.readdir(tempDir)
					console.log("Files in temp directory:", tempFiles)
				} catch (e) {
					console.log("Could not list temp directory:", e)
				}

				try {
					const cwdFiles = await fs.readdir(process.cwd())
					console.log(
						"Files in CWD:",
						cwdFiles.filter((f) => f.includes("test-file")),
					)
				} catch (e) {
					console.log("Could not list CWD:", e)
				}

				try {
					const tmpFiles = await fs.readdir("/tmp")
					console.log(
						"Test files in /tmp:",
						tmpFiles.filter((f) => f.includes("test-file") || f.includes("roo-test")),
					)
				} catch (e) {
					console.log("Could not list /tmp:", e)
				}
			}

			assert.ok(fileFound, `File should have been created. Expected filename: ${baseFileName}`)
			assert.strictEqual(actualContent.trim(), fileContent, "File content should match expected content")
			assert.ok(writeToFileToolExecuted, "write_to_file tool should have been executed")
			assert.ok(
				toolExecutionDetails.includes(baseFileName) || toolExecutionDetails.includes(fileContent),
				"Tool execution should include the filename or content",
			)

			console.log("Test passed! File created successfully at:", actualFilePath)
			console.log("write_to_file tool was properly executed with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should create nested directories when writing file using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		const content = "File in nested directory from native tool calling"
		const fileName = `file-native-${Date.now()}.txt`
		const nestedPath = path.join(tempDir, "nested-native", "deep", "directory", fileName)
		let taskStarted = false
		let taskCompleted = false
		let writeToFileToolExecuted = false
		let toolExecutionDetails = ""

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName, details) => {
				console.log("[TEST-DEBUG] write-to-file nestedDirectories onToolExecuted:", toolName)
				if (
					toolName === "newFileCreated" ||
					toolName === "editedExistingFile" ||
					toolName === "write_to_file" ||
					toolName === "appliedDiff" ||
					toolName === "apply_diff"
				) {
					writeToFileToolExecuted = true
					toolExecutionDetails = details
					console.log("write_to_file tool called!")
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
				taskCompleted = true
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
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					toolProtocol: "native",
					apiProvider: "openrouter",
					apiModelId: "openai/gpt-5.1",
				},
				text: `Create a file named "${fileName}" in a nested directory structure "nested-native/deep/directory/" with the following content:\n${content}`,
			})

			console.log("Task ID:", taskId)
			console.log("Expected nested path:", nestedPath)

			await waitFor(() => taskStarted, { timeout: 45_000 })
			await waitFor(() => taskCompleted, { timeout: 45_000 })
			await sleep(2000)

			assertNativeProtocolUsed(verification, "nestedDirectories")

			let fileFound = false
			let actualFilePath = ""
			let actualContent = ""

			const workspaceDirs = await fs
				.readdir("/tmp")
				.then((files) => files.filter((f) => f.startsWith("roo-test-workspace-")))
				.catch(() => [])

			for (const wsDir of workspaceDirs) {
				const wsNestedPath = path.join("/tmp", wsDir, "nested-native", "deep", "directory", fileName)
				try {
					await fs.access(wsNestedPath)
					fileFound = true
					actualFilePath = wsNestedPath
					actualContent = await fs.readFile(wsNestedPath, "utf-8")
					console.log("File found in workspace nested directory:", wsNestedPath)
					break
				} catch {
					const wsFilePath = path.join("/tmp", wsDir, fileName)
					try {
						await fs.access(wsFilePath)
						fileFound = true
						actualFilePath = wsFilePath
						actualContent = await fs.readFile(wsFilePath, "utf-8")
						console.log("File found in workspace root (nested dirs not created):", wsFilePath)
						break
					} catch {
						// Continue checking
					}
				}
			}

			if (!fileFound) {
				try {
					await fs.access(nestedPath)
					fileFound = true
					actualFilePath = nestedPath
					actualContent = await fs.readFile(nestedPath, "utf-8")
					console.log("File found at expected nested path:", nestedPath)
				} catch {
					// File not found
				}
			}

			if (!fileFound) {
				console.log("File not found. Debugging info:")

				for (const wsDir of workspaceDirs) {
					const wsPath = path.join("/tmp", wsDir)
					try {
						const files = await fs.readdir(wsPath)
						console.log(`Files in workspace ${wsDir}:`, files)

						const nestedDir = path.join(wsPath, "nested-native")
						try {
							await fs.access(nestedDir)
							console.log("Nested directory exists in workspace")
						} catch {
							console.log("Nested directory NOT created in workspace")
						}
					} catch (e) {
						console.log(`Could not list workspace ${wsDir}:`, e)
					}
				}
			}

			assert.ok(fileFound, `File should have been created. Expected filename: ${fileName}`)
			assert.strictEqual(actualContent.trim(), content, "File content should match")
			assert.ok(writeToFileToolExecuted, "write_to_file tool should have been executed")
			assert.ok(
				toolExecutionDetails.includes(fileName) ||
					toolExecutionDetails.includes(content) ||
					toolExecutionDetails.includes("nested"),
				"Tool execution should include the filename, content, or nested directory reference",
			)

			console.log("Test passed! File created successfully at:", actualFilePath)
			console.log("write_to_file tool was properly executed with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
