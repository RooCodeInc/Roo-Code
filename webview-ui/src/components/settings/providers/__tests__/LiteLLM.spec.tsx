import { render, screen, fireEvent } from "@/utils/test-utils"

import { LiteLLM } from "../LiteLLM"
import type { ProviderSettings } from "@roo-code/types"

const mockUseExtensionState = vi.fn()

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockUseExtensionState(),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, placeholder, className, type }: any) => (
		<div className={className}>
			{children}
			<input type={type ?? "text"} value={value} onChange={(e) => onInput?.(e)} placeholder={placeholder} />
		</div>
	),
}))

vi.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange }: any) => (
		<label>
			<input type="checkbox" checked={checked} onChange={() => onChange(!checked)} />
			{children}
		</label>
	),
}))

vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, disabled }: any) => (
		<button onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}))

vi.mock("../../ModelPicker", () => ({
	ModelPicker: () => <div data-testid="model-picker">model picker</div>,
}))

describe("LiteLLM prompt caching toggle", () => {
	const mockSetApiConfigurationField = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue({
			routerModels: {
				litellm: {
					"model-with-cache": { supportsPromptCache: true },
				},
			},
		})
	})

	function renderLiteLLM(apiConfiguration: Partial<ProviderSettings>) {
		render(
			<LiteLLM
				apiConfiguration={apiConfiguration as ProviderSettings}
				setApiConfigurationField={mockSetApiConfigurationField}
				organizationAllowList={{} as any}
			/>,
		)
	}

	it("renders provider-level prompt caching toggle when selected model supports prompt cache", () => {
		renderLiteLLM({
			litellmModelId: "model-with-cache",
		})

		expect(screen.getByText("settings:providers.enablePromptCaching")).toBeInTheDocument()
	})

	it("does not render provider-level prompt caching toggle when selected model does not support prompt cache", () => {
		mockUseExtensionState.mockReturnValue({
			routerModels: {
				litellm: {
					"model-without-cache": { supportsPromptCache: false },
				},
			},
		})

		renderLiteLLM({
			litellmModelId: "model-without-cache",
		})

		expect(screen.queryByText("settings:providers.enablePromptCaching")).not.toBeInTheDocument()
	})

	it("writes litellm override when provider toggle diverges from global", () => {
		renderLiteLLM({
			litellmModelId: "model-with-cache",
			promptCachingEnabled: true,
		})

		const cacheLabel = screen.getByText("settings:providers.enablePromptCaching").closest("label")
		const cacheInput = cacheLabel?.querySelector("input") as HTMLInputElement
		fireEvent.click(cacheInput)

		expect(mockSetApiConfigurationField).toHaveBeenCalledWith("promptCachingProviderOverrides", {
			litellm: false,
		})
	})

	it("removes litellm override when provider toggle matches global", () => {
		renderLiteLLM({
			litellmModelId: "model-with-cache",
			promptCachingEnabled: false,
			promptCachingProviderOverrides: {
				bedrock: true,
				litellm: true,
			},
		})

		const cacheLabel = screen.getByText("settings:providers.enablePromptCaching").closest("label")
		const cacheInput = cacheLabel?.querySelector("input") as HTMLInputElement
		fireEvent.click(cacheInput)

		expect(mockSetApiConfigurationField).toHaveBeenCalledWith("promptCachingProviderOverrides", {
			bedrock: true,
		})
	})
})
