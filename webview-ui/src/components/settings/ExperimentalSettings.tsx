import { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"

import type { Experiments } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"

import { SetExperimentEnabled, SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { ImageGenerationSettings } from "./ImageGenerationSettings"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	// Include Files Changed Overview toggle in Experimental section per review feedback
	filesChangedEnabled?: boolean
	setCachedStateField?: SetCachedStateField<"filesChangedEnabled">
	apiConfiguration?: any
	setApiConfigurationField?: any
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	setOpenRouterImageApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel?: (model: string) => void
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	filesChangedEnabled,
	setCachedStateField,
	apiConfiguration,
	setApiConfigurationField,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
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

			{/* Files Changed Overview (moved from UI section to Experimental) */}
			{typeof filesChangedEnabled !== "undefined" && setCachedStateField && (
				<Section>
					<div>
						<VSCodeCheckbox
							checked={filesChangedEnabled}
							onChange={(e: any) => setCachedStateField("filesChangedEnabled", e.target.checked)}
							data-testid="files-changed-enabled-checkbox">
							{/* Reuse existing translation keys to avoid i18n churn */}
							<label className="block font-medium mb-1">{t("settings:ui.filesChanged.label")}</label>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
							{t("settings:ui.filesChanged.description")}
						</div>
					</div>
				</Section>
			)}

			<Section>
				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
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
									openRouterImageApiKey={openRouterImageApiKey}
									openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
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
			</Section>
		</div>
	)
}
