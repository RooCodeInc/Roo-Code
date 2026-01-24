import { render, screen, fireEvent, act } from "@/utils/test-utils"

import { DeleteCheckpointsDialog } from "../DeleteCheckpointsDialog"
import { vscode } from "@/utils/vscode"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("DeleteCheckpointsDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders dialog with correct content", async () => {
		await act(async () => {
			render(<DeleteCheckpointsDialog taskId="test-id" open={true} onOpenChange={() => {}} />)
		})

		expect(screen.getByText("history:deleteCheckpoints")).toBeInTheDocument()
		expect(screen.getByText("history:deleteCheckpointsMessage")).toBeInTheDocument()
	})

	it("calls vscode.postMessage when delete is confirmed", async () => {
		const onOpenChange = vi.fn()
		await act(async () => {
			render(<DeleteCheckpointsDialog taskId="test-id" open={true} onOpenChange={onOpenChange} />)
		})

		await act(async () => {
			fireEvent.click(screen.getByText("history:delete"))
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "deleteTaskCheckpointsWithId",
			text: "test-id",
		})
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it("calls onOpenChange when cancel is clicked", async () => {
		const onOpenChange = vi.fn()
		await act(async () => {
			render(<DeleteCheckpointsDialog taskId="test-id" open={true} onOpenChange={onOpenChange} />)
		})

		await act(async () => {
			fireEvent.click(screen.getByText("history:cancel"))
		})

		expect(vscode.postMessage).not.toHaveBeenCalled()
	})

	it("does not call vscode.postMessage when taskId is empty", async () => {
		const onOpenChange = vi.fn()
		await act(async () => {
			render(<DeleteCheckpointsDialog taskId="" open={true} onOpenChange={onOpenChange} />)
		})

		await act(async () => {
			fireEvent.click(screen.getByText("history:delete"))
		})

		expect(vscode.postMessage).not.toHaveBeenCalled()
	})
})
