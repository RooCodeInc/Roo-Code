import { HTMLAttributes } from "react"
import { Scale } from "lucide-react"
import { VSCodeCheckbox, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"

type JudgeSettingsProps = HTMLAttributes<HTMLDivElement> & {
	apiConfiguration?: any
	setApiConfigurationField?: (field: string, value: any, isUserAction?: boolean) => void
}

export const JudgeSettings = ({
	apiConfiguration,
	setApiConfigurationField,
	className,
	...props
}: JudgeSettingsProps) => {
	const { t } = useAppTranslation()
	const { listApiConfigMeta } = useExtensionState()

	const judgeEnabled = apiConfiguration?.judgeEnabled ?? false
	const judgeMode = apiConfiguration?.judgeMode ?? "always"
	const judgeDetailLevel = apiConfiguration?.judgeDetailLevel ?? "detailed"
	const judgeAllowUserOverride = apiConfiguration?.judgeAllowUserOverride ?? true
	const judgeBlockOnCriticalIssues = apiConfiguration?.judgeBlockOnCriticalIssues ?? true
	const judgeModelConfigId = apiConfiguration?.judgeModelConfigId ?? ""

	return (
		<div className={cn("flex flex-col gap-4", className)} {...props}>
			<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
				<div className="flex items-center gap-4 font-bold">
					<Scale className="w-4 h-4" />
					<div>{t("settings:experimental.judgeMode.label")}</div>
				</div>

				<div>
					<VSCodeCheckbox
						checked={judgeEnabled}
						onChange={(e: any) => setApiConfigurationField?.("judgeEnabled", e.target.checked)}
						data-testid="judge-enabled-checkbox">
						<span className="font-medium">{t("settings:experimental.judgeMode.enabled")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:experimental.judgeMode.description")}
					</div>
				</div>

				{judgeEnabled && (
					<>
						{/* Judge Mode */}
						<div className="mt-2">
							<label className="block font-medium mb-2">
								{t("settings:experimental.judgeMode.modeLabel")}
							</label>
							<VSCodeDropdown
								value={judgeMode}
								onChange={(e: any) => setApiConfigurationField?.("judgeMode", e.target.value)}
								className="w-full"
								data-testid="judge-mode-dropdown">
								<VSCodeOption value="always">
									{t("settings:experimental.judgeMode.modeAlways")}
								</VSCodeOption>
								<VSCodeOption value="ask">{t("settings:experimental.judgeMode.modeAsk")}</VSCodeOption>
								<VSCodeOption value="never">
									{t("settings:experimental.judgeMode.modeNever")}
								</VSCodeOption>
							</VSCodeDropdown>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{judgeMode === "always" && t("settings:experimental.judgeMode.modeAlwaysDesc")}
								{judgeMode === "ask" && t("settings:experimental.judgeMode.modeAskDesc")}
								{judgeMode === "never" && t("settings:experimental.judgeMode.modeNeverDesc")}
							</div>
						</div>

						{/* Detail Level */}
						<div>
							<label className="block font-medium mb-2">
								{t("settings:experimental.judgeMode.detailLevelLabel")}
							</label>
							<VSCodeDropdown
								value={judgeDetailLevel}
								onChange={(e: any) => setApiConfigurationField?.("judgeDetailLevel", e.target.value)}
								className="w-full"
								data-testid="judge-detail-level-dropdown">
								<VSCodeOption value="concise">
									{t("settings:experimental.judgeMode.detailConcise")}
								</VSCodeOption>
								<VSCodeOption value="detailed">
									{t("settings:experimental.judgeMode.detailDetailed")}
								</VSCodeOption>
							</VSCodeDropdown>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:experimental.judgeMode.detailLevelDesc")}
							</div>
						</div>

						{/* Judge Model Configuration */}
						<div>
							<label className="block font-medium mb-2">
								{t("settings:experimental.judgeMode.modelConfigLabel")}
							</label>
							<VSCodeDropdown
								value={judgeModelConfigId}
								onChange={(e: any) => setApiConfigurationField?.("judgeModelConfigId", e.target.value)}
								className="w-full"
								data-testid="judge-model-config-dropdown">
								<VSCodeOption value="">
									{t("settings:experimental.judgeMode.useCurrentModel")}
								</VSCodeOption>
								{(listApiConfigMeta ?? []).map((config) => (
									<VSCodeOption key={config.id} value={config.id}>
										{config.name}
									</VSCodeOption>
								))}
							</VSCodeDropdown>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:experimental.judgeMode.modelConfigDesc")}
							</div>
						</div>

						{/* Allow User Override */}
						<div>
							<VSCodeCheckbox
								checked={judgeAllowUserOverride}
								onChange={(e: any) =>
									setApiConfigurationField?.("judgeAllowUserOverride", e.target.checked)
								}
								data-testid="judge-allow-override-checkbox">
								<span className="font-medium">
									{t("settings:experimental.judgeMode.allowUserOverride")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:experimental.judgeMode.allowUserOverrideDesc")}
							</div>
						</div>

						{/* Block on Critical Issues */}
						<div>
							<VSCodeCheckbox
								checked={judgeBlockOnCriticalIssues}
								onChange={(e: any) =>
									setApiConfigurationField?.("judgeBlockOnCriticalIssues", e.target.checked)
								}
								data-testid="judge-block-critical-checkbox">
								<span className="font-medium">
									{t("settings:experimental.judgeMode.blockOnCriticalIssues")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:experimental.judgeMode.blockOnCriticalIssuesDesc")}
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
