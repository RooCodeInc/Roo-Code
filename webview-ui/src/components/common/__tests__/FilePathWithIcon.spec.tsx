import { render, screen } from "@testing-library/react"
import React from "react"
import FilePathWithIcon from "../FilePathWithIcon"

vi.mock("../FileIcon", () => ({ default: () => <span data-testid="file-icon" /> }))

describe("FilePathWithIcon", () => {
	it("shows basename in bold by default", () => {
		render(<FilePathWithIcon filePath="src/utils/index.ts" />)
		expect(screen.getByText("index.ts\u200E")).toBeInTheDocument()
	})

	it("shows full path when boldNameOnly is false", () => {
		render(<FilePathWithIcon filePath="src/utils/index.ts" boldNameOnly={false} />)
		expect(screen.getByText("src/utils/index.ts\u200E")).toBeInTheDocument()
	})
})
