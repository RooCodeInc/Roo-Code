import React from "react"
import { render, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import App from "../App"
import TranslationProvider from "../i18n/TranslationContext"

// Mock vscode API
const mockPostMessage = vi.fn()
vi.mock("../utils/vscode", () => ({
	vscode: {
		postMessage: (message: any) => mockPostMessage(message),
	},
}))

// Mock extension state
const mockExtensionState = {
	didHydrateState: true,
	showWelcome: false,
	shouldShowAnnouncement: false,
	telemetrySetting: "off" as const,
	telemetryKey: undefined,
	machineId: "test-machine-id",
	cloudUserInfo: null,
	cloudIsAuthenticated: false,
	cloudApiUrl: undefined,
	renderContext: "editor" as const,
	mdmCompliant: true,
	currentApiConfigName: "test-config",
	listApiConfigMeta: [],
	apiConfiguration: {},
	experiments: {},
	customModes: [],
	mode: { slug: "code", name: "Code" },
	clineMessages: [],
	taskHistory: [],
	version: "1.0.0",
	writeDelayMs: 100,
	requestDelaySeconds: 1,
	enableCheckpoints: false,
	maxOpenTabsContext: 10,
	maxWorkspaceFiles: 100,
	showRooIgnoredFiles: false,
	maxReadFileLine: 1000,
	maxImageFileSize: 5,
	maxTotalImageSize: 20,
	mcpEnabled: false,
	enableMcpServerCreation: false,
	sharingEnabled: false,
	organizationAllowList: {
		enabled: false,
		allowed: [],
		providers: {},
	},
	autoCondenseContext: false,
	autoCondenseContextPercent: 50,
	profileThresholds: {},
	hasOpenedModeSelector: false,
	remoteControlEnabled: false,
	taskSyncEnabled: false,
	featureRoomoteControlEnabled: false,
	// Add missing properties required by ChatView components
	openedTabs: [],
	filePaths: [],
	commands: [],
	gitCommits: [],
	browserToolEnabled: false,
	mcpServers: [],
}

vi.mock("../context/ExtensionStateContext", () => ({
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => children,
	useExtensionState: () => mockExtensionState,
}))

describe("Settings Tab Navigation", () => {
	let queryClient: QueryClient

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		})
		mockPostMessage.mockClear()
	})

	it("should navigate to slash commands section when handleSettingsClick is called", async () => {
		const { container } = render(
			<QueryClientProvider client={queryClient}>
				<TranslationProvider>
					<App />
				</TranslationProvider>
			</QueryClientProvider>,
		)

		// Simulate message from ContextMenu to switch to settings tab with targetSection
		const messageEvent = new MessageEvent("message", {
			data: {
				type: "action",
				action: "switchTab",
				tab: "settings",
				values: { section: "slashCommands" },
			},
		})
		window.dispatchEvent(messageEvent)

		// Wait for the settings view to render
		await waitFor(() => {
			const slashCommandsTab = container.querySelector('[data-testid="tab-slashCommands"]')
			expect(slashCommandsTab).toBeTruthy()
		})

		// Verify the slash commands tab is active
		const slashCommandsTab = container.querySelector('[data-testid="tab-slashCommands"]')
		expect(slashCommandsTab?.getAttribute("aria-selected")).toBe("true")
	})

	it("should switch to settings tab without a specific section", async () => {
		const { container } = render(
			<QueryClientProvider client={queryClient}>
				<TranslationProvider>
					<App />
				</TranslationProvider>
			</QueryClientProvider>,
		)

		// Simulate message to switch to settings tab without targetSection
		const messageEvent = new MessageEvent("message", {
			data: {
				type: "action",
				action: "switchTab",
				tab: "settings",
			},
		})
		window.dispatchEvent(messageEvent)

		// Wait for the settings view to render
		await waitFor(() => {
			const providersTab = container.querySelector('[data-testid="tab-providers"]')
			expect(providersTab).toBeTruthy()
		})

		// Verify the default providers tab is active
		const providersTab = container.querySelector('[data-testid="tab-providers"]')
		expect(providersTab?.getAttribute("aria-selected")).toBe("true")
	})
})
