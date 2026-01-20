import React, { useState, useCallback, useMemo } from "react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"

interface CreateSkillDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSkillCreated: () => void
	hasWorkspace: boolean
}

/**
 * Validate skill name according to agentskills.io spec:
 * - Must start with a letter
 * - Only lowercase letters, numbers, and hyphens allowed
 * - 1-64 characters
 */
const validateSkillName = (name: string): string | null => {
	if (!name) return "settings:skills.validation.nameRequired"
	if (name.length > 64) return "settings:skills.validation.nameTooLong"
	if (!/^[a-z][a-z0-9-]*$/.test(name)) {
		return "settings:skills.validation.nameInvalid"
	}
	return null
}

/**
 * Validate description according to agentskills.io spec:
 * - Required field
 * - 1-1024 characters
 */
const validateDescription = (description: string): string | null => {
	if (!description) return "settings:skills.validation.descriptionRequired"
	if (description.length > 1024) return "settings:skills.validation.descriptionTooLong"
	return null
}

export const CreateSkillDialog: React.FC<CreateSkillDialogProps> = ({
	open,
	onOpenChange,
	onSkillCreated,
	hasWorkspace,
}) => {
	const { t } = useAppTranslation()
	const { customModes } = useExtensionState()

	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [source, setSource] = useState<"global" | "project">(hasWorkspace ? "project" : "global")
	const [mode, setMode] = useState<string>("")
	const [nameError, setNameError] = useState<string | null>(null)
	const [descriptionError, setDescriptionError] = useState<string | null>(null)

	// Get available modes for the dropdown
	const availableModes = useMemo(() => {
		const modes = customModes?.map((m) => ({ slug: m.slug, name: m.name })) || []
		// Add built-in modes
		const builtInModes = [
			{ slug: "code", name: "Code" },
			{ slug: "architect", name: "Architect" },
			{ slug: "ask", name: "Ask" },
			{ slug: "debug", name: "Debug" },
			{ slug: "orchestrator", name: "Orchestrator" },
		]
		return [...builtInModes, ...modes]
	}, [customModes])

	const resetForm = useCallback(() => {
		setName("")
		setDescription("")
		setSource(hasWorkspace ? "project" : "global")
		setMode("")
		setNameError(null)
		setDescriptionError(null)
	}, [hasWorkspace])

	const handleClose = useCallback(() => {
		resetForm()
		onOpenChange(false)
	}, [resetForm, onOpenChange])

	const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
		setName(value)
		setNameError(null)
	}, [])

	const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setDescription(e.target.value)
		setDescriptionError(null)
	}, [])

	const handleCreate = useCallback(() => {
		// Validate fields
		const nameValidationError = validateSkillName(name)
		const descValidationError = validateDescription(description)

		if (nameValidationError) {
			setNameError(nameValidationError)
			return
		}

		if (descValidationError) {
			setDescriptionError(descValidationError)
			return
		}

		// Send message to create skill
		vscode.postMessage({
			type: "createSkill",
			skillName: name,
			source,
			skillDescription: description,
			skillMode: mode || undefined,
		})

		// Close dialog and notify parent
		handleClose()
		onSkillCreated()
	}, [name, description, source, mode, handleClose, onSkillCreated])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("settings:skills.createDialog.title")}</DialogTitle>
					<DialogDescription>{t("settings:skills.createDialog.description")}</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-4">
					{/* Name Input */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="skill-name" className="text-sm font-medium text-vscode-foreground">
							{t("settings:skills.createDialog.nameLabel")} *
						</label>
						<input
							id="skill-name"
							type="text"
							value={name}
							onChange={handleNameChange}
							placeholder={t("settings:skills.createDialog.namePlaceholder")}
							maxLength={64}
							className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vscode-focusBorder"
						/>
						<span className="text-xs text-vscode-descriptionForeground">
							{t("settings:skills.createDialog.nameHint")}
						</span>
						{nameError && <span className="text-xs text-vscode-errorForeground">{t(nameError)}</span>}
					</div>

					{/* Description Input */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="skill-description" className="text-sm font-medium text-vscode-foreground">
							{t("settings:skills.createDialog.descriptionLabel")} *
						</label>
						<textarea
							id="skill-description"
							value={description}
							onChange={handleDescriptionChange}
							placeholder={t("settings:skills.createDialog.descriptionPlaceholder")}
							maxLength={1024}
							rows={3}
							className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vscode-focusBorder resize-none"
						/>
						<span className="text-xs text-vscode-descriptionForeground">
							{t("settings:skills.createDialog.descriptionHint")}
						</span>
						{descriptionError && (
							<span className="text-xs text-vscode-errorForeground">{t(descriptionError)}</span>
						)}
					</div>

					{/* Source Selection */}
					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-medium text-vscode-foreground">
							{t("settings:skills.createDialog.sourceLabel")}
						</label>
						<Select value={source} onValueChange={(value) => setSource(value as "global" | "project")}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="global">{t("settings:skills.source.global")}</SelectItem>
								{hasWorkspace && (
									<SelectItem value="project">{t("settings:skills.source.project")}</SelectItem>
								)}
							</SelectContent>
						</Select>
						<span className="text-xs text-vscode-descriptionForeground">
							{t("settings:skills.createDialog.sourceHint")}
						</span>
					</div>

					{/* Mode Selection (Optional) */}
					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-medium text-vscode-foreground">
							{t("settings:skills.createDialog.modeLabel")}
						</label>
						<Select value={mode} onValueChange={setMode}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t("settings:skills.createDialog.modePlaceholder")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">{t("settings:skills.createDialog.modeAny")}</SelectItem>
								{availableModes.map((m) => (
									<SelectItem key={m.slug} value={m.slug}>
										{m.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<span className="text-xs text-vscode-descriptionForeground">
							{t("settings:skills.createDialog.modeHint")}
						</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" onClick={handleClose}>
						{t("settings:skills.createDialog.cancel")}
					</Button>
					<Button variant="primary" onClick={handleCreate} disabled={!name || !description}>
						{t("settings:skills.createDialog.create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
