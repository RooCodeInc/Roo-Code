import { describe, it, beforeEach, afterEach, expect } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { act } from "react"

import { ModelPicker } from "../ModelPicker"
import type { ModelInfo, ProviderSettings } from "@roo-code/types"

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

describe("ModelPicker - resolvedModelInfo persistence", () => {
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
		vi.useFakeTimers()
		queryClient = new QueryClient()
		mockSetApiConfigurationField = vi.fn()
	})

	afterEach(() => {
		queryClient.clear()
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it("persists resolvedModelInfo with cached metadata when a model is selected", async () => {
		await act(async () => {
			renderComponent()
		})

		// Clear initialization calls so we only assert on user interaction
		mockSetApiConfigurationField.mockClear()

		const trigger = screen.getByTestId("model-picker-button")
		fireEvent.click(trigger)

		// Allow popover animations to settle
		act(() => {
			vi.advanceTimersByTime(100)
		})

		const option = screen.getByTestId("model-option-openrouter/model")
		fireEvent.click(option)

		// Allow onSelect timeout handlers to complete
		act(() => {
			vi.advanceTimersByTime(100)
		})

		expect(mockSetApiConfigurationField).toHaveBeenCalledWith("openRouterModelId", "openrouter/model")
		expect(mockSetApiConfigurationField).toHaveBeenCalledWith("resolvedModelInfo", modelInfo, false)
	})
})
