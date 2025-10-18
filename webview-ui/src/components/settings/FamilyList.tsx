import React from "react"
import { Settings, Trash2, Edit, Check, Users, Badge as BadgeIcon } from "lucide-react"
import { Button } from "@src/components/ui/button"
import { Badge } from "@src/components/ui/badge"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
import { ModeFamily } from "./types"
import { ModeToggleGrid } from "./ModeToggleGrid"

interface FamilyListProps {
	families: ModeFamily[]
	activeFamilyId?: string
	availableModes: Array<{
		slug: string
		name: string
		isBuiltIn: boolean
	}>
	onEditFamily: (family: ModeFamily) => void
	onDeleteFamily: (family: ModeFamily) => void
	onSetActiveFamily: (familyId: string) => void
	onModeToggle: (familyId: string, modeSlug: string, enabled: boolean) => void
}

export const FamilyList: React.FC<FamilyListProps> = ({
	families,
	activeFamilyId,
	availableModes,
	onEditFamily,
	onDeleteFamily,
	onSetActiveFamily,
	onModeToggle,
}) => {
	if (families.length === 0) {
		return (
			<div className="text-center py-8 text-vscode-descriptionForeground">
				<Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
				<p>No mode families created yet.</p>
				<p className="text-sm">Create your first family to organize your modes.</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{families.map((family) => (
				<div
					key={family.id}
					className={`border rounded-lg p-4 ${
						family.id === activeFamilyId
							? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground"
							: "border-vscode-input-border bg-vscode-editor-background"
					}`}
				>
					{/* Family Header */}
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<h3 className="font-semibold text-vscode-foreground m-0">
								{family.name}
							</h3>
							{family.id === activeFamilyId && (
								<Badge variant="default" className="gap-1">
									<Check className="w-3 h-3" />
									Active
								</Badge>
							)}
						</div>

						<div className="flex items-center gap-1">
							<StandardTooltip content={`Enabled modes: ${family.enabledModes.length}`}>
								<div className="flex items-center gap-1 text-xs text-vscode-descriptionForeground">
									<BadgeIcon className="w-3 h-3" />
									{family.enabledModes.length}
								</div>
							</StandardTooltip>

							{family.id !== activeFamilyId && (
								<StandardTooltip content="Set as active family">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => onSetActiveFamily(family.id)}
										className="h-8 w-8"
									>
										<Check className="w-4 h-4" />
									</Button>
								</StandardTooltip>
							)}

							<StandardTooltip content="Edit family">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => onEditFamily(family)}
									className="h-8 w-8"
								>
									<Edit className="w-4 h-4" />
								</Button>
							</StandardTooltip>

							<StandardTooltip content="Delete family">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => onDeleteFamily(family)}
									className="h-8 w-8 text-vscode-errorForeground hover:text-vscode-errorForeground hover:bg-vscode-errorBackground"
								>
									<Trash2 className="w-4 h-4" />
								</Button>
							</StandardTooltip>
						</div>
					</div>

					{/* Family Description */}
					{family.description && (
						<p className="text-sm text-vscode-descriptionForeground mb-3">
							{family.description}
						</p>
					)}

					{/* Mode Toggle Grid */}
					<div className="mt-3">
						<ModeToggleGrid
							family={family}
							availableModes={availableModes}
							onModeToggle={(modeSlug, enabled) =>
								onModeToggle(family.id, modeSlug, enabled)
							}
						/>
					</div>

					{/* Family Metadata */}
					<div className="flex items-center gap-4 mt-3 text-xs text-vscode-descriptionForeground">
						<span>
							Created: {new Date(family.createdAt).toLocaleDateString()}
						</span>
						{family.updatedAt !== family.createdAt && (
							<span>
								Updated: {new Date(family.updatedAt).toLocaleDateString()}
							</span>
						)}
					</div>
				</div>
			))}
		</div>
	)
}