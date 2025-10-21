import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Bell } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { Slider } from "../ui"

type NotificationSettingsProps = HTMLAttributes<HTMLDivElement> & {
	ttsEnabled?: boolean
	ttsSpeed?: number
	soundEnabled?: boolean
	soundVolume?: number
	setCachedStateField: SetCachedStateField<"ttsEnabled" | "ttsSpeed" | "soundEnabled" | "soundVolume">
}

export const NotificationSettings = ({
	ttsEnabled,
	ttsSpeed,
	soundEnabled,
	soundVolume,
	setCachedStateField,
	...props
}: NotificationSettingsProps) => {
	const { t } = useAppTranslation()
	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Bell className="w-4" />
					<div>{t("settings:sections.notifications")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<div className="flex items-center space-x-2">
						<Checkbox
							checked={ttsEnabled}
							onCheckedChange={(checked) => setCachedStateField("ttsEnabled", checked === true)}
							data-testid="tts-enabled-checkbox"
						/>
						<span className="font-medium">{t("settings:notifications.tts.label")}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notifications.tts.description")}
					</div>
				</div>

				{ttsEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<label className="block font-medium mb-1">
								{t("settings:notifications.tts.speedLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={0.1}
									max={2.0}
									step={0.01}
									value={[ttsSpeed ?? 1.0]}
									onValueChange={([value]) => setCachedStateField("ttsSpeed", value)}
									data-testid="tts-speed-slider"
								/>
								<span className="w-10">{((ttsSpeed ?? 1.0) * 100).toFixed(0)}%</span>
							</div>
						</div>
					</div>
				)}

				<div>
					<div className="flex items-center space-x-2">
						<Checkbox
							checked={soundEnabled}
							onCheckedChange={(checked) => setCachedStateField("soundEnabled", checked === true)}
							data-testid="sound-enabled-checkbox"
						/>
						<span className="font-medium">{t("settings:notifications.sound.label")}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notifications.sound.description")}
					</div>
				</div>

				{soundEnabled && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<label className="block font-medium mb-1">
								{t("settings:notifications.sound.volumeLabel")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={1}
									step={0.01}
									value={[soundVolume ?? 0.5]}
									onValueChange={([value]) => setCachedStateField("soundVolume", value)}
									data-testid="sound-volume-slider"
								/>
								<span className="w-10">{((soundVolume ?? 0.5) * 100).toFixed(0)}%</span>
							</div>
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
