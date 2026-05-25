import { NoOpSandbox } from "../NoOpSandbox"

describe("NoOpSandbox", () => {
	it("should always be available", async () => {
		const sandbox = new NoOpSandbox()
		expect(await sandbox.isAvailable()).toBe(true)
	})

	it("should pass commands through unchanged", () => {
		const sandbox = new NoOpSandbox()
		const command = "npm test --verbose"
		expect(sandbox.wrapCommand(command, "/some/dir")).toBe(command)
	})
})
