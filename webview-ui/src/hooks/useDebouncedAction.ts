import { useCallback, useEffect, useRef, useState } from "react"

export function useDebouncedAction(delay = 300) {
	const [isProcessing, setIsProcessing] = useState(false)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const handleWithDebounce = useCallback(
		(operation: () => void) => {
			if (isProcessing) return
			setIsProcessing(true)
			try {
				operation()
			} catch {
				// no-op: swallow errors from caller operations
			}
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			timeoutRef.current = setTimeout(
				() => {
					setIsProcessing(false)
				},
				Math.max(0, delay),
			)
		},
		[isProcessing, delay],
	)

	// Cleanup effect to prevent memory leaks
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	return { isProcessing, handleWithDebounce }
}

export default useDebouncedAction
