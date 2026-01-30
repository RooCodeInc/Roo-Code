import React, { useState, useCallback, useEffect } from "react"

import type { HookAction, ShellCommandAction, SlashCommandAction } from "@roo-code/types"

import { cn } from "@/lib/utils"

import { useDebouncedCallback } from "./hooks/useDebouncedCallback"

interface HookActionEditorProps {
	action: HookAction
	onChange: (action: HookAction) => void
	disabled?: boolean
	/** Unique ID prefix for input elements */
	idPrefix?: string
}

interface ValidationState {
	command?: string
}

/**
 * Reusable component for editing shell/slash command actions.
 * Used by HookCommandTab and CreateHookDialog.
 *
 * Features debounced updates (300ms) for text inputs.
 */
export const HookActionEditor: React.FC<HookActionEditorProps> = ({
	action,
	onChange,
	disabled = false,
	idPrefix = "action",
}) => {
	const isShellCommand = action.type === "command"
	const isSlashCommand = action.type === "slashCommand"

	// Local state for immediate UI updates
	const [localCommand, setLocalCommand] = useState(action.command)
	const [localCwd, setLocalCwd] = useState(isShellCommand ? ((action as ShellCommandAction).cwd ?? "") : "")
	const [localArgs, setLocalArgs] = useState(isSlashCommand ? ((action as SlashCommandAction).args ?? "") : "")
	const [validationErrors, setValidationErrors] = useState<ValidationState>({})

	// Sync local state when action changes externally
	useEffect(() => {
		setLocalCommand(action.command)
	}, [action.command])

	useEffect(() => {
		if (action.type === "command") {
			setLocalCwd((action as ShellCommandAction).cwd ?? "")
		}
	}, [action])

	useEffect(() => {
		if (action.type === "slashCommand") {
			setLocalArgs((action as SlashCommandAction).args ?? "")
		}
	}, [action])

	// Debounced change handlers
	const debouncedCommandChange = useDebouncedCallback((command: string, currentAction: HookAction) => {
		// Validate
		if (!command || command.trim().length === 0) {
			setValidationErrors((prev) => ({ ...prev, command: "Command is required" }))
			return
		}
		if (currentAction.type === "slashCommand" && !command.startsWith("/")) {
			setValidationErrors((prev) => ({ ...prev, command: "Slash command must start with /" }))
			return
		}
		setValidationErrors((prev) => ({ ...prev, command: undefined }))

		if (currentAction.type === "command") {
			onChange({
				...currentAction,
				command: command.trim(),
			} as ShellCommandAction)
		} else {
			onChange({
				...currentAction,
				command: command.trim(),
			} as SlashCommandAction)
		}
	}, 300)

	const debouncedCwdChange = useDebouncedCallback((cwd: string) => {
		if (action.type === "command") {
			onChange({
				...action,
				cwd: cwd.trim() || undefined,
			} as ShellCommandAction)
		}
	}, 300)

	const debouncedArgsChange = useDebouncedCallback((args: string) => {
		if (action.type === "slashCommand") {
			onChange({
				...action,
				args: args.trim() || undefined,
			} as SlashCommandAction)
		}
	}, 300)

	const handleActionTypeChange = useCallback(
		(type: "command" | "slashCommand") => {
			// Reset validation
			setValidationErrors({})

			if (type === "command") {
				const newAction: ShellCommandAction = {
					type: "command",
					command: "",
					timeout: 30,
				}
				setLocalCommand("")
				setLocalCwd("")
				onChange(newAction)
			} else {
				const newAction: SlashCommandAction = {
					type: "slashCommand",
					command: "/",
					args: "",
				}
				setLocalCommand("/")
				setLocalArgs("")
				onChange(newAction)
			}
		},
		[onChange],
	)

	const handleCommandChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value
			setLocalCommand(value)
			// Clear validation error immediately when user types
			if (validationErrors.command) {
				setValidationErrors((prev) => ({ ...prev, command: undefined }))
			}
			debouncedCommandChange(value, action)
		},
		[debouncedCommandChange, action, validationErrors.command],
	)

	const handleCwdChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value
			setLocalCwd(value)
			debouncedCwdChange(value)
		},
		[debouncedCwdChange],
	)

	const handleArgsChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value
			setLocalArgs(value)
			debouncedArgsChange(value)
		},
		[debouncedArgsChange],
	)

	const handleTimeoutChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			if (action.type === "command") {
				onChange({
					...action,
					timeout: parseInt(e.target.value, 10),
				} as ShellCommandAction)
			}
		},
		[action, onChange],
	)

	return (
		<div className="space-y-4">
			{/* Action Type Radio Buttons */}
			<div className="space-y-2">
				<label className="text-sm font-medium text-vscode-foreground">Action Type</label>
				<div className="flex gap-4">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name={`${idPrefix}-actionType`}
							checked={isShellCommand}
							onChange={() => handleActionTypeChange("command")}
							disabled={disabled}
							className="accent-vscode-focusBorder"
						/>
						<span className="text-sm text-vscode-foreground">Shell Command</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name={`${idPrefix}-actionType`}
							checked={isSlashCommand}
							onChange={() => handleActionTypeChange("slashCommand")}
							disabled={disabled}
							className="accent-vscode-focusBorder"
						/>
						<span className="text-sm text-vscode-foreground">Slash Command</span>
					</label>
				</div>
			</div>

			{/* Shell Command Fields */}
			{isShellCommand && action.type === "command" && (
				<div className="space-y-4 border-l-2 border-vscode-panel-border pl-4">
					<div className="space-y-1">
						<label
							htmlFor={`${idPrefix}-shell-command`}
							className="text-sm font-medium text-vscode-foreground">
							Command
						</label>
						<input
							id={`${idPrefix}-shell-command`}
							type="text"
							value={localCommand}
							onChange={handleCommandChange}
							disabled={disabled}
							placeholder="e.g., /path/to/script.sh ${FILE_PATH}"
							className={cn(
								"w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder",
								validationErrors.command
									? "border-vscode-errorForeground"
									: "border-vscode-input-border",
							)}
						/>
						{validationErrors.command && (
							<p className="text-xs text-vscode-errorForeground">{validationErrors.command}</p>
						)}
					</div>

					<div className="space-y-1">
						<label htmlFor={`${idPrefix}-shell-cwd`} className="text-sm font-medium text-vscode-foreground">
							Working Directory{" "}
							<span className="text-vscode-descriptionForeground font-normal">(optional)</span>
						</label>
						<input
							id={`${idPrefix}-shell-cwd`}
							type="text"
							value={localCwd}
							onChange={handleCwdChange}
							disabled={disabled}
							placeholder="e.g., ${WORKSPACE_DIR}"
							className="w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder"
						/>
					</div>

					<div className="space-y-1">
						<label
							htmlFor={`${idPrefix}-shell-timeout`}
							className="text-sm font-medium text-vscode-foreground">
							Timeout <span className="text-vscode-descriptionForeground font-normal">(seconds)</span>
						</label>
						<select
							id={`${idPrefix}-shell-timeout`}
							value={action.timeout}
							onChange={handleTimeoutChange}
							disabled={disabled}
							className="w-32 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder">
							<option value={10}>10 seconds</option>
							<option value={30}>30 seconds</option>
							<option value={60}>60 seconds</option>
							<option value={120}>120 seconds</option>
							<option value={300}>300 seconds</option>
						</select>
					</div>
				</div>
			)}

			{/* Slash Command Fields */}
			{isSlashCommand && action.type === "slashCommand" && (
				<div className="space-y-4 border-l-2 border-vscode-panel-border pl-4">
					<div className="space-y-1">
						<label
							htmlFor={`${idPrefix}-slash-command`}
							className="text-sm font-medium text-vscode-foreground">
							Slash Command
						</label>
						<input
							id={`${idPrefix}-slash-command`}
							type="text"
							value={localCommand}
							onChange={handleCommandChange}
							disabled={disabled}
							placeholder="e.g., /my-custom-command"
							className={cn(
								"w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder",
								validationErrors.command
									? "border-vscode-errorForeground"
									: "border-vscode-input-border",
							)}
						/>
						{validationErrors.command ? (
							<p className="text-xs text-vscode-errorForeground">{validationErrors.command}</p>
						) : (
							<p className="text-xs text-vscode-descriptionForeground">
								Must start with / and reference an existing slash command
							</p>
						)}
					</div>

					<div className="space-y-1">
						<label
							htmlFor={`${idPrefix}-slash-args`}
							className="text-sm font-medium text-vscode-foreground">
							Arguments <span className="text-vscode-descriptionForeground font-normal">(optional)</span>
						</label>
						<input
							id={`${idPrefix}-slash-args`}
							type="text"
							value={localArgs}
							onChange={handleArgsChange}
							disabled={disabled}
							placeholder="e.g., --verbose --format json"
							className="w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder"
						/>
					</div>
				</div>
			)}
		</div>
	)
}
