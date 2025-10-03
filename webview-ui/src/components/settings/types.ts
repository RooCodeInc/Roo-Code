import type { ExperimentId } from "@roo-code/types"

import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

export type SetCachedStateField<K extends keyof ExtensionStateContextType> = (
	field: K,
	value: ExtensionStateContextType[K],
) => void

export type SetExperimentEnabled = (id: ExperimentId, enabled: boolean) => void

// Mode Families Types
export interface ModeFamily {
	/** Unique identifier for the family */
	id: string
	/** Display name for the family */
	name: string
	/** Optional description */
	description?: string
	/** Mode slugs that are enabled in this family */
	enabledModes: string[]
	/** Whether this family is currently active */
	isActive: boolean
	/** Creation timestamp */
	createdAt: number
	/** Last modification timestamp */
	updatedAt: number
}

export interface ModeFamilyConfig {
	/** All available families */
	families: ModeFamily[]
	/** Currently active family ID */
	activeFamilyId?: string
}

export interface ModeFamiliesState {
	/** Current family configuration */
	config: ModeFamilyConfig
	/** Available modes for family assignment */
	availableModes: Array<{
		slug: string
		name: string
		isBuiltIn: boolean
	}>
	/** Loading state */
	isLoading: boolean
	/** Error state */
	error?: string
}

// VS Code message types for mode families
export interface ModeFamilyMessage {
	type: "createModeFamily"
	family: Omit<ModeFamily, "id" | "createdAt" | "updatedAt">
}

export interface UpdateModeFamilyMessage {
	type: "updateModeFamily"
	familyId: string
	updates: Partial<Omit<ModeFamily, "id" | "createdAt" | "updatedAt">>
}

export interface DeleteModeFamilyMessage {
	type: "deleteModeFamily"
	familyId: string
}

export interface SetActiveModeFamilyMessage {
	type: "setActiveModeFamily"
	familyId: string
}

export interface ModeFamiliesResponse {
	type: "modeFamiliesResponse"
	state: ModeFamiliesState
}