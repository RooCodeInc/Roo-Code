import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { fileExistsAtPath } from "../../utils/fs"

export interface ProjectDependency {
	name: string
	type: "npm" | "docker" | "python" | "config"
	version?: string
}

export interface McpRecommendation {
	serverName: string
	config: any
	confidence: number // 0-100
	reason: string
	dependencies: ProjectDependency[]
}

export interface AnalysisResult {
	recommendations: McpRecommendation[]
	detectedDependencies: ProjectDependency[]
	projectType?: string
}

/**
 * Default MCP configurations based on common project patterns
 */
const DEFAULT_MCP_CONFIGS: Record<string, any> = {
	github: {
		command: "docker",
		args: [
			"run",
			"-i",
			"--rm",
			"-e",
			"GITHUB_PERSONAL_ACCESS_TOKEN",
			"-e",
			"GITHUB_TOOLSETS",
			"-e",
			"GITHUB_READ_ONLY",
			"ghcr.io/github/github-mcp-server",
		],
		env: {
			GITHUB_PERSONAL_ACCESS_TOKEN: "${env:GITHUB_PERSONAL_ACCESS_TOKEN}",
			GITHUB_TOOLSETS: "",
			GITHUB_READ_ONLY: "",
		},
		alwaysAllow: [
			"get_file_contents",
			"list_issues",
			"create_issue",
			"get_pull_request",
			"create_pull_request",
			"list_branches",
			"list_commits",
		],
		disabled: false,
	},
	"neo4j-memory": {
		command: "docker",
		args: [
			"run",
			"-i",
			"--rm",
			"-e",
			"NEO4J_URL",
			"-e",
			"NEO4J_USERNAME",
			"-e",
			"NEO4J_PASSWORD",
			"mcp/neo4j-memory",
		],
		env: {
			NEO4J_URL: "bolt://host.docker.internal:7687",
			NEO4J_USERNAME: "neo4j",
			NEO4J_PASSWORD: "password",
		},
		alwaysAllow: ["read_graph", "create_entities", "create_relations", "find_nodes", "search_nodes"],
		disabled: true,
	},
	playwright: {
		command: "npx",
		args: ["-y", "@playwright/mcp@latest", "--browser=", "--viewport-size="],
		alwaysAllow: [
			"browser_navigate",
			"browser_click",
			"browser_type",
			"browser_take_screenshot",
			"browser_snapshot",
		],
		disabled: true,
	},
	puppeteer: {
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-puppeteer"],
		disabled: true,
		alwaysAllow: ["puppeteer_screenshot", "puppeteer_click", "puppeteer_fill", "puppeteer_evaluate"],
	},
	excel: {
		command: "cmd",
		args: ["/c", "npx", "--yes", "@negokaz/excel-mcp-server"],
		env: {
			EXCEL_MCP_PAGING_CELLS_LIMIT: "4000",
		},
		alwaysAllow: ["excel_read_sheet", "excel_write_to_sheet", "excel_describe_sheets"],
		disabled: true,
	},
}

/**
 * Mapping of project dependencies to recommended MCP servers
 */
const DEPENDENCY_TO_MCP_MAP: Record<string, { servers: string[]; confidence: number }> = {
	// Version control
	".git": { servers: ["github"], confidence: 95 },
	".github": { servers: ["github"], confidence: 95 },

	// Database
	neo4j: { servers: ["neo4j-memory", "neo4j-cypher"], confidence: 90 },
	"@neo4j/driver": { servers: ["neo4j-memory", "neo4j-cypher"], confidence: 90 },
	"neo4j-driver": { servers: ["neo4j-memory", "neo4j-cypher"], confidence: 90 },

	// Testing & Automation
	playwright: { servers: ["playwright"], confidence: 85 },
	"@playwright/test": { servers: ["playwright"], confidence: 90 },
	puppeteer: { servers: ["puppeteer"], confidence: 85 },
	"selenium-webdriver": { servers: ["playwright", "puppeteer"], confidence: 75 },

	// Data processing
	xlsx: { servers: ["excel"], confidence: 80 },
	exceljs: { servers: ["excel"], confidence: 80 },
	pandas: { servers: ["excel"], confidence: 70 },
	openpyxl: { servers: ["excel"], confidence: 75 },
}

export class McpConfigAnalyzer {
	constructor(private workspaceFolder: vscode.WorkspaceFolder) {}

	/**
	 * Analyzes the project and returns MCP configuration recommendations
	 */
	async analyzeProject(): Promise<AnalysisResult> {
		const dependencies = await this.detectProjectDependencies()
		const recommendations = this.generateRecommendations(dependencies)
		const projectType = await this.detectProjectType()

		return {
			recommendations,
			detectedDependencies: dependencies,
			projectType,
		}
	}

	/**
	 * Detects project dependencies from various sources
	 */
	private async detectProjectDependencies(): Promise<ProjectDependency[]> {
		const dependencies: ProjectDependency[] = []
		const workspacePath = this.workspaceFolder.uri.fsPath

		// Check for package.json (Node.js projects)
		try {
			const packageJsonPath = path.join(workspacePath, "package.json")
			if (await fileExistsAtPath(packageJsonPath)) {
				try {
					const content = await fs.readFile(packageJsonPath, "utf-8")
					const packageData = JSON.parse(content)

					// Add npm dependencies
					const allDeps = {
						...packageData.dependencies,
						...packageData.devDependencies,
					}

					for (const [name, version] of Object.entries(allDeps)) {
						dependencies.push({
							name,
							type: "npm",
							version: version as string,
						})
					}
				} catch (error) {
					console.error("Error parsing package.json:", error)
				}
			}
		} catch (error) {
			console.error("Error checking for package.json:", error)
		}

		// Check for requirements.txt (Python projects)
		try {
			const requirementsPath = path.join(workspacePath, "requirements.txt")
			if (await fileExistsAtPath(requirementsPath)) {
				try {
					const content = await fs.readFile(requirementsPath, "utf-8")
					const lines = content.split("\n").filter((line) => line.trim() && !line.startsWith("#"))

					for (const line of lines) {
						const match = line.match(/^([^=<>!]+)/)
						if (match) {
							dependencies.push({
								name: match[1].trim(),
								type: "python",
							})
						}
					}
				} catch (error) {
					console.error("Error parsing requirements.txt:", error)
				}
			}
		} catch (error) {
			console.error("Error checking for requirements.txt:", error)
		}

		// Check for docker-compose.yml
		try {
			const dockerComposePath = path.join(workspacePath, "docker-compose.yml")
			const dockerComposeAltPath = path.join(workspacePath, "docker-compose.yaml")

			for (const composePath of [dockerComposePath, dockerComposeAltPath]) {
				if (await fileExistsAtPath(composePath)) {
					try {
						const content = await fs.readFile(composePath, "utf-8")

						// Simple pattern matching for common services
						if (content.includes("neo4j")) {
							dependencies.push({ name: "neo4j", type: "docker" })
						}
						if (content.includes("postgres") || content.includes("postgresql")) {
							dependencies.push({ name: "postgresql", type: "docker" })
						}
						if (content.includes("redis")) {
							dependencies.push({ name: "redis", type: "docker" })
						}
					} catch (error) {
						console.error("Error parsing docker-compose file:", error)
					}
					break
				}
			}
		} catch (error) {
			console.error("Error checking for docker-compose files:", error)
		}

		// Check for .git directory
		try {
			const gitPath = path.join(workspacePath, ".git")
			if (await fileExistsAtPath(gitPath)) {
				dependencies.push({ name: ".git", type: "config" })
			}
		} catch (error) {
			console.error("Error checking for .git directory:", error)
		}

		// Check for .github directory
		try {
			const githubPath = path.join(workspacePath, ".github")
			if (await fileExistsAtPath(githubPath)) {
				dependencies.push({ name: ".github", type: "config" })
			}
		} catch (error) {
			console.error("Error checking for .github directory:", error)
		}

		return dependencies
	}

	/**
	 * Generates MCP server recommendations based on detected dependencies
	 */
	private generateRecommendations(dependencies: ProjectDependency[]): McpRecommendation[] {
		const recommendations: McpRecommendation[] = []
		const addedServers = new Set<string>()

		for (const dep of dependencies) {
			const mapping = DEPENDENCY_TO_MCP_MAP[dep.name]

			if (mapping) {
				for (const serverName of mapping.servers) {
					if (!addedServers.has(serverName)) {
						const config = DEFAULT_MCP_CONFIGS[serverName]

						if (config) {
							recommendations.push({
								serverName,
								config: { ...config, disabled: false }, // Enable by default for recommendations
								confidence: mapping.confidence,
								reason: `Detected ${dep.name} in your project`,
								dependencies: [dep],
							})
							addedServers.add(serverName)
						}
					}
				}
			}
		}

		// Sort by confidence (highest first)
		recommendations.sort((a, b) => b.confidence - a.confidence)

		return recommendations
	}

	/**
	 * Detects the general type of project
	 */
	private async detectProjectType(): Promise<string | undefined> {
		const workspacePath = this.workspaceFolder.uri.fsPath

		// Check for various project indicators
		try {
			if (await fileExistsAtPath(path.join(workspacePath, "package.json"))) {
				try {
					const content = await fs.readFile(path.join(workspacePath, "package.json"), "utf-8")
					const data = JSON.parse(content)

					if (data.dependencies?.react || data.dependencies?.["react-dom"]) {
						return "react"
					}
					if (data.dependencies?.vue) {
						return "vue"
					}
					if (data.dependencies?.express || data.dependencies?.fastify) {
						return "node-backend"
					}
					return "node"
				} catch (error) {
					// If we can't parse the package.json, still consider it a node project
					return "node"
				}
			}
		} catch (error) {
			console.error("Error checking for package.json:", error)
		}

		try {
			if (await fileExistsAtPath(path.join(workspacePath, "requirements.txt"))) {
				try {
					const content = await fs.readFile(path.join(workspacePath, "requirements.txt"), "utf-8")

					if (content.includes("django")) {
						return "django"
					}
					if (content.includes("flask")) {
						return "flask"
					}
					if (content.includes("fastapi")) {
						return "fastapi"
					}
					return "python"
				} catch (error) {
					// If we can't read requirements.txt, still consider it a python project
					return "python"
				}
			}
		} catch (error) {
			console.error("Error checking for requirements.txt:", error)
		}

		try {
			if (await fileExistsAtPath(path.join(workspacePath, "go.mod"))) {
				return "go"
			}
		} catch (error) {
			console.error("Error checking for go.mod:", error)
		}

		try {
			if (await fileExistsAtPath(path.join(workspacePath, "Cargo.toml"))) {
				return "rust"
			}
		} catch (error) {
			console.error("Error checking for Cargo.toml:", error)
		}

		return undefined
	}

	/**
	 * Applies recommended configurations to the MCP settings
	 */
	async applyRecommendations(
		recommendations: McpRecommendation[],
		target: "global" | "project" = "project",
	): Promise<void> {
		// This will be implemented to actually write the configurations
		// For now, it's a placeholder
		console.log("Applying recommendations:", recommendations)
	}
}
