import React from "react"
import { render, fireEvent, screen } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"

import McpMarketplace from "../McpMarketplace"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: Record<string, string>) => {
			const translations: Record<string, string> = {
				"mcp:marketplace.title": "Quick Add Servers",
				"mcp:marketplace.description":
					"Install popular free MCP servers with one click. No API keys required (unless noted).",
				"mcp:marketplace.install": "Add",
				"mcp:marketplace.requiresSetup": "Requires setup",
				"mcp:marketplace.learnMore": "Learn more",
			}
			if (key === "mcp:marketplace.requiresSetupHint" && params) {
				return `This server requires you to configure ${params.keys} in the MCP settings file after installation.`
			}
			return translations[key] || key
		},
	}),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		mcpServers: [],
	}),
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: function MockVSCodeLink({ children, href }: { children?: React.ReactNode; href?: string }) {
		return <a href={href}>{children}</a>
	},
}))

describe("McpMarketplace", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the marketplace title and description", () => {
		render(<McpMarketplace />)

		expect(screen.getByText("Quick Add Servers")).toBeInTheDocument()
		expect(
			screen.getByText("Install popular free MCP servers with one click. No API keys required (unless noted)."),
		).toBeInTheDocument()
	})

	it("renders all catalog items", () => {
		render(<McpMarketplace />)

		expect(screen.getByText("DuckDuckGo Search")).toBeInTheDocument()
		expect(screen.getByText("SearXNG")).toBeInTheDocument()
		expect(screen.getByText("Web Search (DuckDuckGo)")).toBeInTheDocument()
	})

	it("shows 'Requires setup' badge for servers that need configuration", () => {
		render(<McpMarketplace />)

		// SearXNG requires setup
		expect(screen.getByText("Requires setup")).toBeInTheDocument()
	})

	it("shows input fields for servers that require setup env keys", () => {
		render(<McpMarketplace />)

		// SearXNG requires SEARXNG_URL
		expect(screen.getByDisplayValue("https://searxng.example.com")).toBeInTheDocument()
	})

	it("sends installMcpServer message when Add button is clicked", () => {
		render(<McpMarketplace />)

		// Click the first "Add" button (DuckDuckGo Search)
		const addButtons = screen.getAllByText("Add")
		fireEvent.click(addButtons[0])

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "installMcpServer",
			serverName: "ddg-search",
			config: {
				command: "uvx",
				args: ["duckduckgo-mcp-server"],
				env: {
					DDG_SAFE_SEARCH: "OFF",
					DDG_REGION: "wt-wt",
				},
				alwaysAllow: ["search", "fetch_content"],
			},
		})
	})

	it("sends installMcpServer with custom env values for servers requiring setup", () => {
		render(<McpMarketplace />)

		// Change the SEARXNG_URL input value
		const urlInput = screen.getByDisplayValue("https://searxng.example.com")
		fireEvent.change(urlInput, { target: { value: "https://my-searxng.local" } })

		// Click the Add button for SearXNG (second Add button)
		const addButtons = screen.getAllByText("Add")
		fireEvent.click(addButtons[1])

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "installMcpServer",
			serverName: "searxng",
			config: {
				command: "npx",
				args: ["-y", "mcp-searxng"],
				env: {
					SEARXNG_URL: "https://my-searxng.local",
				},
				alwaysAllow: ["searxng_web_search", "web_url_read"],
			},
		})
	})

	it("renders learn more links for servers with URLs", () => {
		render(<McpMarketplace />)

		const learnMoreLinks = screen.getAllByText("Learn more")
		// All 3 catalog items have URLs
		expect(learnMoreLinks.length).toBe(3)
	})
})
