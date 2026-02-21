import { loadIntents, preWriteHook, Intent } from "../preHook"
import * as fs from "fs"
import * as path from "path"
import * as yaml from "js-yaml"

// Mock the file system
jest.mock("fs")
jest.mock("path")

const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>
const mockResolve = path.resolve as jest.MockedFunction<typeof path.resolve>

describe("preHook", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("loadIntents", () => {
		const mockIntents: Intent[] = [
			{
				id: "intent-1",
				name: "Test Intent 1",
				status: "active",
				owned_scope: ["src/**/*.ts", "src/auth/**"],
				constraints: [],
				acceptance_criteria: [],
			},
			{
				id: "intent-2",
				name: "Test Intent 2",
				status: "active",
				owned_scope: ["src/components/**"],
				constraints: [],
				acceptance_criteria: [],
			},
		]

		it("should load intents from YAML file successfully", () => {
			const yamlContent = { active_intents: mockIntents }
			mockReadFileSync.mockReturnValue(yaml.dump(yamlContent))
			mockResolve.mockReturnValue("/path/to/.orchestration/active_intents.yaml")

			const result = loadIntents()

			expect(result).toEqual(mockIntents)
			expect(mockReadFileSync).toHaveBeenCalledWith(expect.any(String), "utf-8")
		})

		it("should throw error if file cannot be read", () => {
			mockReadFileSync.mockImplementation(() => {
				throw new Error("File not found")
			})
			mockResolve.mockReturnValue("/path/to/.orchestration/active_intents.yaml")

			expect(() => loadIntents()).toThrow("Failed to load intents: File not found")
		})

		it("should throw error if YAML structure is invalid", () => {
			mockReadFileSync.mockReturnValue("invalid yaml content")
			mockResolve.mockReturnValue("/path/to/.orchestration/active_intents.yaml")

			expect(() => loadIntents()).toThrow("Invalid YAML structure: missing active_intents array")
		})

		it("should throw error if active_intents array is missing", () => {
			const yamlContent = { other_field: "value" }
			mockReadFileSync.mockReturnValue(yaml.dump(yamlContent))
			mockResolve.mockReturnValue("/path/to/.orchestration/active_intents.yaml")

			expect(() => loadIntents()).toThrow("Invalid YAML structure: missing active_intents array")
		})
	})

	describe("preWriteHook", () => {
		const mockIntents: Intent[] = [
			{
				id: "intent-1",
				name: "Test Intent 1",
				status: "active",
				owned_scope: ["src/**/*.ts", "src/auth/**"],
				constraints: [],
				acceptance_criteria: [],
			},
			{
				id: "intent-2",
				name: "Test Intent 2",
				status: "active",
				owned_scope: ["src/components/**", "lib/**/*.js"],
				constraints: [],
				acceptance_criteria: [],
			},
		]

		beforeEach(() => {
			const yamlContent = { active_intents: mockIntents }
			mockReadFileSync.mockReturnValue(yaml.dump(yamlContent))
			mockResolve.mockReturnValue("/path/to/.orchestration/active_intents.yaml")
		})

		it("should return intent when file path matches scope pattern", () => {
			const result = preWriteHook("src/auth/login.ts", "intent-1")

			expect(result).toEqual(mockIntents[0])
		})

		it("should return intent when file path matches multiple patterns", () => {
			const result = preWriteHook("src/components/Button.tsx", "intent-2")

			expect(result).toEqual(mockIntents[1])
		})

		it("should throw error for invalid intent ID", () => {
			expect(() => preWriteHook("src/test.ts", "invalid-intent")).toThrow("Invalid Intent ID: invalid-intent")
		})

		it("should throw error when file path does not match any scope pattern", () => {
			expect(() => preWriteHook("src/other/file.ts", "intent-1")).toThrow(
				"Scope Violation: Intent 'intent-1' is not authorized to edit 'src/other/file.ts'",
			)
		})

		it("should handle glob patterns with single asterisk correctly", () => {
			const result = preWriteHook("src/components/Button.tsx", "intent-2")
			expect(result).toEqual(mockIntents[1])
		})

		it("should handle glob patterns with double asterisk correctly", () => {
			const result = preWriteHook("src/auth/login/service.ts", "intent-1")
			expect(result).toEqual(mockIntents[0])
		})

		it("should not match partial paths", () => {
			expect(() => preWriteHook("test.ts", "intent-1")).toThrow(
				"Scope Violation: Intent 'intent-1' is not authorized to edit 'test.ts'",
			)
		})

		it("should handle root-level patterns", () => {
			const result = preWriteHook("lib/utils.js", "intent-2")
			expect(result).toEqual(mockIntents[1])
		})
	})
})
