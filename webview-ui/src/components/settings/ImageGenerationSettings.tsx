import React, { useState, useEffect } from "react"
import { VSCodeCheckbox, VSCodeTextField, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getImageGenerationModelsForProvider, type ImageGenerationProvider } from "@roo-code/types"

interface ImageGenerationSettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
	openRouterImageApiKey?: string
	geminiApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	geminiImageGenerationSelectedModel?: string
	imageGenerationProvider?: ImageGenerationProvider
	setOpenRouterImageApiKey: (apiKey: string) => void
	setGeminiApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel: (model: string) => void
	setImageGenerationProvider?: (provider: ImageGenerationProvider | undefined) => void
}

export const ImageGenerationSettings = ({
	enabled,
	onChange,
	openRouterImageApiKey,
	geminiApiKey,
	openRouterImageGenerationSelectedModel,
	geminiImageGenerationSelectedModel,
	imageGenerationProvider = "openrouter",
	setOpenRouterImageApiKey,
	setGeminiApiKey,
	setImageGenerationSelectedModel,
	setImageGenerationProvider,
}: ImageGenerationSettingsProps) => {
	const { t } = useAppTranslation()

	const [provider, setProvider] = useState<ImageGenerationProvider>(imageGenerationProvider)
	const [openRouterApiKeyLocal, setOpenRouterApiKeyLocal] = useState(openRouterImageApiKey || "")
	const [geminiApiKeyLocal, setGeminiApiKeyLocal] = useState(geminiApiKey || "")

	// Get models for current provider
	const availableModels = getImageGenerationModelsForProvider(provider)

	// Get default model for provider
	const getDefaultModel = (provider: ImageGenerationProvider) => {
		const models = getImageGenerationModelsForProvider(provider)
		return models.length > 0 ? models[0].modelId : ""
	}

	// Get current selected model based on provider
	const getCurrentSelectedModel = () => {
		if (provider === "openrouter") {
			return openRouterImageGenerationSelectedModel || getDefaultModel("openrouter")
		} else {
			return geminiImageGenerationSelectedModel || getDefaultModel("gemini")
		}
	}

	const [selectedModel, setSelectedModel] = useState(getCurrentSelectedModel())

	// Update local state when props change (e.g., when switching profiles)
	useEffect(() => {
		setOpenRouterApiKeyLocal(openRouterImageApiKey || "")
		setGeminiApiKeyLocal(geminiApiKey || "")
		const newProvider = imageGenerationProvider || "openrouter"
		setProvider(newProvider)
		// Calculate selected model based on the new provider value
		const newSelectedModel =
			newProvider === "openrouter"
				? openRouterImageGenerationSelectedModel || getDefaultModel("openrouter")
				: geminiImageGenerationSelectedModel || getDefaultModel("gemini")
		setSelectedModel(newSelectedModel)
	}, [
		openRouterImageApiKey,
		geminiApiKey,
		openRouterImageGenerationSelectedModel,
		geminiImageGenerationSelectedModel,
		imageGenerationProvider,
	])

	// Handle provider change
	const handleProviderChange = (value: ImageGenerationProvider) => {
		setProvider(value)
		if (setImageGenerationProvider) {
			setImageGenerationProvider(value as ImageGenerationProvider | undefined)
		}

		// Set default model for new provider
		const defaultModel = getDefaultModel(value)
		setSelectedModel(defaultModel)
		setImageGenerationSelectedModel(defaultModel)
	}

	// Handle API key changes
	const handleOpenRouterApiKeyChange = (value: string) => {
		setOpenRouterApiKeyLocal(value)
		setOpenRouterImageApiKey(value)
	}

	const handleGeminiApiKeyChange = (value: string) => {
		setGeminiApiKeyLocal(value)
		if (setGeminiApiKey) {
			setGeminiApiKey(value)
		}
	}

	// Handle model selection changes
	const handleModelChange = (value: string) => {
		setSelectedModel(value)
		setImageGenerationSelectedModel(value)
	}

	// Get current API key based on provider
	const getCurrentApiKey = () => {
		return provider === "openrouter" ? openRouterApiKeyLocal : geminiApiKeyLocal
	}

	return (
		<div className="space-y-4">
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
						<span className="font-medium">{t("settings:experimental.IMAGE_GENERATION.name")}</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					{t("settings:experimental.IMAGE_GENERATION.description")}
				</p>
			</div>

			{enabled && (
				<div className="ml-2 space-y-3">
					{/* Provider Selection */}
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.IMAGE_GENERATION.providerLabel")}
						</label>
						<VSCodeDropdown
							value={provider}
							onChange={(e: any) => handleProviderChange(e.target.value as ImageGenerationProvider)}
							className="w-full">
							<VSCodeOption value="openrouter" className="py-2 px-3">
								OpenRouter
							</VSCodeOption>
							<VSCodeOption value="gemini" className="py-2 px-3">
								Gemini
							</VSCodeOption>
						</VSCodeDropdown>
						<p className="text-vscode-descriptionForeground text-xs mt-1">
							{t("settings:experimental.IMAGE_GENERATION.providerDescription")}
						</p>
					</div>

					{/* API Key Configuration based on provider */}
					{provider === "openrouter" && (
						<div>
							<label className="block font-medium mb-1">
								{t("settings:experimental.IMAGE_GENERATION.openRouterApiKeyLabel")}
							</label>
							<VSCodeTextField
								value={openRouterApiKeyLocal}
								onInput={(e: any) => handleOpenRouterApiKeyChange(e.target.value)}
								placeholder={t("settings:experimental.IMAGE_GENERATION.openRouterApiKeyPlaceholder")}
								className="w-full"
								type="password"
							/>
							<p className="text-vscode-descriptionForeground text-xs mt-1">
								{t("settings:experimental.IMAGE_GENERATION.getApiKeyText")}{" "}
								<a
									href="https://openrouter.ai/keys"
									target="_blank"
									rel="noopener noreferrer"
									className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
									openrouter.ai/keys
								</a>
							</p>
						</div>
					)}

					{provider === "gemini" && (
						<div>
							<label className="block font-medium mb-1">
								{t("settings:experimental.IMAGE_GENERATION.geminiApiKeyLabel")}
							</label>
							<VSCodeTextField
								value={geminiApiKeyLocal}
								onInput={(e: any) => handleGeminiApiKeyChange(e.target.value)}
								placeholder={t("settings:experimental.IMAGE_GENERATION.geminiApiKeyPlaceholder")}
								className="w-full"
								type="password"
							/>
							<p className="text-vscode-descriptionForeground text-xs mt-1">
								{t("settings:experimental.IMAGE_GENERATION.geminiGetApiKeyText")}{" "}
								<a
									href="https://aistudio.google.com/app/apikey"
									target="_blank"
									rel="noopener noreferrer"
									className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
									Google AI Studio
								</a>
							</p>
						</div>
					)}

					{/* Model Selection */}
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.IMAGE_GENERATION.modelSelectionLabel")}
						</label>
						<VSCodeDropdown
							value={selectedModel}
							onChange={(e: any) => handleModelChange(e.target.value)}
							className="w-full">
							{availableModels.map((model) => (
								<VSCodeOption key={model.modelId} value={model.modelId} className="py-2 px-3">
									{model.label}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
						<p className="text-vscode-descriptionForeground text-xs mt-1">
							{t("settings:experimental.IMAGE_GENERATION.modelSelectionDescription")}
						</p>
					</div>

					{/* Status Message */}
					{enabled && !getCurrentApiKey() && (
						<div className="p-2 bg-vscode-editorWarning-background text-vscode-editorWarning-foreground rounded text-sm">
							{provider === "openrouter"
								? t("settings:experimental.IMAGE_GENERATION.warningMissingKey")
								: t("settings:experimental.IMAGE_GENERATION.warningMissingGeminiKey")}
						</div>
					)}

					{enabled && getCurrentApiKey() && (
						<div className="p-2 bg-vscode-editorInfo-background text-vscode-editorInfo-foreground rounded text-sm">
							{t("settings:experimental.IMAGE_GENERATION.successConfigured")}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
