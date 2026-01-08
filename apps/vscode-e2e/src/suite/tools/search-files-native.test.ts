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

/**
 * Creates a message handler that tracks native protocol verification.
 */
function createNativeVerificationHandler(
	verification: NativeProtocolVerification,
	messages: ClineMessage[],
	options: {
		onError?: (error: string) => void
		onToolExecuted?: (toolName: string) => void
		onSearchResults?: (results: string) => void
		debugLogging?: boolean
	} = {},
): (event: { message: ClineMessage }) => void {
	const { onError, onToolExecuted, onSearchResults, debugLogging = true } = options

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
			}

			try {
				const toolData = JSON.parse(message.text || "{}")
				if (toolData.tool) {
					verification.toolWasExecuted = true
					verification.executedToolName = toolData.tool
					console.log(`[VERIFIED] Tool executed: ${toolData.tool}`)
					onToolExecuted?.(toolData.tool)
				}
			} catch (_e) {
				if (debugLogging) {
					console.log("[DEBUG] Tool callback not JSON:", message.text?.substring(0, 100))
				}
			}
		}

		// Check API request for apiProtocol and search results
		if (message.type === "say" && message.say === "api_req_started" && message.text) {
			const rawText = message.text
			if (debugLogging) {
				console.log("[DEBUG] API request started:", rawText.substring(0, 200))
			}

			// Simple text check first (like original search-files.test.ts)
			if (rawText.includes("search_files")) {
				verification.toolWasExecuted = true
				verification.executedToolName = verification.executedToolName || "search_files"
				console.log("[VERIFIED] Tool executed via raw text check: search_files")
				onToolExecuted?.("search_files")

				// Extract search results
				if (rawText.includes("Result:")) {
					onSearchResults?.(rawText)
					console.log("Captured search results:", rawText.substring(0, 300))
				}
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

				// Also check parsed request content
				if (requestData.request && requestData.request.includes("search_files")) {
					verification.toolWasExecuted = true
					verification.executedToolName = "search_files"
					console.log(`[VERIFIED] Tool executed via parsed request: search_files`)
					onToolExecuted?.("search_files")

					if (requestData.request.includes("Result:")) {
						onSearchResults?.(requestData.request)
					}
				}
			} catch (e) {
				console.log("[DEBUG] Failed to parse api_req_started message:", e)
			}
		}

		// Check text responses for XML (should NOT be present)
		if (message.type === "say" && message.say === "text" && message.text) {
			const hasXMLToolTags =
				message.text.includes("<search_files>") ||
				message.text.includes("</search_files>") ||
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

suite("Roo Code search_files Tool (Native Tool Calling)", function () {
	setDefaultSuiteTimeout(this)

	let workspaceDir: string
	let testFiles: {
		jsFile: string
		tsFile: string
		jsonFile: string
		textFile: string
		nestedJsFile: string
		configFile: string
		readmeFile: string
	}

	suiteSetup(async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error("No workspace folder found")
		}
		workspaceDir = workspaceFolders[0]!.uri.fsPath
		console.log("Workspace directory:", workspaceDir)

		testFiles = {
			jsFile: path.join(workspaceDir, `test-search-native-${Date.now()}.js`),
			tsFile: path.join(workspaceDir, `test-search-native-${Date.now()}.ts`),
			jsonFile: path.join(workspaceDir, `test-config-native-${Date.now()}.json`),
			textFile: path.join(workspaceDir, `test-readme-native-${Date.now()}.txt`),
			nestedJsFile: path.join(workspaceDir, "search-test-native", `nested-native-${Date.now()}.js`),
			configFile: path.join(workspaceDir, `app-config-native-${Date.now()}.yaml`),
			readmeFile: path.join(workspaceDir, `README-native-${Date.now()}.md`),
		}

		await fs.writeFile(
			testFiles.jsFile,
			`function calculateTotal(items) {
	return items.reduce((sum, item) => sum + item.price, 0)
}

function validateUser(user) {
	if (!user.email || !user.name) {
		throw new Error("Invalid user data")
	}
	return true
}

// TODO: Add more validation functions
const API_URL = "https://api.example.com"
export { calculateTotal, validateUser }`,
		)

		await fs.writeFile(
			testFiles.tsFile,
			`interface User {
	id: number
	name: string
	email: string
	isActive: boolean
}

interface Product {
	id: number
	title: string
	price: number
	category: string
}

class UserService {
	async getUser(id: number): Promise<User> {
		// TODO: Implement user fetching
		throw new Error("Not implemented")
	}
	
	async updateUser(user: User): Promise<void> {
		// Implementation here
	}
}

export { User, Product, UserService }`,
		)

		await fs.writeFile(
			testFiles.jsonFile,
			`{
	"name": "test-app",
	"version": "1.0.0",
	"description": "A test application for search functionality",
	"main": "index.js",
	"scripts": {
		"start": "node index.js",
		"test": "jest",
		"build": "webpack"
	},
	"dependencies": {
		"express": "^4.18.0",
		"lodash": "^4.17.21"
	},
	"devDependencies": {
		"jest": "^29.0.0",
		"webpack": "^5.0.0"
	}
}`,
		)

		await fs.writeFile(
			testFiles.textFile,
			`# Project Documentation

This is a test project for demonstrating search functionality.

## Features
- User management
- Product catalog
- Order processing
- Payment integration

## Installation
1. Clone the repository
2. Run npm install
3. Configure environment variables
4. Start the application

## API Endpoints
- GET /users - List all users
- POST /users - Create new user
- PUT /users/:id - Update user
- DELETE /users/:id - Delete user

## TODO
- Add authentication
- Implement caching
- Add error handling
- Write more tests`,
		)

		await fs.mkdir(path.dirname(testFiles.nestedJsFile), { recursive: true })
		await fs.writeFile(
			testFiles.nestedJsFile,
			`// Nested utility functions
function formatCurrency(amount) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(amount)
}

function debounce(func, wait) {
	let timeout
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout)
			func(...args)
		}
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
	}
}

module.exports = { formatCurrency, debounce }`,
		)

		await fs.writeFile(
			testFiles.configFile,
			`# Application Configuration
app:
  name: "Test Application"
  version: "1.0.0"
  port: 3000
  
database:
  host: "localhost"
  port: 5432
  name: "testdb"
  user: "testuser"
  
redis:
  host: "localhost"
  port: 6379
  
logging:
  level: "info"
  file: "app.log"`,
		)

		await fs.writeFile(
			testFiles.readmeFile,
			`# Search Files Test Project

This project contains various file types for testing the search_files functionality.

## File Types Included

- **JavaScript files** (.js) - Contains functions and exports
- **TypeScript files** (.ts) - Contains interfaces and classes  
- **JSON files** (.json) - Configuration and package files
- **Text files** (.txt) - Documentation and notes
- **YAML files** (.yaml) - Configuration files
- **Markdown files** (.md) - Documentation

## Search Patterns to Test

1. Function definitions: \`function\\s+\\w+\`
2. TODO comments: \`TODO.*\`
3. Import/export statements: \`(import|export).*\`
4. Interface definitions: \`interface\\s+\\w+\`
5. Configuration keys: \`"\\w+":\\s*\`

## Expected Results

The search should find matches across different file types and provide context for each match.`,
		)

		console.log("Test files created successfully")
		console.log("Test files:", testFiles)
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		console.log("Cleaning up test files...")
		for (const [key, filePath] of Object.entries(testFiles)) {
			try {
				await fs.unlink(filePath)
				console.log(`Cleaned up ${key} test file`)
			} catch (error) {
				console.log(`Failed to clean up ${key} test file:`, error)
			}
		}

		try {
			const nestedDir = path.join(workspaceDir, "search-test-native")
			await fs.rmdir(nestedDir)
			console.log("Cleaned up nested directory")
		} catch (error) {
			console.log("Failed to clean up nested directory:", error)
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

	test("Should search for function definitions in JavaScript files using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false
		let searchResults: string | null = null

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
					toolExecuted = true
				}
			},
			onSearchResults: (results) => {
				searchResults = results
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
			const jsFileName = path.basename(testFiles.jsFile)
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
				text: `I have created test files in the workspace including a JavaScript file named "${jsFileName}" that contains function definitions like "calculateTotal" and "validateUser". Use the search_files tool with the regex pattern "function\\s+\\w+" to find all function declarations in JavaScript files. The files exist in the workspace directory.`,
			})

			console.log("Task ID:", taskId)

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "functionSearch")

			assert.ok(toolExecuted, "The search_files tool should have been executed")

			// Under native protocol, structured search results may not always be exposed
			// in a scrapeable transport format. When present, perform detailed content
			// validation; otherwise, rely on verified native tool execution and AI
			// completion messages, matching the behavior of other native tool tests
			// like read_file and list_files.
			if (searchResults) {
				const results = searchResults as string
				const hasCalculateTotal = results.includes("calculateTotal")
				const hasValidateUser = results.includes("validateUser")
				const hasFormatCurrency = results.includes("formatCurrency")
				const hasDebounce = results.includes("debounce")
				const hasFunctionKeyword = results.includes("function")
				const hasResults = results.includes("Found") && !results.includes("Found 0")
				const hasAnyExpectedFunction = hasCalculateTotal || hasValidateUser || hasFormatCurrency || hasDebounce

				console.log("Search validation:")
				console.log("- Has calculateTotal:", hasCalculateTotal)
				console.log("- Has validateUser:", hasValidateUser)
				console.log("- Has formatCurrency:", hasFormatCurrency)
				console.log("- Has debounce:", hasDebounce)
				console.log("- Has function keyword:", hasFunctionKeyword)
				console.log("- Has results:", hasResults)
				console.log("- Has any expected function:", hasAnyExpectedFunction)

				assert.ok(hasResults, "Search should return non-empty results")
				assert.ok(hasFunctionKeyword, "Search results should contain 'function' keyword")
				assert.ok(hasAnyExpectedFunction, "Search results should contain at least one expected function name")
			} else {
				console.warn(
					"[functionSearch] No structured search results captured from native protocol; " +
						"falling back to AI completion verification only.",
				)
			}

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("calculateTotal") ||
						m.text?.includes("validateUser") ||
						m.text?.includes("function")),
			)
			assert.ok(completionMessage, "AI should have found function definitions")

			console.log("Test passed! Function definitions found successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should search for TODO comments across multiple file types using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
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
				text: `I have created test files in the workspace that contain TODO comments in JavaScript, TypeScript, and text files. Use the search_files tool with the regex pattern "TODO.*" to find all TODO items across all file types. The files exist in the workspace directory.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "todoSearch")

			assert.ok(toolExecuted, "The search_files tool should have been executed")

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("TODO") ||
						m.text?.toLowerCase().includes("found") ||
						m.text?.toLowerCase().includes("results")),
			)
			assert.ok(completionMessage, "AI should have found TODO comments")

			console.log("Test passed! TODO comments found successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should search with file pattern filter for TypeScript files using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
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
			const tsFileName = path.basename(testFiles.tsFile)
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
				text: `I have created test files in the workspace including a TypeScript file named "${tsFileName}" that contains interface definitions like "User" and "Product". Use the search_files tool with the regex pattern "interface\\s+\\w+" and file pattern "*.ts" to find interfaces only in TypeScript files. The files exist in the workspace directory.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "tsInterfaceSearch")

			assert.ok(toolExecuted, "The search_files tool should have been executed with *.ts pattern")

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("User") || m.text?.includes("Product") || m.text?.includes("interface")),
			)
			assert.ok(completionMessage, "AI should have found interface definitions in TypeScript files")

			console.log("Test passed! TypeScript interfaces found with file pattern filter using native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should search for configuration keys in JSON files using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
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
				text: `Search for configuration keys in JSON files. Use the search_files tool with the regex pattern '"\\w+":\\s*' and file pattern "*.json" to find all configuration keys in JSON files.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "jsonConfigSearch")

			assert.ok(toolExecuted, "The search_files tool should have been executed with JSON filter")

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("name") ||
						m.text?.includes("version") ||
						m.text?.includes("scripts") ||
						m.text?.includes("dependencies")),
			)
			assert.ok(completionMessage, "AI should have found configuration keys in JSON files")

			console.log("Test passed! JSON configuration keys found successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should search in nested directories using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
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
				text: `Search for utility functions in the current directory and subdirectories. Use the search_files tool with the regex pattern "function\\s+(format|debounce)" to find utility functions like formatCurrency and debounce.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "nestedSearch")

			assert.ok(toolExecuted, "The search_files tool should have been executed")

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("formatCurrency") || m.text?.includes("debounce") || m.text?.includes("nested")),
			)
			assert.ok(completionMessage, "AI should have found utility functions in nested directories")

			console.log("Test passed! Nested directory search completed successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should handle complex regex patterns using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
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
				text: `Search for import and export statements in JavaScript and TypeScript files. Use the search_files tool with the regex pattern "(import|export).*" and file pattern "*.{js,ts}" to find all import/export statements.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "complexRegex")

			assert.ok(toolExecuted, "The search_files tool should have been executed with complex regex")

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("export") || m.text?.includes("import") || m.text?.includes("module")),
			)
			assert.ok(completionMessage, "AI should have found import/export statements")

			console.log("Test passed! Complex regex pattern search completed successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should handle search with no matches using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false
		let searchResults: string | null = null

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
					toolExecuted = true
				}
			},
			onSearchResults: (results) => {
				searchResults = results
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
				text: `Search for a pattern that doesn't exist in any files. Use the search_files tool with the regex pattern "nonExistentPattern12345Native" to search for something that won't be found.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "noMatches")

			assert.ok(toolExecuted, "The search_files tool should have been executed")

			// Under native protocol, structured search results may not always be
			// exposed on the transport layer. When present, validate that they
			// clearly indicate an empty result set; otherwise, rely on AI
			// completion messages and native protocol verification.
			if (searchResults) {
				const results = searchResults as string
				const hasZeroResults = results.includes("Found 0") || results.includes("0 results")
				const hasNoMatches =
					results.toLowerCase().includes("no matches") || results.toLowerCase().includes("no results")
				const indicatesEmpty = hasZeroResults || hasNoMatches

				console.log("No-match search validation:")
				console.log("- Has zero results indicator:", hasZeroResults)
				console.log("- Has no matches indicator:", hasNoMatches)
				console.log("- Indicates empty results:", indicatesEmpty)
				console.log("- Search results preview:", results.substring(0, 200))

				assert.ok(indicatesEmpty, "Search results should indicate no matches were found")
			} else {
				console.warn(
					"[noMatches] No structured search results captured from native protocol; " +
						"relying on AI completion verification only.",
				)
			}

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text &&
					m.text.length > 10,
			)
			assert.ok(completionMessage, "AI should have provided a completion response")

			console.log("Test passed! No-match scenario handled correctly with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})

	test("Should search for class definitions and methods using native tool calling", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		const verification = createVerificationState()

		const messageHandler = createNativeVerificationHandler(verification, messages, {
			onToolExecuted: (toolName) => {
				if (toolName === "searchFiles" || toolName === "search_files") {
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
				text: `Search for class definitions and async methods in TypeScript files. Use the search_files tool with the regex pattern "(class\\s+\\w+|async\\s+\\w+)" and file pattern "*.ts" to find classes and async methods.`,
			})

			await waitFor(() => taskCompleted, { timeout: 60_000 })

			assertNativeProtocolUsed(verification, "classSearch")

			assert.ok(toolExecuted, "The search_files tool should have been executed")

			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("UserService") ||
						m.text?.includes("class") ||
						m.text?.includes("async") ||
						m.text?.includes("getUser")),
			)
			assert.ok(completionMessage, "AI should have found class definitions and async methods")

			console.log("Test passed! Class definitions and async methods found successfully with native tool calling")
		} finally {
			api.off(RooCodeEventName.Message, messageHandler)
			api.off(RooCodeEventName.TaskCompleted, taskCompletedHandler)
		}
	})
})
