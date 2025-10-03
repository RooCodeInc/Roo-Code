import React, { useState, useEffect, useCallback } from "react"
import { Plus, Settings, Trash2, Users, Edit, Check, X } from "lucide-react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { Button } from "@src/components/ui/button"
import { Input } from "@src/components/ui/input"
import { Badge } from "@src/components/ui/badge"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogCancel,
	AlertDialogAction,
} from "@src/components/ui/alert-dialog"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ModeFamiliesState, ModeFamily } from "./types"
import { ModeFamilyEditor } from "./ModeFamilyEditor"
import { FamilyList } from "./FamilyList"
import { ModeToggleGrid } from "./ModeToggleGrid"

export const ModeFamiliesSettings: React.FC = () => {
	const { t } = useAppTranslation()

	// State management for mode families
	const [familiesState, setFamiliesState] = useState<ModeFamiliesState>({
		config: {
			families: [],
			activeFamilyId: undefined,
		},
		availableModes: [],
		isLoading: true,
		error: undefined,
	})

	// UI state
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [editingFamily, setEditingFamily] = useState<ModeFamily | null>(null)
	const [deletingFamily, setDeletingFamily] = useState<ModeFamily | null>(null)
	const [newFamilyName, setNewFamilyName] = useState("")
	const [newFamilyDescription, setNewFamilyDescription] = useState("")

	// Handle messages from VS Code
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			switch (message.type) {
				case "modeFamiliesResponse":
					setFamiliesState(message.state)
					break
				case "modeFamiliesUpdated":
					// Refresh the families state
					vscode.postMessage({ type: "getModeFamilies" })
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// Request initial data
	useEffect(() => {
		vscode.postMessage({ type: "getModeFamilies" })
	}, [])

	// Handle family creation
	const handleCreateFamily = useCallback(() => {
		if (!newFamilyName.trim()) return

		const newFamily: Omit<ModeFamily, "id" | "createdAt" | "updatedAt"> = {
			name: newFamilyName.trim(),
			description: newFamilyDescription.trim() || undefined,
			enabledModes: [],
			isActive: false,
		}

		vscode.postMessage({
			type: "createModeFamily",
			family: newFamily,
		})

		// Reset form
		setNewFamilyName("")
		setNewFamilyDescription("")
		setIsCreateDialogOpen(false)
	}, [newFamilyName, newFamilyDescription])

	// Handle family update
	const handleUpdateFamily = useCallback((familyId: string, updates: Partial<ModeFamily>) => {
		vscode.postMessage({
			type: "updateModeFamily",
			familyId,
			updates,
		})
	}, [])

	// Handle family deletion
	const handleDeleteFamily = useCallback((familyId: string) => {
		vscode.postMessage({
			type: "deleteModeFamily",
			familyId,
		})
		setDeletingFamily(null)
	}, [])

	// Handle setting active family
	const handleSetActiveFamily = useCallback((familyId: string) => {
		vscode.postMessage({
			type: "setActiveModeFamily",
			familyId,
		})
	}, [])

	// Handle mode toggle in family
	const handleModeToggle = useCallback((familyId: string, modeSlug: string, enabled: boolean) => {
		const family = familiesState.config.families.find(f => f.id === familyId)
		if (!family) return

		const updatedModes = enabled
			? [...family.enabledModes, modeSlug]
			: family.enabledModes.filter(mode => mode !== modeSlug)

		handleUpdateFamily(familyId, { enabledModes: updatedModes })
	}, [familiesState.config.families, handleUpdateFamily])

	// Generate unique family name if needed
	const generateUniqueFamilyName = useCallback((baseName: string): string => {
		const existingNames = familiesState.config.families.map(f => f.name)
		if (!existingNames.includes(baseName)) return baseName

		let counter = 2
		let newName = `${baseName} ${counter}`
		while (existingNames.includes(newName)) {
			counter++
			newName = `${baseName} ${counter}`
		}
		return newName
	}, [familiesState.config.families])

	// Handle quick family creation
	const handleQuickCreate = useCallback(() => {
		const baseName = t("settings:modeFamilies.defaultFamilyName")
		const uniqueName = generateUniqueFamilyName(baseName)

		setNewFamilyName(uniqueName)
		setNewFamilyDescription("")
		setIsCreateDialogOpen(true)
	}, [generateUniqueFamilyName, t])

	if (familiesState.isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="text-vscode-descriptionForeground">
					{t("settings:common.loading")}
				</div>
			</div>
		)
	}

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Users className="w-4" />
					<div>{t("settings:modeFamilies.title")}</div>
				</div>
			</SectionHeader>

			<Section>
				{/* Header with description and create button */}
				<div className="mb-6">
					<div className="text-sm text-vscode-descriptionForeground mb-4">
						{t("settings:modeFamilies.description")}
					</div>

					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium">
								{t("settings:modeFamilies.totalFamilies", {
									count: familiesState.config.families.length
								})}
							</span>
							{familiesState.config.activeFamilyId && (
								<Badge variant="secondary">
									{familiesState.config.families.find(f => f.id === familiesState.config.activeFamilyId)?.name}
									{" "}
									{t("settings:modeFamilies.active")}
								</Badge>
							)}
						</div>

						<Button onClick={handleQuickCreate} className="gap-2">
							<Plus className="w-4 h-4" />
							{t("settings:modeFamilies.createFamily")}
						</Button>
					</div>
				</div>

				{/* Error display */}
				{familiesState.error && (
					<div className="mb-4 p-3 bg-vscode-errorBackground border border-vscode-errorForeground text-vscode-errorForeground text-sm rounded">
						{familiesState.error}
					</div>
				)}

				{/* Family List */}
				<FamilyList
					families={familiesState.config.families}
					activeFamilyId={familiesState.config.activeFamilyId}
					availableModes={familiesState.availableModes}
					onEditFamily={setEditingFamily}
					onDeleteFamily={setDeletingFamily}
					onSetActiveFamily={handleSetActiveFamily}
					onModeToggle={handleModeToggle}
				/>
			</Section>

			{/* Create Family Dialog */}
			<AlertDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("settings:modeFamilies.createDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:modeFamilies.createDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="space-y-4">
						<div>
							<label className="text-sm font-medium mb-2 block">
								{t("settings:modeFamilies.createDialog.nameLabel")}
							</label>
							<Input
								value={newFamilyName}
								onChange={(e) => setNewFamilyName(e.target.value)}
								placeholder={t("settings:modeFamilies.createDialog.namePlaceholder")}
								className="w-full"
							/>
						</div>

						<div>
							<label className="text-sm font-medium mb-2 block">
								{t("settings:modeFamilies.createDialog.descriptionLabel")}
							</label>
							<Input
								value={newFamilyDescription}
								onChange={(e) => setNewFamilyDescription(e.target.value)}
								placeholder={t("settings:modeFamilies.createDialog.descriptionPlaceholder")}
								className="w-full"
							/>
						</div>
					</div>

					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("settings:common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleCreateFamily}
							disabled={!newFamilyName.trim()}
						>
							{t("settings:modeFamilies.createDialog.create")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Edit Family Modal/Sheet */}
			{editingFamily && (
				<ModeFamilyEditor
					family={editingFamily}
					availableModes={familiesState.availableModes}
					isOpen={!!editingFamily}
					onClose={() => setEditingFamily(null)}
					onSave={(updates) => {
						handleUpdateFamily(editingFamily.id, updates)
						setEditingFamily(null)
					}}
				/>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={!!deletingFamily} onOpenChange={() => setDeletingFamily(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("settings:modeFamilies.deleteDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:modeFamilies.deleteDialog.description", {
								familyName: deletingFamily?.name || ""
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("settings:common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => deletingFamily && handleDeleteFamily(deletingFamily.id)}
							className="bg-vscode-errorForeground hover:bg-vscode-errorForeground/90"
						>
							{t("settings:common.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

export default ModeFamiliesSettings