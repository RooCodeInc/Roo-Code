import { useTranslation } from "react-i18next"

import type { ProviderSettings } from "@roo-code/types"

import { getCurrencySymbol } from "@src/utils/getCurrencySymbol"
import { FormattedTextField, unlimitedDecimalFormatter } from "../common/FormattedTextField"

interface MaxCostInputProps {
	allowedMaxCost?: number
	onValueChange: (value: number | undefined) => void
	apiConfiguration?: ProviderSettings
}

export function MaxCostInput({ allowedMaxCost, onValueChange, apiConfiguration }: MaxCostInputProps) {
	const { t } = useTranslation()
	const currencySymbol = getCurrencySymbol(apiConfiguration)

	return (
		<>
			<label className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
				<span className="codicon codicon-credit-card" />
				{t("settings:autoApprove.apiCostLimit.title")}:
			</label>
			<FormattedTextField
				value={allowedMaxCost}
				onValueChange={onValueChange}
				formatter={unlimitedDecimalFormatter}
				placeholder={t("settings:autoApprove.apiCostLimit.unlimited")}
				style={{ maxWidth: "200px" }}
				data-testid="max-cost-input"
				leftNodes={[<span key="dollar">{currencySymbol}</span>]}
			/>
		</>
	)
}
