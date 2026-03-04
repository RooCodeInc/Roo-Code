import fs from "fs/promises"

import { validateTerminalShellPath } from "../shell.js"

vi.mock("fs/promises", () => ({
	default: {
		access: vi.fn(),
		stat: vi.fn(),
	},
}))

describe("validateTerminalShellPath", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.stat).mockResolvedValue({
			isFile: () => true,
		} as unknown as Awaited<ReturnType<typeof fs.stat>>)
	})

	it("returns invalid for an empty path", async () => {
		const result = await validateTerminalShellPath("   ")
		expect(result).toEqual({ valid: false, reason: "shell path cannot be empty" })
	})

	it("returns invalid for a relative path", async () => {
		const result = await validateTerminalShellPath("bin/bash")
		expect(result).toEqual({ valid: false, reason: "shell path must be absolute" })
	})

	it("returns valid for an absolute executable path", async () => {
		const result = await validateTerminalShellPath("/bin/bash")
		expect(result).toEqual({ valid: true, shellPath: "/bin/bash" })
	})

	it("returns invalid when the shell path cannot be accessed", async () => {
		vi.mocked(fs.access).mockRejectedValueOnce(new Error("ENOENT"))
		const result = await validateTerminalShellPath("/missing/shell")

		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.reason).toContain("shell path")
		}
	})

	it("returns invalid when the shell path points to a directory", async () => {
		vi.mocked(fs.stat).mockResolvedValueOnce({
			isFile: () => false,
		} as unknown as Awaited<ReturnType<typeof fs.stat>>)
		const result = await validateTerminalShellPath("/bin")

		expect(result).toEqual({ valid: false, reason: "shell path must point to a file" })
	})
})
