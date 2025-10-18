import React, { useState, useEffect } from "react"
import { X, Save } from "lucide-react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui/button"
import { Input } from "@src/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@src/components/ui/dialog"
import { ModeFamily } from "./types"
import { ModeToggleGrid } from "./ModeToggleGrid"

interface ModeFamilyEditorProps {
	family: ModeFamily
	availableModes: Array<{
		slug: string
		name: string
		isBuiltIn: boolean
	}>
	isOpen: boolean
	onClose: () => void
	onSave: (updates: Partial<ModeFamily>) => void
}

export const ModeFamilyEditor: React.FC<ModeFamilyEditorProps> = ({
	family,
	availableModes,
	isOpen,
	onClose,
	onSave,
}) => {
	const { t } = useAppTranslation()

	// Local state for editing
	const [name, setName] = useState(family.name)
	const [description, setDescription] = useState(family.description || "")
	const [enabledModes, setEnabledModes] = useState<string[]>(family.enabledModes)
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

	// Reset state when family changes
	useEffect(() => {
		setName(family.name)
		setDescription(family.description || "")
		setEnabledModes(family.enabledModes)
		setHasUnsavedChanges(false)
	}, [family])

	// Track changes
	useEffect(() => {
		const hasChanges =
			name !== family.name ||
			description !== (family.description || "") ||
			JSON.stringify(enabledModes.sort()) !== JSON.stringify(family.enabledModes.sort())

		setHasUnsavedChanges(hasChanges)
	}, [name, description, enabledModes, family])

	// Handle mode toggle
	const handleModeToggle = (modeSlug: string, enabled: boolean) => {
		if (enabled) {
			setEnabledModes(prev => [...prev, modeSlug])
		} else {
			setEnabledModes(prev => prev.filter(mode => mode !== modeSlug))
		}
	}

	// Handle save
	const handleSave = () => {
		const updates: Partial<ModeFamily> = {
			name: name.trim(),
			description: description.trim() || undefined,
			enabledModes,
			updatedAt: Date.now(),
		}

		onSave(updates)
	}

	// Handle close with unsaved changes check
	const handleClose = () => {
		if (hasUnsavedChanges) {
			const confirmed = window.confirm(t("settings:modeFamilies.unsavedChangesWarning"))
			if (!confirmed) return
		}
		onClose()
	}

	if (!isOpen) return null

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Edit Family: {family.name}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{/* Basic Information */}
					<div className="space-y-4">
						<h3 className="text-lg font-medium text-vscode-foreground">
							{t("settings:modeFamilies.editDialog.basicInfo")}
						</h3>

						<div className="grid gap-4">
							<div>
								<label className="text-sm font-medium mb-2 block">
									{t("settings:modeFamilies.editDialog.nameLabel")} *
								</label>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder={t("settings:modeFamilies.editDialog.namePlaceholder")}
									className="w-full"
								/>
							</div>

							<div>
								<label className="text-sm font-medium mb-2 block">
									{t("settings:modeFamilies.editDialog.descriptionLabel")}
								</label>
								<Input
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder={t("settings:modeFamilies.editDialog.descriptionPlaceholder")}
									className="w-full"
								/>
							</div>
						</div>
					</div>

					{/* Mode Selection */}
					<div className="space-y-4">
						<h3 className="text-lg font-medium text-vscode-foreground">
							{t("settings:modeFamilies.editDialog.modeSelection")}
						</h3>

						<div className="text-sm text-vscode-descriptionForeground mb-4">
							{t("settings:modeFamilies.editDialog.modeSelectionDescription")}
						</div>

						<ModeToggleGrid
							family={{
								...family,
								name,
								description: description || undefined,
								enabledModes,
							}}
							availableModes={availableModes}
							onModeToggle={handleModeToggle}
						/>
					</div>

					{/* Summary */}
					<div className="bg-vscode-input-background p-4 rounded-lg">
						<h4 className="font-medium text-vscode-foreground mb-2">
							{t("settings:modeFamilies.editDialog.summary")}
						</h4>
						<div className="text-sm text-vscode-descriptionForeground space-y-1">
							<p>Name: <span className="font-medium text-vscode-foreground">{name}</span></p>
							<p>Description: <span className="font-medium text-vscode-foreground">
								{description || t("settings:modeFamilies.editDialog.noDescription")}
							</span></p>
							<p>Modes enabled: <span className="font-medium text-vscode-foreground">
								{enabledModes.length} of {availableModes.length}
							</span></p>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex justify-between items-center pt-4 border-t border-vscode-input-border">
					<div className="text-sm text-vscode-descriptionForeground">
						{hasUnsavedChanges ? (
							<span className="text-vscode-errorForeground">
								{t("settings:modeFamilies.unsavedChanges")}
							</span>
						) : (
							t("settings:modeFamilies.allChangesSaved")
						)}
					</div>

					<div className="flex gap-2">
						<Button variant="secondary" onClick={handleClose}>
							{t("settings:common.cancel")}
						</Button>
						<Button
							variant="default"
							onClick={handleSave}
							disabled={!hasUnsavedChanges || !name.trim()}
							className="gap-2"
						>
							<Save className="w-4 h-4" />
							{t("settings:common.save")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}