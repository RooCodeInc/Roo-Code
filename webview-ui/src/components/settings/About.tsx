import { HTMLAttributes, useState, useCallback, useEffect, useRef } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Trans } from "react-i18next"
import {
	Download,
	Upload,
	TriangleAlert,
	Bug,
	Lightbulb,
	Shield,
	MessageCircle,
	MessagesSquare,
	RefreshCw,
	HardDrive,
	Loader2,
} from "lucide-react"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { TelemetrySetting, TaskHistoryRetentionSetting } from "@roo-code/types"

import { Package } from "@roo/package"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"

type TaskHistorySize = {
	totalBytes: number
	taskCount: number
	formattedSize: string
}

type AboutProps = HTMLAttributes<HTMLDivElement> & {
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
	debug?: boolean
	setDebug?: (debug: boolean) => void
	taskHistoryRetention: TaskHistoryRetentionSetting
	setTaskHistoryRetention: (value: TaskHistoryRetentionSetting) => void
	taskHistorySize?: TaskHistorySize
}

export const About = ({
	telemetrySetting,
	setTelemetrySetting,
	debug,
	setDebug,
	taskHistoryRetention,
	setTaskHistoryRetention,
	taskHistorySize,
	className,
	...props
}: AboutProps) => {
	const { t } = useAppTranslation()
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [cachedSize, setCachedSize] = useState<TaskHistorySize | undefined>(taskHistorySize)
	const didRequestInitialSize = useRef(false)

	// Update cached size when taskHistorySize changes and reset refreshing state
	useEffect(() => {
		if (taskHistorySize) {
			setCachedSize(taskHistorySize)
			setIsRefreshing(false)
		}
	}, [taskHistorySize])

	// Trigger initial task history size calculation when this tab mounts
	useEffect(() => {
		if (didRequestInitialSize.current) return
		didRequestInitialSize.current = true
		vscode.postMessage({ type: "refreshTaskHistorySize" })
	}, [])

	const handleRefreshStorageSize = useCallback(() => {
		setIsRefreshing(true)
		vscode.postMessage({ type: "refreshTaskHistorySize" })
	}, [])

	const getStorageDisplayText = (): string => {
		// Use cached size if available, otherwise show "Calculating" only if no cached value
		const displaySize = taskHistorySize || cachedSize
		if (!displaySize) {
			return t("settings:taskHistoryStorage.calculating")
		}
		if (displaySize.taskCount === 0) {
			return t("settings:taskHistoryStorage.empty")
		}
		if (displaySize.taskCount === 1) {
			return t("settings:taskHistoryStorage.formatSingular", {
				size: displaySize.formattedSize,
			})
		}
		return t("settings:taskHistoryStorage.format", {
			size: displaySize.formattedSize,
			count: displaySize.taskCount,
		})
	}

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>{t("settings:sections.about")}</SectionHeader>

			<Section>
				<p>
					{Package.sha
						? `Version: ${Package.version} (${Package.sha.slice(0, 8)})`
						: `Version: ${Package.version}`}
				</p>
				<SearchableSetting
					settingId="about-telemetry"
					section="about"
					label={t("settings:footer.telemetry.label")}>
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
				</SearchableSetting>
			</Section>

			<Section className="space-y-0">
				<h3>{t("settings:about.contactAndCommunity")}</h3>
				<div className="flex flex-col gap-3">
					<div className="flex items-start gap-2">
						<Bug className="size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.bugReport.label")}{" "}
							<VSCodeLink href="https://github.com/RooCodeInc/Roo-Code/issues/new?template=bug_report.yml">
								{t("settings:about.bugReport.link")}
							</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<Lightbulb className="size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.featureRequest.label")}{" "}
							<VSCodeLink href="https://github.com/RooCodeInc/Roo-Code/issues/new?template=feature_request.yml">
								{t("settings:about.featureRequest.link")}
							</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<Shield className="size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.securityIssue.label")}{" "}
							<VSCodeLink href="https://github.com/RooCodeInc/Roo-Code/security/policy">
								{t("settings:about.securityIssue.link")}
							</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<MessageCircle className="size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.contact.label")}{" "}
							<VSCodeLink href="mailto:support@roocode.com">support@roocode.com</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<MessagesSquare className="size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							<Trans
								i18nKey="settings:about.community"
								components={{
									redditLink: <VSCodeLink href="https://reddit.com/r/RooCode" />,
									discordLink: <VSCodeLink href="https://discord.gg/roocode" />,
								}}
							/>
						</span>
					</div>
					{setDebug && (
						<SearchableSetting
							settingId="about-debug-mode"
							section="about"
							label={t("settings:about.debugMode.label")}
							className="mt-4 pt-4 border-t border-vscode-settings-headerBorder">
							<VSCodeCheckbox
								checked={debug ?? false}
								onChange={(e: any) => {
									const checked = e.target.checked === true
									setDebug(checked)
								}}>
								{t("settings:about.debugMode.label")}
							</VSCodeCheckbox>
							<p className="text-vscode-descriptionForeground text-sm mt-0">
								{t("settings:about.debugMode.description")}
							</p>
						</SearchableSetting>
					)}
				</div>
			</Section>

			<Section className="space-y-0">
				<SearchableSetting
					settingId="about-task-history-retention"
					section="about"
					label={t("settings:aboutRetention.label")}
					className="mt-4">
					<h3>{t("settings:aboutRetention.label")}</h3>
					<div className="mt-2">
						<Select
							value={taskHistoryRetention}
							onValueChange={(value: TaskHistoryRetentionSetting) => {
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
				</SearchableSetting>

				<SearchableSetting
					settingId="about-task-history-storage"
					section="about"
					label={t("settings:taskHistoryStorage.label")}
					className="mt-4">
					<div className="flex items-center gap-2">
						<HardDrive className="size-4 text-vscode-descriptionForeground shrink-0" />
						<span className="text-sm">
							{t("settings:taskHistoryStorage.label")}: {getStorageDisplayText()}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleRefreshStorageSize}
							disabled={isRefreshing}
							className="h-6 w-6 p-0"
							title={t("settings:taskHistoryStorage.refresh")}>
							{isRefreshing ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<RefreshCw className="size-3.5" />
							)}
						</Button>
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="about-manage-settings"
					section="about"
					label={t("settings:about.manageSettings")}
					className="mt-4 pt-4 border-t border-vscode-settings-headerBorder">
					<h3>{t("settings:about.manageSettings")}</h3>
					<div className="flex flex-wrap items-center gap-2">
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
				</SearchableSetting>
			</Section>
		</div>
	)
}
