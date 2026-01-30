import React, { useState, useCallback, useEffect } from "react"
import { Plus } from "lucide-react"

import {
	hookEventTypes,
	usesToolMatchers,
	usesSessionMatchers,
	hookEventDescriptions,
	type HookEventType,
	type HookAction,
	type HookWithMetadata,
	type ToolMatchersConfig,
	type SessionMatchersConfig,
	type ShellCommandAction,
	type SlashCommandAction,
} from "@roo-code/types"

import { cn } from "@/lib/utils"
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui"

import { HookToolMatchers } from "./HookToolMatchers"
import { HookSessionMatchers } from "./HookSessionMatchers"
import { HookActionEditor } from "./HookActionEditor"
import { useHookValidation, generateHookIdFromName } from "./hooks/useHookValidation"

interface CreateHookDialogProps {
	/** Whether the dialog is open */
	open: boolean
	/** Callback when the dialog open state changes */
	onOpenChange: (open: boolean) => void
	/** Pre-selected event type (when opening from a specific group) */
	preSelectedEventType?: HookEventType
	/** Existing hook IDs for uniqueness validation */
	existingHookIds: string[]
	/** Callback when a hook is created */
	onCreate: (hook: HookWithMetadata) => void
}

interface FormState {
	id: string
	name: string
	eventType: HookEventType | ""
	actionType: "command" | "slashCommand"
	command: string
	cwd: string
	timeout: number
	args: string
	source: "global" | "project"
	toolMatchers: ToolMatchersConfig
	sessionMatchers: SessionMatchersConfig
}

const initialFormState: FormState = {
	id: "",
	name: "",
	eventType: "",
	actionType: "command",
	command: "",
	cwd: "",
	timeout: 30,
	args: "",
	source: "project",
	toolMatchers: { tools: [], customPattern: null },
	sessionMatchers: { sessionType: [] },
}

interface FormErrors {
	id?: string
	name?: string
	command?: string
	eventType?: string
}

/**
 * Dialog for creating a new hook.
 *
 * Features:
 * - Hook ID input (required, validated with regex)
 * - Hook Name input (required, auto-generates ID)
 * - Event Type dropdown (required, pre-selected if opened from a group)
 * - Action Type radio buttons (Shell Command vs Slash Command)
 * - Command input (required)
 * - Optional fields based on action type
 * - Matchers section (conditional on event type)
 * - Source selection (Global vs Project)
 * - Validation before submit
 */
export const CreateHookDialog: React.FC<CreateHookDialogProps> = ({
	open,
	onOpenChange,
	preSelectedEventType,
	existingHookIds,
	onCreate,
}) => {
	const [formState, setFormState] = useState<FormState>({
		...initialFormState,
		eventType: preSelectedEventType ?? "",
	})
	const [errors, setErrors] = useState<FormErrors>({})
	const [idManuallyEdited, setIdManuallyEdited] = useState(false)

	const {
		validateHookId,
		validateHookName,
		validateCommand,
		isHookIdUnique: _isHookIdUnique,
	} = useHookValidation({
		existingHookIds,
	})

	// Reset form when dialog opens/closes or pre-selected event type changes
	useEffect(() => {
		if (open) {
			setFormState({
				...initialFormState,
				eventType: preSelectedEventType ?? "",
			})
			setErrors({})
			setIdManuallyEdited(false)
		}
	}, [open, preSelectedEventType])

	// Auto-generate ID from name if not manually edited
	const handleNameChange = useCallback(
		(name: string) => {
			setFormState((prev) => ({
				...prev,
				name,
				id: idManuallyEdited ? prev.id : generateHookIdFromName(name),
			}))
			// Clear name error when user types
			setErrors((prev) => ({ ...prev, name: undefined }))
		},
		[idManuallyEdited],
	)

	const handleIdChange = useCallback((id: string) => {
		setFormState((prev) => ({ ...prev, id }))
		setIdManuallyEdited(true)
		// Clear ID error when user types
		setErrors((prev) => ({ ...prev, id: undefined }))
	}, [])

	const handleEventTypeChange = useCallback((eventType: HookEventType) => {
		setFormState((prev) => ({
			...prev,
			eventType,
			// Reset matchers when event type changes
			toolMatchers: { tools: [], customPattern: null },
			sessionMatchers: { sessionType: [] },
		}))
		setErrors((prev) => ({ ...prev, eventType: undefined }))
	}, [])

	const _handleActionTypeChange = useCallback((actionType: "command" | "slashCommand") => {
		setFormState((prev) => ({
			...prev,
			actionType,
			// Reset command-specific fields when type changes
			command: actionType === "slashCommand" ? "/" : "",
			cwd: "",
			timeout: 30,
			args: "",
		}))
		setErrors((prev) => ({ ...prev, command: undefined }))
	}, [])

	const handleActionChange = useCallback((action: HookAction) => {
		if (action.type === "command") {
			setFormState((prev) => ({
				...prev,
				actionType: "command",
				command: action.command,
				cwd: action.cwd ?? "",
				timeout: action.timeout ?? 30,
			}))
		} else {
			setFormState((prev) => ({
				...prev,
				actionType: "slashCommand",
				command: action.command,
				args: action.args ?? "",
			}))
		}
		setErrors((prev) => ({ ...prev, command: undefined }))
	}, [])

	const handleToolMatchersChange = useCallback((matchers: ToolMatchersConfig) => {
		setFormState((prev) => ({ ...prev, toolMatchers: matchers }))
	}, [])

	const handleSessionMatchersChange = useCallback((matchers: SessionMatchersConfig) => {
		setFormState((prev) => ({ ...prev, sessionMatchers: matchers }))
	}, [])

	const validateForm = useCallback((): boolean => {
		const newErrors: FormErrors = {}

		// Validate ID
		const idResult = validateHookId(formState.id)
		if (!idResult.valid) {
			newErrors.id = idResult.error
		}

		// Validate name
		const nameResult = validateHookName(formState.name)
		if (!nameResult.valid) {
			newErrors.name = nameResult.error
		}

		// Validate event type
		if (!formState.eventType) {
			newErrors.eventType = "Event type is required"
		}

		// Validate command
		const commandResult = validateCommand(formState.command, formState.actionType)
		if (!commandResult.valid) {
			newErrors.command = commandResult.error
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}, [formState, validateHookId, validateHookName, validateCommand])

	const handleCreate = useCallback(() => {
		if (!validateForm()) {
			return
		}

		// Build the action
		let action: HookAction
		if (formState.actionType === "command") {
			action = {
				type: "command",
				command: formState.command,
				cwd: formState.cwd || undefined,
				timeout: formState.timeout,
			} as ShellCommandAction
		} else {
			action = {
				type: "slashCommand",
				command: formState.command,
				args: formState.args || undefined,
			} as SlashCommandAction
		}

		// Build matchers based on event type
		let matchers: ToolMatchersConfig | SessionMatchersConfig | undefined
		if (formState.eventType && usesToolMatchers(formState.eventType)) {
			matchers = formState.toolMatchers
		} else if (formState.eventType && usesSessionMatchers(formState.eventType)) {
			matchers = formState.sessionMatchers
		}

		// Create the hook
		const newHook: HookWithMetadata = {
			id: formState.id.trim(),
			name: formState.name.trim(),
			enabled: true,
			eventType: formState.eventType as HookEventType,
			source: formState.source,
			action,
			matchers,
		}

		onCreate(newHook)
		onOpenChange(false)
	}, [formState, validateForm, onCreate, onOpenChange])

	// Build current action for HookActionEditor
	const currentAction: HookAction =
		formState.actionType === "command"
			? {
					type: "command",
					command: formState.command,
					cwd: formState.cwd || undefined,
					timeout: formState.timeout,
				}
			: {
					type: "slashCommand",
					command: formState.command,
					args: formState.args || undefined,
				}

	const showToolMatchers = formState.eventType && usesToolMatchers(formState.eventType)
	const showSessionMatchers = formState.eventType && usesSessionMatchers(formState.eventType)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Plus className="w-5 h-5" />
						Create New Hook
					</DialogTitle>
					<DialogDescription>
						Configure a new hook that will execute when the specified event occurs.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Hook Name */}
					<div className="space-y-1">
						<label htmlFor="create-hook-name" className="text-sm font-medium text-vscode-foreground">
							Name <span className="text-vscode-errorForeground">*</span>
						</label>
						<input
							id="create-hook-name"
							type="text"
							value={formState.name}
							onChange={(e) => handleNameChange(e.target.value)}
							placeholder="e.g., Format on Save"
							className={cn(
								"w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder",
								errors.name ? "border-vscode-errorForeground" : "border-vscode-input-border",
							)}
						/>
						{errors.name && <p className="text-xs text-vscode-errorForeground">{errors.name}</p>}
					</div>

					{/* Hook ID */}
					<div className="space-y-1">
						<label htmlFor="create-hook-id" className="text-sm font-medium text-vscode-foreground">
							Hook ID <span className="text-vscode-errorForeground">*</span>
						</label>
						<input
							id="create-hook-id"
							type="text"
							value={formState.id}
							onChange={(e) => handleIdChange(e.target.value)}
							placeholder="e.g., format-on-save"
							className={cn(
								"w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder font-mono",
								errors.id ? "border-vscode-errorForeground" : "border-vscode-input-border",
							)}
						/>
						{errors.id ? (
							<p className="text-xs text-vscode-errorForeground">{errors.id}</p>
						) : (
							<p className="text-xs text-vscode-descriptionForeground">
								Unique identifier using lowercase letters, numbers, and hyphens only.
							</p>
						)}
					</div>

					{/* Event Type */}
					<div className="space-y-1">
						<label htmlFor="create-hook-event-type" className="text-sm font-medium text-vscode-foreground">
							Event Type <span className="text-vscode-errorForeground">*</span>
						</label>
						<select
							id="create-hook-event-type"
							value={formState.eventType}
							onChange={(e) => handleEventTypeChange(e.target.value as HookEventType)}
							className={cn(
								"w-full bg-vscode-input-background text-vscode-input-foreground border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder",
								errors.eventType ? "border-vscode-errorForeground" : "border-vscode-input-border",
							)}>
							<option value="">Select an event type...</option>
							{hookEventTypes.map((eventType) => (
								<option key={eventType} value={eventType}>
									{eventType} - {hookEventDescriptions[eventType]}
								</option>
							))}
						</select>
						{errors.eventType && <p className="text-xs text-vscode-errorForeground">{errors.eventType}</p>}
					</div>

					{/* Source Selection */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-vscode-foreground">Source</label>
						<div className="flex gap-4">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="hookSource"
									checked={formState.source === "project"}
									onChange={() => setFormState((prev) => ({ ...prev, source: "project" }))}
									className="accent-vscode-focusBorder"
								/>
								<span className="text-sm text-vscode-foreground">Project</span>
								<span className="text-xs text-vscode-descriptionForeground">
									(.roo/hooks/.hooks.yaml)
								</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="hookSource"
									checked={formState.source === "global"}
									onChange={() => setFormState((prev) => ({ ...prev, source: "global" }))}
									className="accent-vscode-focusBorder"
								/>
								<span className="text-sm text-vscode-foreground">Global</span>
								<span className="text-xs text-vscode-descriptionForeground">
									(~/.roo/hooks/.hooks.yaml)
								</span>
							</label>
						</div>
					</div>

					{/* Matchers Section (conditional) */}
					{showToolMatchers && (
						<div className="space-y-2 border border-vscode-panel-border rounded-md p-4">
							<h4 className="text-sm font-medium text-vscode-foreground">Tool Matchers</h4>
							<HookToolMatchers matchers={formState.toolMatchers} onChange={handleToolMatchersChange} />

							{/* Custom Pattern */}
							<div className="space-y-1 mt-3">
								<label
									htmlFor="create-custom-pattern"
									className="text-sm font-medium text-vscode-foreground">
									Custom Pattern{" "}
									<span className="text-vscode-descriptionForeground font-normal">(optional)</span>
								</label>
								<input
									id="create-custom-pattern"
									type="text"
									value={formState.toolMatchers.customPattern ?? ""}
									onChange={(e) =>
										handleToolMatchersChange({
											...formState.toolMatchers,
											customPattern: e.target.value || null,
										})
									}
									placeholder="e.g., write_to_file|apply_diff"
									className="w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder font-mono"
								/>
								<p className="text-xs text-vscode-descriptionForeground">
									Regex pattern to match specific tool IDs.
								</p>
							</div>
						</div>
					)}

					{showSessionMatchers && (
						<div className="space-y-2 border border-vscode-panel-border rounded-md p-4">
							<h4 className="text-sm font-medium text-vscode-foreground">Session Matchers</h4>
							<HookSessionMatchers
								matchers={formState.sessionMatchers}
								onChange={handleSessionMatchersChange}
							/>
						</div>
					)}

					{/* Action/Command Section */}
					<div className="space-y-2 border border-vscode-panel-border rounded-md p-4">
						<h4 className="text-sm font-medium text-vscode-foreground">
							Action <span className="text-vscode-errorForeground">*</span>
						</h4>
						<HookActionEditor action={currentAction} onChange={handleActionChange} />
						{errors.command && <p className="text-xs text-vscode-errorForeground mt-2">{errors.command}</p>}
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleCreate}>
						<Plus className="w-4 h-4 mr-1" />
						Create Hook
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
