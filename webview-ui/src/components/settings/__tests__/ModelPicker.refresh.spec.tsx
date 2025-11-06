import { describe, it, beforeEach, afterEach, expect } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { act } from "react"

import { ModelPicker } from "../ModelPicker"
import type { ModelInfo, ProviderSettings } from "@roo-code/types"

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

import { vscode } from "@src/utils/vscode"

Element.prototype.scrollIntoView = vi.fn()

describe("ModelPicker refresh behavior", () => {
	let queryClient: QueryClient
	let mockSetApiConfigurationField: ReturnType<typeof vi.fn>

	const modelInfo: ModelInfo = {
		contextWindow: 32000,
		maxTokens: 16000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.002,
		outputPrice: 0.006,
	}

	const models: Record<string, ModelInfo> = {
		"openrouter/model": modelInfo,
	}

	const apiConfiguration = {
		apiProvider: "openrouter",
		openRouterModelId: "openrouter/model",
	} as ProviderSettings

	const renderComponent = () =>
		render(
			<QueryClientProvider client={queryClient}>
				<ModelPicker
					defaultModelId="openrouter/model"
					models={models}
					modelIdKey="openRouterModelId"
					serviceName="OpenRouter"
					serviceUrl="https://openrouter.ai"
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
					organizationAllowList={{ allowAll: true, providers: {} }}
				/>
			</QueryClientProvider>,
		)

	beforeEach(() => {
		queryClient = new QueryClient()
		mockSetApiConfigurationField = vi.fn()
		vi.useFakeTimers()
		vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		queryClient.clear()
		vi.clearAllTimers()
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("posts flushRouterModels message and shows success state on completion", async () => {
		act(() => {
			renderComponent()
		})

		const refreshButton = screen.getByRole("button", { name: "Refresh" })

		act(() => {
			fireEvent.click(refreshButton)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "flushRouterModels" })
		expect(refreshButton).toHaveTextContent("Refreshing…")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "flushRouterModelsResult",
						success: true,
					},
				}),
			)
		})

		expect(refreshButton).toHaveTextContent("Refreshed")

		act(() => {
			vi.advanceTimersByTime(1500)
		})

		expect(refreshButton).toHaveTextContent("Refresh")
		expect(screen.queryByTestId("api-error-message")).not.toBeInTheDocument()
	})

	it("surfaces error message when refresh fails", async () => {
		act(() => {
			renderComponent()
		})

		const refreshButton = screen.getByRole("button", { name: "Refresh" })

		act(() => {
			fireEvent.click(refreshButton)
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "flushRouterModels" })

		const errorMessage = "something went wrong"
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "flushRouterModelsResult",
						success: false,
						error: errorMessage,
					},
				}),
			)
		})

		expect(refreshButton).toHaveTextContent("Refresh")
		expect(screen.getByTestId("api-error-message")).toHaveTextContent(errorMessage)
	})
})
