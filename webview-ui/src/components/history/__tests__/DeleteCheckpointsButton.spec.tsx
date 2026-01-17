import { render, screen, fireEvent } from "@/utils/test-utils"

import { DeleteCheckpointsButton } from "../DeleteCheckpointsButton"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("DeleteCheckpointsButton", () => {
	it("calls onDeleteCheckpoints when clicked", () => {
		const onDeleteCheckpoints = vi.fn()
		render(<DeleteCheckpointsButton itemId="test-id" onDeleteCheckpoints={onDeleteCheckpoints} />)

		const deleteCheckpointsButton = screen.getByRole("button")
		fireEvent.click(deleteCheckpointsButton)

		expect(onDeleteCheckpoints).toHaveBeenCalledWith("test-id")
	})
})
