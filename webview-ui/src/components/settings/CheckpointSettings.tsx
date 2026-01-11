import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { GitBranch } from "lucide-react"
import { Trans } from "react-i18next"
import { buildDocLink } from "@src/utils/docLinks"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"
import {
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	MAX_CHECKPOINT_TIMEOUT_SECONDS,
	MIN_CHECKPOINT_TIMEOUT_SECONDS,
} from "@roo-code/types"

type CheckpointSettingsProps = HTMLAttributes<HTMLDivElement> & {
	enableCheckpoints?: boolean
	checkpointTimeout?: number
	setCachedStateField: SetCachedStateField<"enableCheckpoints" | "checkpointTimeout">
}

export const CheckpointSettings = ({
	enableCheckpoints,
	checkpointTimeout,
	setCachedStateField,
	...props
}: CheckpointSettingsProps) => {
	const { t } = useAppTranslation()
	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<GitBranch className="w-4" />
					<div>{t("settings:sections.checkpoints")}</div>
				</div>
			</SectionHeader>

			<Section>
				<SearchableSetting
					settingId="checkpoints-enable"
					section="checkpoints"
					label={t("settings:checkpoints.enable.label")}>
					<VSCodeCheckbox
						checked={enableCheckpoints}
						onChange={(e: any) => {
							setCachedStateField("enableCheckpoints", e.target.checked)
						}}>
						<span className="font-medium">{t("settings:checkpoints.enable.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						<Trans i18nKey="settings:checkpoints.enable.description">
							<VSCodeLink
								href={buildDocLink("features/checkpoints", "settings_checkpoints")}
								style={{ display: "inline" }}>
								{" "}
							</VSCodeLink>
						</Trans>
					</div>
				</SearchableSetting>

				{enableCheckpoints && (
					<SearchableSetting
						settingId="checkpoints-timeout"
						section="checkpoints"
						label={t("settings:checkpoints.timeout.label")}
						className="mt-4">
						<label className="block text-sm font-medium mb-2">
							{t("settings:checkpoints.timeout.label")}
						</label>
						<div className="flex items-center gap-2">
							<Slider
								min={MIN_CHECKPOINT_TIMEOUT_SECONDS}
								max={MAX_CHECKPOINT_TIMEOUT_SECONDS}
								step={1}
								defaultValue={[checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS]}
								onValueChange={([value]) => {
									setCachedStateField("checkpointTimeout", value)
								}}
								className="flex-1"
								data-testid="checkpoint-timeout-slider"
							/>
							<span className="w-12 text-center">
								{checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS}
							</span>
						</div>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:checkpoints.timeout.description")}
						</div>
					</SearchableSetting>
				)}
			</Section>
		</div>
	)
}
