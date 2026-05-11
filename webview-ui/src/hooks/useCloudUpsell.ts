import { useState, useCallback, useRef, useEffect } from "react"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface UseCloudUpsellOptions {
	onAuthSuccess?: () => void
	autoOpenOnAuth?: boolean
}

export const useCloudUpsell = (options: UseCloudUpsellOptions = {}) => {
	const { onAuthSuccess, autoOpenOnAuth = false } = options
	const [isOpen, setIsOpen] = useState(false)
	const [shouldOpenOnAuth, setShouldOpenOnAuth] = useState(false)
	const { cloudIsAuthenticated, sharingEnabled, publicSharingEnabled } = useExtensionState()
	const wasUnauthenticatedRef = useRef(!cloudIsAuthenticated)
	const initiatedAuthRef = useRef(false)

	const openUpsell = useCallback(() => {
		setIsOpen(true)
	}, [])

	const closeUpsell = useCallback(() => {
		setIsOpen(false)
		setShouldOpenOnAuth(false)
	}, [])

	const handleConnect = useCallback(() => {
		// Mark that authentication was initiated from this hook
		initiatedAuthRef.current = true
		setShouldOpenOnAuth(true)

		// Send message to VS Code to initiate sign in
		vscode.postMessage({ type: "rooCloudSignIn" })

		// Close the upsell dialog
		closeUpsell()
	}, [closeUpsell])

	useEffect(() => {
		if (!cloudIsAuthenticated) {
			wasUnauthenticatedRef.current = true
			return
		}

		const completedRequestedAuth = initiatedAuthRef.current && wasUnauthenticatedRef.current && shouldOpenOnAuth

		if (completedRequestedAuth) {
			if (autoOpenOnAuth) {
				setIsOpen(true)
			}
			onAuthSuccess?.()
			setShouldOpenOnAuth(false)
			initiatedAuthRef.current = false
		}

		wasUnauthenticatedRef.current = false
	}, [autoOpenOnAuth, cloudIsAuthenticated, onAuthSuccess, shouldOpenOnAuth])

	return {
		isOpen,
		openUpsell,
		closeUpsell,
		handleConnect,
		isAuthenticated: cloudIsAuthenticated,
		sharingEnabled,
		publicSharingEnabled,
	}
}
