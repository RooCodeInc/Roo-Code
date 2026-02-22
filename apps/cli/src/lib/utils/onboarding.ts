import { createElement } from "react"

import { type OnboardingResult, OnboardingProviderChoice } from "@/types/index.js"
import { login } from "@/commands/index.js"
import { saveProviderApiKey, saveSettings } from "@/lib/storage/index.js"
import type { OnboardingSelection } from "@/ui/components/onboarding/index.js"

export async function runOnboarding(): Promise<OnboardingResult> {
	const { render } = await import("ink")
	const { OnboardingScreen } = await import("@/ui/components/onboarding/index.js")

	return new Promise<OnboardingResult>((resolve) => {
		const onSelect = async (selection: OnboardingSelection) => {
			const choice = selection.choice
			await saveSettings({ onboardingProviderChoice: choice })

			app.unmount()

			console.log("")

			if (choice === OnboardingProviderChoice.Roo) {
				const result = await login()
				await saveSettings({ onboardingProviderChoice: choice })

				resolve({
					choice: OnboardingProviderChoice.Roo,
					authMethod: "roo-token",
					token: result.success ? result.token : undefined,
					skipped: false,
				})
			} else if (selection.authMethod === "oauth") {
				await saveSettings({ provider: selection.provider })

				console.log("Configured openai-codex to use OpenAI OAuth.")
				console.log("")
				resolve({
					choice: OnboardingProviderChoice.Byok,
					authMethod: "oauth",
					provider: selection.provider,
					skipped: false,
				})
			} else {
				await saveSettings({ provider: selection.provider })
				await saveProviderApiKey(selection.provider, selection.apiKey)

				console.log(`Configured ${selection.provider} with a saved API key.`)
				console.log("")
				resolve({
					choice: OnboardingProviderChoice.Byok,
					authMethod: "api-key",
					provider: selection.provider,
					apiKey: selection.apiKey,
					skipped: false,
				})
			}
		}

		const app = render(createElement(OnboardingScreen, { onSelect }))
	})
}
