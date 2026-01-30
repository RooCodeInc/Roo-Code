import { useMemo, useCallback } from "react"

import type { HookActionType, HookConfig, ShellCommandAction } from "@roo-code/types"

/** Hook ID validation regex - lowercase letters, numbers, and hyphens only */
const HOOK_ID_REGEX = /^[a-z0-9-]+$/

/** Slash command validation - must start with / */
const SLASH_COMMAND_REGEX = /^\//

interface ValidationResult {
	valid: boolean
	error?: string
}

interface HookValidationErrors {
	id?: string
	name?: string
	command?: string
	eventType?: string
}

interface FullValidationResult {
	valid: boolean
	errors: HookValidationErrors
}

interface UseHookValidationProps {
	/** Function to check if a hook ID already exists */
	existingHookIds: string[]
}

interface UseHookValidationReturn {
	/**
	 * Validates a hook ID.
	 * - Must be non-empty
	 * - Must match lowercase letters, numbers, and hyphens only
	 * - Must be unique among existing hooks
	 */
	validateHookId: (id: string, excludeId?: string) => ValidationResult

	/**
	 * Validates a hook name.
	 * - Must be non-empty
	 */
	validateHookName: (name: string) => ValidationResult

	/**
	 * Validates a command based on action type.
	 * - For shell commands: must be non-empty
	 * - For slash commands: must start with /
	 */
	validateCommand: (command: string, actionType: HookActionType) => ValidationResult

	/**
	 * Validates a complete hook configuration.
	 * Returns all validation errors at once.
	 */
	validateHookConfig: (config: Partial<HookConfig> & { eventType?: string }) => FullValidationResult

	/**
	 * Checks if a hook ID is unique among existing hooks.
	 */
	isHookIdUnique: (id: string, excludeId?: string) => boolean
}

/**
 * Custom hook for hook validation.
 * Provides validation functions for hook fields.
 */
export function useHookValidation({ existingHookIds }: UseHookValidationProps): UseHookValidationReturn {
	const isHookIdUnique = useCallback(
		(id: string, excludeId?: string): boolean => {
			const idsToCheck = excludeId
				? existingHookIds.filter((existingId) => existingId !== excludeId)
				: existingHookIds
			return !idsToCheck.includes(id)
		},
		[existingHookIds],
	)

	const validateHookId = useCallback(
		(id: string, excludeId?: string): ValidationResult => {
			// Check if empty
			if (!id || id.trim().length === 0) {
				return { valid: false, error: "Hook ID is required" }
			}

			const trimmedId = id.trim()

			// Check format
			if (!HOOK_ID_REGEX.test(trimmedId)) {
				return {
					valid: false,
					error: "Hook ID must contain only lowercase letters, numbers, and hyphens",
				}
			}

			// Check uniqueness
			if (!isHookIdUnique(trimmedId, excludeId)) {
				return {
					valid: false,
					error: "A hook with this ID already exists",
				}
			}

			return { valid: true }
		},
		[isHookIdUnique],
	)

	const validateHookName = useCallback((name: string): ValidationResult => {
		if (!name || name.trim().length === 0) {
			return { valid: false, error: "Hook name is required" }
		}

		return { valid: true }
	}, [])

	const validateCommand = useCallback((command: string, actionType: HookActionType): ValidationResult => {
		if (!command || command.trim().length === 0) {
			return { valid: false, error: "Command is required" }
		}

		const trimmedCommand = command.trim()

		if (actionType === "slashCommand") {
			if (!SLASH_COMMAND_REGEX.test(trimmedCommand)) {
				return {
					valid: false,
					error: "Slash command must start with /",
				}
			}
		}

		return { valid: true }
	}, [])

	const validateHookConfig = useCallback(
		(config: Partial<HookConfig> & { eventType?: string }): FullValidationResult => {
			const errors: HookValidationErrors = {}

			// Validate ID
			const idResult = validateHookId(config.id ?? "")
			if (!idResult.valid) {
				errors.id = idResult.error
			}

			// Validate name
			const nameResult = validateHookName(config.name ?? "")
			if (!nameResult.valid) {
				errors.name = nameResult.error
			}

			// Validate event type
			if (!config.eventType) {
				errors.eventType = "Event type is required"
			}

			// Validate action/command
			if (config.action) {
				const actionType = config.action.type
				const command = "command" in config.action ? config.action.command : ""
				const commandResult = validateCommand(command, actionType)
				if (!commandResult.valid) {
					errors.command = commandResult.error
				}
			} else {
				errors.command = "Command is required"
			}

			return {
				valid: Object.keys(errors).length === 0,
				errors,
			}
		},
		[validateHookId, validateHookName, validateCommand],
	)

	return useMemo(
		() => ({
			validateHookId,
			validateHookName,
			validateCommand,
			validateHookConfig,
			isHookIdUnique,
		}),
		[validateHookId, validateHookName, validateCommand, validateHookConfig, isHookIdUnique],
	)
}

/**
 * Generates a unique hook ID from a name.
 * Converts to lowercase, replaces spaces with hyphens, removes invalid characters.
 */
export function generateHookIdFromName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
}

/**
 * Creates a default hook configuration for a given event type.
 */
export function createDefaultHookConfig(_eventType: string): Partial<HookConfig> {
	return {
		id: "",
		name: "",
		enabled: true,
		action: {
			type: "command",
			command: "",
			timeout: 30,
		} as ShellCommandAction,
		matchers: undefined,
	}
}
