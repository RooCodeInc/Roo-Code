import React from "react"
import { Badge } from "@src/components/ui/badge"
import { Button } from "@src/components/ui/button"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
import { ModeFamily } from "./types"

interface ModeToggleGridProps {
	family: ModeFamily
	availableModes: Array<{
		slug: string
		name: string
		isBuiltIn: boolean
	}>
	onModeToggle: (modeSlug: string, enabled: boolean) => void
}

export const ModeToggleGrid: React.FC<ModeToggleGridProps> = ({
	family,
	availableModes,
	onModeToggle,
}) => {
	// Group modes by type for better organization
	const builtInModes = availableModes.filter(mode => mode.isBuiltIn)
	const customModes = availableModes.filter(mode => !mode.isBuiltIn)

	return (
		<div className="space-y-4">
			{/* Built-in Modes Section */}
			{builtInModes.length > 0 && (
				<div>
					<h4 className="text-sm font-medium text-vscode-foreground mb-2">
						Built-in Modes
					</h4>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
						{builtInModes.map((mode) => {
							const isEnabled = family.enabledModes.includes(mode.slug)
							return (
								<div
									key={mode.slug}
									className={`flex items-center justify-between p-2 rounded border ${
										isEnabled
											? "bg-vscode-button-background border-vscode-focusBorder"
											: "bg-vscode-input-background border-vscode-input-border"
									}`}
								>
									<div className="flex items-center gap-2 min-w-0">
										<Badge variant={mode.isBuiltIn ? "secondary" : "outline"} className="text-xs">
											{mode.isBuiltIn ? "Built-in" : "Custom"}
										</Badge>
										<span className={`text-sm truncate ${isEnabled ? "font-medium" : "text-vscode-descriptionForeground"}`}>
											{mode.name}
										</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => onModeToggle(mode.slug, !isEnabled)}
										className={`h-6 w-6 p-0 ml-2 ${
											isEnabled
												? "text-vscode-button-foreground"
												: "text-vscode-descriptionForeground hover:text-vscode-foreground"
										}`}
									>
										<span className={`codicon ${isEnabled ? "codicon-check" : "codicon-add"}`} />
									</Button>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Custom Modes Section */}
			{customModes.length > 0 && (
				<div>
					<h4 className="text-sm font-medium text-vscode-foreground mb-2">
						Custom Modes
					</h4>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
						{customModes.map((mode) => {
							const isEnabled = family.enabledModes.includes(mode.slug)
							return (
								<div
									key={mode.slug}
									className={`flex items-center justify-between p-2 rounded border ${
										isEnabled
											? "bg-vscode-button-background border-vscode-focusBorder"
											: "bg-vscode-input-background border-vscode-input-border"
									}`}
								>
									<div className="flex items-center gap-2 min-w-0">
										<Badge variant={mode.isBuiltIn ? "secondary" : "outline"} className="text-xs">
											{mode.isBuiltIn ? "Built-in" : "Custom"}
										</Badge>
										<span className={`text-sm truncate ${isEnabled ? "font-medium" : "text-vscode-descriptionForeground"}`}>
											{mode.name}
										</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => onModeToggle(mode.slug, !isEnabled)}
										className={`h-6 w-6 p-0 ml-2 ${
											isEnabled
												? "text-vscode-button-foreground"
												: "text-vscode-descriptionForeground hover:text-vscode-foreground"
										}`}
									>
										<span className={`codicon ${isEnabled ? "codicon-check" : "codicon-add"}`} />
									</Button>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Empty State */}
			{availableModes.length === 0 && (
				<div className="text-center py-4 text-vscode-descriptionForeground">
					<p className="text-sm">No modes available</p>
				</div>
			)}

			{/* Summary */}
			{family.enabledModes.length > 0 && (
				<div className="text-xs text-vscode-descriptionForeground pt-2 border-t border-vscode-input-border">
					{family.enabledModes.length} of {availableModes.length} modes enabled
				</div>
			)}
		</div>
	)
}