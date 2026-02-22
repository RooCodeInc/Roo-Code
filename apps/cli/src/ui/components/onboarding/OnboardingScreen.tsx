import { Box, Text, useInput } from "ink"
import { Select } from "@inkjs/ui"
import { useMemo, useState } from "react"

import { ByokProvider, OnboardingProviderChoice, ASCII_ROO } from "@/types/index.js"

type ApiKeyByokProvider = Exclude<ByokProvider, "openai-codex">

const byokProviders: Array<{ label: string; value: ApiKeyByokProvider }> = [
	{ label: "OpenRouter", value: "openrouter" },
	{ label: "Anthropic", value: "anthropic" },
	{ label: "OpenAI", value: "openai-native" },
	{ label: "Google Gemini", value: "gemini" },
	{ label: "Vercel AI Gateway", value: "vercel-ai-gateway" },
]

export type OnboardingSelection =
	| { choice: OnboardingProviderChoice.Roo; authMethod: "roo-token" }
	| { choice: OnboardingProviderChoice.Byok; authMethod: "api-key"; provider: ApiKeyByokProvider; apiKey: string }
	| { choice: OnboardingProviderChoice.Byok; authMethod: "oauth"; provider: "openai-codex" }

export interface OnboardingScreenProps {
	onSelect: (selection: OnboardingSelection) => void
}

export function OnboardingScreen({ onSelect }: OnboardingScreenProps) {
	const [stage, setStage] = useState<"entry" | "provider" | "apiKey">("entry")
	const [provider, setProvider] = useState<ApiKeyByokProvider>("openrouter")
	const [apiKey, setApiKey] = useState("")

	useInput((input, key) => {
		if (stage !== "apiKey") {
			return
		}

		if (key.return) {
			const trimmedKey = apiKey.trim()
			if (trimmedKey.length > 0) {
				onSelect({
					choice: OnboardingProviderChoice.Byok,
					authMethod: "api-key",
					provider,
					apiKey: trimmedKey,
				})
			}
			return
		}

		if (key.backspace || key.delete) {
			setApiKey((current) => current.slice(0, -1))
			return
		}

		if (key.escape) {
			setStage("provider")
			return
		}

		if (input) {
			setApiKey((current) => current + input)
		}
	})

	const providerLabel = useMemo(() => {
		return byokProviders.find((item) => item.value === provider)?.label ?? provider
	}, [provider])

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="cyan">
				{ASCII_ROO}
			</Text>
			{stage === "entry" && (
				<>
					<Text dimColor>Welcome! How would you like to connect to an LLM provider?</Text>
					<Select
						options={[
							{ label: "Connect to Roo Code Cloud", value: OnboardingProviderChoice.Roo },
							{ label: "Sign in with OpenAI (ChatGPT Plus/Pro)", value: "openai-codex-oauth" },
							{ label: "Bring your own API key", value: OnboardingProviderChoice.Byok },
						]}
						onChange={(value: string) => {
							if (value === OnboardingProviderChoice.Roo) {
								onSelect({ choice: OnboardingProviderChoice.Roo, authMethod: "roo-token" })
								return
							}

							if (value === "openai-codex-oauth") {
								onSelect({
									choice: OnboardingProviderChoice.Byok,
									authMethod: "oauth",
									provider: "openai-codex",
								})
								return
							}

							setStage("provider")
						}}
					/>
				</>
			)}

			{stage === "provider" && (
				<>
					<Text dimColor>Select your provider:</Text>
					<Select
						options={byokProviders}
						onChange={(value: string) => {
							setProvider(value as ApiKeyByokProvider)
							setStage("apiKey")
						}}
					/>
				</>
			)}

			{stage === "apiKey" && (
				<>
					<Text dimColor>Enter your {providerLabel} API key (input is hidden):</Text>
					<Text>{apiKey.length > 0 ? "*".repeat(apiKey.length) : ""}</Text>
					<Text dimColor>Enter to continue, Esc to change provider</Text>
				</>
			)}
		</Box>
	)
}
