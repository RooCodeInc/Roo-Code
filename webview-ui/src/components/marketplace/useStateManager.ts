import { useState, useEffect } from "react"
import { MarketplaceViewStateManager, ViewState } from "./MarketplaceViewStateManager"

export function useStateManager(existingManager?: MarketplaceViewStateManager) {
	const [manager] = useState(() => existingManager || new MarketplaceViewStateManager())
	const [state, setState] = useState(() => manager.getState())

	useEffect(() => {
		const handleStateChange = (newState: ViewState) => {
			setState((prevState) => {
				// Compare specific state properties that matter for rendering
				const hasChanged =
					prevState.isFetching !== newState.isFetching ||
					prevState.activeTab !== newState.activeTab ||
					prevState.allItems !== newState.allItems ||
					prevState.displayItems !== newState.displayItems ||
					prevState.filters !== newState.filters ||
					prevState.sources !== newState.sources ||
					prevState.refreshingUrls !== newState.refreshingUrls ||
					prevState.installedMetadata !== newState.installedMetadata

				return hasChanged ? newState : prevState
			})
		}

		const handleMessage = (event: MessageEvent) => {
			manager.handleMessage(event.data)
		}

		window.addEventListener("message", handleMessage)
		const unsubscribe = manager.onStateChange(handleStateChange)

		return () => {
			window.removeEventListener("message", handleMessage)
			unsubscribe()
			// Don't cleanup the manager if it was provided externally
			if (!existingManager) {
				manager.cleanup()
			}
		}
	}, [manager, existingManager])

	return [state, manager] as const
}
