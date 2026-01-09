import React from "react"
import { Edit, Trash2 } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button, StandardTooltip, Badge } from "@/components/ui"
import { vscode } from "@/utils/vscode"

export interface SkillForUI {
	name: string
	description: string
	source: "global" | "project"
	filePath: string
	mode?: string
}

interface SkillItemProps {
	skill: SkillForUI
	onDelete: (skill: SkillForUI) => void
}

export const SkillItem: React.FC<SkillItemProps> = ({ skill, onDelete }) => {
	const { t } = useAppTranslation()

	const handleEdit = () => {
		vscode.postMessage({
			type: "openSkillFile",
			text: skill.name,
			values: { source: skill.source },
		})
	}

	const handleDelete = () => {
		onDelete(skill)
	}

	return (
		<div className="px-4 py-2 text-sm flex items-center group hover:bg-vscode-list-hoverBackground">
			{/* Skill name and description */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="truncate text-vscode-foreground font-medium">{skill.name}</span>
					{skill.mode && (
						<Badge variant="secondary" className="text-xs px-1.5 py-0">
							{skill.mode}
						</Badge>
					)}
				</div>
				{skill.description && (
					<div className="text-xs text-vscode-descriptionForeground truncate mt-0.5">{skill.description}</div>
				)}
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-2 ml-2">
				<StandardTooltip content={t("settings:skills.edit")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						onClick={handleEdit}
						className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
						<Edit className="w-4 h-4" />
					</Button>
				</StandardTooltip>

				<StandardTooltip content={t("settings:skills.delete")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						onClick={handleDelete}
						className="size-6 flex items-center justify-center opacity-60 hover:opacity-100 hover:text-red-400">
						<Trash2 className="w-4 h-4" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
}
