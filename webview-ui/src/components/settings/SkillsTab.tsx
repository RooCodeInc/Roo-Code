import React, { useState, useEffect, useMemo } from "react"
import { Plus, Globe, Folder } from "lucide-react"

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

import { SkillItem, type SkillForUI } from "./SkillItem"

// Validation function for skill names
// Must be 1-64 lowercase characters with optional hyphens
// No leading/trailing hyphens, no consecutive hyphens
const validateSkillName = (name: string): boolean => {
	const trimmed = name.trim()
	if (trimmed.length === 0 || trimmed.length > 64) return false
	// Must match backend validation: lowercase letters/numbers, hyphens allowed but no leading/trailing/consecutive
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)
}

export const SkillsTab: React.FC = () => {
	const { t } = useAppTranslation()
	const { skills, cwd } = useExtensionState()
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [skillToDelete, setSkillToDelete] = useState<SkillForUI | null>(null)
	const [globalNewName, setGlobalNewName] = useState("")
	const [workspaceNewName, setWorkspaceNewName] = useState("")
	const [globalNameError, setGlobalNameError] = useState(false)
	const [workspaceNameError, setWorkspaceNameError] = useState(false)

	// Check if we're in a workspace/project
	const hasWorkspace = Boolean(cwd)

	// Request skills when component mounts
	useEffect(() => {
		handleRefresh()
	}, [])

	const handleRefresh = () => {
		vscode.postMessage({ type: "requestSkills" })
	}

	const handleDeleteClick = (skill: SkillForUI) => {
		setSkillToDelete(skill)
		setDeleteDialogOpen(true)
	}

	const handleDeleteConfirm = () => {
		if (skillToDelete) {
			vscode.postMessage({
				type: "deleteSkill",
				text: skillToDelete.name,
				values: { source: skillToDelete.source },
			})
			setDeleteDialogOpen(false)
			setSkillToDelete(null)
			// Refresh the skills list after deletion
			setTimeout(handleRefresh, 100)
		}
	}

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false)
		setSkillToDelete(null)
	}

	const handleCreateSkill = (source: "global" | "project", name: string) => {
		const trimmedName = name.trim()
		if (!validateSkillName(trimmedName)) {
			if (source === "global") {
				setGlobalNameError(true)
			} else {
				setWorkspaceNameError(true)
			}
			return
		}

		vscode.postMessage({
			type: "createSkill",
			text: trimmedName,
			values: { source },
		})

		// Clear the input and refresh
		if (source === "global") {
			setGlobalNewName("")
			setGlobalNameError(false)
		} else {
			setWorkspaceNewName("")
			setWorkspaceNameError(false)
		}
		setTimeout(handleRefresh, 500)
	}

	const handleGlobalNameChange = (value: string) => {
		setGlobalNewName(value)
		if (globalNameError) {
			setGlobalNameError(!validateSkillName(value.trim()) && value.trim().length > 0)
		}
	}

	const handleWorkspaceNameChange = (value: string) => {
		setWorkspaceNewName(value)
		if (workspaceNameError) {
			setWorkspaceNameError(!validateSkillName(value.trim()) && value.trim().length > 0)
		}
	}

	// Group skills by source
	const globalSkills = useMemo(() => skills?.filter((s) => s.source === "global") || [], [skills])
	const workspaceSkills = useMemo(() => skills?.filter((s) => s.source === "project") || [], [skills])

	return (
		<div>
			{/* Global Skills Section */}
			<div className="mb-6">
				<div className="flex items-center gap-1.5 mb-2">
					<Globe className="w-3 h-3" />
					<h4 className="text-sm font-medium m-0">{t("settings:skills.global")}</h4>
				</div>
				<div className="border border-vscode-panel-border rounded-md">
					{globalSkills.length === 0 ? (
						<div className="px-4 py-3 text-sm text-vscode-descriptionForeground">
							{t("settings:skills.empty")}
						</div>
					) : (
						globalSkills.map((skill) => (
							<SkillItem key={`global-${skill.name}`} skill={skill} onDelete={handleDeleteClick} />
						))
					)}
					{/* New global skill input */}
					<div className="px-4 py-2 flex flex-col gap-1 border-t border-vscode-panel-border">
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={globalNewName}
								onChange={(e) => handleGlobalNameChange(e.target.value)}
								placeholder={t("settings:skills.newGlobalPlaceholder")}
								className={`flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1 text-sm focus:outline-none ${
									globalNameError
										? "border-red-500 focus:border-red-500"
										: "border-vscode-input-border focus:border-vscode-focusBorder"
								}`}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleCreateSkill("global", globalNewName)
									}
								}}
							/>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleCreateSkill("global", globalNewName)}
								disabled={!globalNewName.trim()}
								className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
								<Plus className="w-4 h-4" />
							</Button>
						</div>
						{globalNameError && (
							<span className="text-xs text-red-500">{t("settings:skills.invalidName")}</span>
						)}
					</div>
				</div>
			</div>

			{/* Workspace Skills Section - Only show if in a workspace */}
			{hasWorkspace && (
				<div className="mb-6">
					<div className="flex items-center gap-1.5 mb-2">
						<Folder className="w-3 h-3" />
						<h4 className="text-sm font-medium m-0">{t("settings:skills.workspace")}</h4>
					</div>
					<div className="border border-vscode-panel-border rounded-md">
						{workspaceSkills.length === 0 ? (
							<div className="px-4 py-3 text-sm text-vscode-descriptionForeground">
								{t("settings:skills.empty")}
							</div>
						) : (
							workspaceSkills.map((skill) => (
								<SkillItem key={`project-${skill.name}`} skill={skill} onDelete={handleDeleteClick} />
							))
						)}
						{/* New workspace skill input */}
						<div className="px-4 py-2 flex flex-col gap-1 border-t border-vscode-panel-border">
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={workspaceNewName}
									onChange={(e) => handleWorkspaceNameChange(e.target.value)}
									placeholder={t("settings:skills.newWorkspacePlaceholder")}
									className={`flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1 text-sm focus:outline-none ${
										workspaceNameError
											? "border-red-500 focus:border-red-500"
											: "border-vscode-input-border focus:border-vscode-focusBorder"
									}`}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											handleCreateSkill("project", workspaceNewName)
										}
									}}
								/>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleCreateSkill("project", workspaceNewName)}
									disabled={!workspaceNewName.trim()}
									className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
									<Plus className="w-4 h-4" />
								</Button>
							</div>
							{workspaceNameError && (
								<span className="text-xs text-red-500">{t("settings:skills.invalidName")}</span>
							)}
						</div>
					</div>
				</div>
			)}

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
		</div>
	)
}
