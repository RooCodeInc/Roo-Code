import { render } from "@testing-library/react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { LexicalSelectAllPlugin } from "../LexicalSelectAllPlugin"

// Mock the $selectAll function
vi.mock("lexical", async () => {
	const actual = await vi.importActual("lexical")
	return {
		...actual,
		$selectAll: vi.fn(),
	}
})

describe("LexicalSelectAllPlugin", () => {
	const initialConfig = {
		namespace: "test-editor",
		nodes: [],
		onError: () => {},
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should handle Cmd+A keyboard shortcut", () => {
		const { container } = render(
			<LexicalComposer initialConfig={initialConfig}>
				<PlainTextPlugin
					contentEditable={<ContentEditable />}
					placeholder={<div>Placeholder</div>}
					ErrorBoundary={LexicalErrorBoundary}
				/>
				<LexicalSelectAllPlugin />
			</LexicalComposer>,
		)

		const contentEditable = container.querySelector('[contenteditable="true"]') as HTMLElement
		expect(contentEditable).toBeTruthy()

		// Mock document.activeElement to simulate focus
		Object.defineProperty(document, "activeElement", {
			value: contentEditable,
			writable: true,
		})

		// Mock contains method
		contentEditable.contains = vi.fn().mockReturnValue(true)

		const preventDefault = vi.fn()
		const stopPropagation = vi.fn()

		// Simulate Cmd+A
		const event = new KeyboardEvent("keydown", {
			key: "a",
			metaKey: true,
			bubbles: true,
			cancelable: true,
		})

		Object.defineProperty(event, "preventDefault", {
			value: preventDefault,
		})
		Object.defineProperty(event, "stopPropagation", {
			value: stopPropagation,
		})

		document.dispatchEvent(event)

		// Verify preventDefault and stopPropagation were called
		expect(preventDefault).toHaveBeenCalled()
		expect(stopPropagation).toHaveBeenCalled()
	})

	it("should handle Ctrl+A keyboard shortcut", () => {
		const { container } = render(
			<LexicalComposer initialConfig={initialConfig}>
				<PlainTextPlugin
					contentEditable={<ContentEditable />}
					placeholder={<div>Placeholder</div>}
					ErrorBoundary={LexicalErrorBoundary}
				/>
				<LexicalSelectAllPlugin />
			</LexicalComposer>,
		)

		const contentEditable = container.querySelector('[contenteditable="true"]') as HTMLElement
		expect(contentEditable).toBeTruthy()

		// Mock document.activeElement to simulate focus
		Object.defineProperty(document, "activeElement", {
			value: contentEditable,
			writable: true,
		})

		// Mock contains method
		contentEditable.contains = vi.fn().mockReturnValue(true)

		const preventDefault = vi.fn()
		const stopPropagation = vi.fn()

		// Simulate Ctrl+A
		const event = new KeyboardEvent("keydown", {
			key: "a",
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		})

		Object.defineProperty(event, "preventDefault", {
			value: preventDefault,
		})
		Object.defineProperty(event, "stopPropagation", {
			value: stopPropagation,
		})

		document.dispatchEvent(event)

		// Verify preventDefault and stopPropagation were called
		expect(preventDefault).toHaveBeenCalled()
		expect(stopPropagation).toHaveBeenCalled()
	})

	it("should not interfere with other key combinations", () => {
		const { container } = render(
			<LexicalComposer initialConfig={initialConfig}>
				<PlainTextPlugin
					contentEditable={<ContentEditable />}
					placeholder={<div>Placeholder</div>}
					ErrorBoundary={LexicalErrorBoundary}
				/>
				<LexicalSelectAllPlugin />
			</LexicalComposer>,
		)

		const contentEditable = container.querySelector('[contenteditable="true"]')
		expect(contentEditable).toBeTruthy()

		// Focus the editor
		;(contentEditable as HTMLElement)?.focus()

		// Simulate Cmd+B (should not be intercepted)
		const event = new KeyboardEvent("keydown", {
			key: "b",
			metaKey: true,
			bubbles: true,
			cancelable: true,
		})

		Object.defineProperty(event, "preventDefault", {
			value: vi.fn(),
		})
		Object.defineProperty(event, "stopPropagation", {
			value: vi.fn(),
		})

		document.dispatchEvent(event)

		// Verify preventDefault and stopPropagation were NOT called
		expect(event.preventDefault).not.toHaveBeenCalled()
		expect(event.stopPropagation).not.toHaveBeenCalled()
	})

	it("should not interfere when editor is not focused", () => {
		render(
			<LexicalComposer initialConfig={initialConfig}>
				<PlainTextPlugin
					contentEditable={<ContentEditable />}
					placeholder={<div>Placeholder</div>}
					ErrorBoundary={LexicalErrorBoundary}
				/>
				<LexicalSelectAllPlugin />
			</LexicalComposer>,
		)

		// Don't focus the editor

		// Simulate Cmd+A
		const event = new KeyboardEvent("keydown", {
			key: "a",
			metaKey: true,
			bubbles: true,
			cancelable: true,
		})

		Object.defineProperty(event, "preventDefault", {
			value: vi.fn(),
		})
		Object.defineProperty(event, "stopPropagation", {
			value: vi.fn(),
		})

		document.dispatchEvent(event)

		// Verify preventDefault and stopPropagation were NOT called
		expect(event.preventDefault).not.toHaveBeenCalled()
		expect(event.stopPropagation).not.toHaveBeenCalled()
	})
})
