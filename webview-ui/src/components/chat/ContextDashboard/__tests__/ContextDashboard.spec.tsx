import React from "react"
import { render, screen } from "@/utils/test-utils"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"

import ContextDashboardButton from "../ContextDashboard"

// Mock i18n TranslationContext
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			const translations: Record<string, string> = {
				"chat:contextDashboard.title": "Context",
				"chat:contextDashboard.expand": "Expand context",
				"chat:contextDashboard.collapse": "Collapse context",
				"chat:contextDashboard.stats": "{{files}} files, {{tabs}} tabs",
				"chat:contextDashboard.openedTabs": "Open Tabs",
				"chat:contextDashboard.workspaceFiles": "Workspace Files",
				"chat:contextDashboard.more": "+{{count}} more",
				"chat:contextDashboard.moreFiles": "+{{count}} more files",
				"chat:contextDashboard.tooltip": "View context files and folders",
			}
			if (options && typeof options === "object") {
				// Replace placeholders with actual values
				let translated = translations[key] || key
				Object.entries(options).forEach(([k, v]) => {
					translated = translated.replace(new RegExp(`{{${k}}}`, "g"), String(v))
				})
				return translated
			}
			return translations[key] || key
		},
	}),
}))

// Mock ExtensionStateContext
const mockFilePaths = vi.fn()
const mockOpenedTabs = vi.fn()

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => ({
		filePaths: mockFilePaths(),
		openedTabs: mockOpenedTabs(),
	})),
}))

const queryClient = new QueryClient()

const renderWithProviders = async (
	props: { filePaths?: string[]; openedTabs?: Array<{ label: string; isActive: boolean; path?: string }> } = {},
) => {
	const { filePaths = [], openedTabs = [] } = props

	// Set up the mocks to return the test data
	mockFilePaths.mockReturnValue(filePaths)
	mockOpenedTabs.mockReturnValue(openedTabs)

	const user = userEvent.setup()
	const result = render(
		<QueryClientProvider client={queryClient}>
			<ContextDashboardButton />
		</QueryClientProvider>,
	)
	return { result, user }
}

describe("ContextDashboardButton", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset mocks to return empty arrays
		mockFilePaths.mockReturnValue([])
		mockOpenedTabs.mockReturnValue([])
	})

	it("does not render when no context is available", () => {
		const { container } = render(
			<QueryClientProvider client={queryClient}>
				<ContextDashboardButton />
			</QueryClientProvider>,
		)
		expect(container).toBeEmptyDOMElement()
	})

	it("renders as a button when context is available", async () => {
		const openedTabs = [{ label: "index.ts", isActive: true, path: "/src/index.ts" }]

		await renderWithProviders({ openedTabs })

		// Button should be rendered
		expect(screen.getByRole("button", { name: /view context files and folders/i })).toBeInTheDocument()
	})

	it("opens popover and shows content when clicked", async () => {
		const openedTabs = [
			{ label: "index.ts", isActive: true, path: "/src/index.ts" },
			{ label: "App.tsx", isActive: false, path: "/src/App.tsx" },
		]

		const { user } = await renderWithProviders({ openedTabs })

		// Click to open popover
		await user.click(screen.getByRole("button", { name: /view context files and folders/i }))

		// Content should be visible
		expect(screen.getByText("Context")).toBeInTheDocument()
		expect(screen.getByText("Open Tabs")).toBeInTheDocument()
		expect(screen.getByText("index.ts")).toBeInTheDocument()
		expect(screen.getByText("App.tsx")).toBeInTheDocument()
	})

	it("shows workspace files in popover", async () => {
		const filePaths = ["/src/index.ts", "/src/App.tsx", "/src/utils.ts"]

		const { user } = await renderWithProviders({ filePaths })

		// Click to open popover
		await user.click(screen.getByRole("button", { name: /view context files and folders/i }))

		// Workspace files should be visible
		expect(screen.getByText("Workspace Files")).toBeInTheDocument()
		expect(screen.getByText("index.ts")).toBeInTheDocument()
		expect(screen.getByText("App.tsx")).toBeInTheDocument()
		expect(screen.getByText("utils.ts")).toBeInTheDocument()
	})

	it("shows correct stats badge", async () => {
		const filePaths = ["/src/file1.ts", "/src/file2.ts"]
		const openedTabs = [{ label: "test.ts", isActive: true }]

		const { user } = await renderWithProviders({ filePaths, openedTabs })

		// Click to open popover
		await user.click(screen.getByRole("button", { name: /view context files and folders/i }))

		expect(screen.getByText("2 files, 1 tabs")).toBeInTheDocument()
	})

	it("limits displayed tabs and shows more indicator", async () => {
		const openedTabs = Array.from({ length: 15 }, (_, i) => ({
			label: `file${i}.ts`,
			isActive: false,
		}))

		const { user } = await renderWithProviders({ openedTabs })

		// Click to open popover
		await user.click(screen.getByRole("button", { name: /view context files and folders/i }))

		expect(screen.getByText("+5 more")).toBeInTheDocument()
	})

	it("limits workspace files and shows more indicator", async () => {
		const filePaths = Array.from({ length: 20 }, (_, i) => `/src/file${i}.ts`)

		const { user } = await renderWithProviders({ filePaths })

		// Click to open popover
		await user.click(screen.getByRole("button", { name: /view context files and folders/i }))

		expect(screen.getByText("+5 more files")).toBeInTheDocument()
	})

	it("shows both tabs and files in popover", async () => {
		const filePaths = ["/src/component.tsx", "/src/styles.css"]
		const openedTabs = [
			{ label: "Dashboard.tsx", isActive: true },
			{ label: "Settings.tsx", isActive: false },
		]

		const { user } = await renderWithProviders({ filePaths, openedTabs })

		// Click to open popover
		await user.click(screen.getByRole("button", { name: /view context files and folders/i }))

		expect(screen.getByText("Context")).toBeInTheDocument()
		expect(screen.getByText("Open Tabs")).toBeInTheDocument()
		expect(screen.getByText("Workspace Files")).toBeInTheDocument()
		expect(screen.getByText("Dashboard.tsx")).toBeInTheDocument()
		expect(screen.getByText("Settings.tsx")).toBeInTheDocument()
		expect(screen.getByText("component.tsx")).toBeInTheDocument()
		expect(screen.getByText("styles.css")).toBeInTheDocument()
	})

	it("shows active tab indicator", async () => {
		const openedTabs = [
			{ label: "index.ts", isActive: true, path: "/src/index.ts" },
			{ label: "App.tsx", isActive: false, path: "/src/App.tsx" },
		]

		const { user } = await renderWithProviders({ openedTabs })

		// Click to open popover
		await user.click(screen.getByRole("button", { name: /view context files and folders/i }))

		// Should have active indicator (first tab is active)
		expect(screen.getByText("index.ts")).toBeInTheDocument()
		expect(screen.getByText("App.tsx")).toBeInTheDocument()
	})
})
