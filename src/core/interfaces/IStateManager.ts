/**
 * IStateManager - Core interface for managing state
 *
 * This interface defines the contract for state management,
 * allowing different implementations without coupling to specific details.
 */

/**
 * Interface for managing state in the application
 */
export interface IStateManager {
	/**
	 * Reset the state to its initial values
	 */
	resetToInitialState(): Promise<void>

	/**
	 * Get the current state
	 * @returns The current state object
	 */
	getState(): Record<string, any>

	/**
	 * Update a specific part of the state
	 * @param key - The state key to update
	 * @param value - The new value
	 */
	updateState(key: string, value: any): void

	/**
	 * Check if the state manager is in a valid state
	 * @returns Whether the state is valid
	 */
	isValid(): boolean
}
