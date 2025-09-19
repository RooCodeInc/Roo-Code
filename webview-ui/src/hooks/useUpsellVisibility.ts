import { useCallback, useMemo } from "react"
import { useDismissedUpsells, useIsUpsellVisible } from "@src/context/DismissedUpsellsContext"
import { UpsellId, UPSELL_IDS, isValidUpsellId } from "@src/constants/upsellIds"

// Re-export upsell constants and types for convenience
export { UPSELL_IDS, isValidUpsellId }
export type { UpsellId }

/**
 * Hook to check visibility of a single upsell
 * @param upsellId - The ID of the upsell to check
 * @returns Whether the upsell is visible (not dismissed)
 */
export function useUpsellVisibility(upsellId: UpsellId | string): boolean {
	return useIsUpsellVisible(upsellId)
}

/**
 * Hook to check visibility of multiple upsells
 * @param upsellIds - Array of upsell IDs to check
 * @returns Object with visibility status for each upsell ID
 */
export function useMultipleUpsellVisibility(upsellIds: (UpsellId | string)[]): Record<string, boolean> {
	const { isUpsellVisible } = useDismissedUpsells()

	return useMemo(() => {
		const result: Record<string, boolean> = {}

		for (const id of upsellIds) {
			result[id] = isUpsellVisible(id)
		}

		return result
	}, [upsellIds, isUpsellVisible])
}

/**
 * Hook to check if any of the provided upsells are visible
 * @param upsellIds - Array of upsell IDs to check
 * @returns True if at least one upsell is visible
 */
export function useAnyUpsellVisible(upsellIds: (UpsellId | string)[]): boolean {
	const { isUpsellVisible } = useDismissedUpsells()

	return useMemo(() => {
		return upsellIds.some((id) => isUpsellVisible(id))
	}, [upsellIds, isUpsellVisible])
}

/**
 * Hook to check if all of the provided upsells are visible
 * @param upsellIds - Array of upsell IDs to check
 * @returns True if all upsells are visible
 */
export function useAllUpsellsVisible(upsellIds: (UpsellId | string)[]): boolean {
	const { isUpsellVisible } = useDismissedUpsells()

	return useMemo(() => {
		return upsellIds.every((id) => isUpsellVisible(id))
	}, [upsellIds, isUpsellVisible])
}

/**
 * Hook that provides upsell management functions
 * @returns Object with upsell management functions
 */
export function useUpsellManager() {
	const { dismissUpsell, refreshDismissedUpsells, dismissedUpsells, isLoading } = useDismissedUpsells()

	const dismissMultiple = useCallback(
		(upsellIds: (UpsellId | string)[]) => {
			upsellIds.forEach((id) => dismissUpsell(id))
		},
		[dismissUpsell],
	)

	const getDismissedCount = useCallback(() => {
		return dismissedUpsells.length
	}, [dismissedUpsells])

	const clearAllDismissed = useCallback(() => {
		// This would require a new message type to the extension
		console.warn("clearAllDismissed is not yet implemented. It requires extension-side support.")
	}, [])

	return {
		dismissUpsell,
		dismissMultiple,
		refreshDismissedUpsells,
		getDismissedCount,
		clearAllDismissed,
		dismissedUpsells,
		isLoading,
	}
}
