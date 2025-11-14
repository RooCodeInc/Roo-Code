/*
Semantics for Reasoning Effort (SimpleThinkingBudget)

Capability surface:
- modelInfo.supportsReasoningEffort: boolean | Array&lt;"disable" | "none" | "minimal" | "low" | "medium" | "high"&gt;
  - true  → UI shows ["low","medium","high"]
  - array → UI shows exactly the provided values

Selection behavior:
- "disable":
  - Label: t("settings:providers.reasoningEffort.none")
  - set enableReasoningEffort = false
  - persist reasoningEffort = "disable"
  - request builders omit any reasoning parameter/body sections
- "none":
  - Label: t("settings:providers.reasoningEffort.none")
  - set enableReasoningEffort = true
  - persist reasoningEffort = "none"
  - request builders include reasoning with value "none"
- "minimal" | "low" | "medium" | "high":
  - set enableReasoningEffort = true
  - persist the selected value
  - request builders include reasoning with the selected effort

Required:
- If modelInfo.requiredReasoningEffort is true, do not synthesize a "None" choice. Only show values from the capability.
- On mount, if unset and a default exists, set enableReasoningEffort = true and use modelInfo.reasoningEffort.

Notes:
- Current selection is normalized to the capability: unsupported persisted values are not shown.
- Both "disable" and "none" display as the "None" label per UX, but are wired differently as above.
- "minimal" uses t("settings:providers.reasoningEffort.minimal").
*/
import { useEffect } from "react"

import { type ProviderSettings, type ModelInfo, type ReasoningEffort, reasoningEfforts } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

interface SimpleThinkingBudgetProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	modelInfo?: ModelInfo
}

// Reasoning selection values including control values
type ReasoningSelectValue = "disable" | "none" | "minimal" | ReasoningEffort

export const SimpleThinkingBudget = ({
	apiConfiguration,
	setApiConfigurationField,
	modelInfo,
}: SimpleThinkingBudgetProps) => {
	const { t } = useAppTranslation()

	const isSupported = !!modelInfo?.supportsReasoningEffort

	const isReasoningEffortRequired = !!modelInfo?.requiredReasoningEffort

	// Compute available options from capability
	const supports = modelInfo?.supportsReasoningEffort
	const availableOptions: readonly ReasoningSelectValue[] =
		supports === true ? ([...reasoningEfforts] as const) : (supports as any)

	// Helper for labels
	const labelFor = (v: ReasoningSelectValue) => {
		if (v === "disable" || v === "none") return t("settings:providers.reasoningEffort.none")
		if (v === "minimal") return t("settings:providers.reasoningEffort.minimal")
		return t(`settings:providers.reasoningEffort.${v}`)
	}

	// Determine current selection (normalize to capability)
	let current: ReasoningSelectValue | undefined = apiConfiguration.reasoningEffort as ReasoningSelectValue | undefined
	if (!current && isReasoningEffortRequired && modelInfo.reasoningEffort) {
		current = modelInfo.reasoningEffort as ReasoningSelectValue
	}
	// If persisted value isn't supported by capability (e.g., "minimal" while supports=true), don't show it
	const normalizedCurrent: ReasoningSelectValue | undefined =
		current && (availableOptions as readonly any[]).includes(current) ? current : undefined

	// Default when required: set to model default on mount (no synthetic "None")
	useEffect(() => {
		if (!isReasoningEffortRequired) return
		if (!apiConfiguration.reasoningEffort && modelInfo?.reasoningEffort) {
			setApiConfigurationField("enableReasoningEffort", true, false)
			setApiConfigurationField("reasoningEffort", modelInfo?.reasoningEffort as any, false)
		}
	}, [
		isReasoningEffortRequired,
		apiConfiguration.reasoningEffort,
		modelInfo?.reasoningEffort,
		setApiConfigurationField,
	])

	if (!isSupported) {
		return null
	}

	return (
		<div className="flex flex-col gap-1" data-testid="simple-reasoning-effort">
			<div className="flex justify-between items-center">
				<label className="block font-medium mb-1">{t("settings:providers.reasoningEffort.label")}</label>
			</div>
			<Select
				value={normalizedCurrent}
				onValueChange={(value: ReasoningSelectValue) => {
				if (value === "disable") {
					setApiConfigurationField("enableReasoningEffort", false, true)
					setApiConfigurationField("reasoningEffort", "disable" as any, true)
					} else {
						setApiConfigurationField("enableReasoningEffort", true, true)
						setApiConfigurationField("reasoningEffort", value as any, true)
					}
				}}>
				<SelectTrigger className="w-full">
					<SelectValue
						placeholder={normalizedCurrent ? labelFor(normalizedCurrent) : t("settings:common.select")}
					/>
				</SelectTrigger>
				<SelectContent>
					{availableOptions.map((value) => (
						<SelectItem key={value} value={value}>
							{labelFor(value)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
