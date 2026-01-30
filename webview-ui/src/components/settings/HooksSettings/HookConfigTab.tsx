import React, { useState, useCallback, useEffect } from "react"

import {
	usesToolMatchers,
	usesSessionMatchers,
	type HookWithMetadata,
	type ToolMatchersConfig,
	type SessionMatchersConfig,
	type ShellCommandAction,
} from "@roo-code/types"

import { cn } from "@/lib/utils"

import { HookToolMatchers } from "./HookToolMatchers"
import { HookSessionMatchers } from "./HookSessionMatchers"
import { useDebouncedCallback } from "./hooks/useDebouncedCallback"

/** Hook ID validation regex - lowercase letters, numbers, and hyphens only */
const HOOK_ID_REGEX = /^[a-z0-9-]+$/

interface HookConfigTabProps {
	hook: HookWithMetadata
	onChange: (updates: Partial<HookWithMetadata>) => void
	disabled?: boolean
}

interface ValidationState {
	id?: string
	name?: string
}

/**
 * Config tab content for a hook item.
 * Shows:
 * - Hook ID input field (with validation)
 * - Hook Name input field (with validation)
 * - Conditional matchers (HookToolMatchers for tool-related events, HookSessionMatchers for SessionStart, nothing for events without matchers)
 * - Custom pattern input field for regex/glob (only for tool-related hooks)
 * - Timeout dropdown (only for shell commands)
 *
 * Features debounced updates (300ms) for text inputs.
 */
export const HookConfigTab: React.FC<HookConfigTabProps> = ({ hook, onChange, disabled = false }) => {
	const showToolMatchers = usesToolMatchers(hook.eventType)
	const showSessionMatchers = usesSessionMatchers(hook.eventType)
	const isShellCommand = hook.action.type === "command"

	// Local state for immediate UI updates
	const [localId, setLocalId] = useState(hook.id)
	const [localName, setLocalName] = useState(hook.name)
	const [localCustomPattern, setLocalCustomPattern] = useState(
		showToolMatchers ? ((hook.matchers as ToolMatchersConfig)?.customPattern ?? "") : "",
	)
	const [validationErrors, setValidationErrors] = useState<ValidationState>({})

	// Sync local state when hook changes externally
	useEffect(() => {
		setLocalId(hook.id)
	}, [hook.id])

	useEffect(() => {
		setLocalName(hook.name)
	}, [hook.name])

	useEffect(() => {
		if (showToolMatchers) {
			setLocalCustomPattern((hook.matchers as ToolMatchersConfig)?.customPattern ?? "")
		}
	}, [hook.matchers, showToolMatchers])

	// Debounced onChange handlers (300ms delay)
	const debouncedIdChange = useDebouncedCallback((id: string) => {
		// Validate before applying
		if (!id || id.trim().length === 0) {
			setValidationErrors((prev) => ({ ...prev, id: "Hook ID is required" }))
			return
		}
		if (!HOOK_ID_REGEX.test(id.trim())) {
			setValidationErrors((prev) => ({
				...prev,
				id: "Hook ID must contain only lowercase letters, numbers, and hyphens",
			}))
			return
		}
		setValidationErrors((prev) => ({ ...prev, id: undefined }))
		onChange({ id: id.trim() })
	}, 300)

	const debouncedNameChange = useDebouncedCallback((name: string) => {
		if (!name || name.trim().length === 0) {
			setValidationErrors((prev) => ({ ...prev, name: "Hook name is required" }))
			return
		}
		setValidationErrors((prev) => ({ ...prev, name: undefined }))
		onChange({ name: name.trim() })
	}, 300)

	const debouncedCustomPatternChange = useDebouncedCallback((customPattern: string) => {
		if (showToolMatchers) {
			const currentMatchers = (hook.matchers as ToolMatchersConfig) || {}
			onChange({
				matchers: {
					...currentMatchers,
					customPattern: customPattern || null,
				},
			})
		}
	}, 300)

	const handleIdChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value
			setLocalId(value)
			// Clear validation error immediately when user types
			if (validationErrors.id) {
				setValidationErrors((prev) => ({ ...prev, id: undefined }))
			}
			debouncedIdChange(value)
		},
		[debouncedIdChange, validationErrors.id],
	)

	const handleNameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value
			setLocalName(value)
			// Clear validation error immediately when user types
			if (validationErrors.name) {
				setValidationErrors((prev) => ({ ...prev, name: undefined }))
			}
			debouncedNameChange(value)
		},
		[debouncedNameChange, validationErrors.name],
	)

	const handleCustomPatternChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value
			setLocalCustomPattern(value)
			debouncedCustomPatternChange(value)
		},
		[debouncedCustomPatternChange],
	)

	const handleToolMatchersChange = useCallback(
		(matchers: ToolMatchersConfig) => {
			onChange({ matchers })
		},
		[onChange],
	)

	const handleSessionMatchersChange = useCallback(
		(matchers: SessionMatchersConfig) => {
			onChange({ matchers })
		},
		[onChange],
	)

	const handleTimeoutChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			if (hook.action.type === "command") {
				const shellAction: ShellCommandAction = {
					type: "command",
					command: hook.action.command,
					cwd: hook.action.cwd,
					timeout: parseInt(e.target.value, 10),
				}
				onChange({ action: shellAction })
			}
		},
		[hook.action, onChange],
	)

	return (
		<div className="space-y-4">
			{/* Hook ID */}
			<div className="space-y-1">
				<label htmlFor={`hook-id-${hook.id}`} className="text-sm font-medium text-vscode-foreground">
					Hook ID
				</label>
				<input
					id={`hook-id-${hook.id}`}
					type="text"
					value={localId}
					onChange={handleIdChange}
					disabled={disabled}
					placeholder="e.g., my-hook-id"
					className={cn(
						"w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder font-mono",
						validationErrors.id ? "border-vscode-errorForeground" : "border-vscode-input-border",
					)}
				/>
				{validationErrors.id ? (
					<p className="text-xs text-vscode-errorForeground">{validationErrors.id}</p>
				) : (
					<p className="text-xs text-vscode-descriptionForeground">
						Unique identifier using lowercase letters, numbers, and hyphens only.
					</p>
				)}
			</div>

			{/* Hook Name */}
			<div className="space-y-1">
				<label htmlFor={`hook-name-${hook.id}`} className="text-sm font-medium text-vscode-foreground">
					Name
				</label>
				<input
					id={`hook-name-${hook.id}`}
					type="text"
					value={localName}
					onChange={handleNameChange}
					disabled={disabled}
					placeholder="e.g., My Hook"
					className={cn(
						"w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder",
						validationErrors.name ? "border-vscode-errorForeground" : "border-vscode-input-border",
					)}
				/>
				{validationErrors.name ? (
					<p className="text-xs text-vscode-errorForeground">{validationErrors.name}</p>
				) : (
					<p className="text-xs text-vscode-descriptionForeground">Human-readable name for the hook.</p>
				)}
			</div>

			{/* Tool Matchers (for tool-related hooks) */}
			{showToolMatchers && (
				<>
					<HookToolMatchers
						matchers={hook.matchers as ToolMatchersConfig}
						onChange={handleToolMatchersChange}
						disabled={disabled}
					/>

					{/* Custom Pattern */}
					<div className="space-y-1">
						<label
							htmlFor={`custom-pattern-${hook.id}`}
							className="text-sm font-medium text-vscode-foreground">
							Custom Pattern{" "}
							<span className="text-vscode-descriptionForeground font-normal">(optional)</span>
						</label>
						<input
							id={`custom-pattern-${hook.id}`}
							type="text"
							value={localCustomPattern}
							onChange={handleCustomPatternChange}
							disabled={disabled}
							placeholder="e.g., write_to_file|apply_diff or mcp__memory__.*"
							className="w-full bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-focusBorder font-mono"
						/>
						<p className="text-xs text-vscode-descriptionForeground">
							Regex pattern to match specific tool IDs. Examples: write_to_file|edit_file, mcp__memory__.*
						</p>
					</div>
				</>
			)}

			{/* Session Matchers (for SessionStart hooks) */}
			{showSessionMatchers && (
				<HookSessionMatchers
					matchers={hook.matchers as SessionMatchersConfig}
					onChange={handleSessionMatchersChange}
					disabled={disabled}
				/>
			)}

			{/* No matchers info */}
			{!showToolMatchers && !showSessionMatchers && (
				<div className="text-sm text-vscode-descriptionForeground bg-vscode-input-background p-3 rounded border border-vscode-panel-border">
					<p>
						This hook type (<code className="bg-vscode-input-background px-1">{hook.eventType}</code>) fires
						unconditionally when its event occurs. No matchers are needed.
					</p>
				</div>
			)}

			{/* Timeout for shell commands - shown in Config tab as well for quick access */}
			{isShellCommand && hook.action.type === "command" && (
				<div className="space-y-1">
					<label htmlFor={`config-timeout-${hook.id}`} className="text-sm font-medium text-vscode-foreground">
						Timeout <span className="text-vscode-descriptionForeground font-normal">(seconds)</span>
					</label>
					<select
						id={`config-timeout-${hook.id}`}
						value={hook.action.timeout}
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
			)}
		</div>
	)
}
