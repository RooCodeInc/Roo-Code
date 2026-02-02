import React, { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Download, Upload, Bookmark } from "lucide-react"
import { Trans } from "react-i18next"

import type { SavedPrompt } from "@roo-code/types"

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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"

interface SavedPromptFormData {
	name: string
	content: string
	description: string
	apiConfigId: string
}

const emptyFormData: SavedPromptFormData = {
	name: "",
	content: "",
	description: "",
	apiConfigId: "",
}

export const SavedPromptsSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const { savedPrompts, listApiConfigMeta } = useExtensionState()
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [promptToDelete, setPromptToDelete] = useState<SavedPrompt | null>(null)
	const [editDialogOpen, setEditDialogOpen] = useState(false)
	const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null)
	const [formData, setFormData] = useState<SavedPromptFormData>(emptyFormData)

	// Request saved prompts when component mounts
	useEffect(() => {
		vscode.postMessage({ type: "requestSavedPrompts" })
	}, [])

	const handleDeleteClick = (prompt: SavedPrompt) => {
		setPromptToDelete(prompt)
		setDeleteDialogOpen(true)
	}

	const handleDeleteConfirm = () => {
		if (promptToDelete) {
			vscode.postMessage({
				type: "deleteSavedPrompt",
				savedPromptId: promptToDelete.id,
			})
			setDeleteDialogOpen(false)
			setPromptToDelete(null)
		}
	}

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false)
		setPromptToDelete(null)
	}

	const handleEditClick = (prompt: SavedPrompt) => {
		setEditingPrompt(prompt)
		setFormData({
			name: prompt.name,
			content: prompt.content,
			description: prompt.description || "",
			apiConfigId: prompt.apiConfigId || "",
		})
		setEditDialogOpen(true)
	}

	const handleCreateClick = () => {
		setEditingPrompt(null)
		setFormData(emptyFormData)
		setEditDialogOpen(true)
	}

	const handleSave = () => {
		if (!formData.name.trim() || !formData.content.trim()) {
			return
		}

		if (editingPrompt) {
			// Update existing prompt
			vscode.postMessage({
				type: "updateSavedPrompt",
				savedPromptUpdate: {
					id: editingPrompt.id,
					name: formData.name.trim(),
					content: formData.content.trim(),
					description: formData.description.trim() || undefined,
					apiConfigId: formData.apiConfigId || undefined,
				},
			})
		} else {
			// Create new prompt
			vscode.postMessage({
				type: "createSavedPrompt",
				savedPromptCreate: {
					name: formData.name.trim(),
					content: formData.content.trim(),
					description: formData.description.trim() || undefined,
					apiConfigId: formData.apiConfigId || undefined,
				},
			})
		}

		setEditDialogOpen(false)
		setEditingPrompt(null)
		setFormData(emptyFormData)
	}

	const handleExport = () => {
		vscode.postMessage({ type: "exportSavedPrompts" })
	}

	const handleImport = () => {
		vscode.postMessage({ type: "importSavedPrompts" })
	}

	const promptsList = savedPrompts || []

	return (
		<div>
			<SectionHeader>{t("settings:sections.savedPrompts")}</SectionHeader>

			<Section>
				{/* Description section */}
				<SearchableSetting
					settingId="saved-prompts-description"
					section="savedPrompts"
					label={t("settings:sections.savedPrompts")}
					className="mb-4">
					<p className="text-sm text-vscode-descriptionForeground">
						{t("settings:savedPrompts.description")}
					</p>
				</SearchableSetting>

				{/* Action buttons */}
				<div className="flex items-center gap-2 mb-4">
					<Button variant="outline" size="sm" onClick={handleCreateClick}>
						<Plus className="w-4 h-4 mr-1" />
						{t("settings:savedPrompts.create")}
					</Button>
					<Button variant="outline" size="sm" onClick={handleImport}>
						<Upload className="w-4 h-4 mr-1" />
						{t("settings:savedPrompts.import")}
					</Button>
					{promptsList.length > 0 && (
						<Button variant="outline" size="sm" onClick={handleExport}>
							<Download className="w-4 h-4 mr-1" />
							{t("settings:savedPrompts.export")}
						</Button>
					)}
				</div>

				{/* Saved prompts list */}
				<SearchableSetting
					settingId="saved-prompts-list"
					section="savedPrompts"
					label={t("settings:savedPrompts.listTitle")}
					className="mb-6">
					<div className="flex items-center gap-1.5 mb-2">
						<Bookmark className="w-3 h-3" />
						<h4 className="text-sm font-medium m-0">{t("settings:savedPrompts.listTitle")}</h4>
					</div>
					<div className="border border-vscode-panel-border rounded-md">
						{promptsList.length === 0 ? (
							<div className="px-4 py-3 text-sm text-vscode-descriptionForeground">
								{t("settings:savedPrompts.noPrompts")}
							</div>
						) : (
							promptsList.map((prompt: SavedPrompt) => {
								const apiConfig = listApiConfigMeta?.find(
									(config) => config.id === prompt.apiConfigId,
								)
								return (
									<div
										key={prompt.id}
										className="px-4 py-2 flex items-center justify-between hover:bg-vscode-list-hoverBackground border-b border-vscode-panel-border last:border-b-0">
										<div className="flex-1 min-w-0">
											<div className="font-medium text-sm truncate">{prompt.name}</div>
											{prompt.description && (
												<div className="text-xs text-vscode-descriptionForeground truncate">
													{prompt.description}
												</div>
											)}
											{apiConfig && (
												<div className="text-xs text-vscode-descriptionForeground mt-1">
													{t("settings:savedPrompts.apiConfig")}: {apiConfig.name}
												</div>
											)}
										</div>
										<div className="flex items-center gap-1 ml-2">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleEditClick(prompt)}
												className="size-6 opacity-60 hover:opacity-100">
												<Edit2 className="w-3.5 h-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleDeleteClick(prompt)}
												className="size-6 opacity-60 hover:opacity-100 text-vscode-errorForeground">
												<Trash2 className="w-3.5 h-3.5" />
											</Button>
										</div>
									</div>
								)
							})
						)}
					</div>
				</SearchableSetting>
			</Section>

			{/* Delete confirmation dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("settings:savedPrompts.deleteTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:savedPrompts.deleteDescription", { name: promptToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleDeleteCancel}>
							{t("common:cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>
							{t("common:delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Edit/Create dialog */}
			<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>
							{editingPrompt
								? t("settings:savedPrompts.editTitle")
								: t("settings:savedPrompts.createTitle")}
						</DialogTitle>
						<DialogDescription>
							{editingPrompt
								? t("settings:savedPrompts.editDescription")
								: t("settings:savedPrompts.createDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<label htmlFor="name" className="text-sm font-medium">
								{t("settings:savedPrompts.nameLabel")} *
							</label>
							<Input
								id="name"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								placeholder={t("settings:savedPrompts.namePlaceholder")}
							/>
						</div>
						<div className="grid gap-2">
							<label htmlFor="description" className="text-sm font-medium">
								{t("settings:savedPrompts.descriptionLabel")}
							</label>
							<Input
								id="description"
								value={formData.description}
								onChange={(e) => setFormData({ ...formData, description: e.target.value })}
								placeholder={t("settings:savedPrompts.descriptionPlaceholder")}
							/>
						</div>
						<div className="grid gap-2">
							<label htmlFor="content" className="text-sm font-medium">
								{t("settings:savedPrompts.contentLabel")} *
							</label>
							<Textarea
								id="content"
								value={formData.content}
								onChange={(e) => setFormData({ ...formData, content: e.target.value })}
								placeholder={t("settings:savedPrompts.contentPlaceholder")}
								rows={6}
							/>
						</div>
						<div className="grid gap-2">
							<label htmlFor="apiConfig" className="text-sm font-medium">
								{t("settings:savedPrompts.apiConfigLabel")}
							</label>
							<Select
								value={formData.apiConfigId}
								onValueChange={(value) => setFormData({ ...formData, apiConfigId: value })}>
								<SelectTrigger>
									<SelectValue placeholder={t("settings:savedPrompts.apiConfigPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">{t("settings:savedPrompts.noApiConfig")}</SelectItem>
									{listApiConfigMeta?.map((config) => (
										<SelectItem key={config.id} value={config.id}>
											{config.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-vscode-descriptionForeground">
								{t("settings:savedPrompts.apiConfigDescription")}
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditDialogOpen(false)}>
							{t("common:cancel")}
						</Button>
						<Button
							onClick={handleSave}
							disabled={!formData.name.trim() || !formData.content.trim()}>
							{editingPrompt ? t("common:save") : t("common:create")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
