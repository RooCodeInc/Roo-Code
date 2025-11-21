import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Trans } from "react-i18next"
import { Info, Download, Upload, TriangleAlert } from "lucide-react"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { TelemetrySetting } from "@roo-code/types"

import { Package } from "@roo/package"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type AboutProps = HTMLAttributes<HTMLDivElement> & {
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
	taskHistoryRetention: string
	setTaskHistoryRetention: (value: "never" | "90" | "60" | "30" | "7" | "3") => void
}

export const About = ({
	telemetrySetting,
	setTelemetrySetting,
	taskHistoryRetention,
	setTaskHistoryRetention,
	className,
	...props
}: AboutProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader
				description={
					Package.sha
						? `Version: ${Package.version} (${Package.sha.slice(0, 8)})`
						: `Version: ${Package.version}`
				}>
				<div className="flex items-center gap-2">
					<Info className="w-4" />
					<div>{t("settings:sections.about")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox
						checked={telemetrySetting !== "disabled"}
						onChange={(e: any) => {
							const checked = e.target.checked === true
							setTelemetrySetting(checked ? "enabled" : "disabled")
						}}>
						{t("settings:footer.telemetry.label")}
					</VSCodeCheckbox>
					<p className="text-vscode-descriptionForeground text-sm mt-0">
						<Trans
							i18nKey="settings:footer.telemetry.description"
							components={{
								privacyLink: <VSCodeLink href="https://roocode.com/privacy" />,
							}}
						/>
					</p>
				</div>

				<div>
					<Trans
						i18nKey="settings:footer.feedback"
						components={{
							githubLink: <VSCodeLink href="https://github.com/RooCodeInc/Roo-Code" />,
							redditLink: <VSCodeLink href="https://reddit.com/r/RooCode" />,
							discordLink: <VSCodeLink href="https://discord.gg/roocode" />,
						}}
					/>
				</div>

				<div className="mt-4">
					<label className="block font-medium mb-1">{t("settings:aboutRetention.label")}</label>
					<Select
						value={(taskHistoryRetention ?? "never").toString()}
						onValueChange={(value: "never" | "90" | "60" | "30" | "7" | "3") => {
							setTaskHistoryRetention(value)
						}}>
						<SelectTrigger className="w-64">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="never">{t("settings:aboutRetention.options.never")}</SelectItem>
							<SelectItem value="90">{t("settings:aboutRetention.options.90")}</SelectItem>
							<SelectItem value="60">{t("settings:aboutRetention.options.60")}</SelectItem>
							<SelectItem value="30">{t("settings:aboutRetention.options.30")}</SelectItem>
							<SelectItem value="7">{t("settings:aboutRetention.options.7")}</SelectItem>
							<SelectItem value="3">{t("settings:aboutRetention.options.3")}</SelectItem>
						</SelectContent>
					</Select>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:aboutRetention.description")}
					</div>
					<div className="text-red-500 text-sm mt-1">{t("settings:aboutRetention.warning")}</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 mt-2">
					<Button onClick={() => vscode.postMessage({ type: "exportSettings" })} className="w-28">
						<Upload className="p-0.5" />
						{t("settings:footer.settings.export")}
					</Button>
					<Button onClick={() => vscode.postMessage({ type: "importSettings" })} className="w-28">
						<Download className="p-0.5" />
						{t("settings:footer.settings.import")}
					</Button>
					<Button
						variant="destructive"
						onClick={() => vscode.postMessage({ type: "resetState" })}
						className="w-28">
						<TriangleAlert className="p-0.5" />
						{t("settings:footer.settings.reset")}
					</Button>
				</div>
			</Section>
		</div>
	)
}
