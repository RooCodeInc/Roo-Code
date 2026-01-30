import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

import { McpExecution } from "../McpExecution"

vi.mock("react-use", () => ({
	useEvent: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// CodeBlock is heavy (shiki); mock it to just print its props.
vi.mock("../../common/CodeBlock", () => ({
	default: ({ source, rawSource, language }: { source: string; rawSource?: string; language: string }) =>
		!source || source.length === 0 ? null : (
			<div data-testid={`code-block-${language}`} data-raw={rawSource ?? ""}>
				{source}
			</div>
		),
}))

vi.mock("../Markdown", () => ({
	Markdown: ({ markdown }: { markdown: string }) => <div data-testid="markdown">{markdown}</div>,
}))

vi.mock("../../mcp/McpToolRow", () => ({
	default: ({ tool }: { tool: { name: string } }) => <div data-testid="mcp-tool-row">{tool.name}</div>,
}))

describe("McpExecution", () => {
	it("pretty prints minified JSON response when expanded (no streaming status)", () => {
		render(
			<McpExecution
				executionId="1"
				serverName="github"
				toolName="list_pull_requests"
				isArguments={true}
				useMcpServer={
					{
						type: "use_mcp_tool",
						serverName: "github",
						toolName: "list_pull_requests",
						arguments: "{}",
						response: '[{"id":1,"title":"PR"}]',
					} as any
				}
			/>,
		)

		// Expand response
		fireEvent.click(screen.getByRole("button"))

		const block = screen.getByTestId("code-block-json")
		expect(block).toHaveTextContent('"id": 1')
		expect(block).toHaveTextContent('"title": "PR"')
		// raw output preserved for copy
		expect(block.getAttribute("data-raw")).toBe('[{"id":1,"title":"PR"}]')
	})

	it("pretty prints escaped JSON blobs when expanded", () => {
		// Example: JSON content returned as an escaped JSON blob string (common in some MCP servers)
		const escapedBlob = '[{\\"id\\":1,\\"title\\":\\"PR\\"}]'

		render(
			<McpExecution
				executionId="1"
				serverName="github"
				toolName="list_pull_requests"
				isArguments={true}
				useMcpServer={
					{
						type: "use_mcp_tool",
						serverName: "github",
						toolName: "list_pull_requests",
						arguments: "{}",
						response: escapedBlob,
					} as any
				}
			/>,
		)

		fireEvent.click(screen.getByRole("button"))

		const block = screen.getByTestId("code-block-json")
		expect(block).toHaveTextContent('"id": 1')
		expect(block).toHaveTextContent('"title": "PR"')
		expect(block.getAttribute("data-raw")).toBe(escapedBlob)
	})

	it("pretty prints double-encoded JSON when expanded", () => {
		// Example: response is a JSON string whose content is JSON
		const doubleEncoded = JSON.stringify('[{"id":1,"title":"PR"}]')

		render(
			<McpExecution
				executionId="1"
				serverName="github"
				toolName="list_pull_requests"
				isArguments={true}
				useMcpServer={
					{
						type: "use_mcp_tool",
						serverName: "github",
						toolName: "list_pull_requests",
						arguments: "{}",
						response: doubleEncoded,
					} as any
				}
			/>,
		)

		fireEvent.click(screen.getByRole("button"))

		const block = screen.getByTestId("code-block-json")
		expect(block).toHaveTextContent('"id": 1')
		expect(block).toHaveTextContent('"title": "PR"')
		expect(block.getAttribute("data-raw")).toBe(doubleEncoded)
	})

	it("renders non-JSON response as Markdown", () => {
		render(
			<McpExecution
				executionId="1"
				serverName="github"
				toolName="list_pull_requests"
				isArguments={true}
				useMcpServer={
					{
						type: "use_mcp_tool",
						serverName: "github",
						toolName: "list_pull_requests",
						arguments: "{}",
						response: "not json",
					} as any
				}
			/>,
		)

		fireEvent.click(screen.getByRole("button"))

		expect(screen.getByTestId("markdown")).toHaveTextContent("not json")
	})
})
