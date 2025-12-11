import React from "react"
import { VSCodeCheckbox, VSCodeTextField, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"

// Speech-to-text provider types (extensible for future providers)
export type SpeechToTextProvider = "deepgram" // | "whisper" | "azure" etc.

interface SpeechToTextSettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
	speechToTextProvider?: SpeechToTextProvider
	deepgramApiKey?: string
	deepgramModel?: string
	deepgramLanguage?: string
	setSpeechToTextProvider?: (provider: SpeechToTextProvider) => void
	setDeepgramApiKey: (apiKey: string) => void
	setDeepgramModel: (model: string) => void
	setDeepgramLanguage: (language: string) => void
}

// Available STT providers (add more here as they become available)
const STT_PROVIDERS = [
	{ value: "deepgram", label: "Deepgram", description: "Fast, accurate real-time transcription" },
	// Future providers can be added here:
	// { value: "whisper", label: "OpenAI Whisper", description: "High-quality offline transcription" },
	// { value: "azure", label: "Azure Speech", description: "Microsoft Azure Speech Services" },
] as const

const DEEPGRAM_MODELS = [
	{ value: "nova-3", label: "Nova 3 (Latest, Best Quality)" },
	{ value: "nova-2", label: "Nova 2" },
	{ value: "nova", label: "Nova (Legacy)" },
	{ value: "whisper-large", label: "Whisper Large" },
	{ value: "whisper-medium", label: "Whisper Medium" },
	{ value: "whisper-small", label: "Whisper Small" },
	{ value: "whisper-tiny", label: "Whisper Tiny" },
] as const

const DEEPGRAM_LANGUAGES = [
	{ value: "en", label: "English" },
	{ value: "en-US", label: "English (US)" },
	{ value: "en-GB", label: "English (UK)" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "it", label: "Italian" },
	{ value: "pt", label: "Portuguese" },
	{ value: "nl", label: "Dutch" },
	{ value: "ja", label: "Japanese" },
	{ value: "ko", label: "Korean" },
	{ value: "zh", label: "Chinese" },
	{ value: "ru", label: "Russian" },
	{ value: "ar", label: "Arabic" },
	{ value: "hi", label: "Hindi" },
] as const

export const SpeechToTextSettings = ({
	enabled,
	onChange,
	speechToTextProvider,
	deepgramApiKey,
	deepgramModel,
	deepgramLanguage,
	setSpeechToTextProvider,
	setDeepgramApiKey,
	setDeepgramModel,
	setDeepgramLanguage,
}: SpeechToTextSettingsProps) => {
	const { t } = useAppTranslation()

	const currentProvider = speechToTextProvider || "deepgram"
	const currentModel = deepgramModel || "nova-3"
	const currentLanguage = deepgramLanguage || "en"
	const isConfigured = currentProvider === "deepgram" && !!deepgramApiKey

	return (
		<div className="space-y-4">
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
						<span className="font-medium">
							{t("settings:experimental.SPEECH_TO_TEXT.name", { defaultValue: "Speech-to-Text" })}
						</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					{t("settings:experimental.SPEECH_TO_TEXT.description", {
						defaultValue:
							"Use your voice to input messages in the chat. Enable this to show the microphone button.",
					})}
				</p>
			</div>

			{enabled && (
				<div className="ml-2 space-y-3">
					{/* Provider Selection */}
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.SPEECH_TO_TEXT.providerLabel", { defaultValue: "Provider" })}
						</label>
						<VSCodeDropdown
							value={currentProvider}
							onChange={(e: any) => setSpeechToTextProvider?.(e.target.value as SpeechToTextProvider)}
							className="w-full">
							{STT_PROVIDERS.map((provider) => (
								<VSCodeOption key={provider.value} value={provider.value} className="py-2 px-3">
									{provider.label}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
						<p className="text-vscode-descriptionForeground text-xs mt-1">
							{STT_PROVIDERS.find((p) => p.value === currentProvider)?.description ||
								t("settings:experimental.SPEECH_TO_TEXT.providerDescription", {
									defaultValue: "Select the speech-to-text service provider.",
								})}
						</p>
					</div>

					{/* Deepgram-specific settings */}
					{currentProvider === "deepgram" && (
						<>
							{/* API Key Configuration */}
							<div>
								<label className="block font-medium mb-1">
									{t("settings:experimental.SPEECH_TO_TEXT.apiKeyLabel", {
										defaultValue: "Deepgram API Key",
									})}
								</label>
								<VSCodeTextField
									value={deepgramApiKey || ""}
									onInput={(e: any) => setDeepgramApiKey(e.target.value)}
									placeholder={t("settings:experimental.SPEECH_TO_TEXT.apiKeyPlaceholder", {
										defaultValue: "Enter your Deepgram API key",
									})}
									className="w-full"
									type="password"
								/>
								<p className="text-vscode-descriptionForeground text-xs mt-1">
									{t("settings:experimental.SPEECH_TO_TEXT.getApiKeyText", {
										defaultValue: "Get your API key from",
									})}{" "}
									<a
										href="https://console.deepgram.com/"
										target="_blank"
										rel="noopener noreferrer"
										className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
										console.deepgram.com
									</a>
								</p>
							</div>

							{/* Model Selection */}
							<div>
								<label className="block font-medium mb-1">
									{t("settings:experimental.SPEECH_TO_TEXT.modelLabel", {
										defaultValue: "Transcription Model",
									})}
								</label>
								<VSCodeDropdown
									value={currentModel}
									onChange={(e: any) => setDeepgramModel(e.target.value)}
									className="w-full">
									{DEEPGRAM_MODELS.map((model) => (
										<VSCodeOption key={model.value} value={model.value} className="py-2 px-3">
											{model.label}
										</VSCodeOption>
									))}
								</VSCodeDropdown>
								<p className="text-vscode-descriptionForeground text-xs mt-1">
									{t("settings:experimental.SPEECH_TO_TEXT.modelDescription", {
										defaultValue:
											"Nova 3 offers the best accuracy. Whisper models are slower but may handle some accents better.",
									})}
								</p>
							</div>

							{/* Language Selection */}
							<div>
								<label className="block font-medium mb-1">
									{t("settings:experimental.SPEECH_TO_TEXT.languageLabel", {
										defaultValue: "Language",
									})}
								</label>
								<VSCodeDropdown
									value={currentLanguage}
									onChange={(e: any) => setDeepgramLanguage(e.target.value)}
									className="w-full">
									{DEEPGRAM_LANGUAGES.map((lang) => (
										<VSCodeOption key={lang.value} value={lang.value} className="py-2 px-3">
											{lang.label}
										</VSCodeOption>
									))}
								</VSCodeDropdown>
								<p className="text-vscode-descriptionForeground text-xs mt-1">
									{t("settings:experimental.SPEECH_TO_TEXT.languageDescription", {
										defaultValue: "Select the primary language you'll be speaking.",
									})}
								</p>
							</div>
						</>
					)}

					{/* Status Message */}
					{!isConfigured && (
						<div className="p-2 bg-vscode-editorWarning-background text-vscode-editorWarning-foreground rounded text-sm">
							{t("settings:experimental.SPEECH_TO_TEXT.warningMissingKey", {
								defaultValue: "Please enter your API key to enable speech-to-text.",
							})}
						</div>
					)}

					{isConfigured && (
						<div className="p-2 bg-vscode-editorInfo-background text-vscode-editorInfo-foreground rounded text-sm">
							{t("settings:experimental.SPEECH_TO_TEXT.successConfigured", {
								defaultValue:
									"Speech-to-text is configured. Click the microphone button in the chat to start recording.",
							})}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
