import { render } from "@testing-library/react"
import { ChatLexicalTextArea } from "../ChatLexicalTextArea"
import { vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"

// Mock the vscode module
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the extension state context
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		filePaths: [],
		openedTabs: [],
		currentApiConfigName: "test-config",
		listApiConfigMeta: [{ id: "1", name: "test-config" }],
		customModes: [],
		customModePrompts: {},
		cwd: "/test",
		pinnedApiConfigs: [],
		togglePinnedApiConfig: vi.fn(),
		taskHistory: [],
		clineMessages: [],
		commands: [],
	}),
}))

// Mock the translation context
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock material icons
vi.mock("vscode-material-icons", () => ({
	getIconForFilePath: vi.fn(() => "file-icon"),
	getIconUrlByName: vi.fn(() => "icon-url"),
}))

describe("ChatLexicalTextArea - Select All Functionality", () => {
	const defaultProps = {
		inputValue: "Test content in the editor",
		setInputValue: vi.fn(),
		sendingDisabled: false,
		selectApiConfigDisabled: false,
		placeholderText: "Type a message...",
		selectedImages: [],
		setSelectedImages: vi.fn(),
		onSend: vi.fn(),
		onSelectImages: vi.fn(),
		shouldDisableImages: false,
		mode: "code" as any,
		setMode: vi.fn(),
		modeShortcutText: "Cmd+1",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Mock window.MATERIAL_ICONS_BASE_URI
		Object.defineProperty(window, "MATERIAL_ICONS_BASE_URI", {
			value: "test-uri",
			writable: true,
		})
	})

	it("should render without crashing with LexicalSelectAllPlugin", () => {
		const { container } = render(
			<TooltipProvider>
				<ChatLexicalTextArea {...defaultProps} />
			</TooltipProvider>,
		)

		const contentEditable = container.querySelector('[contenteditable="true"]')
		expect(contentEditable).toBeTruthy()
	})

	it("should handle keyboard events properly", () => {
		const { container } = render(
			<TooltipProvider>
				<ChatLexicalTextArea {...defaultProps} />
			</TooltipProvider>,
		)

		const contentEditable = container.querySelector('[contenteditable="true"]') as HTMLElement
		expect(contentEditable).toBeTruthy()

		// Mock focus state
		Object.defineProperty(document, "activeElement", {
			value: contentEditable,
			writable: true,
		})
		contentEditable.contains = vi.fn().mockReturnValue(true)

		// Simulate Cmd+A - should not throw any errors
		const event = new KeyboardEvent("keydown", {
			key: "a",
			metaKey: true,
			bubbles: true,
			cancelable: true,
		})

		expect(() => {
			document.dispatchEvent(event)
		}).not.toThrow()
	})

	it("should not interfere with other keyboard shortcuts", () => {
		const { container } = render(
			<TooltipProvider>
				<ChatLexicalTextArea {...defaultProps} />
			</TooltipProvider>,
		)

		const contentEditable = container.querySelector('[contenteditable="true"]') as HTMLElement
		expect(contentEditable).toBeTruthy()

		// Mock focus state
		Object.defineProperty(document, "activeElement", {
			value: contentEditable,
			writable: true,
		})
		contentEditable.contains = vi.fn().mockReturnValue(true)

		// Simulate Cmd+B - should not interfere
		const event = new KeyboardEvent("keydown", {
			key: "b",
			metaKey: true,
			bubbles: true,
			cancelable: true,
		})

		expect(() => {
			document.dispatchEvent(event)
		}).not.toThrow()
	})
})
