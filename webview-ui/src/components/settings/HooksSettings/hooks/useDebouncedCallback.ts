import { useCallback, useRef, useEffect, useState } from "react"

/**
 * A hook that returns a debounced version of the provided callback.
 * The debounced function will only execute after the specified delay
 * has passed without any new calls.
 *
 * @param callback - The function to debounce
 * @param delay - The debounce delay in milliseconds
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
	callback: T,
	delay: number,
): (...args: Parameters<T>) => void {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const callbackRef = useRef(callback)

	// Update the callback ref when callback changes
	useEffect(() => {
		callbackRef.current = callback
	}, [callback])

	// Clear timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	return useCallback(
		(...args: Parameters<T>) => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			timeoutRef.current = setTimeout(() => {
				callbackRef.current(...args)
			}, delay)
		},
		[delay],
	)
}

/**
 * A hook that provides immediate local state with debounced updates to parent.
 * Useful for input fields that need responsive typing with debounced save.
 *
 * @param value - The controlled value from parent
 * @param onChange - The callback to update parent (will be debounced)
 * @param delay - The debounce delay in milliseconds
 * @returns [localValue, setLocalValue] - Local state that updates immediately
 */
export function useDebouncedValue<T>(
	value: T,
	onChange: (value: T) => void,
	delay: number = 300,
): [T, (value: T) => void] {
	const [localValue, setLocalValueInternal] = useState<T>(value)
	const debouncedOnChange = useDebouncedCallback(onChange, delay)

	// Sync local value when external value changes
	useEffect(() => {
		setLocalValueInternal(value)
	}, [value])

	const setLocalValue = useCallback(
		(newValue: T) => {
			setLocalValueInternal(newValue)
			debouncedOnChange(newValue)
		},
		[debouncedOnChange],
	)

	return [localValue, setLocalValue]
}
