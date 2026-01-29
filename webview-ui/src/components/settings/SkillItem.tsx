import React from "react"
import { Edit, Trash2 } from "lucide-react"

import type { SkillMetadata } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button, StandardTooltip } from "@/components/ui"

interface SkillItemProps {
	skill: SkillMetadata
	onEdit: () => void
	onDelete: () => void
}

export const SkillItem: React.FC<SkillItemProps> = ({ skill, onEdit, onDelete }) => {
	const { t } = useAppTranslation()

	return (
		<div className="px-4 py-2 text-sm flex items-center group hover:bg-vscode-list-hoverBackground">
			{/* Skill name and description */}
			<div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
				<div className="flex items-center gap-2">
					<span className="truncate text-vscode-foreground">{skill.name}</span>
					{skill.mode && (
						<span className="px-1.5 py-0.5 text-xs rounded bg-vscode-badge-background text-vscode-badge-foreground shrink-0">
							{skill.mode}
						</span>
					)}
				</div>
				{skill.description && (
					<div className="text-xs text-vscode-descriptionForeground truncate mt-0.5">{skill.description}</div>
				)}
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-2 ml-2">
				<StandardTooltip content={t("settings:skills.editSkill")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						onClick={onEdit}
						className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
						<Edit className="w-4 h-4" />
					</Button>
				</StandardTooltip>

				<StandardTooltip content={t("settings:skills.deleteSkill")}>
					<Button
						variant="ghost"
						size="icon"
						tabIndex={-1}
						onClick={onDelete}
						className="size-6 flex items-center justify-center opacity-60 hover:opacity-100 hover:text-red-400">
						<Trash2 className="w-4 h-4" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
}
