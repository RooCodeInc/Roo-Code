import React from "react"
import { Badge } from "@src/components/ui/badge"
import { Button } from "@src/components/ui/button"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
import { ModeFamily } from "@src/components/settings/types"
import { vscode } from "@src/utils/vscode"

interface FamilyContextIndicatorProps {
	activeFamily: ModeFamily | null
	hasFamilies: boolean
	onManageFamilies?: () => void
	className?: string
}

export const FamilyContextIndicator: React.FC<FamilyContextIndicatorProps> = ({
	activeFamily,
	hasFamilies,
	onManageFamilies,
	className = "",
}) => {
	// If no families exist, show helpful indicator
	if (!hasFamilies) {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				<span className="text-sm text-vscode-descriptionForeground">No families</span>
				<StandardTooltip content="Create your first mode family to organize modes">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							vscode.postMessage({
								type: "openCustomModesSettings",
							})
						}}>
						Create Family
					</Button>
				</StandardTooltip>
			</div>
		)
	}

	// If family mode is not active, show indicator with option to enable
	if (!activeFamily) {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				<Badge variant="outline" className="gap-1">
					<span className="text-xs">All Modes</span>
				</Badge>
				<StandardTooltip content="Enable family filtering to organize your modes">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							vscode.postMessage({
								type: "openCustomModesSettings",
							})
						}}>
						<span className="codicon codicon-organization"></span>
					</Button>
				</StandardTooltip>
			</div>
		)
	}

	// Show active family context
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			<div className="flex items-center gap-1">
				<Badge variant="secondary" className="gap-1">
					<span className="codicon codicon-organization text-xs"></span>
					<span className="text-xs font-medium">{activeFamily.name}</span>
				</Badge>
				<span className="text-xs text-vscode-descriptionForeground">
					({activeFamily.enabledModes.length} modes)
				</span>
			</div>

			<div className="flex items-center gap-1">
				<StandardTooltip content={`Manage families (${activeFamily.name} is active)`}>
					<Button
						variant="ghost"
						size="sm"
						onClick={onManageFamilies || (() => {
							vscode.postMessage({
								type: "openCustomModesSettings",
							})
						})}>
						<span className="codicon codicon-settings-gear"></span>
					</Button>
				</StandardTooltip>

				<StandardTooltip content="View all available modes">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							// Could add logic here to show all modes vs family modes
							// For now, we'll just show the family management
							vscode.postMessage({
								type: "openCustomModesSettings",
							})
						}}>
						<span className="codicon codicon-eye"></span>
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
}