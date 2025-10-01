import { useState, useEffect, useCallback, useRef } from "react"

/**
 * Configuration options for the useAutosaveDraft hook
 */
export interface UseAutosaveDraftOptions {
	/** Unique key to identify the draft (e.g., conversation/task ID) */
	key: string
	/** Debounce delay in milliseconds before saving to localStorage (default: 100ms for fast responsiveness) */
	debounceMs?: number
	/** Prefix for localStorage keys to avoid collisions */
	storagePrefix?: string
}

/**
 * Return value from the useAutosaveDraft hook
 */
export interface UseAutosaveDraftReturn {
	/** Current draft content */
	draftContent: string
	/** Function to update the draft content */
	updateDraft: (content: string) => void
	/** Function to manually clear the draft */
	clearDraft: () => void
	/** Whether an initial draft was restored on mount */
	hasInitialDraft: boolean
	/** Whether a debounced save operation is in progress */
	isDebouncing: boolean
}

/**
 * Custom React hook for auto-saving message drafts to localStorage
 *
 * This hook provides automatic persistence of draft content using localStorage
 * with debouncing to prevent excessive writes. It handles conversation isolation
 * through unique keys and provides graceful error handling for storage limitations.
 *
 * @param options Configuration options for the hook
 * @returns Hook interface with draft content and management functions
 *
 * @example
 * ```tsx
 * const {
 *   draftContent,
 *   updateDraft,
 *   clearDraft,
 *   hasInitialDraft
 * } = useAutosaveDraft({
 *   key: currentTask?.id || 'default',
 *   debounceMs: 100,
 *   clearOnSubmit: true
 * })
 *
 * // Use in your component
 * <ChatTextArea
 *   inputValue={draftContent}
 *   setInputValue={updateDraft}
 *   onSend={handleSend}
 * />
 * ```
 */
export const useAutosaveDraft = (options: UseAutosaveDraftOptions): UseAutosaveDraftReturn => {
	const { key, debounceMs = 100, storagePrefix = "roo-draft" } = options

	// Local state for the hook
	const [draftContent, setDraftContent] = useState<string>("")
	const [hasInitialDraft, setHasInitialDraft] = useState<boolean>(false)
	const [isDebouncing, setIsDebouncing] = useState<boolean>(false)

	// Refs for debouncing and cleanup
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const storageKey = `${storagePrefix}.${key}`

	/**
	 * Safely access localStorage with error handling
	 * @param operation The localStorage operation to perform
	 * @param fallback Fallback value if operation fails
	 * @returns The result of the operation or fallback value
	 */
	const safeLocalStorage = useCallback(<T>(operation: () => T, fallback: T): T => {
		try {
			return operation()
		} catch (error) {
			console.warn("[useAutosaveDraft] localStorage operation failed:", error)
			return fallback
		}
	}, [])

	/**
	 * Initialize draft content from localStorage on mount
	 */
	useEffect(() => {
		const savedDraft = safeLocalStorage(() => localStorage.getItem(storageKey), null)

		if (savedDraft && savedDraft.trim()) {
			setDraftContent(savedDraft)
			setHasInitialDraft(true)
		}
	}, [storageKey, safeLocalStorage])

	/**
	 * Save draft content to localStorage with debouncing
	 * @param content The content to save
	 */
	const saveDraft = useCallback(
		(content: string) => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}

			setIsDebouncing(true)
			debounceTimerRef.current = setTimeout(() => {
				safeLocalStorage(() => {
					if (content.trim()) {
						localStorage.setItem(storageKey, content)
					} else {
						localStorage.removeItem(storageKey)
					}
				}, undefined)
				setIsDebouncing(false)
			}, debounceMs)
		},
		[storageKey, debounceMs, safeLocalStorage],
	)

	/**
	 * Update draft content and trigger auto-save
	 * @param content The new content to save
	 */
	const updateDraft = useCallback(
		(content: string) => {
			setDraftContent(content)
			saveDraft(content)
		},
		[saveDraft],
	)

	/**
	 * Clear the draft from both state and localStorage
	 */
	const clearDraft = useCallback(() => {
		safeLocalStorage(() => localStorage.removeItem(storageKey), undefined)

		setDraftContent("")
		setHasInitialDraft(false)

		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
			setIsDebouncing(false)
		}
	}, [storageKey, safeLocalStorage])

	/**
	 * Cleanup timers on unmount
	 */
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [])

	return {
		draftContent,
		updateDraft,
		clearDraft,
		hasInitialDraft,
		isDebouncing,
	}
}
