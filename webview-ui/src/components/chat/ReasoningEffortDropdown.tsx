import { memo } from "react"
import { Brain } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { StandardTooltip } from "@/components/ui"

import type { ReasoningEffortWithMinimal, ReasoningEfforts } from "@roo-code/types"

// @ts-ignore - vscode is available globally in webview
declare const vscode: any

interface ReasoningEffortDropdownProps {
	apiConfiguration: {
		reasoningEffort?: ReasoningEffortWithMinimal
		enableReasoningEffort?: boolean
	}
}

const ReasoningEffortDropdown = ({ apiConfiguration }: ReasoningEffortDropdownProps) => {
	const { t } = useAppTranslation()
	const { info: model } = useSelectedModel(apiConfiguration)

	// Check if model supports reasoning effort
	const isReasoningEffortSupported = !!model && model.supportsReasoningEffort

	// Check if reasoning is enabled
	const isReasoningEnabled = apiConfiguration?.enableReasoningEffort === true

	// Get current reasoning effort value
	const currentReasoningEffort = apiConfiguration?.reasoningEffort

	// Build available options based on model capabilities
	const availableOptions: readonly ReasoningEffortWithMinimal[] = isReasoningEffortSupported
		? (model?.reasoningEfforts as readonly ReasoningEffortWithMinimal[]) || [
				"low" as const,
				"medium" as const,
				"high" as const,
			])
		: []

	// Determine if we should show the dropdown
	const shouldShowDropdown = isReasoningEffortSupported && isReasoningEnabled

	// Get display value for current selection
	const getDisplayValue = (value: ReasoningEffortWithMinimal | undefined) => {
		if (value === "disable" || value === "none") {
			return t("settings:providers.reasoningEffort.none")
		}
		return t(`settings:providers.reasoningEffort.${value}`)
	}

	const handleValueChange = (value: ReasoningEffortWithMinimal) => {
		// Send message to update reasoning effort
		// This will be handled by the extension to persist to the current profile
		const message = {
			type: "upsertApiConfiguration",
			text: "", // Will use current config name from extension
			apiConfiguration: {
				reasoningEffort: value,
				enableReasoningEffort: true,
			},
		}
		if (typeof vscode !== "undefined") {
			vscode.postMessage(message)
		}
	}

	if (!shouldShowDropdown) {
		return null
	}

	return (
		<StandardTooltip content={t("settings:providers.reasoningEffort.tooltip")}>
			<Select value={currentReasoningEffort} onValueChange={handleValueChange}>
				<SelectTrigger className="h-7 min-w-20 px-2 py-1 text-xs">
					<SelectValue>
						<Brain className="size-3.5 shrink-0" />
						<span className="truncate">{getDisplayValue(currentReasoningEffort)}</span>
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{availableOptions.map((option) => (
						<SelectItem key={option} value={option}>
							{getDisplayValue(option)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</StandardTooltip>
	)
}

export default memo(ReasoningEffortDropdown)
