import { fireEvent, render, screen } from "@testing-library/react"
import { vi, describe, it, beforeEach } from "vitest"

import SettingsView from "../SettingsView"
import type { SearchResult } from "@/hooks/useSettingsSearch"
import type { SectionName } from "@/utils/parseSettingsI18nKeys"

const mockUseExtensionState = vi.fn()
const mockUseSettingsSearch = vi.fn<(query: string) => SearchResult[]>()

// Minimal ResizeObserver polyfill for jsdom
class ResizeObserverPolyfill {
	callback: ResizeObserverCallback
	constructor(callback: ResizeObserverCallback) {
		this.callback = callback
	}
	observe() {
		// no-op
	}
	disconnect() {
		// no-op
	}
}

const defaultExtensionState = {
	currentApiConfigName: "default",
	listApiConfigMeta: [],
	uriScheme: "vscode",
	settingsImportedAt: undefined as number | undefined,
	apiConfiguration: {},
	alwaysAllowReadOnly: false,
	alwaysAllowReadOnlyOutsideWorkspace: false,
	allowedCommands: [] as string[],
	deniedCommands: [] as string[],
	allowedMaxRequests: undefined as number | undefined,
	allowedMaxCost: undefined as number | undefined,
	language: "en",
	alwaysAllowBrowser: false,
	alwaysAllowExecute: false,
	alwaysAllowMcp: false,
	alwaysAllowModeSwitch: false,
	alwaysAllowSubtasks: false,
	alwaysAllowWrite: false,
	alwaysAllowWriteOutsideWorkspace: false,
	alwaysAllowWriteProtected: false,
	autoCondenseContext: false,
	autoCondenseContextPercent: 50,
	browserToolEnabled: true,
	browserViewportSize: "900x600",
	enableCheckpoints: false,
	checkpointTimeout: 15,
	diffEnabled: true,
	experiments: {},
	fuzzyMatchThreshold: 1,
	maxOpenTabsContext: 20,
	maxWorkspaceFiles: 200,
	mcpEnabled: false,
	remoteBrowserHost: "",
	screenshotQuality: 75,
	soundEnabled: false,
	ttsEnabled: false,
	ttsSpeed: 1,
	soundVolume: 0.5,
	telemetrySetting: "unset" as const,
	terminalOutputLineLimit: 500,
	terminalOutputCharacterLimit: 50000,
	terminalShellIntegrationTimeout: 3000,
	terminalShellIntegrationDisabled: false,
	terminalCommandDelay: 0,
	terminalPowershellCounter: false,
	terminalZshClearEolMark: false,
	terminalZshOhMy: false,
	terminalZshP10k: false,
	terminalZdotdir: false,
	writeDelayMs: 0,
	showRooIgnoredFiles: true,
	enableSubfolderRules: false,
	remoteBrowserEnabled: false,
	maxReadFileLine: -1,
	maxImageFileSize: 5,
	maxTotalImageSize: 20,
	terminalCompressProgressBar: false,
	maxConcurrentFileReads: 5,
	condensingApiConfigId: "",
	customCondensingPrompt: "",
	customSupportPrompts: {},
	profileThresholds: {},
	alwaysAllowFollowupQuestions: false,
	followupAutoApproveTimeoutMs: undefined as number | undefined,
	includeDiagnosticMessages: true,
	maxDiagnosticMessages: 50,
	includeTaskHistoryInEnhance: true,
	imageGenerationProvider: "openrouter",
	openRouterImageApiKey: "",
	openRouterImageGenerationSelectedModel: "",
	reasoningBlockCollapsed: true,
	enterBehavior: "send" as const,
	includeCurrentTime: true,
	includeCurrentCost: true,
	maxGitStatusFiles: 0,
}

const mockSearchResults: SearchResult[] = [
	{
		id: "browser.enable",
		tab: "browser" as SectionName,
		labelKey: "settings:browser.enable.label",
		descriptionKey: "settings:browser.enable.description",
		translatedLabel: "Enable browser tool",
		translatedDescription: "Allows Roo to use a browser",
		matchScore: 10,
	},
	{
		id: "browser.viewport",
		tab: "browser" as SectionName,
		labelKey: "settings:browser.viewport.label",
		descriptionKey: "settings:browser.viewport.description",
		translatedLabel: "Browser viewport",
		translatedDescription: "Configure viewport size",
		matchScore: 9,
	},
]

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockUseExtensionState(),
}))

vi.mock("@/hooks/useSettingsSearch", () => ({
	useSettingsSearch: (query: string) => mockUseSettingsSearch(query),
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/ui", () => ({
	Button: ({ children, onClick, disabled, "data-testid": dataTestId }: any) => (
		<button onClick={onClick} disabled={disabled} data-testid={dataTestId}>
			{children}
		</button>
	),
	StandardTooltip: ({ children }: any) => <>{children}</>,
	Input: ({ value, onChange, onFocus, onBlur, onKeyDown, "data-testid": dataTestId }: any) => (
		<input
			value={value}
			onChange={onChange}
			onFocus={onFocus}
			onBlur={onBlur}
			onKeyDown={onKeyDown}
			data-testid={dataTestId}
		/>
	),
	AlertDialog: ({ children }: any) => <div>{children}</div>,
	AlertDialogContent: ({ children }: any) => <div>{children}</div>,
	AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
	AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
	AlertDialogCancel: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
	AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
	AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
	AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
	Tooltip: ({ children }: any) => <>{children}</>,
	TooltipContent: ({ children }: any) => <div>{children}</div>,
	TooltipProvider: ({ children }: any) => <>{children}</>,
	TooltipTrigger: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
}))

vi.mock("../../common/Tab", () => ({
	Tab: ({ children }: any) => <div>{children}</div>,
	TabHeader: ({ children }: any) => <div>{children}</div>,
	TabContent: ({ children }: any) => <div>{children}</div>,
	TabList: ({ children }: any) => <div>{children}</div>,
	TabTrigger: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}))

vi.mock("../ApiConfigManager", () => ({
	__esModule: true,
	default: () => <div>ApiConfigManager</div>,
}))

vi.mock("../ApiOptions", () => ({
	__esModule: true,
	default: () => <div>ApiOptions</div>,
}))

// Mock all settings subsections to inert components
vi.mock("../AutoApproveSettings", () => ({ AutoApproveSettings: () => <div>AutoApproveSettings</div> }))
vi.mock("../BrowserSettings", () => ({ BrowserSettings: () => <div>BrowserSettings</div> }))
vi.mock("../CheckpointSettings", () => ({ CheckpointSettings: () => <div>CheckpointSettings</div> }))
vi.mock("../NotificationSettings", () => ({ NotificationSettings: () => <div>NotificationSettings</div> }))
vi.mock("../ContextManagementSettings", () => ({
	ContextManagementSettings: () => <div>ContextManagementSettings</div>,
}))
vi.mock("../TerminalSettings", () => ({ TerminalSettings: () => <div>TerminalSettings</div> }))
vi.mock("../ExperimentalSettings", () => ({ ExperimentalSettings: () => <div>ExperimentalSettings</div> }))
vi.mock("../LanguageSettings", () => ({ LanguageSettings: () => <div>LanguageSettings</div> }))
vi.mock("../About", () => ({ About: () => <div>About</div> }))
vi.mock("../PromptsSettings", () => ({ __esModule: true, default: () => <div>PromptsSettings</div> }))
vi.mock("../SlashCommandsSettings", () => ({ SlashCommandsSettings: () => <div>SlashCommandsSettings</div> }))
vi.mock("../UISettings", () => ({ UISettings: () => <div>UISettings</div> }))

describe("SettingsView search interactions", () => {
	beforeEach(() => {
		;(global as any).ResizeObserver = (global as any).ResizeObserver || ResizeObserverPolyfill
		mockUseExtensionState.mockReturnValue(defaultExtensionState)
		mockUseSettingsSearch.mockImplementation(() => mockSearchResults)
	})

	it("allows clicking a search result without closing before selection", async () => {
		render(<SettingsView onDone={vi.fn()} />)

		const input = screen.getByTestId("settings-search-input") as HTMLInputElement
		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: "browser" } })

		const listbox = await screen.findByRole("listbox")
		expect(listbox).toBeInTheDocument()

		const options = screen.getAllByRole("option")
		fireEvent.mouseDown(options[0])
		fireEvent.click(options[0])

		expect(input.value).toBe("")
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
	})

	it("supports keyboard navigation and enter selection from search input", async () => {
		render(<SettingsView onDone={vi.fn()} />)

		const input = screen.getByTestId("settings-search-input") as HTMLInputElement
		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: "browser" } })

		await screen.findByRole("listbox")
		let options = screen.getAllByRole("option")
		expect(options[0]).toHaveAttribute("aria-selected", "true")

		fireEvent.keyDown(input, { key: "ArrowDown" })
		options = screen.getAllByRole("option")
		expect(options[1]).toHaveAttribute("aria-selected", "true")

		fireEvent.keyDown(input, { key: "Enter" })
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
		expect(input.value).toBe("")
	})
})
