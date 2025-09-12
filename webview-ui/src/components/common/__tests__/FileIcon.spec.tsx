import { render } from "@testing-library/react"
import React from "react"
import FileIcon from "../FileIcon"

vi.mock("vscode-material-icons", () => ({
	getIconForFilePath: (path: string) => (path.endsWith(".ts") ? "typescript" : "file"),
	getIconUrlByName: (name: string, base: string) => `${base || ""}/${name}.svg`,
}))

describe("FileIcon", () => {
	it("renders an img with computed src and size", () => {
		const { container } = render(<FileIcon filePath="src/index.ts" size={16} />)
		const img = container.querySelector("img") as HTMLImageElement
		expect(img).toBeTruthy()
		expect(img.getAttribute("width")).toBe("16")
		expect(img.getAttribute("height")).toBe("16")
	})
})
