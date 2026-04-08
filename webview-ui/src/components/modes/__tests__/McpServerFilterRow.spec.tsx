import React from "react"
import { render, fireEvent, screen } from "@/utils/test-utils"

import { McpServerFilterRow } from "../McpServerFilterRow"
import type { McpServerFilterRowProps } from "../McpServerFilterRow"

vi.mock("@/components/ui/checkbox", function () {
	return {
		Checkbox: function MockCheckbox({ checked, onCheckedChange, "aria-label": ariaLabel }: any) {
			return (
				<input
					type="checkbox"
					checked={checked}
					aria-label={ariaLabel}
					onChange={function () {
						onCheckedChange(!checked)
					}}
				/>
			)
		},
		checkboxVariants: function () {
			return ""
		},
	}
})

vi.mock("@/components/ui/toggle-switch", function () {
	return {
		ToggleSwitch: function MockToggleSwitch({
			checked,
			onChange,
			"aria-label": ariaLabel,
			"data-testid": testId,
		}: any) {
			return (
				<button
					type="button"
					role="switch"
					aria-checked={checked}
					aria-label={ariaLabel}
					data-testid={testId}
					onClick={onChange}
				/>
			)
		},
	}
})

const mockTools = [
	{ name: "tool-a", description: "First tool" },
	{ name: "tool-b", description: "Second tool" },
	{ name: "tool-c" },
]

function renderRow(overrides: Partial<McpServerFilterRowProps> = {}) {
	const defaultProps: McpServerFilterRowProps = {
		serverName: "test-server",
		serverStatus: "connected",
		availableTools: mockTools,
		filter: undefined,
		onFilterChange: vi.fn(),
		isEditing: true,
		...overrides,
	}
	return {
		...render(<McpServerFilterRow {...defaultProps} />),
		onFilterChange: defaultProps.onFilterChange as ReturnType<typeof vi.fn>,
	}
}

describe("McpServerFilterRow", function () {
	beforeEach(function () {
		vi.clearAllMocks()
	})

	describe("read-only mode", function () {
		it("renders server name and summary", function () {
			renderRow({ isEditing: false })
			expect(screen.getByText("test-server")).toBeInTheDocument()
			expect(screen.getByText("3 of 3 tools allowed")).toBeInTheDocument()
		})

		it("shows disabled label when server is disabled", function () {
			renderRow({ isEditing: false, filter: { disabled: true } })
			expect(screen.getByText("disabled")).toBeInTheDocument()
		})

		it("shows correct count with allowlist filter", function () {
			renderRow({ isEditing: false, filter: { allowedTools: ["tool-a"] } })
			expect(screen.getByText("1 of 3 tools allowed")).toBeInTheDocument()
		})

		it("shows correct count with blocklist filter", function () {
			renderRow({ isEditing: false, filter: { disabledTools: ["tool-b"] } })
			expect(screen.getByText("2 of 3 tools allowed")).toBeInTheDocument()
		})
	})

	describe("server header", function () {
		it("renders server name bold in edit mode", function () {
			renderRow()
			expect(screen.getByText("test-server")).toHaveClass("font-bold")
		})

		it("renders tool count", function () {
			renderRow()
			expect(screen.getByText("3 tools")).toBeInTheDocument()
		})

		it("shows green dot when connected", function () {
			const { container } = renderRow({ serverStatus: "connected" })
			expect(container.querySelector(".bg-vscode-charts-green")).toBeInTheDocument()
		})

		it("shows yellow dot when connecting", function () {
			const { container } = renderRow({ serverStatus: "connecting" })
			expect(container.querySelector(".bg-vscode-charts-yellow")).toBeInTheDocument()
		})

		it("shows gray dot when disconnected", function () {
			const { container } = renderRow({ serverStatus: "disconnected" })
			expect(container.querySelector(".bg-vscode-descriptionForeground")).toBeInTheDocument()
		})

		it("toggle checked when server enabled", function () {
			renderRow({ filter: undefined })
			const toggle = screen.getByRole("switch", { name: "Toggle test-server server" })
			expect(toggle).toHaveAttribute("aria-checked", "true")
		})

		it("toggle unchecked when server disabled", function () {
			renderRow({ filter: { disabled: true } })
			const toggle = screen.getByRole("switch", { name: "Toggle test-server server" })
			expect(toggle).toHaveAttribute("aria-checked", "false")
		})
	})

	describe("toggle server", function () {
		it("disables server on toggle when enabled", function () {
			const { onFilterChange } = renderRow({ filter: undefined })
			fireEvent.click(screen.getByRole("switch", { name: "Toggle test-server server" }))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", { disabled: true })
		})

		it("enables server on toggle when disabled", function () {
			const { onFilterChange } = renderRow({ filter: { disabled: true } })
			fireEvent.click(screen.getByRole("switch", { name: "Toggle test-server server" }))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", undefined)
		})

		it("preserves allowedTools when re-enabling", function () {
			const { onFilterChange } = renderRow({
				filter: { disabled: true, allowedTools: ["tool-a"] },
			})
			fireEvent.click(screen.getByRole("switch", { name: "Toggle test-server server" }))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", {
				disabled: undefined,
				allowedTools: ["tool-a"],
			})
		})
	})

	describe("expand/collapse", function () {
		it("does not show tool list by default", function () {
			renderRow()
			expect(screen.queryByTestId("mcp-filter-mode-test-server")).not.toBeInTheDocument()
		})

		it("shows tool list when header is clicked", function () {
			renderRow()
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			expect(screen.getByTestId("mcp-filter-mode-test-server")).toBeInTheDocument()
		})

		it("does not expand when server is disabled", function () {
			renderRow({ filter: { disabled: true } })
			const row = screen.getByTestId("mcp-server-filter-row-test-server")
			expect(row.querySelector(".codicon-chevron-right")).not.toBeInTheDocument()
		})
	})

	describe("filter mode selector", function () {
		function expandRow(overrides: Partial<McpServerFilterRowProps> = {}) {
			const result = renderRow(overrides)
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			return result
		}

		it("defaults to Allow All mode", function () {
			expandRow()
			expect(screen.getByText("All tools are enabled for this mode.")).toBeInTheDocument()
		})

		it("switches to allowlist mode", function () {
			const { onFilterChange } = expandRow()
			fireEvent.click(screen.getByTestId("mcp-filter-mode-btn-allowlist"))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", {
				allowedTools: ["tool-a", "tool-b", "tool-c"],
				disabledTools: undefined,
			})
		})

		it("switches to blocklist mode", function () {
			const { onFilterChange } = expandRow()
			fireEvent.click(screen.getByTestId("mcp-filter-mode-btn-blocklist"))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", {
				disabledTools: [],
				allowedTools: undefined,
			})
		})

		it("switches back to allow all mode", function () {
			const { onFilterChange } = expandRow({ filter: { allowedTools: ["tool-a"] } })
			fireEvent.click(screen.getByTestId("mcp-filter-mode-btn-allowAll"))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", undefined)
		})
	})

	describe("tool checkboxes in allowlist mode", function () {
		it("renders checkboxes for each tool", function () {
			renderRow({ filter: { allowedTools: ["tool-a", "tool-b"] } })
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			expect(screen.getByTestId("mcp-tool-filter-tool-a")).toBeInTheDocument()
			expect(screen.getByTestId("mcp-tool-filter-tool-b")).toBeInTheDocument()
			expect(screen.getByTestId("mcp-tool-filter-tool-c")).toBeInTheDocument()
		})

		it("removes tool from allowlist when unchecked", function () {
			const { onFilterChange } = renderRow({ filter: { allowedTools: ["tool-a", "tool-b"] } })
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			fireEvent.click(screen.getByRole("checkbox", { name: "Disable tool tool-a" }))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", { allowedTools: ["tool-b"] })
		})

		it("adds tool to allowlist when checked", function () {
			const { onFilterChange } = renderRow({ filter: { allowedTools: ["tool-a"] } })
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			fireEvent.click(screen.getByRole("checkbox", { name: "Enable tool tool-b" }))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", {
				allowedTools: ["tool-a", "tool-b"],
			})
		})
	})

	describe("tool checkboxes in blocklist mode", function () {
		it("adds tool to disabledTools when unchecked", function () {
			const { onFilterChange } = renderRow({ filter: { disabledTools: [] } })
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			fireEvent.click(screen.getByRole("checkbox", { name: "Disable tool tool-a" }))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", { disabledTools: ["tool-a"] })
		})

		it("removes tool from disabledTools when re-checked", function () {
			const { onFilterChange } = renderRow({ filter: { disabledTools: ["tool-b"] } })
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			fireEvent.click(screen.getByRole("checkbox", { name: "Enable tool tool-b" }))
			expect(onFilterChange).toHaveBeenCalledWith("test-server", { disabledTools: [] })
		})
	})

	describe("tool descriptions", function () {
		it("shows tool description when available", function () {
			renderRow({ filter: { allowedTools: ["tool-a"] } })
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			expect(screen.getByText("First tool")).toBeInTheDocument()
		})

		it("does not render description span when not present", function () {
			renderRow({ filter: { disabledTools: [] } })
			fireEvent.click(screen.getByTestId("mcp-server-header-test-server"))
			const toolC = screen.getByTestId("mcp-tool-filter-tool-c")
			expect(toolC.querySelectorAll("span").length).toBe(1)
		})
	})
})
