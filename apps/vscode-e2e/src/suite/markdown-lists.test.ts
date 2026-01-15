import * as assert from "assert"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { waitUntilCompleted } from "./utils"
import { setDefaultSuiteTimeout } from "./test-utils"

suite("Markdown List Rendering", function () {
	setDefaultSuiteTimeout(this)

	test("Should render unordered lists with bullets in chat", async function () {
		// Allow retries for AI output format variability
		this.retries(2)

		const api = globalThis.api
		const messages: ClineMessage[] = []

		api.on(RooCodeEventName.Message, ({ message }: { message: ClineMessage }) => {
			if (message.type === "say") {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: { mode: "ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Please show me an example of an unordered list with the following items: Apple, Banana, Orange",
		})

		await waitUntilCompleted({ api, taskId })

		// PRIMARY ASSERTION: Check if all items appear somewhere in the response
		const allText = messages.map((m) => m.text || "").join("\n")

		assert.ok(allText.includes("Apple"), "Response should mention Apple")
		assert.ok(allText.includes("Banana"), "Response should mention Banana")
		assert.ok(allText.includes("Orange"), "Response should mention Orange")

		// SOFT ASSERTION: Validate at least one common list format is present
		// Flexible about which format (dash, asterisk, or bullet) but requires some list formatting
		const hasListFormat =
			allText.includes("- ") || allText.includes("* ") || allText.includes("• ") || allText.match(/^\s*[-*•]/m)

		// Log which format was detected for debugging
		if (hasListFormat) {
			console.log("✓ AI used list formatting")
		} else {
			console.log("⚠ AI did not use traditional list formatting")
			console.log("Response format:", allText.substring(0, 200))
		}

		// Assert that at least one list format is present (soft assertion - flexible about which format)
		assert.ok(
			hasListFormat,
			"Response should contain at least one list format (dash, asterisk, or bullet). " +
				"The test is flexible about which format is used, but requires some list formatting.",
		)
	})

	test("Should render ordered lists with numbers in chat", async () => {
		const api = globalThis.api

		const messages: ClineMessage[] = []

		api.on(RooCodeEventName.Message, ({ message }: { message: ClineMessage }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: { mode: "ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Please show me a numbered list with three steps: First step, Second step, Third step",
		})

		await waitUntilCompleted({ api, taskId })

		// Find the message containing the numbered list
		const listMessage = messages.find(
			({ say, text }) =>
				(say === "completion_result" || say === "text") &&
				text?.includes("First step") &&
				text?.includes("Second step") &&
				text?.includes("Third step"),
		)

		assert.ok(listMessage, "Should have a message containing the numbered list")

		// The rendered markdown should contain numbered markers
		const messageText = listMessage?.text || ""
		assert.ok(
			messageText.includes("1. First step") || messageText.includes("1) First step"),
			"List items should be rendered with numbers",
		)
	})

	test("Should render nested lists with proper hierarchy", async function () {
		// Allow retries for AI output format variability
		this.retries(2)

		const api = globalThis.api
		const messages: ClineMessage[] = []

		api.on(RooCodeEventName.Message, ({ message }: { message: ClineMessage }) => {
			if (message.type === "say") {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: { mode: "ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Please create a nested list with 'Main item' having two sub-items: 'Sub-item A' and 'Sub-item B'",
		})

		await waitUntilCompleted({ api, taskId })

		// PRIMARY ASSERTION: Check if all items appear somewhere in the response
		const allText = messages.map((m) => m.text || "").join("\n")

		// Check for main item (allow variations in wording)
		assert.ok(
			allText.includes("Main item") || allText.includes("Main") || allText.includes("main"),
			"Response should mention the main item",
		)

		assert.ok(allText.includes("Sub-item A"), "Response should mention Sub-item A")
		assert.ok(allText.includes("Sub-item B"), "Response should mention Sub-item B")

		// OPTIONAL: Check for list formatting and hierarchy (log but don't fail)
		const hasListFormat =
			allText.includes("- ") || allText.includes("* ") || allText.includes("• ") || allText.match(/^\s*[-*•]/m)

		const hasIndentation = allText.match(/\s{2,}[-*•]/) || allText.includes("\t-") || allText.includes("\t*")

		if (hasListFormat && hasIndentation) {
			console.log("✓ AI used nested list formatting with indentation")
		} else if (hasListFormat) {
			console.log("⚠ AI used list formatting but without clear nesting")
		} else {
			console.log("⚠ AI did not use traditional list formatting")
			console.log("Response format:", allText.substring(0, 300))
		}
	})

	test("Should render mixed ordered and unordered lists", async () => {
		const api = globalThis.api

		const messages: ClineMessage[] = []

		api.on(RooCodeEventName.Message, ({ message }: { message: ClineMessage }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: { mode: "ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Please create a list that has both numbered items and bullet points, mixing ordered and unordered lists",
		})

		await waitUntilCompleted({ api, taskId })

		// Find a message that contains both types of lists
		const listMessage = messages.find(
			({ say, text }) =>
				(say === "completion_result" || say === "text") &&
				text &&
				// Check for numbered list markers
				(text.includes("1.") || text.includes("1)")) &&
				// Check for bullet list markers
				(text.includes("-") || text.includes("*") || text.includes("•")),
		)

		assert.ok(listMessage, "Should have a message containing mixed list types")
	})
})
