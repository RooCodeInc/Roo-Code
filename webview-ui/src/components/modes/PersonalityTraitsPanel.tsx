import React, { useState, useEffect, useCallback, useMemo } from "react"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { ChevronDown, ChevronUp, Sparkles, Settings, Plus, Pencil, Trash2 } from "lucide-react"

import type { PersonalityTrait, PersonalityConfig, ModeConfig } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button, Input, Collapsible, CollapsibleContent, CollapsibleTrigger, StandardTooltip } from "@src/components/ui"
import EmojiPicker from "@src/components/modes/EmojiPicker"
import {
	BUILT_IN_PERSONALITY_TRAITS,
	getAllTraitsForConfig,
	resolveActiveTraits,
	mergeTraitPrompts,
	DEFAULT_PERSONALITY_TRAIT_ENHANCER_PROMPT,
} from "@roo/personality-traits"

interface PersonalityTraitsPanelProps {
	currentMode: ModeConfig | undefined
	onUpdateMode: (slug: string, modeConfig: ModeConfig) => void
	personalityTraitEnhancerPrompt?: string
}

const PersonalityTraitsPanel: React.FC<PersonalityTraitsPanelProps> = ({
	currentMode,
	onUpdateMode,
	personalityTraitEnhancerPrompt,
}) => {
	const { t } = useAppTranslation()

	const personalityConfig: PersonalityConfig = useMemo(
		() =>
			currentMode?.personalityConfig || {
				activeTraitIds: [],
				customTraits: [],
				deletedBuiltInTraitIds: [],
			},
		[currentMode?.personalityConfig],
	)

	const allTraits = useMemo(
		() => getAllTraitsForConfig(personalityConfig.customTraits, personalityConfig.deletedBuiltInTraitIds || []),
		[personalityConfig.customTraits, personalityConfig.deletedBuiltInTraitIds],
	)

	const activeTraits = useMemo(
		() => resolveActiveTraits(personalityConfig.activeTraitIds, personalityConfig.customTraits, personalityConfig.deletedBuiltInTraitIds || []),
		[personalityConfig.activeTraitIds, personalityConfig.customTraits, personalityConfig.deletedBuiltInTraitIds],
	)

	const combinedPrompt = useMemo(() => mergeTraitPrompts(activeTraits), [activeTraits])

	// UI state
	const [isPreviewOpen, setIsPreviewOpen] = useState(false)
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [isEnhancerPromptOpen, setIsEnhancerPromptOpen] = useState(false)
	const [editingTraitId, setEditingTraitId] = useState<string | null>(null)

	// Form fields (shared between create and edit)
	const [formEmoji, setFormEmoji] = useState("")
	const [formLabel, setFormLabel] = useState("")
	const [formPrompt, setFormPrompt] = useState("")
	const [isEnhancing, setIsEnhancing] = useState(false)

	// Listen for enhanced personality trait responses
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "enhancedPersonalityTrait") {
				setIsEnhancing(false)
				if (message.text) {
					setFormPrompt(message.text)
				}
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	const updatePersonalityConfig = useCallback(
		(newConfig: PersonalityConfig) => {
			if (!currentMode) return
			onUpdateMode(currentMode.slug, {
				...currentMode,
				personalityConfig: newConfig,
				source: currentMode.source || "global",
			})
		},
		[currentMode, onUpdateMode],
	)

	const toggleTrait = useCallback(
		(traitId: string) => {
			const currentIds = [...personalityConfig.activeTraitIds]
			const index = currentIds.indexOf(traitId)
			if (index >= 0) {
				currentIds.splice(index, 1)
			} else {
				currentIds.push(traitId)
			}
			updatePersonalityConfig({ ...personalityConfig, activeTraitIds: currentIds })
		},
		[personalityConfig, updatePersonalityConfig],
	)

	const getTraitOrder = useCallback(
		(traitId: string): number | null => {
			const index = personalityConfig.activeTraitIds.indexOf(traitId)
			return index >= 0 ? index + 1 : null
		},
		[personalityConfig.activeTraitIds],
	)

	const generateTraitId = useCallback(
		(label: string): string => {
			const baseId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
			let id = baseId
			let attempt = 0
			while (allTraits.some((t) => t.id === id)) {
				attempt++
				id = `${baseId}-${attempt}`
			}
			return id
		},
		[allTraits],
	)

	// Reset form and close
	const resetForm = useCallback(() => {
		setFormEmoji("")
		setFormLabel("")
		setFormPrompt("")
		setEditingTraitId(null)
		setIsFormOpen(false)
	}, [])

	// Start editing a trait — loads its data into the form
	const startEditing = useCallback(
		(trait: PersonalityTrait) => {
			setEditingTraitId(trait.id)
			setFormEmoji(trait.emoji)
			setFormLabel(trait.label)
			setFormPrompt(trait.prompt)
			setIsFormOpen(true)
		},
		[],
	)

	// Start creating a new trait — clears form
	const startCreating = useCallback(() => {
		setEditingTraitId(null)
		setFormEmoji("")
		setFormLabel("")
		setFormPrompt("")
		setIsFormOpen(true)
	}, [])

	// Save: either create new or update existing
	const handleSave = useCallback(() => {
		if (!formLabel.trim() || !formPrompt.trim()) return

		if (editingTraitId) {
			// Editing existing trait — update in customTraits
			const isBuiltInOverride = BUILT_IN_PERSONALITY_TRAITS.some((t) => t.id === editingTraitId)
			const updatedTrait: PersonalityTrait = {
				id: editingTraitId,
				emoji: formEmoji || "✨",
				label: formLabel.trim(),
				prompt: formPrompt.trim(),
				isBuiltIn: false, // Once edited, it becomes a custom override
			}

			let newCustomTraits: PersonalityTrait[]
			const existingCustom = personalityConfig.customTraits.find((t) => t.id === editingTraitId)
			if (existingCustom) {
				// Update existing custom trait
				newCustomTraits = personalityConfig.customTraits.map((t) =>
					t.id === editingTraitId ? updatedTrait : t,
				)
			} else {
				// Built-in being edited for the first time — add as custom override
				newCustomTraits = [...personalityConfig.customTraits, updatedTrait]
			}

			updatePersonalityConfig({ ...personalityConfig, customTraits: newCustomTraits })
		} else {
			// Creating new trait
			const newTrait: PersonalityTrait = {
				id: generateTraitId(formLabel),
				emoji: formEmoji || "✨",
				label: formLabel.trim(),
				prompt: formPrompt.trim(),
				isBuiltIn: false,
			}
			const newCustomTraits = [...personalityConfig.customTraits, newTrait]
			updatePersonalityConfig({ ...personalityConfig, customTraits: newCustomTraits })
		}

		resetForm()
	}, [editingTraitId, formEmoji, formLabel, formPrompt, personalityConfig, updatePersonalityConfig, generateTraitId, resetForm])

	// Delete a trait
	const handleDeleteTrait = useCallback(
		(traitId: string) => {
			const isBuiltIn = BUILT_IN_PERSONALITY_TRAITS.some((t) => t.id === traitId)
			let newConfig = { ...personalityConfig }

			if (isBuiltIn) {
				// Mark built-in as deleted (can be restored later)
				newConfig.deletedBuiltInTraitIds = [...(newConfig.deletedBuiltInTraitIds || []), traitId]
			}

			// Remove from custom traits if it was an override or custom
			newConfig.customTraits = newConfig.customTraits.filter((t) => t.id !== traitId)
			// Remove from active
			newConfig.activeTraitIds = newConfig.activeTraitIds.filter((id) => id !== traitId)

			updatePersonalityConfig(newConfig)

			// If we were editing this trait, close the form
			if (editingTraitId === traitId) {
				resetForm()
			}
		},
		[personalityConfig, updatePersonalityConfig, editingTraitId, resetForm],
	)

	// Enhance trait description via LLM
	const handleEnhance = useCallback(() => {
		const textToEnhance = formPrompt.trim() || formLabel.trim()
		if (!textToEnhance) return
		setIsEnhancing(true)
		vscode.postMessage({ type: "enhancePersonalityTrait", text: textToEnhance })
	}, [formPrompt, formLabel])

	if (!currentMode) return null

	const isEditing = editingTraitId !== null
	const isRooProtected = (traitId: string) => traitId === "roo"

	return (
		<div className="mb-4">
			<div className="font-bold mb-1">{t("personality:title")}</div>
			<div className="text-sm text-vscode-descriptionForeground mb-3">{t("personality:description")}</div>

			{/* Trait Pills Grid */}
			<div className="flex flex-wrap gap-2 mb-3">
				{allTraits.map((trait) => {
					const order = getTraitOrder(trait.id)
					const isActive = order !== null
					const canEditDelete = !isRooProtected(trait.id)

					return (
						<div key={trait.id} className="relative group">
							<button
								onClick={() => toggleTrait(trait.id)}
								className={`
									relative flex items-center gap-2 px-4 py-2 rounded-full
									min-w-[140px] max-w-[200px] h-9
									text-sm font-medium cursor-pointer
									transition-all duration-200 ease-in-out
									border
									${isActive
										? "bg-vscode-button-background text-vscode-button-foreground border-vscode-button-background shadow-sm"
										: "bg-vscode-input-background text-vscode-input-foreground border-vscode-input-border hover:border-vscode-focusBorder"
									}
									hover:shadow-md
								`}
								style={{
									backgroundImage: isActive
										? "none"
										: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.02) 100%)",
								}}
								title={trait.label}>
								{isActive && (
									<span
										className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-vscode-badge-background text-vscode-badge-foreground text-xs flex items-center justify-center font-bold"
										style={{ fontSize: "10px" }}>
										{order}
									</span>
								)}
								<span className="flex-shrink-0">{trait.emoji}</span>
								<span className="truncate">{trait.label}</span>
							</button>

							{/* Edit/Delete buttons on hover (all traits except Roo) */}
							{canEditDelete && (
								<div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
									<StandardTooltip content={t("personality:editTrait")}>
										<button
											onClick={(e) => {
												e.stopPropagation()
												startEditing(trait)
											}}
											className="w-5 h-5 rounded-full bg-vscode-badge-background text-vscode-badge-foreground flex items-center justify-center hover:bg-vscode-button-hoverBackground transition-colors">
											<Pencil className="w-3 h-3" />
										</button>
									</StandardTooltip>
									<StandardTooltip content={t("personality:deleteTrait")}>
										<button
											onClick={(e) => {
												e.stopPropagation()
												handleDeleteTrait(trait.id)
											}}
											className="w-5 h-5 rounded-full bg-vscode-badge-background text-vscode-badge-foreground flex items-center justify-center hover:bg-vscode-errorForeground transition-colors">
											<Trash2 className="w-3 h-3" />
										</button>
									</StandardTooltip>
								</div>
							)}
						</div>
					)
				})}
			</div>

			{/* Combined Prompt Preview (collapsible) */}
			{activeTraits.length > 0 && (
				<Collapsible open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
					<CollapsibleTrigger asChild>
						<button className="flex items-center gap-1 text-sm text-vscode-textLink-foreground hover:underline cursor-pointer mb-2">
							{isPreviewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
							{t("personality:previewPrompt")}
						</button>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words bg-vscode-editor-background border border-vscode-input-border rounded max-h-[300px] overflow-y-auto mb-3">
							{combinedPrompt || t("personality:noActiveTraits")}
						</pre>
					</CollapsibleContent>
				</Collapsible>
			)}

			{/* Unified Create / Edit Trait Section */}
			<Collapsible open={isFormOpen} onOpenChange={(open) => { if (!open) resetForm(); else if (!isEditing) startCreating(); }}>
				<CollapsibleTrigger asChild>
					<button className="flex items-center gap-1 text-sm text-vscode-textLink-foreground hover:underline cursor-pointer">
						<Plus className="w-4 h-4" />
						{isEditing ? `${t("personality:editTrait")}: ${formLabel}` : t("personality:createTrait")}
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="mt-2 p-3 border border-vscode-input-border rounded bg-vscode-input-background">
						<div className="flex gap-2 mb-2">
							<div>
								<label className="text-xs text-vscode-descriptionForeground block mb-1">
									{t("personality:emojiLabel")}
								</label>
								<EmojiPicker value={formEmoji} onChange={setFormEmoji} />
							</div>
							<div className="flex-1">
								<label className="text-xs text-vscode-descriptionForeground block mb-1">
									{t("personality:titleLabel")}
								</label>
								<Input
									type="text"
									value={formLabel}
									onChange={(e) => setFormLabel(e.target.value)}
									placeholder={t("personality:labelPlaceholder")}
								/>
							</div>
						</div>

						<div className="mb-2">
							<div className="flex items-center justify-between mb-1">
								<label className="text-xs text-vscode-descriptionForeground">
									{t("personality:promptLabel")}
								</label>
								<div className="flex items-center gap-1">
									<StandardTooltip content={t("personality:enhanceTooltip")}>
										<Button
											variant="ghost"
											size="icon"
											onClick={handleEnhance}
											disabled={isEnhancing || (!formPrompt.trim() && !formLabel.trim())}
											className="h-6 w-6">
											<Sparkles className={`w-3.5 h-3.5 ${isEnhancing ? "animate-pulse" : ""}`} />
										</Button>
									</StandardTooltip>
									<StandardTooltip content={t("personality:enhancerSettingsTooltip")}>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => setIsEnhancerPromptOpen(!isEnhancerPromptOpen)}
											className="h-6 w-6">
											<Settings className="w-3.5 h-3.5" />
										</Button>
									</StandardTooltip>
								</div>
							</div>
							<VSCodeTextArea
								resize="vertical"
								value={formPrompt}
								onInput={(e: any) => setFormPrompt(e.target.value)}
								placeholder={t("personality:promptPlaceholder")}
								rows={4}
								className="w-full"
							/>
						</div>

						{/* Enhancer Prompt Editor (collapsible) */}
						{isEnhancerPromptOpen && (
							<div className="mb-2 p-2 border border-vscode-input-border rounded bg-vscode-editor-background">
								<div className="text-xs text-vscode-descriptionForeground mb-1">
									{t("personality:enhancerPromptLabel")}
								</div>
								<VSCodeTextArea
									resize="vertical"
									value={personalityTraitEnhancerPrompt || DEFAULT_PERSONALITY_TRAIT_ENHANCER_PROMPT}
									onInput={(e: any) => {
										vscode.postMessage({
											type: "updateSettings",
											updatedSettings: { personalityTraitEnhancerPrompt: e.target.value },
										})
									}}
									rows={6}
									className="w-full text-xs"
								/>
							</div>
						)}

						<div className="flex gap-2">
							<Button variant="primary" onClick={handleSave} disabled={!formLabel.trim() || !formPrompt.trim()}>
								{isEditing ? (
									<>{t("settings:common.save")}</>
								) : (
									<><Plus className="w-4 h-4 mr-1" />{t("personality:addTraitButton")}</>
								)}
							</Button>
							{isEditing && (
								<Button variant="secondary" onClick={resetForm}>
									{t("settings:common.cancel")}
								</Button>
							)}
						</div>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	)
}

export default PersonalityTraitsPanel
