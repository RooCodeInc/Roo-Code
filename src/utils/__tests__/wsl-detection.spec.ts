import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs"
import * as os from "os"

// Mock the modules before importing the functions
vi.mock("fs")
vi.mock("os")

import { isWSL, getWSLVersion } from "../wsl-detection"

describe("WSL Detection", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Clear environment variables
		delete process.env.WSL_DISTRO_NAME
		delete process.env.WSL_INTEROP
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("isWSL", () => {
		it("should return false on non-Linux platforms", () => {
			vi.mocked(os.platform).mockReturnValue("win32")
			expect(isWSL()).toBe(false)

			vi.mocked(os.platform).mockReturnValue("darwin")
			expect(isWSL()).toBe(false)
		})

		it("should return true when WSL_DISTRO_NAME environment variable is set", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			process.env.WSL_DISTRO_NAME = "Ubuntu"
			expect(isWSL()).toBe(true)
		})

		it("should return true when WSL_INTEROP environment variable is set", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			process.env.WSL_INTEROP = "/run/WSL/8_interop"
			expect(isWSL()).toBe(true)
		})

		it("should return true when /proc/version contains Microsoft", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			vi.mocked(fs.readFileSync).mockReturnValue(
				"Linux version 4.4.0-19041-Microsoft (Microsoft@Microsoft.com) (gcc version 5.4.0)" as any,
			)
			expect(isWSL()).toBe(true)
		})

		it("should return true when /proc/version contains WSL", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			vi.mocked(fs.readFileSync).mockReturnValue("Linux version 5.10.16.3-WSL2" as any)
			expect(isWSL()).toBe(true)
		})

		it("should return true when /proc/sys/kernel/osrelease contains Microsoft", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
				if (path === "/proc/version") {
					throw new Error("File not found")
				}
				if (path === "/proc/sys/kernel/osrelease") {
					return "4.4.0-19041-Microsoft" as any
				}
				throw new Error("Unexpected path")
			})
			expect(isWSL()).toBe(true)
		})

		it("should return false on regular Linux", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			vi.mocked(fs.readFileSync).mockReturnValue("Linux version 5.10.0-generic" as any)
			expect(isWSL()).toBe(false)
		})

		it("should return false when file reads fail", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("File not found")
			})
			expect(isWSL()).toBe(false)
		})
	})

	describe("getWSLVersion", () => {
		it("should return null on non-WSL systems", () => {
			vi.mocked(os.platform).mockReturnValue("win32")
			expect(getWSLVersion()).toBeNull()
		})

		it("should return 2 when /proc/version contains WSL2", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			process.env.WSL_DISTRO_NAME = "Ubuntu"
			vi.mocked(fs.readFileSync).mockReturnValue("Linux version 5.10.16.3-WSL2" as any)
			expect(getWSLVersion()).toBe(2)
		})

		it("should return 2 when kernel version is 4.x or higher", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			process.env.WSL_DISTRO_NAME = "Ubuntu"
			vi.mocked(fs.readFileSync).mockReturnValue("Linux version 5.10.0-generic" as any)
			expect(getWSLVersion()).toBe(2)
		})

		it("should return 1 when kernel version is below 4.x", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			process.env.WSL_DISTRO_NAME = "Ubuntu"
			vi.mocked(fs.readFileSync).mockReturnValue("Linux version 3.10.0-generic" as any)
			expect(getWSLVersion()).toBe(1)
		})

		it("should return 2 as default when version cannot be determined", () => {
			vi.mocked(os.platform).mockReturnValue("linux")
			process.env.WSL_DISTRO_NAME = "Ubuntu"
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("File not found")
			})
			expect(getWSLVersion()).toBe(2)
		})
	})
})
