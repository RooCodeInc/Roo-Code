import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"
import { vscode } from "@src/utils/vscode"
import { UpsellId } from "@src/constants/upsellIds"

interface DismissedUpsellsContextType {
	/** List of dismissed upsell IDs */
	dismissedUpsells: string[]
	/** Check if a specific upsell is visible (not dismissed) */
	isUpsellVisible: (upsellId: UpsellId | string) => boolean
	/** Dismiss an upsell */
	dismissUpsell: (upsellId: UpsellId | string) => void
	/** Check if the context is loading initial data */
	isLoading: boolean
	/** Force refresh dismissed upsells from extension */
	refreshDismissedUpsells: () => void
}

const DismissedUpsellsContext = createContext<DismissedUpsellsContextType | undefined>(undefined)

interface DismissedUpsellsProviderProps {
	children: ReactNode
}

export const DismissedUpsellsProvider: React.FC<DismissedUpsellsProviderProps> = ({ children }) => {
	const [dismissedUpsells, setDismissedUpsells] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(false)

	// Request dismissed upsells from extension
	const refreshDismissedUpsells = useCallback(() => {
		vscode.postMessage({ type: "getDismissedUpsells" })
	}, [])

	// Check if an upsell is visible
	const isUpsellVisible = useCallback(
		(upsellId: UpsellId | string): boolean => {
			return !dismissedUpsells.includes(upsellId)
		},
		[dismissedUpsells],
	)

	// Dismiss an upsell
	const dismissUpsell = useCallback(
		(upsellId: UpsellId | string) => {
			if (!dismissedUpsells.includes(upsellId)) {
				// Optimistically update local state
				setDismissedUpsells((prev) => [...prev, upsellId])

				// Send dismiss message to extension
				vscode.postMessage({
					type: "dismissUpsell",
					upsellId: upsellId,
				})
			}
		},
		[dismissedUpsells],
	)

	// Listen for messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			if (message && message.type === "dismissedUpsells" && Array.isArray(message.list)) {
				setDismissedUpsells(message.list)
				setIsLoading(false)
			}
		}

		window.addEventListener("message", handleMessage)

		// Request initial dismissed upsells list
		refreshDismissedUpsells()

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [refreshDismissedUpsells])

	const value: DismissedUpsellsContextType = {
		dismissedUpsells,
		isUpsellVisible,
		dismissUpsell,
		isLoading,
		refreshDismissedUpsells,
	}

	return <DismissedUpsellsContext.Provider value={value}>{children}</DismissedUpsellsContext.Provider>
}

/**
 * Hook to use the dismissed upsells context
 * @throws Error if used outside of DismissedUpsellsProvider
 */
export const useDismissedUpsells = (): DismissedUpsellsContextType => {
	const context = useContext(DismissedUpsellsContext)

	if (!context) {
		throw new Error("useDismissedUpsells must be used within a DismissedUpsellsProvider")
	}

	return context
}

/**
 * Helper hook to check if a specific upsell is visible
 * This is a convenience wrapper around useDismissedUpsells
 */
export const useIsUpsellVisible = (upsellId: UpsellId | string): boolean => {
	const { isUpsellVisible } = useDismissedUpsells()
	return isUpsellVisible(upsellId)
}
