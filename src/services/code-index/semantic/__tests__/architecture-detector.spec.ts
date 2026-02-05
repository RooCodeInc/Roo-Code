/**
 * ArchitectureDetector Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest"
import { ArchitectureDetector } from "../architecture-detector"
import { DetectedArchitecture, DetectedFramework } from "../interfaces"
import * as fs from "fs/promises"

// Mock fs/promises
vi.mock("fs/promises", () => ({
	readdir: vi.fn(),
	readFile: vi.fn(),
}))

const mockReaddir = fs.readdir as unknown as MockedFunction<typeof fs.readdir>
const mockReadFile = fs.readFile as unknown as MockedFunction<typeof fs.readFile>

describe("ArchitectureDetector", () => {
	let detector: ArchitectureDetector

	beforeEach(() => {
		detector = new ArchitectureDetector()
		vi.clearAllMocks()
	})

	describe("detectPattern", () => {
		it("should detect MVC pattern", async () => {
			mockReaddir.mockImplementation(async (dirPath: any) => {
				if (dirPath === "/test/project") {
					return [
						{ name: "models", isDirectory: () => true },
						{ name: "views", isDirectory: () => true },
						{ name: "controllers", isDirectory: () => true },
						{ name: "package.json", isDirectory: () => false },
					] as any
				}
				return []
			})

			mockReadFile.mockResolvedValue(JSON.stringify({ dependencies: {} }))

			const result = await detector.detectPattern("/test/project")

			expect(result).toBeDefined()
			expect(result.allPatterns).toBeDefined()

			const mvcPattern = result.allPatterns.find((p) => p.pattern === "mvc")
			expect(mvcPattern).toBeDefined()
			expect(mvcPattern!.score).toBeGreaterThan(0)
		})

		it("should detect Clean Architecture pattern", async () => {
			mockReaddir.mockImplementation(async (dirPath: any) => {
				if (dirPath === "/test/project") {
					return [
						{ name: "domain", isDirectory: () => true },
						{ name: "usecases", isDirectory: () => true },
						{ name: "infrastructure", isDirectory: () => true },
						{ name: "adapters", isDirectory: () => true },
					] as any
				}
				return []
			})

			mockReadFile.mockRejectedValue(new Error("No file"))

			const result = await detector.detectPattern("/test/project")

			expect(result).toBeDefined()
			const cleanPattern = result.allPatterns.find((p) => p.pattern === "clean-architecture")
			expect(cleanPattern).toBeDefined()
			expect(cleanPattern!.score).toBeGreaterThan(0)
		})

		it("should return unknown for empty project", async () => {
			mockReaddir.mockResolvedValue([])
			mockReadFile.mockRejectedValue(new Error("No file"))

			const result = await detector.detectPattern("/empty/project")

			expect(result.primaryPattern).toBe("unknown")
			expect(result.confidence).toBe(0)
		})
	})

	describe("identifyLayers", () => {
		it("should identify presentation layer", async () => {
			mockReaddir.mockImplementation(async (dirPath: any) => {
				if (dirPath === "/test/project") {
					return [
						{ name: "components", isDirectory: () => true },
						{ name: "pages", isDirectory: () => true },
					] as any
				}
				return []
			})

			const layers = await detector.identifyLayers("/test/project")

			expect(layers).toBeDefined()
			const presentationLayer = layers.find((l) => l.type === "presentation")
			expect(presentationLayer).toBeDefined()
		})

		it("should identify domain layer", async () => {
			mockReaddir.mockImplementation(async (dirPath: any) => {
				if (dirPath === "/test/project") {
					return [
						{ name: "domain", isDirectory: () => true },
						{ name: "entities", isDirectory: () => true },
					] as any
				}
				return []
			})

			const layers = await detector.identifyLayers("/test/project")

			const domainLayer = layers.find((l) => l.type === "domain")
			expect(domainLayer).toBeDefined()
		})
	})

	describe("detectCustomFrameworks", () => {
		it("should detect Odoo framework", async () => {
			mockReaddir.mockImplementation(async (dirPath: any) => {
				if (dirPath === "/test/odoo") {
					return [
						{ name: "sale_custom", isDirectory: () => true },
						{ name: "__manifest__.py", isDirectory: () => false },
					] as any
				}
				if (dirPath.includes("sale_custom")) {
					return [
						{ name: "__manifest__.py", isDirectory: () => false },
						{ name: "models", isDirectory: () => true },
						{ name: "views", isDirectory: () => true },
					] as any
				}
				return []
			})

			mockReadFile.mockRejectedValue(new Error("No file"))

			const frameworks = await detector.detectCustomFrameworks("/test/odoo")

			expect(frameworks).toBeDefined()
			const odoo = frameworks.find((f) => f.name === "Odoo")
			expect(odoo).toBeDefined()
			expect(odoo!.confidence).toBeGreaterThan(0)
		})

		it("should detect Express framework", async () => {
			mockReaddir.mockImplementation(async (dirPath: any) => {
				if (dirPath === "/test/express") {
					return [
						{ name: "routes", isDirectory: () => true },
						{ name: "middleware", isDirectory: () => true },
						{ name: "app.js", isDirectory: () => false },
						{ name: "package.json", isDirectory: () => false },
					] as any
				}
				return []
			})

			mockReadFile.mockResolvedValue(
				JSON.stringify({
					dependencies: {
						express: "^4.18.0",
					},
				}),
			)

			const frameworks = await detector.detectCustomFrameworks("/test/express")

			expect(frameworks).toBeDefined()
			const express = frameworks.find((f) => f.name === "Express")
			expect(express).toBeDefined()
			expect(express!.confidence).toBeGreaterThan(0)
		})

		it("should detect Django framework", async () => {
			mockReaddir.mockImplementation(async (dirPath: any) => {
				if (dirPath === "/test/django") {
					return [
						{ name: "manage.py", isDirectory: () => false },
						{ name: "settings.py", isDirectory: () => false },
						{ name: "urls.py", isDirectory: () => false },
					] as any
				}
				return []
			})

			mockReadFile.mockRejectedValue(new Error("No file"))

			const frameworks = await detector.detectCustomFrameworks("/test/django")

			const django = frameworks.find((f) => f.name === "Django")
			expect(django).toBeDefined()
			expect(django!.confidence).toBeGreaterThan(0)
		})

		it("should return empty for unknown frameworks", async () => {
			mockReaddir.mockResolvedValue([])
			mockReadFile.mockRejectedValue(new Error("No file"))

			const frameworks = await detector.detectCustomFrameworks("/test/unknown")

			expect(frameworks).toEqual([])
		})
	})
})
