import { describe, it, expect, beforeEach } from "vitest"
import { virtualWorkspace } from "../VirtualWorkspace"
import * as fs from "fs"
import * as path from "path"

describe("VirtualWorkspace", () => {
	beforeEach(() => {
		virtualWorkspace.rollback()
	})

	it("writes to memory and reads from memory without touching physical disk", async () => {
		const testPath = path.join(process.cwd(), "test-virtual-file.js")
		const mockContent = "console.log('virtual')"

		await virtualWorkspace.writeFile(testPath, mockContent)

		const readOut = await virtualWorkspace.readFile(testPath)
		expect(readOut).toBe(mockContent)

		const fileExistsPhysically = fs.existsSync(testPath)
		expect(fileExistsPhysically).toBe(false)
	})
})
