import { useMemo } from "react"
import { useExtensionState } from "@src/context/ExtensionStateContext"

/**
 * Custom hook that creates and returns the auto-approval toggles object
 * This encapsulates the logic for creating the toggles object from extension state
 */
export function useAutoApprovalToggles() {
	const {
		alwaysAllowReadOnly,
		alwaysAllowWrite,
		alwaysAllowExecute,
		alwaysAllowBrowser,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysApproveResubmit,
		
		alwaysAllowDeploySfMetadata,
		alwaysAllowRetrieveSfMetadata,
	} = useExtensionState()

	const toggles = useMemo(
		() => ({
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysApproveResubmit,
			
			alwaysAllowDeploySfMetadata,
			alwaysAllowRetrieveSfMetadata,
		}),
		[
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysApproveResubmit,
		
			alwaysAllowDeploySfMetadata,
			alwaysAllowRetrieveSfMetadata,
		],
	)

	return toggles
}
