import { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"

import type { Experiments, ImageGenerationProvider } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"

import { SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { ImageGenerationSettings } from "./ImageGenerationSettings"
import { SpeechToTextSettings, SpeechToTextProvider } from "./SpeechToTextSettings"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	apiConfiguration?: any
	setApiConfigurationField?: any
	imageGenerationProvider?: ImageGenerationProvider
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	setImageGenerationProvider?: (provider: ImageGenerationProvider) => void
	setOpenRouterImageApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel?: (model: string) => void
	// Speech-to-text settings
	speechToTextEnabled?: boolean
	speechToTextProvider?: SpeechToTextProvider
	deepgramApiKey?: string
	deepgramModel?: string
	deepgramLanguage?: string
	setSpeechToTextEnabled?: (enabled: boolean) => void
	setSpeechToTextProvider?: (provider: SpeechToTextProvider) => void
	setDeepgramApiKey?: (apiKey: string) => void
	setDeepgramModel?: (model: string) => void
	setDeepgramLanguage?: (language: string) => void
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	apiConfiguration,
	setApiConfigurationField,
	imageGenerationProvider,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	setImageGenerationProvider,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	// Speech-to-text settings
	speechToTextEnabled,
	speechToTextProvider,
	deepgramApiKey,
	deepgramModel,
	deepgramLanguage,
	setSpeechToTextEnabled,
	setSpeechToTextProvider,
	setDeepgramApiKey,
	setDeepgramModel,
	setDeepgramLanguage,
	className,
	...props
}: ExperimentalSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<FlaskConical className="w-4" />
					<div>{t("settings:sections.experimental")}</div>
				</div>
			</SectionHeader>

			<Section>
				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
					// Hide MULTIPLE_NATIVE_TOOL_CALLS - feature is on hold
					.filter(([key]) => key !== "MULTIPLE_NATIVE_TOOL_CALLS")
					.map((config) => {
						if (config[0] === "MULTI_FILE_APPLY_DIFF") {
							return (
								<ExperimentalFeature
									key={config[0]}
									experimentKey={config[0]}
									enabled={experiments[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF, enabled)
									}
								/>
							)
						}
						if (
							config[0] === "IMAGE_GENERATION" &&
							setImageGenerationProvider &&
							setOpenRouterImageApiKey &&
							setImageGenerationSelectedModel
						) {
							return (
								<ImageGenerationSettings
									key={config[0]}
									enabled={experiments[EXPERIMENT_IDS.IMAGE_GENERATION] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.IMAGE_GENERATION, enabled)
									}
									imageGenerationProvider={imageGenerationProvider}
									openRouterImageApiKey={openRouterImageApiKey}
									openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
									setImageGenerationProvider={setImageGenerationProvider}
									setOpenRouterImageApiKey={setOpenRouterImageApiKey}
									setImageGenerationSelectedModel={setImageGenerationSelectedModel}
								/>
							)
						}
						return (
							<ExperimentalFeature
								key={config[0]}
								experimentKey={config[0]}
								enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
								onChange={(enabled) =>
									setExperimentEnabled(
										EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
										enabled,
									)
								}
							/>
						)
					})}

				{/* Speech-to-Text Settings */}
				{setSpeechToTextEnabled && setDeepgramApiKey && setDeepgramModel && setDeepgramLanguage && (
					<SpeechToTextSettings
						enabled={speechToTextEnabled ?? false}
						onChange={setSpeechToTextEnabled}
						speechToTextProvider={speechToTextProvider}
						deepgramApiKey={deepgramApiKey}
						deepgramModel={deepgramModel}
						deepgramLanguage={deepgramLanguage}
						setSpeechToTextProvider={setSpeechToTextProvider}
						setDeepgramApiKey={setDeepgramApiKey}
						setDeepgramModel={setDeepgramModel}
						setDeepgramLanguage={setDeepgramLanguage}
					/>
				)}
			</Section>
		</div>
	)
}
