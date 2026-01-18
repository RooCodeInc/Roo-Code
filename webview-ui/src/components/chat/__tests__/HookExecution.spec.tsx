import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

import { HookExecution } from "../HookExecution"

vi.mock("i18next", () => ({
	t: (key: string, _options?: unknown) => key,
}))

vi.mock("lucide-react", () => ({
	ChevronDown: (props: any) => <svg aria-label="ChevronDown" {...props} />,
	FishingHook: (props: any) => <svg aria-label="FishingHook" {...props} />,
}))

vi.mock("@src/components/ui", () => ({
	Button: ({ children, ...props }: any) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
	StandardTooltip: ({ children }: any) => <>{children}</>,
}))

vi.mock("@src/components/common/CodeBlock", () => ({
	default: ({ source }: { source: string }) => <div data-testid="code-block">{source}</div>,
}))

/**
 * HookExecution tests
 *
 * Verifies:
 * - `hookExecutionOutputStatus` payload parsing via schema
 * - filtering by `executionId`
 * - no crashes on invalid payloads
 */
describe("HookExecution", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("filters hookExecutionOutputStatus updates by executionId", async () => {
		render(
			<HookExecution
				message={{
					text: JSON.stringify({
						executionId: "execA",
						hookId: "hook_1",
						event: "PreToolUse",
						toolName: "Write",
						command: "echo hi",
					}),
				}}
			/>,
		)

		// Expand so output can render once it arrives.
		fireEvent.click(screen.getByTestId("hook-execution-toggle"))

		// Wrong executionId: should be ignored.
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "hookExecutionOutputStatus",
					text: JSON.stringify({
						executionId: "execB",
						hookId: "hook_1",
						event: "PreToolUse",
						status: "output",
						command: "echo hi",
						cwd: "/project",
						output: "SHOULD_NOT_APPEAR",
					}),
				},
			}),
		)

		expect(screen.queryByText("SHOULD_NOT_APPEAR")).toBeNull()

		// Matching executionId: should update output.
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "hookExecutionOutputStatus",
					text: JSON.stringify({
						executionId: "execA",
						hookId: "hook_1",
						event: "PreToolUse",
						status: "output",
						command: "echo hi",
						cwd: "/project",
						output: "STREAMED_OUTPUT",
					}),
				},
			}),
		)

		// Our CodeBlock mock renders code blocks as divs with text content.
		expect(await screen.findByText("STREAMED_OUTPUT")).toBeInTheDocument()
	})

	it("does not crash on invalid hookExecutionOutputStatus payload", () => {
		render(
			<HookExecution
				message={{
					text: JSON.stringify({
						executionId: "execA",
						hookId: "hook_1",
						event: "PreToolUse",
						command: "echo hi",
					}),
				}}
			/>,
		)

		expect(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "hookExecutionOutputStatus",
						text: "not-json",
					},
				}),
			)
		}).not.toThrow()
	})
})
