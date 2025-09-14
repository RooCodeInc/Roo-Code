import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface DraftPersistenceContextType {
	savedDraft: string | null
	saveCurrentDraft: (draft: string) => void
	restoreDraft: () => string | null
	clearDraft: () => void
}

const DraftPersistenceContext = createContext<DraftPersistenceContextType | undefined>(undefined)

export const DraftPersistenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [savedDraft, setSavedDraft] = useState<string | null>(null)

	const saveCurrentDraft = useCallback((draft: string) => {
		setSavedDraft(draft)
	}, [])

	const restoreDraft = useCallback(() => {
		const draft = savedDraft
		setSavedDraft(null) // Clear after restoring
		return draft
	}, [savedDraft])

	const clearDraft = useCallback(() => {
		setSavedDraft(null)
	}, [])

	return (
		<DraftPersistenceContext.Provider value={{ savedDraft, saveCurrentDraft, restoreDraft, clearDraft }}>
			{children}
		</DraftPersistenceContext.Provider>
	)
}

export const useDraftPersistence = () => {
	const context = useContext(DraftPersistenceContext)
	if (!context) {
		// Return a no-op implementation if context is not available
		return {
			savedDraft: null,
			saveCurrentDraft: () => {},
			restoreDraft: () => null,
			clearDraft: () => {},
		}
	}
	return context
}
