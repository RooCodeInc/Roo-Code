import React from "react"
import { render, fireEvent, screen } from "@src/utils/test-utils"

// Mock vscode.postMessage
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))
import { vscode } from "@src/utils/vscode"

import Thumbnails from "../Thumbnails"

describe("Thumbnails", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("filters out base64 data URIs and renders only safe image URIs", () => {
		const images = [
			"data:image/png;base64,AAAA", // should be filtered
			"file:///tmp/saved-image-1.png",
			"https://example.com/image-2.webp",
		]

		render(<Thumbnails images={images} />)

		const imgs = screen.getAllByRole("img") as HTMLImageElement[]
		expect(imgs.length).toBe(2)
		// Ensure no rendered src starts with data:
		for (const img of imgs) {
			const src = img.getAttribute("src") || ""
			expect(src.startsWith("data:")).toBe(false)
		}
	})

	it("posts openImage with clicked image URI (never base64)", () => {
		const images = ["data:image/png;base64,BBBB", "file:///tmp/saved-image.png"]
		render(<Thumbnails images={images} />)

		const imgs = screen.getAllByRole("img") as HTMLImageElement[]
		// Only the safe one should render
		expect(imgs.length).toBe(1)

		const safeImg = imgs[0]
		const src = safeImg.getAttribute("src") || ""
		expect(src.startsWith("data:")).toBe(false)

		fireEvent.click(safeImg)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openImage",
			text: src,
		})
	})
})
