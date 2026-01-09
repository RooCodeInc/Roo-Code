/**
 * Zustand Store Profiler
 *
 * Wraps existing Zustand stores to profile state updates.
 * Only active when profiling is enabled.
 *
 * Usage:
 *   import { wrapStoreWithProfiler } from "./storeProfiler.js"
 *
 *   // After store creation, wrap it for profiling
 *   wrapStoreWithProfiler(useMyStore, "MyStore")
 */

import { RenderProfiler } from "./renderProfiler.js"

/**
 * Find which keys changed between two state objects
 */
function findChangedKeys<T extends object>(prev: T, next: T): string[] {
	const changed: string[] = []
	const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])

	for (const key of allKeys) {
		const prevValue = (prev as Record<string, unknown>)[key]
		const nextValue = (next as Record<string, unknown>)[key]

		// Shallow comparison
		if (prevValue !== nextValue) {
			changed.push(key)
		}
	}

	return changed
}

/**
 * Type for a Zustand store that has getState and setState methods
 * Using loose typing to handle Zustand's complex overloaded setState signature
 */
interface ZustandLikeStore {
	getState: () => unknown
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	setState: (...args: any[]) => void
}

/**
 * Wrap an existing Zustand store with profiling
 *
 * This wraps the store's setState method to measure duration
 * and track which state keys changed.
 *
 * @param store - The Zustand store hook (has getState/setState)
 * @param storeName - Name for logging
 */
export function wrapStoreWithProfiler(store: ZustandLikeStore, storeName: string): void {
	const originalSetState = store.setState.bind(store)

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	store.setState = (...args: any[]) => {
		const [partial, replace] = args
		const profiler = RenderProfiler.getInstance()

		// Fast path: if profiling is disabled, just call original
		if (!profiler.isEnabled()) {
			return originalSetState(partial, replace)
		}

		const start = performance.now()
		const prevState = store.getState()

		// Call original setState
		originalSetState(partial, replace)

		const duration = performance.now() - start
		const nextState = store.getState()

		// Find what changed
		const changedKeys = findChangedKeys(prevState as object, nextState as object)

		// Determine action name from the partial
		let actionName = "setState"
		if (typeof partial === "object" && partial !== null) {
			const keys = Object.keys(partial)
			if (keys.length <= 3) {
				actionName = `set(${keys.join(",")})`
			} else {
				actionName = `set(${keys.length} keys)`
			}
		} else if (typeof partial === "function") {
			actionName = "set(fn)"
		}

		// Record the update
		profiler.recordStoreUpdate(storeName, actionName, duration)

		// Log changed keys (as separate record with 0 duration to avoid double-counting)
		if (changedKeys.length > 0 && changedKeys.length <= 5) {
			profiler.recordStoreUpdate(storeName, `→ ${changedKeys.join(",")}`, 0)
		}
	}
}

/**
 * Create a logging wrapper for setState that can be used manually
 *
 * Usage:
 *   const profiledSet = createProfiledSetState(set, "MyStore")
 *   // Use profiledSet instead of set
 */
export function createProfiledSetState<T extends object>(
	originalSet: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void,
	getState: () => T,
	storeName: string,
): typeof originalSet {
	return (partial, replace) => {
		const profiler = RenderProfiler.getInstance()

		// Fast path: if profiling is disabled, just call original
		if (!profiler.isEnabled()) {
			return originalSet(partial, replace)
		}

		const start = performance.now()
		const prevState = getState()

		// Call original set
		originalSet(partial, replace)

		const duration = performance.now() - start
		const nextState = getState()

		// Find what changed
		const changedKeys = findChangedKeys(prevState as object, nextState as object)

		// Determine action name
		let actionName = "set"
		if (typeof partial === "object" && partial !== null) {
			const keys = Object.keys(partial)
			if (keys.length <= 3) {
				actionName = `set(${keys.join(",")})`
			} else {
				actionName = `set(${keys.length} keys)`
			}
		} else if (typeof partial === "function") {
			actionName = "set(fn)"
		}

		// Record the update
		profiler.recordStoreUpdate(storeName, actionName, duration)

		// Log changed keys
		if (changedKeys.length > 0 && changedKeys.length <= 5) {
			profiler.recordStoreUpdate(storeName, `→ ${changedKeys.join(",")}`, 0)
		}
	}
}
