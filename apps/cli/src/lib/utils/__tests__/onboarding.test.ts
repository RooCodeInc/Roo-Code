import { render } from "ink"

import { login } from "@/commands/index.js"
import { saveProviderApiKey, saveSettings } from "@/lib/storage/index.js"
import { OnboardingProviderChoice } from "@/types/index.js"
import type { OnboardingSelection } from "@/ui/components/onboarding/index.js"

import { runOnboarding } from "../onboarding.js"

let nextSelection: OnboardingSelection

vi.mock("ink", () => ({
	render: vi.fn((node: unknown) => {
		const app = { unmount: vi.fn() }

		queueMicrotask(() => {
			const onSelect = (node as { props?: { onSelect?: (selection: OnboardingSelection) => void } }).props
				?.onSelect
			if (onSelect) {
				void onSelect(nextSelection)
			}
		})

		return app
	}),
}))

vi.mock("@/commands/index.js", () => ({
	login: vi.fn(),
}))

vi.mock("@/lib/storage/index.js", () => ({
	saveProviderApiKey: vi.fn(),
	saveSettings: vi.fn(),
}))

vi.mock("@/ui/components/onboarding/index.js", () => ({
	OnboardingScreen: () => null,
}))

describe("runOnboarding", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(saveSettings).mockResolvedValue(undefined)
		vi.mocked(saveProviderApiKey).mockResolvedValue(undefined)
		vi.spyOn(console, "log").mockImplementation(() => {})
	})

	it("returns roo-token onboarding result for Roo choice", async () => {
		nextSelection = { choice: OnboardingProviderChoice.Roo, authMethod: "roo-token" }
		vi.mocked(login).mockResolvedValue({ success: true, token: "roo-token" })

		const result = await runOnboarding()

		expect(result).toEqual({
			choice: OnboardingProviderChoice.Roo,
			authMethod: "roo-token",
			token: "roo-token",
			skipped: false,
		})
		expect(saveSettings).toHaveBeenCalledWith({ onboardingProviderChoice: OnboardingProviderChoice.Roo })
		expect(saveProviderApiKey).not.toHaveBeenCalled()
		expect(render).toHaveBeenCalled()
	})

	it("returns api-key onboarding result for BYOK selection", async () => {
		nextSelection = {
			choice: OnboardingProviderChoice.Byok,
			authMethod: "api-key",
			provider: "openrouter",
			apiKey: "test-openrouter-key",
		}

		const result = await runOnboarding()

		expect(result).toEqual({
			choice: OnboardingProviderChoice.Byok,
			authMethod: "api-key",
			provider: "openrouter",
			apiKey: "test-openrouter-key",
			skipped: false,
		})
		expect(saveSettings).toHaveBeenCalledWith({ onboardingProviderChoice: OnboardingProviderChoice.Byok })
		expect(saveSettings).toHaveBeenCalledWith({ provider: "openrouter" })
		expect(saveProviderApiKey).toHaveBeenCalledWith("openrouter", "test-openrouter-key")
	})

	it("returns oauth onboarding result for openai-codex selection", async () => {
		nextSelection = {
			choice: OnboardingProviderChoice.Byok,
			authMethod: "oauth",
			provider: "openai-codex",
		}

		const result = await runOnboarding()

		expect(result).toEqual({
			choice: OnboardingProviderChoice.Byok,
			authMethod: "oauth",
			provider: "openai-codex",
			skipped: false,
		})
		expect(saveSettings).toHaveBeenCalledWith({ provider: "openai-codex" })
		expect(saveProviderApiKey).not.toHaveBeenCalled()
	})
})
