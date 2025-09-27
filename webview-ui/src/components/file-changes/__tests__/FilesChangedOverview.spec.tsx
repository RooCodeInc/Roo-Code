import React from "react"
import { act, fireEvent, render, screen } from "@/utils/test-utils"

import { EXPERIMENT_IDS } from "../../../../../src/shared/experiments"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const postMessageMock = vi.fn()

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: postMessageMock,
	},
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		experiments: {
			[EXPERIMENT_IDS.FILES_CHANGED_OVERVIEW]: true,
		},
	}),
}))

vi.mock("@/hooks/useDebouncedAction", () => ({
	useDebouncedAction: () => ({
		isProcessing: false,
		handleWithDebounce: (fn: () => void) => fn(),
	}),
}))

describe("FilesChangedOverview", () => {
	beforeEach(() => {
		postMessageMock.mockClear()
	})

	it("virtualizes large file lists", async () => {
		const { default: FilesChangedOverview } = await import("../FilesChangedOverview")

		render(<FilesChangedOverview />)

		const files = Array.from({ length: 40 }, (_, index) => ({
			uri: `path/file-${index}.ts`,
			type: "edit" as const,
			fromCheckpoint: "base",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 1,
			linesRemoved: 0,
		}))

		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "filesChanged",
						filesChanged: {
							baseCheckpoint: "base",
							files,
						},
					},
				}),
			)
		})

		const toggle = await screen.findByRole("button", { name: "file-changes:accessibility.files_list" })
		fireEvent.click(toggle)

		const renderedItems = screen.getAllByTestId(/file-item-/)

		expect(renderedItems.length).toBeLessThanOrEqual(10)
	})
})
