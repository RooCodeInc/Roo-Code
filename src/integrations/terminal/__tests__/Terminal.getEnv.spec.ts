// npx vitest run integrations/terminal/__tests__/Terminal.getEnv.spec.ts

import { Terminal } from "../Terminal"

describe("Terminal.getEnv", () => {
	let originalPlatform: PropertyDescriptor | undefined

	beforeAll(() => {
		originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")
	})

	afterAll(() => {
		if (originalPlatform) {
			Object.defineProperty(process, "platform", originalPlatform)
		}
	})

	describe("common environment variables", () => {
		it("should set VTE_VERSION to 0", () => {
			const env = Terminal.getEnv()
			expect(env.VTE_VERSION).toBe("0")
		})

		it("should set PAGER to empty string on Windows", () => {
			Object.defineProperty(process, "platform", { value: "win32" })
			const env = Terminal.getEnv()
			expect(env.PAGER).toBe("")
		})

		it("should set PAGER to cat on non-Windows", () => {
			Object.defineProperty(process, "platform", { value: "linux" })
			const env = Terminal.getEnv()
			expect(env.PAGER).toBe("cat")
		})
	})

	describe("Windows UTF-8 encoding fix", () => {
		beforeEach(() => {
			Object.defineProperty(process, "platform", { value: "win32" })
		})

		it("should set PYTHONIOENCODING to utf-8 on Windows", () => {
			const env = Terminal.getEnv()
			expect(env.PYTHONIOENCODING).toBe("utf-8")
		})

		it("should set PYTHONUTF8 to 1 on Windows", () => {
			const env = Terminal.getEnv()
			expect(env.PYTHONUTF8).toBe("1")
		})

		it("should set RUBYOPT to -EUTF-8 on Windows", () => {
			const env = Terminal.getEnv()
			expect(env.RUBYOPT).toBe("-EUTF-8")
		})

		it("should not set Python/Ruby UTF-8 vars on non-Windows", () => {
			Object.defineProperty(process, "platform", { value: "linux" })
			const env = Terminal.getEnv()
			expect(env.PYTHONIOENCODING).toBeUndefined()
			expect(env.PYTHONUTF8).toBeUndefined()
			expect(env.RUBYOPT).toBeUndefined()
		})
	})
})
