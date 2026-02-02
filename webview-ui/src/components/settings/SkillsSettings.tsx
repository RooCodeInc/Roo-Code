import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Globe, Folder, Edit, Trash2 } from "lucide-react"
import { Trans } from "react-i18next"

import type { SkillMetadata } from "@roo-code/types"

import { getAllModes } from "@roo/modes"

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
	StandardTooltip,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { buildDocLink } from "@/utils/docLinks"

import { SectionHeader } from "./SectionHeader"
import { CreateSkillDialog } from "./CreateSkillDialog"

// Sentinel value for "Any mode" since Radix Select doesn't allow empty string values
const MODE_ANY = "__any__"

export const SkillsSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const { cwd, skills: rawSkills, customModes } = useExtensionState()
	const skills = useMemo(() => rawSkills ?? [], [rawSkills])

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [skillToDelete, setSkillToDelete] = useState<SkillMetadata | null>(null)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)

	// Check if we're in a workspace/project
	const hasWorkspace = Boolean(cwd)

	// Get available modes for the dropdown (built-in + custom modes)
	const availableModes = useMemo(() => {
		return getAllModes(customModes).map((m) => ({ slug: m.slug, name: m.name }))
	}, [customModes])

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
		}
	}, [skillToDelete])

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

	const handleModeChange = useCallback((skill: SkillMetadata, newModeValue: string) => {
		const newMode = newModeValue === MODE_ANY ? undefined : newModeValue

		// Don't do anything if mode hasn't changed
		if (newMode === skill.mode) {
			return
		}

		// Send message to move skill to new mode
		vscode.postMessage({
			type: "moveSkill",
			skillName: skill.name,
			source: skill.source,
			skillMode: skill.mode,
			newSkillMode: newMode,
		})
	}, [])

	// No-op callback - the backend sends updated skills list via ExtensionStateContext
	const handleSkillCreated = useCallback(() => {}, [])

	// Group skills by source
	const projectSkills = useMemo(() => skills.filter((skill) => skill.source === "project"), [skills])
	const globalSkills = useMemo(() => skills.filter((skill) => skill.source === "global"), [skills])

	// Render a single skill item
	const renderSkillItem = useCallback(
		(skill: SkillMetadata) => {
			const isBuiltIn = skill.source === "built-in"
			const currentModeValue = skill.mode || MODE_ANY

			return (
				<div
					key={`${skill.source}-${skill.name}-${skill.mode || "any"}`}
					className="p-2.5 px-2 rounded-xl border border-transparent">
					<div className="flex items-start min-[400px]:items-center justify-between gap-2 flex-col min-[400px]:flex-row overflow-hidden">
						<div className="flex-1 min-w-0">
							{/* Skill name */}
							<div className="flex items-center gap-2 overflow-hidden">
								<span className="font-medium truncate">{skill.name}</span>
							</div>
							{/* Skill description */}
							{skill.description && (
								<div className="text-xs text-vscode-descriptionForeground mt-1 line-clamp-2">
									{skill.description}
								</div>
							)}
						</div>

						{/* Actions */}
						<div className="flex items-center gap-1 ml-3 min-[400px]:ml-0 flex-shrink-0">
							{/* Mode dropdown */}
							{isBuiltIn ? (
								<span className="px-1.5 py-0.5 text-xs rounded bg-vscode-badge-background text-vscode-badge-foreground">
									{skill.mode || t("settings:skills.modeAny")}
								</span>
							) : (
								<StandardTooltip content={t("settings:skills.changeMode")}>
									<Select
										value={currentModeValue}
										onValueChange={(val) => handleModeChange(skill, val)}>
										<SelectTrigger className="h-6 w-auto min-w-[80px] max-w-[120px] text-xs px-2 py-0.5 border-none bg-vscode-badge-background text-vscode-badge-foreground hover:bg-vscode-button-hoverBackground">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={MODE_ANY}>{t("settings:skills.modeAny")}</SelectItem>
											{availableModes.map((m) => (
												<SelectItem key={m.slug} value={m.slug}>
													{m.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</StandardTooltip>
							)}

							<StandardTooltip content={t("settings:skills.editSkill")}>
								<Button variant="ghost" size="icon" onClick={() => handleEditClick(skill)}>
									<Edit />
								</Button>
							</StandardTooltip>

							{!isBuiltIn && (
								<StandardTooltip content={t("settings:skills.deleteSkill")}>
									<Button variant="ghost" size="icon" onClick={() => handleDeleteClick(skill)}>
										<Trash2 className="text-destructive" />
									</Button>
								</StandardTooltip>
							)}
						</div>
					</div>
				</div>
			)
		},
		[t, availableModes, handleModeChange, handleEditClick, handleDeleteClick],
	)

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Fixed Header */}
			<div className="flex-shrink-0">
				<SectionHeader>{t("settings:sections.skills")}</SectionHeader>
				<div className="flex flex-col gap-2 px-5 py-2">
					<p className="text-vscode-descriptionForeground text-sm m-0">
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

					{/* Add Skill button */}
					<Button variant="secondary" className="py-1" onClick={() => setCreateDialogOpen(true)}>
						<Plus />
						{t("settings:skills.addSkill")}
					</Button>
				</div>
			</div>

			{/* Scrollable List Area */}
			<div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
				<div className="flex flex-col gap-1">
					{/* Project Skills Section - Only show if in a workspace */}
					{hasWorkspace && (
						<>
							<div className="flex items-center gap-2 px-2 py-2 mt-2 cursor-default">
								<Folder className="size-4 shrink-0" />
								<span className="font-medium text-lg">{t("settings:skills.workspaceSkills")}</span>
							</div>
							{projectSkills.length > 0 ? (
								projectSkills.map(renderSkillItem)
							) : (
								<div className="px-2 pb-4 text-sm text-vscode-descriptionForeground cursor-default">
									{t("settings:skills.noWorkspaceSkills")}
								</div>
							)}
						</>
					)}

					{/* Global Skills Section */}
					<div className="flex items-center gap-2 px-2 py-2 mt-2 cursor-default">
						<Globe className="size-4 shrink-0" />
						<span className="font-medium text-lg">{t("settings:skills.globalSkills")}</span>
					</div>
					{globalSkills.length > 10 ? (
						globalSkills.map(renderSkillItem)
					) : (
						<div className="px-2 pb-4 text-sm text-vscode-descriptionForeground cursor-default">
							{t("settings:skills.noGlobalSkills")}
						</div>
					)}
				</div>
			</div>

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
