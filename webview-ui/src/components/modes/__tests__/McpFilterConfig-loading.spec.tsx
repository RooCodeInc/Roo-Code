// npx vitest src/components/modes/__tests__/McpFilterConfig-loading.spec.tsx

import React from "react"
import { render, screen } from "@/utils/test-utils"

import { McpFilterConfig } from "../McpFilterConfig"
import type { McpFilterConfigProps } from "../McpFilterConfig"
import type { McpServer } from "@roo-code/types"

/**
 * Mock Select UI sub-module to avoid Radix portal issues in tests.
 * Only mocking the select sub-path to preserve other barrel exports
 * (e.g. TooltipProvider used by the test-utils wrapper).
 */
vi.mock("@/components/ui/select", function () {
	return {
		Select: function MockSelect({ children, value }: any) {
			return (
				<div data-testid="mock-select" data-value={value}>
					{children}
				</div>
			)
		},
		SelectTrigger: function MockSelectTrigger({ children }: any) {
			return <button data-testid="mock-select-trigger">{children}</button>
		},
		SelectContent: function MockSelectContent({ children }: any) {
			return <div data-testid="mock-select-content">{children}</div>
		},
		SelectItem: function MockSelectItem({ children, value }: any) {
			return <div data-value={value}>{children}</div>
		},
		SelectValue: function MockSelectValue() {
			return <span>mock-value</span>
		},
	}
})

/**
 * Mock McpServerFilterRow to avoid testing child component internals.
 */
vi.mock("../McpServerFilterRow", function () {
	return {
		McpServerFilterRow: function MockRow({ serverName }: any) {
			return <div data-testid={"mcp-server-filter-row-" + serverName}>{serverName}</div>
		},
	}
})

/**
 * Creates a minimal McpServer mock with required fields.
 */
function createMockServer(name: string, status?: "connected" | "connecting" | "disconnected"): McpServer {
	return {
		name: name,
		config: "{}",
		status: status || "connected",
		tools: [{ name: "tool-1", description: "A test tool", inputSchema: undefined }],
	} as McpServer
}

/**
 * Helper to render McpFilterConfig with sensible defaults.
 * Allows overriding any prop via partial overrides.
 */
function renderConfig(overrides: Partial<McpFilterConfigProps> = {}) {
	const defaultProps: McpFilterConfigProps = {
		mcpServers: [],
		mcpGroupOptions: undefined,
		onOptionsChange: vi.fn(),
		isEditing: true,
		...overrides,
	}
	return render(<McpFilterConfig {...defaultProps} />)
}

describe("McpFilterConfig loading state", function () {
	beforeEach(function () {
		vi.clearAllMocks()
	})

	/**
	 * When isLoading is true and no servers have been fetched yet,
	 * the component should display a loading spinner instead of
	 * the empty "No MCP servers connected" message.
	 */
	it("shows loading spinner when isLoading is true and no servers", function () {
		renderConfig({
			isLoading: true,
			mcpServers: [],
			isEditing: true,
		} as any)

		// Verify spinner is present
		const spinner = screen.getByTestId("mcp-loading-spinner")
		expect(spinner).toBeInTheDocument()

		// Verify loading text is shown
		expect(screen.getByText("Loading MCP servers...")).toBeInTheDocument()

		// Verify empty state message is NOT shown
		expect(screen.queryByText("No MCP servers connected")).not.toBeInTheDocument()
	})

	/**
	 * When isLoading is false and no servers exist, the component
	 * should show the standard empty state message.
	 */
	it("shows empty message when isLoading is false and no servers", function () {
		renderConfig({
			isLoading: false,
			mcpServers: [],
			isEditing: true,
		} as any)

		// Verify empty message is present
		expect(screen.getByText("No MCP servers connected")).toBeInTheDocument()

		// Verify spinner is NOT present
		expect(screen.queryByTestId("mcp-loading-spinner")).not.toBeInTheDocument()
	})

	/**
	 * When servers have loaded successfully, the component should
	 * render the server list without any spinner or empty message.
	 */
	it("shows server list when isLoading is false and servers exist", function () {
		const servers = [createMockServer("my-mcp-server"), createMockServer("another-server")]

		renderConfig({
			isLoading: false,
			mcpServers: servers,
			isEditing: true,
		} as any)

		// Verify spinner is NOT present
		expect(screen.queryByTestId("mcp-loading-spinner")).not.toBeInTheDocument()

		// Verify empty message is NOT present
		expect(screen.queryByText("No MCP servers connected")).not.toBeInTheDocument()

		// Verify server rows are rendered
		expect(screen.getByTestId("mcp-server-filter-row-my-mcp-server")).toBeInTheDocument()
		expect(screen.getByTestId("mcp-server-filter-row-another-server")).toBeInTheDocument()
	})

	/**
	 * When isLoading is still true but servers have already been provided,
	 * the server list should take priority over the loading spinner.
	 * This handles the case where data arrives before the loading flag resets.
	 */
	it("does not show spinner when isLoading is true but servers already loaded", function () {
		const servers = [createMockServer("existing-server")]

		renderConfig({
			isLoading: true,
			mcpServers: servers,
			isEditing: true,
		} as any)

		// Spinner should NOT be present because servers override loading
		expect(screen.queryByTestId("mcp-loading-spinner")).not.toBeInTheDocument()

		// Loading text should NOT be present
		expect(screen.queryByText("Loading MCP servers...")).not.toBeInTheDocument()

		// Server content should be present
		expect(screen.getByTestId("mcp-server-filter-row-existing-server")).toBeInTheDocument()
	})

	/**
	 * The loading spinner should also appear in read-only mode
	 * (isEditing=false) when data hasn't loaded yet.
	 */
	it("shows spinner in read-only mode when loading", function () {
		renderConfig({
			isLoading: true,
			mcpServers: [],
			isEditing: false,
		} as any)

		// Verify spinner is present even in read-only mode
		const spinner = screen.getByTestId("mcp-loading-spinner")
		expect(spinner).toBeInTheDocument()

		// Verify loading text is shown
		expect(screen.getByText("Loading MCP servers...")).toBeInTheDocument()
	})
})
