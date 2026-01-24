import { HTMLAttributes } from "react"
import { Trans } from "react-i18next"
import {
	VSCodeCheckbox,
	VSCodeTextField,
	VSCodeDropdown,
	VSCodeOption,
	VSCodeLink,
} from "@vscode/webview-ui-toolkit/react"

import { type EmbedderProvider, CODEBASE_INDEX_DEFAULTS, type CodebaseIndexConfig } from "@roo-code/types"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import {
	useOpenRouterModelProviders,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
} from "@src/components/ui/hooks/useOpenRouterModelProviders"

import { SearchableSetting } from "./SearchableSetting"
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { SectionName } from "./SettingsView"

// Default URLs for providers
const DEFAULT_QDRANT_URL = "http://localhost:6333"
const DEFAULT_OLLAMA_URL = "http://localhost:11434"

type IndexingSettingsProps = HTMLAttributes<HTMLDivElement> & {
	// Nested config object from ExtensionState
	codebaseIndexConfig: CodebaseIndexConfig | undefined
	// Callback to update the nested config
	onConfigChange: (config: Partial<CodebaseIndexConfig>) => void
}

export const IndexingSettings = ({ codebaseIndexConfig, onConfigChange, ...props }: IndexingSettingsProps) => {
	const { t } = useAppTranslation()
	const { codebaseIndexModels, apiConfiguration } = useExtensionState()

	// Extract values from nested config
	const codebaseIndexEnabled = codebaseIndexConfig?.codebaseIndexEnabled ?? false
	const codebaseIndexQdrantUrl = codebaseIndexConfig?.codebaseIndexQdrantUrl ?? ""
	const codebaseIndexEmbedderProvider = codebaseIndexConfig?.codebaseIndexEmbedderProvider ?? "openai"
	const codebaseIndexEmbedderBaseUrl = codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl ?? ""
	const codebaseIndexEmbedderModelId = codebaseIndexConfig?.codebaseIndexEmbedderModelId ?? ""
	const codebaseIndexEmbedderModelDimension = codebaseIndexConfig?.codebaseIndexEmbedderModelDimension
	const codebaseIndexOpenAiCompatibleBaseUrl = codebaseIndexConfig?.codebaseIndexOpenAiCompatibleBaseUrl ?? ""
	const codebaseIndexBedrockRegion = codebaseIndexConfig?.codebaseIndexBedrockRegion ?? ""
	const codebaseIndexBedrockProfile = codebaseIndexConfig?.codebaseIndexBedrockProfile ?? ""
	const codebaseIndexSearchMaxResults = codebaseIndexConfig?.codebaseIndexSearchMaxResults
	const codebaseIndexSearchMinScore = codebaseIndexConfig?.codebaseIndexSearchMinScore
	const codebaseIndexOpenRouterSpecificProvider = codebaseIndexConfig?.codebaseIndexOpenRouterSpecificProvider ?? ""

	// Helper to update a single field
	const updateField = <K extends keyof CodebaseIndexConfig>(key: K, value: CodebaseIndexConfig[K]) => {
		onConfigChange({ [key]: value } as Partial<CodebaseIndexConfig>)
	}

	const getAvailableModels = () => {
		if (!codebaseIndexModels) return []
		const models = codebaseIndexModels[codebaseIndexEmbedderProvider as keyof typeof codebaseIndexModels]
		return models ? Object.keys(models) : []
	}

	// Fetch OpenRouter model providers for embedding model
	const { data: openRouterEmbeddingProviders } = useOpenRouterModelProviders(
		codebaseIndexEmbedderProvider === "openrouter" ? codebaseIndexEmbedderModelId : undefined,
		undefined,
		{
			enabled: codebaseIndexEmbedderProvider === "openrouter" && !!codebaseIndexEmbedderModelId,
		},
	)

	// Helper to handle provider change and auto-populate bedrock settings
	const handleProviderChange = (value: EmbedderProvider) => {
		// Update provider and clear model selection
		const updates: Partial<CodebaseIndexConfig> = {
			codebaseIndexEmbedderProvider: value,
			codebaseIndexEmbedderModelId: "",
		}

		// Auto-populate Region and Profile when switching to Bedrock
		// if the main API provider is also configured for Bedrock
		if (value === "bedrock" && apiConfiguration?.apiProvider === "bedrock") {
			// Only populate if currently empty
			if (!codebaseIndexBedrockRegion && apiConfiguration.awsRegion) {
				updates.codebaseIndexBedrockRegion = apiConfiguration.awsRegion
			}
			if (!codebaseIndexBedrockProfile && apiConfiguration.awsProfile) {
				updates.codebaseIndexBedrockProfile = apiConfiguration.awsProfile
			}
		}

		onConfigChange(updates)
	}

	// Note: We're using a fixed section name that matches what's in SettingsView
	// This is safe because "indexing" will be added to sectionNames
	const sectionName = "indexing" as SectionName

	return (
		<div {...props}>
			<SectionHeader>{t("settings:sections.indexing")}</SectionHeader>

			<Section>
				{/* Description */}
				<div className="text-vscode-descriptionForeground text-sm mb-4">
					<Trans i18nKey="settings:codeIndex.description">
						<VSCodeLink
							href={buildDocLink("features/experimental/codebase-indexing", "settings")}
							style={{ display: "inline" }}
						/>
					</Trans>
				</div>

				{/* Enable/Disable Toggle */}
				<SearchableSetting
					settingId="indexing-enable"
					section={sectionName}
					label={t("settings:codeIndex.enableLabel")}>
					<VSCodeCheckbox
						checked={codebaseIndexEnabled}
						onChange={(e: any) => updateField("codebaseIndexEnabled", e.target.checked)}>
						<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:codeIndex.enableDescription")}
					</div>
				</SearchableSetting>

				{/* Configuration settings (only shown when enabled) */}
				{codebaseIndexEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background mt-4">
						{/* Embedder Provider Selection */}
						<SearchableSetting
							settingId="indexing-provider"
							section={sectionName}
							label={t("settings:codeIndex.embedderProviderLabel")}>
							<label className="block font-medium mb-1">
								{t("settings:codeIndex.embedderProviderLabel")}
							</label>
							<Select
								value={codebaseIndexEmbedderProvider}
								onValueChange={(value: EmbedderProvider) => handleProviderChange(value)}>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="openai">{t("settings:codeIndex.openaiProvider")}</SelectItem>
									<SelectItem value="ollama">{t("settings:codeIndex.ollamaProvider")}</SelectItem>
									<SelectItem value="openai-compatible">
										{t("settings:codeIndex.openaiCompatibleProvider")}
									</SelectItem>
									<SelectItem value="gemini">{t("settings:codeIndex.geminiProvider")}</SelectItem>
									<SelectItem value="mistral">{t("settings:codeIndex.mistralProvider")}</SelectItem>
									<SelectItem value="vercel-ai-gateway">
										{t("settings:codeIndex.vercelAiGatewayProvider")}
									</SelectItem>
									<SelectItem value="bedrock">{t("settings:codeIndex.bedrockProvider")}</SelectItem>
									<SelectItem value="openrouter">
										{t("settings:codeIndex.openRouterProvider")}
									</SelectItem>
								</SelectContent>
							</Select>
						</SearchableSetting>

						{/* OpenAI Settings */}
						{codebaseIndexEmbedderProvider === "openai" && (
							<>
								<SearchableSetting
									settingId="indexing-openai-model"
									section={sectionName}
									label={t("settings:codeIndex.modelLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.modelLabel")}
									</label>
									<VSCodeDropdown
										value={codebaseIndexEmbedderModelId}
										onChange={(e: any) =>
											updateField("codebaseIndexEmbedderModelId", e.target.value)
										}>
										<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
										{getAvailableModels().map((modelId) => {
											const model =
												codebaseIndexModels?.["openai" as keyof typeof codebaseIndexModels]?.[
													modelId
												]
											return (
												<VSCodeOption key={modelId} value={modelId}>
													{modelId}{" "}
													{model
														? t("settings:codeIndex.modelDimensions", {
																dimension: model.dimension,
															})
														: ""}
												</VSCodeOption>
											)
										})}
									</VSCodeDropdown>
								</SearchableSetting>
							</>
						)}

						{/* Ollama Settings */}
						{codebaseIndexEmbedderProvider === "ollama" && (
							<>
								<SearchableSetting
									settingId="indexing-ollama-url"
									section={sectionName}
									label={t("settings:codeIndex.ollamaBaseUrlLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.ollamaBaseUrlLabel")}
									</label>
									<VSCodeTextField
										value={codebaseIndexEmbedderBaseUrl}
										onInput={(e: any) =>
											updateField("codebaseIndexEmbedderBaseUrl", e.target.value)
										}
										onBlur={(e: any) => {
											if (!e.target.value.trim()) {
												updateField("codebaseIndexEmbedderBaseUrl", DEFAULT_OLLAMA_URL)
											}
										}}
										placeholder={t("settings:codeIndex.ollamaUrlPlaceholder")}
										className="w-full"
									/>
								</SearchableSetting>

								<SearchableSetting
									settingId="indexing-ollama-model"
									section={sectionName}
									label={t("settings:codeIndex.modelLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.modelLabel")}
									</label>
									<VSCodeTextField
										value={codebaseIndexEmbedderModelId}
										onInput={(e: any) =>
											updateField("codebaseIndexEmbedderModelId", e.target.value)
										}
										placeholder={t("settings:codeIndex.modelPlaceholder")}
										className="w-full"
									/>
								</SearchableSetting>

								<SearchableSetting
									settingId="indexing-ollama-dimension"
									section={sectionName}
									label={t("settings:codeIndex.modelDimensionLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.modelDimensionLabel")}
									</label>
									<VSCodeTextField
										value={codebaseIndexEmbedderModelDimension?.toString() ?? ""}
										onInput={(e: any) => {
											const value = e.target.value
												? parseInt(e.target.value, 10) || undefined
												: undefined
											updateField("codebaseIndexEmbedderModelDimension", value)
										}}
										placeholder={t("settings:codeIndex.modelDimensionPlaceholder")}
										className="w-full"
									/>
								</SearchableSetting>
							</>
						)}

						{/* OpenAI Compatible Settings */}
						{codebaseIndexEmbedderProvider === "openai-compatible" && (
							<>
								<SearchableSetting
									settingId="indexing-openai-compatible-url"
									section={sectionName}
									label={t("settings:codeIndex.openAiCompatibleBaseUrlLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.openAiCompatibleBaseUrlLabel")}
									</label>
									<VSCodeTextField
										value={codebaseIndexOpenAiCompatibleBaseUrl}
										onInput={(e: any) =>
											updateField("codebaseIndexOpenAiCompatibleBaseUrl", e.target.value)
										}
										placeholder={t("settings:codeIndex.openAiCompatibleBaseUrlPlaceholder")}
										className="w-full"
									/>
								</SearchableSetting>

								<SearchableSetting
									settingId="indexing-openai-compatible-model"
									section={sectionName}
									label={t("settings:codeIndex.modelLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.modelLabel")}
									</label>
									<VSCodeTextField
										value={codebaseIndexEmbedderModelId}
										onInput={(e: any) =>
											updateField("codebaseIndexEmbedderModelId", e.target.value)
										}
										placeholder={t("settings:codeIndex.modelPlaceholder")}
										className="w-full"
									/>
								</SearchableSetting>

								<SearchableSetting
									settingId="indexing-openai-compatible-dimension"
									section={sectionName}
									label={t("settings:codeIndex.modelDimensionLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.modelDimensionLabel")}
									</label>
									<VSCodeTextField
										value={codebaseIndexEmbedderModelDimension?.toString() ?? ""}
										onInput={(e: any) => {
											const value = e.target.value
												? parseInt(e.target.value, 10) || undefined
												: undefined
											updateField("codebaseIndexEmbedderModelDimension", value)
										}}
										placeholder={t("settings:codeIndex.modelDimensionPlaceholder")}
										className="w-full"
									/>
									<div className="text-vscode-descriptionForeground text-sm mt-1">
										{t("settings:codeIndex.openAiCompatibleModelDimensionDescription")}
									</div>
								</SearchableSetting>
							</>
						)}

						{/* Gemini Settings */}
						{codebaseIndexEmbedderProvider === "gemini" && (
							<SearchableSetting
								settingId="indexing-gemini-model"
								section={sectionName}
								label={t("settings:codeIndex.modelLabel")}>
								<label className="block font-medium mb-1">{t("settings:codeIndex.modelLabel")}</label>
								<VSCodeDropdown
									value={codebaseIndexEmbedderModelId}
									onChange={(e: any) => updateField("codebaseIndexEmbedderModelId", e.target.value)}>
									<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
									{getAvailableModels().map((modelId) => {
										const model =
											codebaseIndexModels?.["gemini" as keyof typeof codebaseIndexModels]?.[
												modelId
											]
										return (
											<VSCodeOption key={modelId} value={modelId}>
												{modelId}{" "}
												{model
													? t("settings:codeIndex.modelDimensions", {
															dimension: model.dimension,
														})
													: ""}
											</VSCodeOption>
										)
									})}
								</VSCodeDropdown>
							</SearchableSetting>
						)}

						{/* Mistral Settings */}
						{codebaseIndexEmbedderProvider === "mistral" && (
							<SearchableSetting
								settingId="indexing-mistral-model"
								section={sectionName}
								label={t("settings:codeIndex.modelLabel")}>
								<label className="block font-medium mb-1">{t("settings:codeIndex.modelLabel")}</label>
								<VSCodeDropdown
									value={codebaseIndexEmbedderModelId}
									onChange={(e: any) => updateField("codebaseIndexEmbedderModelId", e.target.value)}>
									<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
									{getAvailableModels().map((modelId) => {
										const model =
											codebaseIndexModels?.["mistral" as keyof typeof codebaseIndexModels]?.[
												modelId
											]
										return (
											<VSCodeOption key={modelId} value={modelId}>
												{modelId}{" "}
												{model
													? t("settings:codeIndex.modelDimensions", {
															dimension: model.dimension,
														})
													: ""}
											</VSCodeOption>
										)
									})}
								</VSCodeDropdown>
							</SearchableSetting>
						)}

						{/* Vercel AI Gateway Settings */}
						{codebaseIndexEmbedderProvider === "vercel-ai-gateway" && (
							<SearchableSetting
								settingId="indexing-vercel-model"
								section={sectionName}
								label={t("settings:codeIndex.modelLabel")}>
								<label className="block font-medium mb-1">{t("settings:codeIndex.modelLabel")}</label>
								<VSCodeDropdown
									value={codebaseIndexEmbedderModelId}
									onChange={(e: any) => updateField("codebaseIndexEmbedderModelId", e.target.value)}>
									<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
									{getAvailableModels().map((modelId) => {
										const model =
											codebaseIndexModels?.[
												"vercel-ai-gateway" as keyof typeof codebaseIndexModels
											]?.[modelId]
										return (
											<VSCodeOption key={modelId} value={modelId}>
												{modelId}{" "}
												{model
													? t("settings:codeIndex.modelDimensions", {
															dimension: model.dimension,
														})
													: ""}
											</VSCodeOption>
										)
									})}
								</VSCodeDropdown>
							</SearchableSetting>
						)}

						{/* Bedrock Settings */}
						{codebaseIndexEmbedderProvider === "bedrock" && (
							<>
								<SearchableSetting
									settingId="indexing-bedrock-region"
									section={sectionName}
									label={t("settings:codeIndex.bedrockRegionLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.bedrockRegionLabel")}
									</label>
									<VSCodeTextField
										value={codebaseIndexBedrockRegion}
										onInput={(e: any) => updateField("codebaseIndexBedrockRegion", e.target.value)}
										placeholder={t("settings:codeIndex.bedrockRegionPlaceholder")}
										className="w-full"
									/>
								</SearchableSetting>

								<SearchableSetting
									settingId="indexing-bedrock-profile"
									section={sectionName}
									label={t("settings:codeIndex.bedrockProfileLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.bedrockProfileLabel")}
										<span className="text-xs text-vscode-descriptionForeground ml-1">
											({t("settings:codeIndex.optional")})
										</span>
									</label>
									<VSCodeTextField
										value={codebaseIndexBedrockProfile}
										onInput={(e: any) => updateField("codebaseIndexBedrockProfile", e.target.value)}
										placeholder={t("settings:codeIndex.bedrockProfilePlaceholder")}
										className="w-full"
									/>
									<div className="text-vscode-descriptionForeground text-sm mt-1">
										{t("settings:codeIndex.bedrockProfileDescription")}
									</div>
								</SearchableSetting>

								<SearchableSetting
									settingId="indexing-bedrock-model"
									section={sectionName}
									label={t("settings:codeIndex.modelLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.modelLabel")}
									</label>
									<VSCodeDropdown
										value={codebaseIndexEmbedderModelId}
										onChange={(e: any) =>
											updateField("codebaseIndexEmbedderModelId", e.target.value)
										}>
										<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
										{getAvailableModels().map((modelId) => {
											const model =
												codebaseIndexModels?.["bedrock" as keyof typeof codebaseIndexModels]?.[
													modelId
												]
											return (
												<VSCodeOption key={modelId} value={modelId}>
													{modelId}{" "}
													{model
														? t("settings:codeIndex.modelDimensions", {
																dimension: model.dimension,
															})
														: ""}
												</VSCodeOption>
											)
										})}
									</VSCodeDropdown>
								</SearchableSetting>
							</>
						)}

						{/* OpenRouter Settings */}
						{codebaseIndexEmbedderProvider === "openrouter" && (
							<>
								<SearchableSetting
									settingId="indexing-openrouter-model"
									section={sectionName}
									label={t("settings:codeIndex.modelLabel")}>
									<label className="block font-medium mb-1">
										{t("settings:codeIndex.modelLabel")}
									</label>
									<VSCodeDropdown
										value={codebaseIndexEmbedderModelId}
										onChange={(e: any) =>
											updateField("codebaseIndexEmbedderModelId", e.target.value)
										}>
										<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
										{getAvailableModels().map((modelId) => {
											const model =
												codebaseIndexModels?.[
													"openrouter" as keyof typeof codebaseIndexModels
												]?.[modelId]
											return (
												<VSCodeOption key={modelId} value={modelId}>
													{modelId}{" "}
													{model
														? t("settings:codeIndex.modelDimensions", {
																dimension: model.dimension,
															})
														: ""}
												</VSCodeOption>
											)
										})}
									</VSCodeDropdown>
								</SearchableSetting>

								{/* Provider Routing for OpenRouter */}
								{openRouterEmbeddingProviders &&
									Object.keys(openRouterEmbeddingProviders).length > 0 && (
										<SearchableSetting
											settingId="indexing-openrouter-provider"
											section={sectionName}
											label={t("settings:codeIndex.openRouterProviderRoutingLabel")}>
											<label className="block font-medium mb-1">
												<a
													href="https://openrouter.ai/docs/features/provider-routing"
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-1 hover:underline">
													{t("settings:codeIndex.openRouterProviderRoutingLabel")}
													<span className="codicon codicon-link-external text-xs" />
												</a>
											</label>
											<Select
												value={
													codebaseIndexOpenRouterSpecificProvider ||
													OPENROUTER_DEFAULT_PROVIDER_NAME
												}
												onValueChange={(value) =>
													updateField("codebaseIndexOpenRouterSpecificProvider", value)
												}>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={OPENROUTER_DEFAULT_PROVIDER_NAME}>
														{OPENROUTER_DEFAULT_PROVIDER_NAME}
													</SelectItem>
													{Object.entries(openRouterEmbeddingProviders).map(
														([value, { label }]) => (
															<SelectItem key={value} value={value}>
																{label}
															</SelectItem>
														),
													)}
												</SelectContent>
											</Select>
											<div className="text-vscode-descriptionForeground text-sm mt-1">
												{t("settings:codeIndex.openRouterProviderRoutingDescription")}
											</div>
										</SearchableSetting>
									)}
							</>
						)}

						{/* Qdrant Settings */}
						<SearchableSetting
							settingId="indexing-qdrant-url"
							section={sectionName}
							label={t("settings:codeIndex.qdrantUrlLabel")}>
							<label className="block font-medium mb-1">{t("settings:codeIndex.qdrantUrlLabel")}</label>
							<VSCodeTextField
								value={codebaseIndexQdrantUrl}
								onInput={(e: any) => updateField("codebaseIndexQdrantUrl", e.target.value)}
								onBlur={(e: any) => {
									if (!e.target.value.trim()) {
										updateField("codebaseIndexQdrantUrl", DEFAULT_QDRANT_URL)
									}
								}}
								placeholder={t("settings:codeIndex.qdrantUrlPlaceholder")}
								className="w-full"
							/>
						</SearchableSetting>

						{/* Advanced Settings */}
						<h4 className="text-sm font-medium mt-4 mb-2">{t("settings:codeIndex.advancedConfigLabel")}</h4>

						{/* Search Score Threshold */}
						<SearchableSetting
							settingId="indexing-search-score"
							section={sectionName}
							label={t("settings:codeIndex.searchMinScoreLabel")}>
							<label className="block font-medium mb-1">
								{t("settings:codeIndex.searchMinScoreLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={CODEBASE_INDEX_DEFAULTS.MIN_SEARCH_SCORE}
									max={CODEBASE_INDEX_DEFAULTS.MAX_SEARCH_SCORE}
									step={CODEBASE_INDEX_DEFAULTS.SEARCH_SCORE_STEP}
									value={[
										codebaseIndexSearchMinScore ?? CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
									]}
									onValueChange={(values) => updateField("codebaseIndexSearchMinScore", values[0])}
								/>
								<span className="w-12 text-center">
									{(
										codebaseIndexSearchMinScore ?? CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE
									).toFixed(2)}
								</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:codeIndex.searchMinScoreDescription")}
							</div>
						</SearchableSetting>

						{/* Maximum Search Results */}
						<SearchableSetting
							settingId="indexing-search-results"
							section={sectionName}
							label={t("settings:codeIndex.searchMaxResultsLabel")}>
							<label className="block font-medium mb-1">
								{t("settings:codeIndex.searchMaxResultsLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={CODEBASE_INDEX_DEFAULTS.MIN_SEARCH_RESULTS}
									max={CODEBASE_INDEX_DEFAULTS.MAX_SEARCH_RESULTS}
									step={CODEBASE_INDEX_DEFAULTS.SEARCH_RESULTS_STEP}
									value={[
										codebaseIndexSearchMaxResults ?? CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
									]}
									onValueChange={(values) => updateField("codebaseIndexSearchMaxResults", values[0])}
								/>
								<span className="w-12 text-center">
									{codebaseIndexSearchMaxResults ?? CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS}
								</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:codeIndex.searchMaxResultsDescription")}
							</div>
						</SearchableSetting>

						{/* Note about API keys */}
						<div className="mt-4 p-3 bg-vscode-inputValidation-infoBackground border border-vscode-inputValidation-infoBorder rounded">
							<p className="text-sm text-vscode-inputValidation-infoForeground m-0">
								<strong>Note:</strong> API keys for indexing providers (OpenAI, Gemini, Mistral, etc.)
								are configured in the Codebase Indexing popover accessible from the chat interface
								status bar.
							</p>
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
