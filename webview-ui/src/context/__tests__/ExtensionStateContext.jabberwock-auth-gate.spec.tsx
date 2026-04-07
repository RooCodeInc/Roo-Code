import { render, waitFor } from "@/utils/test-utils"
import React from "react"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

describe("ExtensionStateContext Jabberwock auth gate", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	function postStateMessage(state: any) {
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "state",
					state,
				},
			}),
		)
	}

	it("does not post requestRooModels when auth flips and provider !== 'jabberwock'", async () => {
		render(
			<ExtensionStateContextProvider>
				<div />
			</ExtensionStateContextProvider>,
		)

		// Flip auth to true with a non-jabberwock provider (anthropic)
		postStateMessage({
			cloudIsAuthenticated: true,
			apiConfiguration: { apiProvider: "anthropic" },
		})

		// Should NOT fire auth-driven Jabberwock refresh
		await waitFor(() => {
			const calls = (vscode.postMessage as any).mock.calls as any[][]
			const hasRequest = calls.some((c) => c[0]?.type === "requestRooModels")
			expect(hasRequest).toBe(false)
		})
	})

	it("posts requestRooModels when auth flips and provider === 'jabberwock'", async () => {
		render(
			<ExtensionStateContextProvider>
				<div />
			</ExtensionStateContextProvider>,
		)

		// Ensure prev false (explicit)
		postStateMessage({
			cloudIsAuthenticated: false,
			apiConfiguration: { apiProvider: "jabberwock" },
		})

		vi.clearAllMocks()

		// Flip to true with provider jabberwock - should trigger
		postStateMessage({
			cloudIsAuthenticated: true,
			apiConfiguration: { apiProvider: "jabberwock" },
		})

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestRooModels" })
		})
	})
})
