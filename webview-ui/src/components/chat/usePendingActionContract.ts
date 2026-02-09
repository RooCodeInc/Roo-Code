import { useCallback, useRef, useState } from "react"

export interface PendingActionContract {
	isPending: boolean
	tryBeginPendingAction: () => boolean
	clearPendingAction: () => void
}

export const usePendingActionContract = (): PendingActionContract => {
	const pendingActionRef = useRef(false)
	const [isPending, setIsPending] = useState(false)

	const tryBeginPendingAction = useCallback(() => {
		if (pendingActionRef.current) {
			return false
		}

		pendingActionRef.current = true
		setIsPending(true)
		return true
	}, [])

	const clearPendingAction = useCallback(() => {
		pendingActionRef.current = false
		setIsPending(false)
	}, [])

	return {
		isPending,
		tryBeginPendingAction,
		clearPendingAction,
	}
}
