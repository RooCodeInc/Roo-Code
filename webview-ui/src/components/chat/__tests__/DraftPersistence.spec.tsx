import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { DraftPersistenceProvider, useDraftPersistence } from "../hooks/useDraftPersistence"

// Test component to interact with the draft persistence context
const TestComponent = () => {
	const { savedDraft, saveCurrentDraft, restoreDraft, clearDraft } = useDraftPersistence()
	const [localDraft, setLocalDraft] = React.useState("")

	return (
		<div>
			<input type="text" value={localDraft} onChange={(e) => setLocalDraft(e.target.value)} data-testid="input" />
			<button onClick={() => saveCurrentDraft(localDraft)} data-testid="save">
				Save Draft
			</button>
			<button
				onClick={() => {
					const draft = restoreDraft()
					if (draft) setLocalDraft(draft)
				}}
				data-testid="restore">
				Restore Draft
			</button>
			<button onClick={() => clearDraft()} data-testid="clear">
				Clear Draft
			</button>
			<div data-testid="saved-draft">{savedDraft || "No draft"}</div>
		</div>
	)
}

describe("DraftPersistence", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should save and restore a draft", async () => {
		render(
			<DraftPersistenceProvider>
				<TestComponent />
			</DraftPersistenceProvider>,
		)

		const input = screen.getByTestId("input")
		const saveButton = screen.getByTestId("save")
		const restoreButton = screen.getByTestId("restore")
		const savedDraftDisplay = screen.getByTestId("saved-draft")

		// Initially no draft
		expect(savedDraftDisplay.textContent).toBe("No draft")

		// Type some text
		fireEvent.change(input, { target: { value: "My draft text" } })
		expect(input).toHaveValue("My draft text")

		// Save the draft
		fireEvent.click(saveButton)
		await waitFor(() => {
			expect(savedDraftDisplay.textContent).toBe("My draft text")
		})

		// Clear the input
		fireEvent.change(input, { target: { value: "" } })
		expect(input).toHaveValue("")

		// Restore the draft
		fireEvent.click(restoreButton)
		expect(input).toHaveValue("My draft text")

		// After restoring, the saved draft should be cleared
		await waitFor(() => {
			expect(savedDraftDisplay.textContent).toBe("No draft")
		})
	})

	it("should clear a draft", async () => {
		render(
			<DraftPersistenceProvider>
				<TestComponent />
			</DraftPersistenceProvider>,
		)

		const input = screen.getByTestId("input")
		const saveButton = screen.getByTestId("save")
		const clearButton = screen.getByTestId("clear")
		const savedDraftDisplay = screen.getByTestId("saved-draft")

		// Save a draft
		fireEvent.change(input, { target: { value: "Draft to clear" } })
		fireEvent.click(saveButton)
		await waitFor(() => {
			expect(savedDraftDisplay.textContent).toBe("Draft to clear")
		})

		// Clear the draft
		fireEvent.click(clearButton)
		await waitFor(() => {
			expect(savedDraftDisplay.textContent).toBe("No draft")
		})
	})

	it("should handle multiple save operations", async () => {
		render(
			<DraftPersistenceProvider>
				<TestComponent />
			</DraftPersistenceProvider>,
		)

		const input = screen.getByTestId("input")
		const saveButton = screen.getByTestId("save")
		const savedDraftDisplay = screen.getByTestId("saved-draft")

		// Save first draft
		fireEvent.change(input, { target: { value: "First draft" } })
		fireEvent.click(saveButton)
		await waitFor(() => {
			expect(savedDraftDisplay.textContent).toBe("First draft")
		})

		// Save second draft (overwrites first)
		fireEvent.change(input, { target: { value: "Second draft" } })
		fireEvent.click(saveButton)
		await waitFor(() => {
			expect(savedDraftDisplay.textContent).toBe("Second draft")
		})
	})

	it("should return null when restoring with no saved draft", () => {
		render(
			<DraftPersistenceProvider>
				<TestComponent />
			</DraftPersistenceProvider>,
		)

		const input = screen.getByTestId("input")
		const restoreButton = screen.getByTestId("restore")

		// Try to restore when no draft is saved
		fireEvent.click(restoreButton)

		// Input should remain empty
		expect(input).toHaveValue("")
	})

	it("should provide no-op implementation when context is not available", () => {
		// Component using the hook outside of provider
		const ComponentWithoutProvider = () => {
			const { savedDraft, saveCurrentDraft, restoreDraft, clearDraft } = useDraftPersistence()

			return (
				<div>
					<div data-testid="saved">{savedDraft || "null"}</div>
					<button onClick={() => saveCurrentDraft("test")} data-testid="save">
						Save
					</button>
					<button onClick={() => restoreDraft()} data-testid="restore">
						Restore
					</button>
					<button onClick={() => clearDraft()} data-testid="clear">
						Clear
					</button>
				</div>
			)
		}

		render(<ComponentWithoutProvider />)

		const saved = screen.getByTestId("saved")
		expect(saved.textContent).toBe("null")

		// These should not throw errors even without provider
		fireEvent.click(screen.getByTestId("save"))
		fireEvent.click(screen.getByTestId("restore"))
		fireEvent.click(screen.getByTestId("clear"))

		// State should remain unchanged
		expect(saved.textContent).toBe("null")
	})
})
