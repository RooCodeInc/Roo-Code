import { afterAll, afterEach, beforeAll, beforeEach, defineMatrix, describe, it } from "@roo-code/evally"
import { RooCodeEventName, type RooCodeAPI, type ClineMessage } from "@roo-code/types"
import { strict as assert } from "assert"
import { waitFor, sleep } from "./utils"

import * as fs from "fs/promises"
import * as path from "path"
interface NativeProtocolVerification {
	hasNativeApiProtocol: boolean
	apiProtocol: string | null
	responseIsNotXML: boolean
	toolWasExecuted: boolean
	executedToolName: string | null
}

function createVerificationState(): NativeProtocolVerification {
	return {
		hasNativeApiProtocol: false,
		apiProtocol: null,
		responseIsNotXML: true,
		toolWasExecuted: false,
		executedToolName: null,
	}
}

function assertNativeProtocolUsed(verification: NativeProtocolVerification, testName: string): void {
	assert.ok(
		verification.apiProtocol !== null,
		`[${testName}] apiProtocol should be set in api_req_started message. This indicates an API request was made.`,
	)

	assert.strictEqual(
		verification.hasNativeApiProtocol,
		true,
		`[${testName}] Native API protocol should be used. Expected apiProtocol to be "anthropic" or "openai", but got: ${verification.apiProtocol}`,
	)

	assert.strictEqual(
		verification.responseIsNotXML,
		true,
		`[${testName}] Response should NOT contain XML tool tags. Found XML tags which indicates XML protocol was used instead of native.`,
	)

	assert.strictEqual(
		verification.toolWasExecuted,
		true,
		`[${testName}] Tool should have been executed. Executed tool: ${verification.executedToolName || "none"}`,
	)
}

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

		if (debugLogging) {
			console.log(`[DEBUG] Message: type=${message.type}, say=${message.say}, ask=${message.ask}`)
		}

		if (message.type === "say" && message.say === "error") {
			const errorText = (message.text as string | undefined) || "Unknown error"
			console.error("[ERROR]:", errorText)
			onError?.(errorText)
		}

		if (message.type === "ask" && message.ask === "tool") {
			if (debugLogging && typeof message.text === "string") {
				console.log("[DEBUG] Tool callback:", message.text.substring(0, 300))
			}

			try {
				const toolData = JSON.parse((message.text as string) || "{}")

				if (toolData.tool) {
					verification.toolWasExecuted = true
					verification.executedToolName = toolData.tool
					console.log(`[VERIFIED] Tool executed: ${toolData.tool}`)
				}

				if (toolData.tool === "appliedDiff" || toolData.tool === "apply_diff") {
					console.log("[TOOL] apply_diff tool executed")
					onApplyDiffExecuted?.()
				}
			} catch {
				if (debugLogging && typeof message.text === "string") {
					console.log("[DEBUG] Tool callback not JSON:", message.text.substring(0, 100))
				}
			}
		}

		if (message.type === "say" && message.say === "api_req_started" && typeof message.text === "string") {
			const rawText = message.text
			if (debugLogging) {
				console.log("[DEBUG] API request started:", rawText.substring(0, 200))
			}

			if (rawText.includes("apply_diff") || rawText.includes("appliedDiff")) {
				verification.toolWasExecuted = true
				verification.executedToolName = verification.executedToolName || "apply_diff"
				console.log("[VERIFIED] Tool executed via raw text check: apply_diff")
				onApplyDiffExecuted?.()
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

				if (
					requestData.request &&
					(requestData.request.includes("apply_diff") || requestData.request.includes("appliedDiff"))
				) {
					verification.toolWasExecuted = true
					verification.executedToolName = "apply_diff"
					console.log("[VERIFIED] Tool executed via parsed request: apply_diff")
					onApplyDiffExecuted?.()
				}
			} catch (e) {
				console.log("[DEBUG] Failed to parse api_req_started message:", e)
			}
		}

		if (message.type === "say" && message.say === "text" && typeof message.text === "string") {
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

		if (message.type === "say" && message.say === "completion_result" && typeof message.text === "string") {
			if (debugLogging) {
				console.log("[DEBUG] AI completion:", message.text.substring(0, 200))
			}
		}
	}
}

const evalGroupVariables: { openRouterModelId: string }[] = [{ openRouterModelId: "openai/gpt-5.1" }]

const now = Date.now()
const testFiles: Record<
	string,
	{
		path: string
		name: string
		content: string
	}
> = {
	simpleModify: {
		name: `test-file-simple-native-${now}.txt`,
		content: "Hello World\nThis is a test file\nWith multiple lines",
		path: ``,
	},
	multipleReplace: {
		name: `test-func-multiple-native-${now}.js`,
		content: `function calculate(x, y) {\n  const sum = x + y\n  const product = x * y\n  return { sum: sum, product: product }\n}`,
		path: ``,
	},
	lineNumbers: {
		name: `test-lines-native-${now}.js`,
		content: `// Header comment\nfunction oldFunction() {\n  console.log("Old implementation")\n}\n\n// Another function\nfunction keepThis() {\n  console.log("Keep this")\n}\n\n// Footer comment`,
		path: ``,
	},
	errorHandling: {
		name: `test-error-native-${now}.txt`,
		content: "Original content",
		path: ``,
	},
	multiSearchReplace: {
		name: `test-multi-search-native-${now}.js`,
		content: `function processData(data) {\n  console.log("Processing data")\n  return data.map(item => item * 2)\n}\n\n// Some other code in between\nconst config = {\n  timeout: 5000,\n  retries: 3\n}\n\nfunction validateInput(input) {\n  console.log("Validating input")\n  if (!input) {\n    throw new Error("Invalid input")\n  }\n  return true\n}`,
		path: ``,
	},
}

function getTestWorkspaceDir(): string {
	const fromGlobal = (globalThis as { rooTestWorkspaceDir?: string }).rooTestWorkspaceDir
	if (typeof fromGlobal === "string" && fromGlobal.length > 0) {
		return fromGlobal
	}
	return process.cwd()
}

async function createTestFile(file: { name: string; content: string }): Promise<string> {
	const tmpPath = path.join(getTestWorkspaceDir(), file.name)
	await fs.writeFile(tmpPath, file.content)
	return tmpPath
}
async function resetTestFile(file: { name: string; content: string }): Promise<string> {
	const tmpPath = path.join(getTestWorkspaceDir(), file.name)
	await fs.writeFile(tmpPath, file.content)
	return tmpPath
}
async function removeTestFile(file: { name: string }): Promise<void> {
	const tmpPath = path.join(getTestWorkspaceDir(), file.name)
	try {
		await fs.unlink(tmpPath)
	} catch {
		void 0
	}
}

export default defineMatrix({
	variables: evalGroupVariables,
	iterations: 10,
	tests: function () {
		describe("Apply_diff Tool (Native Tool Calling)", function () {
			let workspaceDir: string
			beforeAll(async () => {
				console.log("beforeAll Executed")
				workspaceDir = getTestWorkspaceDir()
				console.log("[INFO] Using workspace directory:", workspaceDir)

				console.log("Creating test files in workspace...")
				for (const [key, file] of Object.entries(testFiles)) {
					file.path = path.join(workspaceDir, file.name)
					await fs.writeFile(file.path, file.content)
					console.log(`Created ${key} test file at:`, file.path)
				}

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

			beforeEach(async () => {
				console.log("beforeEach Executed - resetting test files to original content")
				await resetAllTestFiles()
			})
			afterEach(async () => {
				console.log("afterEach Executed")
			})
			afterAll(async () => {
				console.log("afterAll Executed")
			})

			it("should apply diff to modify file content and events (extension harness integrated)", async function ({
				variable,
			}) {
				const api: RooCodeAPI | undefined = (globalThis as { api?: RooCodeAPI }).api as RooCodeAPI | undefined

				if (!api) {
					console.warn(
						"[applyDiff.matrix] globalThis.api is not set; not running inside VSCode extension host. Skipping test.",
					)
					return
				}

				const file = testFiles.simpleModify
				if (!file) throw new Error("Missing test file definition")
				const expectedContent = "Hello Universe\nThis is a test file\nWith multiple lines"
				await createTestFile(file)

				const messages: ClineMessage[] = []
				let taskStarted = false
				let taskCompleted = false
				let errorOccurred: string | null = null
				let applyDiffExecuted = false

				const verification = createVerificationState()

				let taskId: string = ""
				const messageHandler = createNativeVerificationHandler(verification, messages, {
					onError: (error) => {
						errorOccurred = error
					},
					onApplyDiffExecuted: () => {
						applyDiffExecuted = true
					},
					debugLogging: true,
				})
				const taskStartedHandler = (id: string) => {
					if (id === taskId) taskStarted = true
				}
				const taskCompletedHandler = (id: string) => {
					if (id === taskId) taskCompleted = true
				}
				api.on(RooCodeEventName.Message, messageHandler)
				api.on(RooCodeEventName.TaskStarted, taskStartedHandler)
				api.on(RooCodeEventName.TaskCompleted, taskCompletedHandler)

				let verboseLog = ""
				function logMsg(msg: string) {
					verboseLog += msg + "\n"
				}
				try {
					console.log(variable.openRouterModelId)
					taskId = await api.startNewTask({
						configuration: {
							mode: "code",
							autoApprovalEnabled: true,
							alwaysAllowWrite: true,
							alwaysAllowReadOnly: true,
							alwaysAllowReadOnlyOutsideWorkspace: true,
							toolProtocol: "native",
							apiProvider: "openrouter",
							openRouterModelId: variable.openRouterModelId,
						},
						text: `Use apply_diff on the file ${file.name} to change "Hello World" to "Hello Universe". The file already exists with this content:\n${file.content}\nAssume the file exists and you can modify it directly.`,
					})
					await waitFor(() => taskStarted, { timeout: 60000 })
					if (errorOccurred) {
						logMsg("Task failed early with error: " + errorOccurred)
						throw createVerboseError("Early error: " + errorOccurred, verboseLog, messages)
					}
					await waitFor(() => taskCompleted, { timeout: 60000 })
					await sleep(2000)
					const actualContent = await fs.readFile(
						file.path || path.join(getTestWorkspaceDir(), file.name),
						"utf-8",
					)
					try {
						assert.strictEqual(
							actualContent.trim(),
							expectedContent.trim(),
							"File was not modified by extension and diff!",
						)
					} catch (e) {
						logMsg("File content did not match expected output.")
						logMsg("Expected:\n" + expectedContent)
						logMsg("Actual:\n" + actualContent)
						throw createVerboseError(e instanceof Error ? e.message : String(e), verboseLog, messages)
					}

					assertNativeProtocolUsed(verification, "simpleModify")

					if (!applyDiffExecuted) {
						logMsg("apply_diff tool was not executed!")
						throw createVerboseError("apply_diff tool was not executed!", verboseLog, messages)
					}
				} catch (err) {
					if (verboseLog || messages.length > 0) {
						const lines = [
							"",
							"========== DEBUG LOG ==========",
							verboseLog.trim(),
							"---------- Message History ----------",
							...messages.map((m) => JSON.stringify(m)),
							"=====================================",
						]
						console.error(lines.filter(Boolean).join("\n"))
					}
					throw err
				} finally {
					api.off(RooCodeEventName.Message, messageHandler)
					api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
					api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
					await removeTestFile(file)
				}

				function createVerboseError(text: string, log: string, msgArr: ClineMessage[]): Error {
					let summary = `\n\n========== DEBUG LOG ==========`
					if (log) summary += `\n${log.trim()}`
					summary +=
						`\n---------- Message History ----------\n` + msgArr.map((m) => JSON.stringify(m)).join("\n")
					summary += `\n=====================================`
					return new Error(text + summary)
				}
			})
			it("Should apply multiple search/replace blocks in single diff using native tool calling", async function ({
				variable,
			}) {
				const api = (globalThis as { api?: RooCodeAPI }).api as RooCodeAPI
				const messages: ClineMessage[] = []
				const testFile = testFiles.multipleReplace
				if (!testFile) {
					throw new Error("Missing test file definition: multipleReplace")
				}
				const expectedContent =
					"function compute(a, b) {\n" +
					"  const total = a + b\n" +
					"  const result = a * b\n" +
					"  return { total: total, result: result }\n" +
					"}"
				let taskStarted = false
				let taskCompleted = false
				let applyDiffExecuted = false

				const verification = createVerificationState()

				const messageHandler = createNativeVerificationHandler(verification, messages, {
					onApplyDiffExecuted: () => {
						applyDiffExecuted = true
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
							openRouterModelId: variable.openRouterModelId,
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

					await waitFor(() => taskStarted, { timeout: 60_000 })

					await waitFor(() => taskCompleted, { timeout: 60_000 })

					await sleep(2000)

					const actualContent = await fs.readFile(testFile.path, "utf-8")
					console.log("File content after modification:", actualContent)

					assertNativeProtocolUsed(verification, "multipleReplace")

					assert.strictEqual(applyDiffExecuted, true, "apply_diff tool should have been executed")

					assert.strictEqual(
						actualContent.trim(),
						expectedContent.trim(),
						"All replacements should be applied correctly",
					)

					console.log(
						"Test passed! apply_diff tool executed with VERIFIED native protocol and multiple replacements applied successfully",
					)
				} finally {
					api.off(RooCodeEventName.Message, messageHandler)
					api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
					api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
				}
			})
			it("Should handle apply_diff with line number hints using native tool calling", async function ({
				variable,
			}) {
				const api = (globalThis as { api?: RooCodeAPI }).api as RooCodeAPI
				const messages: ClineMessage[] = []
				const testFile = testFiles.lineNumbers
				if (!testFile) {
					throw new Error("Missing test file definition: lineNumbers")
				}
				const expectedContent =
					"// Header comment\n" +
					"function newFunction() {\n" +
					'  console.log("New implementation")\n' +
					"}\n" +
					"\n" +
					"// Another function\n" +
					"function keepThis() {\n" +
					'  console.log("Keep this")\n' +
					"}\n" +
					"\n" +
					"// Footer comment"

				let taskStarted = false
				let taskCompleted = false
				let applyDiffExecuted = false

				const verification = createVerificationState()

				const messageHandler = createNativeVerificationHandler(verification, messages, {
					onApplyDiffExecuted: () => {
						applyDiffExecuted = true
					},
					debugLogging: true,
				})
				api.on(RooCodeEventName.Message, messageHandler)

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
					taskId = await api.startNewTask({
						configuration: {
							mode: "code",
							autoApprovalEnabled: true,
							alwaysAllowWrite: true,
							alwaysAllowReadOnly: true,
							alwaysAllowReadOnlyOutsideWorkspace: true,
							toolProtocol: "native",
							apiProvider: "openrouter",
							openRouterModelId: variable.openRouterModelId,
						},
						text: `Use apply_diff on the file ${testFile.name} to change "oldFunction" to "newFunction" and update its console.log to "New implementation". Keep the rest of the file unchanged.

The file already exists with this content:
${testFile.content}

Assume the file exists and you can modify it directly.`,
					})

					console.log("Task ID:", taskId)
					console.log("Test filename:", testFile.name)

					await waitFor(() => taskStarted, { timeout: 60_000 })

					await waitFor(() => taskCompleted, { timeout: 60_000 })

					await sleep(2000)

					const actualContent = await fs.readFile(testFile.path, "utf-8")
					console.log("File content after modification:", actualContent)

					assertNativeProtocolUsed(verification, "lineNumbers")

					assert.strictEqual(applyDiffExecuted, true, "apply_diff tool should have been executed")

					assert.strictEqual(
						actualContent.trim(),
						expectedContent.trim(),
						"Only specified function should be modified",
					)

					console.log(
						"Test passed! apply_diff tool executed with VERIFIED native protocol and targeted modification successful",
					)
				} finally {
					api.off(RooCodeEventName.Message, messageHandler)
					api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
					api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
				}
			})
			it("Should handle apply_diff errors gracefully using native tool calling", async function ({ variable }) {
				const api = (globalThis as { api?: RooCodeAPI }).api as RooCodeAPI
				const messages: ClineMessage[] = []
				const testFile = testFiles.errorHandling
				if (!testFile) {
					throw new Error("Missing test file definition: errorHandling")
				}
				let taskStarted = false
				let taskCompleted = false
				let errorDetected = false
				let applyDiffAttempted = false
				let writeToFileUsed = false

				const messageHandler = ({ message }: { message: ClineMessage }) => {
					messages.push(message)

					if (message.type === "say" && message.say === "error") {
						errorDetected = true
						console.log("Error detected:", message.text)
					}

					if (message.type === "ask" && message.ask === "tool") {
						console.log("Tool ASK request:", message.text?.substring(0, 500))
						try {
							const toolData = JSON.parse(message.text || "{}")
							if (toolData.tool === "appliedDiff") {
								applyDiffAttempted = true
								console.log("apply_diff tool attempted via ASK!")
							}
							if (toolData.tool === "editedExistingFile" || toolData.tool === "newFileCreated") {
								writeToFileUsed = true
								console.log("write_to_file tool used!")
							}
						} catch (e) {
							console.error(e)
						}
					}

					if (message.type === "say" && message.say === "diff_error") {
						applyDiffAttempted = true
						console.log("diff_error detected - apply_diff was attempted")
					}

					if (message.type === "say" && message.say === "api_req_started" && message.text) {
						console.log("API request started:", message.text.substring(0, 200))
					}
				}
				api.on(RooCodeEventName.Message, messageHandler)

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
					taskId = await api.startNewTask({
						configuration: {
							mode: "code",
							autoApprovalEnabled: true,
							alwaysAllowWrite: true,
							alwaysAllowReadOnly: true,
							alwaysAllowReadOnlyOutsideWorkspace: true,
							reasoningEffort: "none",
							toolProtocol: "native",
							apiProvider: "openrouter",
							openRouterModelId: variable.openRouterModelId,
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
					await waitFor(() => taskStarted, { timeout: 90_000 })

					await waitFor(() => taskCompleted || errorDetected, { timeout: 90_000 })

					await sleep(2000)

					const actualContent = await fs.readFile(testFile.path, "utf-8")
					console.log("File content after task:", actualContent)
					console.log("applyDiffAttempted:", applyDiffAttempted)
					console.log("writeToFileUsed:", writeToFileUsed)

					assert.strictEqual(applyDiffAttempted, true, "apply_diff tool should have been attempted")

					assert.strictEqual(
						writeToFileUsed,
						false,
						"write_to_file should NOT be used when apply_diff fails - the AI should report the error instead",
					)

					assert.strictEqual(
						actualContent.trim(),
						testFile.content.trim(),
						"File content should remain unchanged when search pattern not found",
					)

					console.log("Test passed! apply_diff attempted with native protocol and error handled gracefully")
				} finally {
					api.off(RooCodeEventName.Message, messageHandler)
					api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
					api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
				}
			})
			it("Should apply multiple search/replace blocks to edit two separate functions using native tool calling", async function ({
				variable,
			}) {
				const api = (globalThis as { api?: RooCodeAPI }).api as RooCodeAPI
				const messages: ClineMessage[] = []
				const testFile = testFiles.multiSearchReplace
				if (!testFile) {
					throw new Error("Missing test file definition: multiSearchReplace")
				}
				const expectedContent =
					"function transformData(data) {\n" +
					'  console.log("Transforming data")\n' +
					"  return data.map(item => item * 2)\n" +
					"}\n" +
					"\n" +
					"// Some other code in between\n" +
					"const config = {\n" +
					"  timeout: 5000,\n" +
					"  retries: 3\n" +
					"}\n" +
					"\n" +
					"function checkInput(input) {\n" +
					'  console.log("Checking input")\n' +
					"  if (!input) {\n" +
					'    throw new Error("Invalid input")\n' +
					"  }\n" +
					"  return true\n" +
					"}"
				let taskStarted = false
				let taskCompleted = false
				let errorOccurred: string | null = null
				let applyDiffExecuted = false
				let applyDiffCount = 0

				const verification = createVerificationState()

				const messageHandler = ({ message }: { message: ClineMessage }) => {
					messages.push(message)

					if (message.type === "say" && message.say === "error") {
						errorOccurred = message.text || "Unknown error"
						console.error("Error:", message.text)
					}
					if (message.type === "ask" && message.ask === "tool") {
						console.log("Tool request:", message.text?.substring(0, 200))
						try {
							const toolData = JSON.parse(message.text || "{}")
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
							void _e
						}
					}
					if (message.type === "say" && (message.say === "completion_result" || message.say === "text")) {
						console.log("AI response:", message.text?.substring(0, 200))
						if (message.say === "text" && message.text) {
							const hasXMLToolTags =
								message.text.includes("<apply_diff>") || message.text.includes("</apply_diff>")
							if (hasXMLToolTags) {
								verification.responseIsNotXML = false
								console.log("[WARNING] Found XML tool tags in response")
							}
						}
					}

					if (message.type === "say" && message.say === "api_req_started" && message.text) {
						console.log("API request started:", message.text.substring(0, 200))
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
							console.log("Failed to parse api_req_started message:", e)
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
							openRouterModelId: variable.openRouterModelId,
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

					await waitFor(() => taskStarted, { timeout: 60_000 })

					if (errorOccurred) {
						console.error("Early error detected:", errorOccurred)
					}

					await waitFor(() => taskCompleted, { timeout: 60_000 })

					await sleep(2000)

					const actualContent = await fs.readFile(testFile.path, "utf-8")
					console.log("File content after modification:", actualContent)

					assertNativeProtocolUsed(verification, "multiSearchReplace")

					assert.strictEqual(applyDiffExecuted, true, "apply_diff tool should have been executed")
					console.log(`apply_diff was executed ${applyDiffCount} time(s)`)

					assert.strictEqual(
						actualContent.trim(),
						expectedContent.trim(),
						"Both functions should be modified with separate search/replace blocks",
					)

					console.log(
						"Test passed! apply_diff tool executed with VERIFIED native protocol and multiple search/replace blocks applied successfully",
					)
				} finally {
					api.off(RooCodeEventName.Message, messageHandler)
					api.off(RooCodeEventName.TaskStarted, taskStartedHandler)
					api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
				}
			})
		})
	},
})

async function resetAllTestFiles() {
	for (const file of Object.values(testFiles)) {
		await resetTestFile(file)
	}
}
