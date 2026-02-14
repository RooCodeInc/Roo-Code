import { HTMLAttributes, useState } from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { Experiments, ExperimentId } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui"

import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"

type RpiSettingsProps = HTMLAttributes<HTMLDivElement> & {
	rpiAutopilotEnabled?: boolean
	rpiCouncilEngineEnabled?: boolean
	rpiCouncilApiConfigId?: string
	rpiVerificationStrictness?: string
	experiments: Experiments
	listApiConfigMeta: { id: string; name: string }[]
	rpiCodeReviewEnabled?: boolean
	rpiCodeReviewScoreThreshold?: number
	setCachedStateField: SetCachedStateField<
		| "rpiAutopilotEnabled"
		| "rpiCouncilEngineEnabled"
		| "rpiCouncilApiConfigId"
		| "rpiVerificationStrictness"
		| "rpiCodeReviewEnabled"
		| "rpiCodeReviewScoreThreshold"
		| "sandboxImage"
		| "sandboxNetworkAccess"
		| "sandboxMemoryLimit"
		| "sandboxMaxExecutionTime"
		| "rpiContextDistillationBudget"
		| "rpiCouncilTimeoutSeconds"
	>
	setExperimentEnabled: SetExperimentEnabled
	sandboxImage?: string
	sandboxNetworkAccess?: string
	sandboxMemoryLimit?: string
	sandboxMaxExecutionTime?: number
	rpiContextDistillationBudget?: number
	rpiCouncilTimeoutSeconds?: number
}

export const RpiSettings = ({
	rpiAutopilotEnabled,
	rpiCouncilEngineEnabled,
	rpiCouncilApiConfigId,
	rpiVerificationStrictness,
	experiments,
	listApiConfigMeta,
	setCachedStateField,
	setExperimentEnabled,
	sandboxImage,
	sandboxNetworkAccess,
	sandboxMemoryLimit,
	sandboxMaxExecutionTime,
	rpiCodeReviewEnabled,
	rpiCodeReviewScoreThreshold,
	rpiContextDistillationBudget,
	rpiCouncilTimeoutSeconds,
	className,
	...props
}: RpiSettingsProps) => {
	const { t } = useAppTranslation()
	const [advancedOpen, setAdvancedOpen] = useState(false)

	const sandboxEnabled = experiments?.sandboxExecution ?? false

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			{/* Core Section */}
			<SectionHeader>{t("settings:rpiConfig.sectionCore")}</SectionHeader>
			<Section>
				<SearchableSetting
					settingId="rpi-autopilot"
					section="rpiConfig"
					label={t("settings:rpiConfig.autopilot.label")}>
					<VSCodeCheckbox
						checked={rpiAutopilotEnabled ?? true}
						onChange={(e: any) => setCachedStateField("rpiAutopilotEnabled", e.target.checked)}
						data-testid="rpi-autopilot-enabled-checkbox">
						<label className="block font-medium mb-1">{t("settings:rpiConfig.autopilot.label")}</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.autopilot.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-council-engine"
					section="rpiConfig"
					label={t("settings:rpiConfig.councilEngine.label")}>
					<VSCodeCheckbox
						checked={rpiCouncilEngineEnabled ?? true}
						onChange={(e: any) => setCachedStateField("rpiCouncilEngineEnabled", e.target.checked)}
						data-testid="rpi-council-engine-enabled-checkbox">
						<label className="block font-medium mb-1">{t("settings:rpiConfig.councilEngine.label")}</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.councilEngine.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-council-api-config"
					section="rpiConfig"
					label={t("settings:rpiConfig.councilApiConfig.label")}>
					<label className="block font-medium mb-1">{t("settings:rpiConfig.councilApiConfig.label")}</label>
					<Select
						value={rpiCouncilApiConfigId || "-"}
						onValueChange={(value) => {
							const newConfigId = value === "-" ? "" : value
							setCachedStateField("rpiCouncilApiConfigId", newConfigId)
						}}
						disabled={!rpiCouncilEngineEnabled}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="-">
								{t("settings:rpiConfig.councilApiConfig.useCurrentConfig")}
							</SelectItem>
							{(listApiConfigMeta || []).map((config) => (
								<SelectItem key={config.id} value={config.id}>
									{config.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.councilApiConfig.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-verification-strictness"
					section="rpiConfig"
					label={t("settings:rpiConfig.verificationStrictness.label")}>
					<label className="block font-medium mb-1">
						{t("settings:rpiConfig.verificationStrictness.label")}
					</label>
					<Select
						value={rpiVerificationStrictness || "lenient"}
						onValueChange={(value) => setCachedStateField("rpiVerificationStrictness", value)}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="lenient">
								{t("settings:rpiConfig.verificationStrictness.lenient")}
							</SelectItem>
							<SelectItem value="standard">
								{t("settings:rpiConfig.verificationStrictness.standard")}
							</SelectItem>
							<SelectItem value="strict">
								{t("settings:rpiConfig.verificationStrictness.strict")}
							</SelectItem>
						</SelectContent>
					</Select>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.verificationStrictness.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-code-review"
					section="rpiConfig"
					label={t("settings:rpiConfig.codeReview.label")}>
					<VSCodeCheckbox
						checked={rpiCodeReviewEnabled ?? true}
						onChange={(e: any) => setCachedStateField("rpiCodeReviewEnabled", e.target.checked)}
						data-testid="rpi-code-review-enabled-checkbox">
						<label className="block font-medium mb-1">{t("settings:rpiConfig.codeReview.label")}</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.codeReview.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-code-review-threshold"
					section="rpiConfig"
					label={t("settings:rpiConfig.codeReviewThreshold.label")}>
					<label className="block font-medium mb-1">
						{t("settings:rpiConfig.codeReviewThreshold.label")}
					</label>
					<Input
						type="number"
						value={rpiCodeReviewScoreThreshold ?? 4}
						onChange={(e) =>
							setCachedStateField(
								"rpiCodeReviewScoreThreshold",
								Math.max(1, Math.min(10, parseInt(e.target.value) || 4)),
							)
						}
						disabled={!(rpiCodeReviewEnabled ?? true)}
						min={1}
						max={10}
					/>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.codeReviewThreshold.description")}
					</div>
				</SearchableSetting>
			</Section>

			{/* Sandbox Section */}
			<SectionHeader>{t("settings:rpiConfig.sectionSandbox")}</SectionHeader>
			<Section>
				<SearchableSetting
					settingId="rpi-sandbox-enabled"
					section="rpiConfig"
					label={t("settings:rpiConfig.sandboxEnabled.label")}>
					<VSCodeCheckbox
						checked={sandboxEnabled}
						onChange={(e: any) =>
							setExperimentEnabled("sandboxExecution" as ExperimentId, e.target.checked)
						}
						data-testid="rpi-sandbox-enabled-checkbox">
						<label className="block font-medium mb-1">{t("settings:rpiConfig.sandboxEnabled.label")}</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.sandboxEnabled.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-sandbox-image"
					section="rpiConfig"
					label={t("settings:rpiConfig.sandboxImage.label")}>
					<label className="block font-medium mb-1">{t("settings:rpiConfig.sandboxImage.label")}</label>
					<Input
						value={sandboxImage ?? "node:20"}
						onChange={(e) => setCachedStateField("sandboxImage", e.target.value)}
						disabled={!sandboxEnabled}
						placeholder="node:20"
					/>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.sandboxImage.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-sandbox-network"
					section="rpiConfig"
					label={t("settings:rpiConfig.sandboxNetworkAccess.label")}>
					<label className="block font-medium mb-1">
						{t("settings:rpiConfig.sandboxNetworkAccess.label")}
					</label>
					<Select
						value={sandboxNetworkAccess ?? "restricted"}
						onValueChange={(value) => setCachedStateField("sandboxNetworkAccess", value)}
						disabled={!sandboxEnabled}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="full">{t("settings:rpiConfig.sandboxNetworkAccess.full")}</SelectItem>
							<SelectItem value="restricted">
								{t("settings:rpiConfig.sandboxNetworkAccess.restricted")}
							</SelectItem>
							<SelectItem value="none">{t("settings:rpiConfig.sandboxNetworkAccess.none")}</SelectItem>
						</SelectContent>
					</Select>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.sandboxNetworkAccess.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-sandbox-memory"
					section="rpiConfig"
					label={t("settings:rpiConfig.sandboxMemoryLimit.label")}>
					<label className="block font-medium mb-1">{t("settings:rpiConfig.sandboxMemoryLimit.label")}</label>
					<Select
						value={sandboxMemoryLimit ?? "4g"}
						onValueChange={(value) => setCachedStateField("sandboxMemoryLimit", value)}
						disabled={!sandboxEnabled}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="256m">256 MB</SelectItem>
							<SelectItem value="512m">512 MB</SelectItem>
							<SelectItem value="1g">1 GB</SelectItem>
							<SelectItem value="2g">2 GB</SelectItem>
							<SelectItem value="4g">4 GB</SelectItem>
							<SelectItem value="8g">8 GB</SelectItem>
							<SelectItem value="16g">16 GB</SelectItem>
						</SelectContent>
					</Select>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.sandboxMemoryLimit.description")}
					</div>
				</SearchableSetting>

				<SearchableSetting
					settingId="rpi-sandbox-timeout"
					section="rpiConfig"
					label={t("settings:rpiConfig.sandboxMaxExecutionTime.label")}>
					<label className="block font-medium mb-1">
						{t("settings:rpiConfig.sandboxMaxExecutionTime.label")}
					</label>
					<Input
						type="number"
						value={sandboxMaxExecutionTime ?? 120}
						onChange={(e) =>
							setCachedStateField("sandboxMaxExecutionTime", parseInt(e.target.value) || 120)
						}
						disabled={!sandboxEnabled}
						min={10}
						max={600}
					/>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:rpiConfig.sandboxMaxExecutionTime.description")}
					</div>
				</SearchableSetting>
			</Section>

			{/* Advanced Section (Collapsible) */}
			<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
				<CollapsibleTrigger asChild>
					<div className="flex items-center gap-1 cursor-pointer select-none mt-2">
						{advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
						<SectionHeader>{t("settings:rpiConfig.sectionAdvanced")}</SectionHeader>
					</div>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<Section>
						<SearchableSetting
							settingId="rpi-distillation-budget"
							section="rpiConfig"
							label={t("settings:rpiConfig.contextDistillationBudget.label")}>
							<label className="block font-medium mb-1">
								{t("settings:rpiConfig.contextDistillationBudget.label")}
							</label>
							<Input
								type="number"
								value={rpiContextDistillationBudget ?? 8000}
								onChange={(e) =>
									setCachedStateField(
										"rpiContextDistillationBudget",
										parseInt(e.target.value) || 8000,
									)
								}
								min={1000}
								max={32000}
							/>
							<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
								{t("settings:rpiConfig.contextDistillationBudget.description")}
							</div>
						</SearchableSetting>

						<SearchableSetting
							settingId="rpi-council-timeout"
							section="rpiConfig"
							label={t("settings:rpiConfig.councilTimeout.label")}>
							<label className="block font-medium mb-1">
								{t("settings:rpiConfig.councilTimeout.label")}
							</label>
							<Input
								type="number"
								value={rpiCouncilTimeoutSeconds ?? 90}
								onChange={(e) =>
									setCachedStateField("rpiCouncilTimeoutSeconds", parseInt(e.target.value) || 90)
								}
								min={15}
								max={300}
							/>
							<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
								{t("settings:rpiConfig.councilTimeout.description")}
							</div>
						</SearchableSetting>
					</Section>
				</CollapsibleContent>
			</Collapsible>
		</div>
	)
}
