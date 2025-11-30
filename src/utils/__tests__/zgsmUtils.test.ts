import { describe, test, expect } from "vitest"
import { getOperatingSystem } from "../../utils/zgsmUtils"

describe("getOperatingSystem", () => {
	test("应该返回操作系统名称", () => {
		const result = getOperatingSystem()
		expect(result).toBeTruthy()
		expect(typeof result).toBe("string")
		expect(result.length).toBeGreaterThan(0)
	})

	test("应该缓存结果", () => {
		const result1 = getOperatingSystem()
		const result2 = getOperatingSystem()
		expect(result1).toBe(result2)
	})

	test("应该返回合理的操作系统名称", () => {
		const result = getOperatingSystem()

		// 结果应该是一个合理的操作系统名称
		expect(result).toBeTruthy()
		expect(typeof result).toBe("string")
		expect(result.length).toBeGreaterThan(0)

		// 应该包含平台信息
		const platform = process.platform
		const expectedPlatformNames: Record<string, string> = {
			win32: "Windows",
			darwin: "macOS",
			linux: "Linux",
			freebsd: "FreeBSD",
			openbsd: "OpenBSD",
		}

		const expectedName = expectedPlatformNames[platform] || platform
		expect(result.toLowerCase()).toContain(expectedName.toLowerCase())
	})

	test("应该处理 Windows 平台", () => {
		// 验证函数在 Windows 环境下不会抛出 PowerShell ENOENT 错误
		expect(() => {
			const result = getOperatingSystem()
			expect(result).toBeTruthy()
		}).not.toThrow()
	})
})
