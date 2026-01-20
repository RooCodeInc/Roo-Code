import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Globe, Folder } from "lucide-react"
import { Trans } from "react-i18next"

import type { SkillMetadata } from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { buildDocLink } from "@/utils/docLinks"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"
import { SkillItem } from "./SkillItem"
import { CreateSkillDialog } from "./CreateSkillDialog"
import type { SectionName } from "./SettingsView"

// Note: skills will be provided via ExtensionStateContext in Phase 4
// For now, we type it as potentially undefined and use mock data pattern
interface ExtendedExtensionState {
	skills?: SkillMetadata[]
	cwd?: string
}

export const SkillsSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const extensionState = useExtensionState() as ExtendedExtensionState
	const { cwd } = extensionState

	// Skills will come from context in Phase 4, for now handle undefined
	const rawSkills = (extensionState as ExtendedExtensionState).skills
	const skills = useMemo(() => rawSkills ?? [], [rawSkills])

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [skillToDelete, setSkillToDelete] = useState<SkillMetadata | null>(null)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)

	// Check if we're in a workspace/project
	const hasWorkspace = Boolean(cwd)

	const handleRefresh = useCallback(() => {
		vscode.postMessage({ type: "requestSkills" })
	}, [])

	// Request skills when component mounts
	useEffect(() => {
		handleRefresh()
	}, [handleRefresh])

	const handleDeleteClick = useCallback((skill: SkillMetadata) => {
		setSkillToDelete(skill)
		setDeleteDialogOpen(true)
	}, [])

	const handleDeleteConfirm = useCallback(() => {
		if (skillToDelete) {
			vscode.postMessage({
				type: "deleteSkill",
				skillName: skillToDelete.name,
				source: skillToDelete.source,
				skillMode: skillToDelete.mode,
			})
			setDeleteDialogOpen(false)
			setSkillToDelete(null)
			// Refresh the skills list after deletion
			setTimeout(handleRefresh, 100)
		}
	}, [skillToDelete, handleRefresh])

	const handleDeleteCancel = useCallback(() => {
		setDeleteDialogOpen(false)
		setSkillToDelete(null)
	}, [])

	const handleEditClick = useCallback((skill: SkillMetadata) => {
		vscode.postMessage({
			type: "openSkillFile",
			skillName: skill.name,
			source: skill.source,
			skillMode: skill.mode,
		})
	}, [])

	const handleSkillCreated = useCallback(() => {
		// Refresh skills list after creation
		setTimeout(handleRefresh, 500)
	}, [handleRefresh])

	// Group skills by source
	const projectSkills = useMemo(() => skills.filter((skill) => skill.source === "project"), [skills])

	const globalSkills = useMemo(() => skills.filter((skill) => skill.source === "global"), [skills])

	return (
		<div>
			<SectionHeader>{t("settings:sections.skills")}</SectionHeader>

			<Section>
				{/* Description section */}
				<SearchableSetting
					settingId="skills-description"
					section={"skills" as SectionName}
					label={t("settings:sections.skills")}
					className="mb-4">
					<p className="text-sm text-vscode-descriptionForeground mb-2">
						<Trans
							i18nKey="settings:skills.description"
							components={{
								DocsLink: (
									<a
										href={buildDocLink("features/skills", "skills_settings")}
										target="_blank"
										rel="noopener noreferrer"
										className="text-vscode-textLink-foreground hover:underline">
										Docs
									</a>
								),
							}}
						/>
					</p>
				</SearchableSetting>

				{/* Project Skills Section - Only show if in a workspace */}
				{hasWorkspace && (
					<SearchableSetting
						settingId="skills-project"
						section={"skills" as SectionName}
						label={t("settings:skills.projectSkills")}
						className="mb-6">
						<div className="flex items-center justify-between mb-2">
							<div className="flex items-center gap-1.5">
								<Folder className="w-3 h-3" />
								<h4 className="text-sm font-medium m-0">{t("settings:skills.projectSkills")}</h4>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setCreateDialogOpen(true)}
								className="h-6 px-2 text-xs opacity-60 hover:opacity-100">
								<Plus className="w-3 h-3 mr-1" />
								{t("settings:skills.addSkill")}
							</Button>
						</div>
						<div className="border border-vscode-panel-border rounded-md">
							{projectSkills.length > 0 ? (
								projectSkills.map((skill) => (
									<SkillItem
										key={`project-${skill.name}-${skill.mode || "any"}`}
										skill={skill}
										onEdit={() => handleEditClick(skill)}
										onDelete={() => handleDeleteClick(skill)}
									/>
								))
							) : (
								<div className="px-4 py-6 text-sm text-vscode-descriptionForeground text-center">
									{t("settings:skills.noProjectSkills")}
								</div>
							)}
						</div>
					</SearchableSetting>
				)}

				{/* Global Skills Section */}
				<SearchableSetting
					settingId="skills-global"
					section={"skills" as SectionName}
					label={t("settings:skills.globalSkills")}
					className="mb-6">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-1.5">
							<Globe className="w-3 h-3" />
							<h4 className="text-sm font-medium m-0">{t("settings:skills.globalSkills")}</h4>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setCreateDialogOpen(true)}
							className="h-6 px-2 text-xs opacity-60 hover:opacity-100">
							<Plus className="w-3 h-3 mr-1" />
							{t("settings:skills.addSkill")}
						</Button>
					</div>
					<div className="border border-vscode-panel-border rounded-md">
						{globalSkills.length > 0 ? (
							globalSkills.map((skill) => (
								<SkillItem
									key={`global-${skill.name}-${skill.mode || "any"}`}
									skill={skill}
									onEdit={() => handleEditClick(skill)}
									onDelete={() => handleDeleteClick(skill)}
								/>
							))
						) : (
							<div className="px-4 py-6 text-sm text-vscode-descriptionForeground text-center">
								{t("settings:skills.noGlobalSkills")}
							</div>
						)}
					</div>
				</SearchableSetting>
			</Section>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("settings:skills.deleteDialog.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:skills.deleteDialog.description", { name: skillToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleDeleteCancel}>
							{t("settings:skills.deleteDialog.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>
							{t("settings:skills.deleteDialog.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Create Skill Dialog */}
			<CreateSkillDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onSkillCreated={handleSkillCreated}
				hasWorkspace={hasWorkspace}
			/>
		</div>
	)
}
