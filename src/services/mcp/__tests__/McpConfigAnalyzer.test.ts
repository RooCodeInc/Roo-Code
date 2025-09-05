import { describe, it, expect, beforeEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { McpConfigAnalyzer } from "../McpConfigAnalyzer"

// Mock modules
vi.mock("fs/promises")
vi.mock("path")
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(),
}))

// Import the mocked function
import { fileExistsAtPath } from "../../../utils/fs"

describe("McpConfigAnalyzer", () => {
	let analyzer: McpConfigAnalyzer
	let mockWorkspaceFolder: vscode.WorkspaceFolder

	beforeEach(() => {
		// Create a mock workspace folder
		mockWorkspaceFolder = {
			uri: {
				fsPath: "/test/project",
				scheme: "file",
				authority: "",
				path: "/test/project",
				query: "",
				fragment: "",
				with: vi.fn(),
				toString: vi.fn(() => "file:///test/project"),
			} as any,
			name: "test-project",
			index: 0,
		}

		analyzer = new McpConfigAnalyzer(mockWorkspaceFolder)
		vi.clearAllMocks()

		// Setup path.join to return expected paths
		vi.mocked(path.join).mockImplementation((...args) => args.join("/"))
	})

	describe("analyzeProject", () => {
		it("should analyze a Node.js project with package.json", async () => {
			const mockPackageJson = {
				dependencies: {
					"@playwright/test": "^1.40.0",
					"neo4j-driver": "^5.0.0",
				},
				devDependencies: {
					puppeteer: "^21.0.0",
				},
			}

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/package.json") return true
				if (filePath === "/test/project/.git") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/package.json") {
					return JSON.stringify(mockPackageJson)
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			// Check detected dependencies
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "@playwright/test", type: "npm" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "neo4j-driver", type: "npm" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "puppeteer", type: "npm" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: ".git", type: "config" }),
			)

			// Check recommendations
			expect(result.recommendations.length).toBeGreaterThan(0)

			// Should recommend playwright with high confidence
			const playwrightRec = result.recommendations.find((r) => r.serverName === "playwright")
			expect(playwrightRec).toBeDefined()
			expect(playwrightRec?.confidence).toBe(90)

			// Should recommend neo4j-memory
			const neo4jRec = result.recommendations.find((r) => r.serverName === "neo4j-memory")
			expect(neo4jRec).toBeDefined()
			expect(neo4jRec?.confidence).toBe(90)

			// Should recommend github due to .git
			const githubRec = result.recommendations.find((r) => r.serverName === "github")
			expect(githubRec).toBeDefined()
			expect(githubRec?.confidence).toBe(95)

			// Should recommend puppeteer
			const puppeteerRec = result.recommendations.find((r) => r.serverName === "puppeteer")
			expect(puppeteerRec).toBeDefined()
			expect(puppeteerRec?.confidence).toBe(85)

			expect(result.projectType).toBe("node")
		})

		it("should analyze a Python project with requirements.txt", async () => {
			const mockRequirements = `
django==4.2.0
pandas>=1.5.0
openpyxl==3.1.0
neo4j==5.14.0
			`

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/requirements.txt") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/requirements.txt") {
					return mockRequirements
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			// Check detected dependencies
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "django", type: "python" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "pandas", type: "python" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "openpyxl", type: "python" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "neo4j", type: "python" }),
			)

			// Check recommendations
			const excelRec = result.recommendations.find((r) => r.serverName === "excel")
			expect(excelRec).toBeDefined()
			expect(excelRec?.confidence).toBeGreaterThanOrEqual(70)

			const neo4jRec = result.recommendations.find((r) => r.serverName === "neo4j-memory")
			expect(neo4jRec).toBeDefined()
			expect(neo4jRec?.confidence).toBe(90)

			expect(result.projectType).toBe("django")
		})

		it("should analyze a Docker project with docker-compose.yml", async () => {
			const mockDockerCompose = `
version: '3.8'
services:
  web:
    image: nginx:latest
  db:
    image: neo4j:5
  cache:
    image: redis:7
			`

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/docker-compose.yml") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/docker-compose.yml") {
					return mockDockerCompose
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			// Check detected dependencies
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "neo4j", type: "docker" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "redis", type: "docker" }),
			)

			// Check recommendations
			const neo4jRec = result.recommendations.find((r) => r.serverName === "neo4j-memory")
			expect(neo4jRec).toBeDefined()
			expect(neo4jRec?.confidence).toBe(90)

			expect(result.projectType).toBeUndefined()
		})

		it("should detect Git repositories", async () => {
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/.git") return true
				if (filePath === "/test/project/.github") return true
				return false
			})

			vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))

			const result = await analyzer.analyzeProject()

			// Check detected dependencies
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: ".git", type: "config" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: ".github", type: "config" }),
			)

			// Should recommend github with high confidence
			const githubRec = result.recommendations.find((r) => r.serverName === "github")
			expect(githubRec).toBeDefined()
			expect(githubRec?.confidence).toBe(95)

			expect(result.projectType).toBeUndefined()
		})

		it("should handle projects with multiple configuration files", async () => {
			const mockPackageJson = {
				dependencies: {
					xlsx: "^0.18.0",
				},
			}

			const mockDockerCompose = `
services:
  db:
    image: neo4j:5
			`

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/package.json") return true
				if (filePath === "/test/project/docker-compose.yml") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/package.json") {
					return JSON.stringify(mockPackageJson)
				}
				if (filePath === "/test/project/docker-compose.yml") {
					return mockDockerCompose
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			// Check detected dependencies from both sources
			expect(result.detectedDependencies).toContainEqual(expect.objectContaining({ name: "xlsx", type: "npm" }))
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "neo4j", type: "docker" }),
			)

			// Check recommendations
			const excelRec = result.recommendations.find((r) => r.serverName === "excel")
			expect(excelRec).toBeDefined()
			expect(excelRec?.confidence).toBe(80)

			const neo4jRec = result.recommendations.find((r) => r.serverName === "neo4j-memory")
			expect(neo4jRec).toBeDefined()
			expect(neo4jRec?.confidence).toBe(90)

			expect(result.projectType).toBe("node")
		})

		it("should detect React projects", async () => {
			const mockPackageJson = {
				dependencies: {
					react: "^18.0.0",
					"react-dom": "^18.0.0",
				},
			}

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/package.json") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/package.json") {
					return JSON.stringify(mockPackageJson)
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			expect(result.projectType).toBe("react")
		})

		it("should detect Django projects", async () => {
			const mockRequirements = `
django==4.2.0
djangorestframework==3.14.0
			`

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/requirements.txt") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/requirements.txt") {
					return mockRequirements
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			expect(result.projectType).toBe("django")
		})

		it("should handle malformed package.json gracefully", async () => {
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/package.json") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/package.json") {
					return "invalid json {"
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			// Should not crash and return empty dependencies
			expect(result.detectedDependencies).toEqual([])
			expect(result.recommendations).toEqual([])
			expect(result.projectType).toBe("node") // Still detects as node project even with malformed JSON
		})

		it("should handle file read errors gracefully", async () => {
			vi.mocked(fileExistsAtPath).mockImplementation(async () => {
				throw new Error("Permission denied")
			})
			vi.mocked(fs.readFile).mockRejectedValue(new Error("Permission denied"))

			const result = await analyzer.analyzeProject()

			// Should not crash and return empty results
			expect(result.detectedDependencies).toEqual([])
			expect(result.recommendations).toEqual([])
			expect(result.projectType).toBeUndefined()
		})

		it("should handle empty requirements.txt", async () => {
			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/requirements.txt") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/requirements.txt") {
					return ""
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			expect(result.detectedDependencies).toEqual([])
			expect(result.recommendations).toEqual([])
			expect(result.projectType).toBe("python")
		})

		it("should ignore comments in requirements.txt", async () => {
			const mockRequirements = `
# This is a comment
django==4.2.0
# Another comment
pandas>=1.5.0
			`

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/requirements.txt") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/requirements.txt") {
					return mockRequirements
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			expect(result.detectedDependencies).toHaveLength(2)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "django", type: "python" }),
			)
			expect(result.detectedDependencies).toContainEqual(
				expect.objectContaining({ name: "pandas", type: "python" }),
			)
		})

		it("should sort recommendations by confidence", async () => {
			const mockPackageJson = {
				dependencies: {
					"@playwright/test": "^1.40.0", // 90% confidence
					puppeteer: "^21.0.0", // 85% confidence
					xlsx: "^0.18.0", // 80% confidence
				},
			}

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/package.json") return true
				if (filePath === "/test/project/.git") return true // 95% confidence
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/package.json") {
					return JSON.stringify(mockPackageJson)
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			// Recommendations should be sorted by confidence (highest first)
			expect(result.recommendations[0].serverName).toBe("github") // 95%
			expect(result.recommendations[0].confidence).toBe(95)

			// Check that confidence decreases
			for (let i = 1; i < result.recommendations.length; i++) {
				expect(result.recommendations[i].confidence).toBeLessThanOrEqual(
					result.recommendations[i - 1].confidence,
				)
			}
		})

		it("should not duplicate server recommendations", async () => {
			const mockPackageJson = {
				dependencies: {
					"@playwright/test": "^1.40.0",
					playwright: "^1.40.0", // Both should map to playwright server
				},
			}

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/package.json") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/package.json") {
					return JSON.stringify(mockPackageJson)
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			// Should only have one playwright recommendation
			const playwrightRecs = result.recommendations.filter((r) => r.serverName === "playwright")
			expect(playwrightRecs).toHaveLength(1)
		})

		it("should enable recommended servers by default", async () => {
			const mockPackageJson = {
				dependencies: {
					"neo4j-driver": "^5.0.0",
				},
			}

			vi.mocked(fileExistsAtPath).mockImplementation(async (filePath: string) => {
				if (filePath === "/test/project/package.json") return true
				return false
			})

			vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
				if (filePath === "/test/project/package.json") {
					return JSON.stringify(mockPackageJson)
				}
				throw new Error("File not found")
			})

			const result = await analyzer.analyzeProject()

			const neo4jRec = result.recommendations.find((r) => r.serverName === "neo4j-memory")
			expect(neo4jRec).toBeDefined()
			expect(neo4jRec?.config.disabled).toBe(false) // Should be enabled
		})
	})

	describe("applyRecommendations", () => {
		it("should be a placeholder for now", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			const recommendations = [
				{
					serverName: "test",
					config: {},
					confidence: 90,
					reason: "Test",
					dependencies: [],
				},
			]

			await analyzer.applyRecommendations(recommendations)

			expect(consoleSpy).toHaveBeenCalledWith("Applying recommendations:", recommendations)

			consoleSpy.mockRestore()
		})
	})
})
