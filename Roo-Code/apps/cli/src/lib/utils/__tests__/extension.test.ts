import fs from "fs"
import path from "path"

import { getDefaultExtensionPath } from "../extension.js"

vi.mock("fs")

describe("getDefaultExtensionPath", () => {
	const originalEnv = process.env

	beforeEach(() => {
		vi.resetAllMocks()
		// Reset process.env to avoid ROO_EXTENSION_PATH from installed CLI affecting tests.
		process.env = { ...originalEnv }
		delete process.env.ROO_EXTENSION_PATH
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it("should return monorepo path when extension.js exists there", () => {
		const mockDirname = "/test/apps/cli/dist"
		const expectedMonorepoPath = path.resolve("/test/apps/cli", "../../src/dist")

		// Walk-up: dist/ has no package.json, apps/cli/ does
		vi.mocked(fs.existsSync).mockImplementation((p) => {
			const s = String(p)

			if (s === path.join(mockDirname, "package.json")) {
				return false
			}

			if (s === path.join("/test/apps/cli", "package.json")) {
				return true
			}

			if (s === path.join(expectedMonorepoPath, "extension.js")) {
				return true
			}

			return false
		})

		const result = getDefaultExtensionPath(mockDirname)

		expect(result).toBe(expectedMonorepoPath)
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(expectedMonorepoPath, "extension.js"))
	})

	it("should return package path when extension.js does not exist in monorepo path", () => {
		const mockDirname = "/test/apps/cli/dist"
		const expectedPackagePath = path.resolve("/test/apps/cli", "extension")

		// Walk-up finds package.json at apps/cli/, but no extension.js in monorepo path
		vi.mocked(fs.existsSync).mockImplementation((p) => {
			const s = String(p)

			if (s === path.join("/test/apps/cli", "package.json")) {
				return true
			}

			return false
		})

		const result = getDefaultExtensionPath(mockDirname)

		expect(result).toBe(expectedPackagePath)
	})

	it("should check monorepo path first", () => {
		const mockDirname = "/test/apps/cli/dist"

		vi.mocked(fs.existsSync).mockImplementation((p) => {
			const s = String(p)

			if (s === path.join("/test/apps/cli", "package.json")) {
				return true
			}

			return false
		})

		getDefaultExtensionPath(mockDirname)

		const expectedMonorepoPath = path.resolve("/test/apps/cli", "../../src/dist")
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(expectedMonorepoPath, "extension.js"))
	})

	it("should work when called from source directory (tsx dev)", () => {
		const mockDirname = "/test/apps/cli/src/commands/cli"
		const expectedMonorepoPath = path.resolve("/test/apps/cli", "../../src/dist")

		// Walk-up: no package.json in src subdirs, found at apps/cli/
		vi.mocked(fs.existsSync).mockImplementation((p) => {
			const s = String(p)

			if (s === path.join("/test/apps/cli", "package.json")) {
				return true
			}

			if (s === path.join(expectedMonorepoPath, "extension.js")) {
				return true
			}

			return false
		})

		const result = getDefaultExtensionPath(mockDirname)

		expect(result).toBe(expectedMonorepoPath)
	})
})
