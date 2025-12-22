import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FoldVertical } from "lucide-react"

import type { ContextCondense } from "@roo-code/types"

import { Markdown } from "../Markdown"

interface CondensationResultRowProps {
	data: ContextCondense
}

/**
 * Displays the result of a successful context condensation operation.
 * Shows token reduction, cost, and an expandable summary section.
 */
export function CondensationResultRow({ data }: CondensationResultRowProps) {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	const { cost, prevContextTokens, newContextTokens, summary } = data

	// Handle null/undefined token values to prevent crashes
	const prevTokens = prevContextTokens ?? 0
	const newTokens = newContextTokens ?? 0
	const displayCost = cost ?? 0

	return (
		<div className="mb-2">
			<div
				className="group text-sm transition-opacity opacity-40 hover:opacity-100 cursor-pointer select-none"
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					marginBottom: isExpanded ? "10px" : "0",
					justifyContent: "space-between",
				}}
				onClick={() => setIsExpanded(!isExpanded)}>
				<div style={{ display: "flex", alignItems: "center", gap: "10px", flexGrow: 1 }}>
					<FoldVertical size={16} className="text-vscode-foreground" />
					<span className="text-vscode-foreground">{t("chat:contextManagement.condensation.title")}</span>
					<span className="text-vscode-descriptionForeground text-sm">
						{prevTokens.toLocaleString()} → {newTokens.toLocaleString()}{" "}
						{t("chat:contextManagement.tokens")}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div
						className="text-xs text-vscode-dropdown-foreground border-vscode-dropdown-border/50 border px-1.5 py-0.5 rounded-lg"
						style={{ opacity: displayCost > 0 ? 1 : 0 }}>
						${displayCost.toFixed(4)}
					</div>
					<span
						className={`codicon codicon-chevron-${isExpanded ? "up" : "down"} opacity-0 group-hover:opacity-100 transition-opacity`}></span>
				</div>
			</div>

			{isExpanded && (
				<div className="mt-2 ml-0 p-4 bg-vscode-editor-background rounded text-vscode-foreground text-sm">
					<Markdown markdown={summary} />
				</div>
			)}
		</div>
	)
}
