import React from "react"
import { render, screen } from "@/utils/test-utils"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"

import ContextDashboard from "../ContextDashboard"

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

const renderWithProviders = (
	props: { filePaths?: string[]; openedTabs?: Array<{ label: string; isActive: boolean; path?: string }> } = {},
) => {
	const { filePaths = [], openedTabs = [] } = props

	// Set up the mocks to return the test data
	mockFilePaths.mockReturnValue(filePaths)
	mockOpenedTabs.mockReturnValue(openedTabs)

	return render(
		<QueryClientProvider client={queryClient}>
			<ContextDashboard />
		</QueryClientProvider>,
	)
}

describe("ContextDashboard", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset mocks to return empty arrays
		mockFilePaths.mockReturnValue([])
		mockOpenedTabs.mockReturnValue([])
	})

	it("does not render when no context is available", () => {
		const { container } = renderWithProviders({ filePaths: [], openedTabs: [] })
		expect(container).toBeEmptyDOMElement()
	})

	it("renders with opened tabs", () => {
		const openedTabs = [
			{ label: "index.ts", isActive: true, path: "/src/index.ts" },
			{ label: "App.tsx", isActive: false, path: "/src/App.tsx" },
		]

		renderWithProviders({ openedTabs })

		expect(screen.getByText("Context")).toBeInTheDocument()
		expect(screen.getByText("Open Tabs")).toBeInTheDocument()
		expect(screen.getByText("index.ts")).toBeInTheDocument()
		expect(screen.getByText("App.tsx")).toBeInTheDocument()
	})

	it("renders with workspace files", () => {
		const filePaths = ["/src/index.ts", "/src/App.tsx", "/src/utils.ts"]

		renderWithProviders({ filePaths })

		expect(screen.getByText("Workspace Files")).toBeInTheDocument()
		expect(screen.getByText("index.ts")).toBeInTheDocument()
		expect(screen.getByText("App.tsx")).toBeInTheDocument()
		expect(screen.getByText("utils.ts")).toBeInTheDocument()
	})

	it("shows correct stats badge", () => {
		const filePaths = ["/src/file1.ts", "/src/file2.ts"]
		const openedTabs = [{ label: "test.ts", isActive: true }]

		renderWithProviders({ filePaths, openedTabs })

		expect(screen.getByText("2 files, 1 tabs")).toBeInTheDocument()
	})

	it("can collapse and expand", async () => {
		const filePaths = ["/src/index.ts"]
		const openedTabs = [{ label: "test.ts", isActive: true }]
		const user = userEvent.setup()

		renderWithProviders({ filePaths, openedTabs })

		// Initially expanded
		expect(screen.getByText("Open Tabs")).toBeInTheDocument()
		expect(screen.getByText("Workspace Files")).toBeInTheDocument()

		// Find the toggle button and click to collapse
		const toggleButton = screen.getByRole("button", { name: /collapse context/i })
		await user.click(toggleButton)

		// Content should be hidden
		expect(screen.queryByText("Open Tabs")).not.toBeInTheDocument()
		expect(screen.queryByText("Workspace Files")).not.toBeInTheDocument()

		// Click to expand again
		const expandButton = screen.getByRole("button", { name: /expand context/i })
		await user.click(expandButton)

		// Content should be visible again
		expect(screen.getByText("Open Tabs")).toBeInTheDocument()
		expect(screen.getByText("Workspace Files")).toBeInTheDocument()
	})

	it("shows active tab indicator", () => {
		const openedTabs = [
			{ label: "index.ts", isActive: true, path: "/src/index.ts" },
			{ label: "App.tsx", isActive: false, path: "/src/App.tsx" },
		]

		renderWithProviders({ openedTabs })

		// Get all elements matching either filename (fixed regex to match .ts or .tsx)
		const tabs = screen.getAllByText(/index\.ts|App\.tsx/)
		expect(tabs.length).toBeGreaterThanOrEqual(2)
	})

	it("limits displayed items and shows more indicator", () => {
		const openedTabs = Array.from({ length: 15 }, (_, i) => ({
			label: `file${i}.ts`,
			isActive: false,
		}))

		renderWithProviders({ openedTabs })

		expect(screen.getByText("+5 more")).toBeInTheDocument()
	})

	it("limits workspace files and shows more indicator", () => {
		const filePaths = Array.from({ length: 20 }, (_, i) => `/src/file${i}.ts`)

		renderWithProviders({ filePaths })

		expect(screen.getByText("+5 more files")).toBeInTheDocument()
	})

	it("renders with both tabs and files", () => {
		const filePaths = ["/src/component.tsx", "/src/styles.css"]
		const openedTabs = [
			{ label: "Dashboard.tsx", isActive: true },
			{ label: "Settings.tsx", isActive: false },
		]

		renderWithProviders({ filePaths, openedTabs })

		expect(screen.getByText("Context")).toBeInTheDocument()
		expect(screen.getByText("Open Tabs")).toBeInTheDocument()
		expect(screen.getByText("Workspace Files")).toBeInTheDocument()
		expect(screen.getByText("Dashboard.tsx")).toBeInTheDocument()
		expect(screen.getByText("Settings.tsx")).toBeInTheDocument()
		expect(screen.getByText("component.tsx")).toBeInTheDocument()
		expect(screen.getByText("styles.css")).toBeInTheDocument()
	})
})
