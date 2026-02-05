import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
	ProjectMemoryImpl,
	DesignDecision,
	BestPractice,
	ProjectContext,
} from "../project-memory"
import { SQLiteAdapter } from "../storage/sqlite-adapter"

describe("ProjectMemory", () => {
	let memory: ProjectMemoryImpl
	let storage: SQLiteAdapter
	const testDbPath = ":memory:"

	beforeEach(async () => {
		storage = new SQLiteAdapter(testDbPath)
		await storage.initialize()
		memory = new ProjectMemoryImpl(storage)
		await memory.initialize()
	})

	afterEach(async () => {
		await storage.close()
	})

	describe("Design Decisions", () => {
		it("should save and retrieve a design decision", async () => {
			const decision: DesignDecision = {
				id: "",
				title: "Use Repository Pattern",
				description: "We decided to use the repository pattern for data access",
				rationale: "This provides better testability and abstraction",
				alternatives: ["DAO pattern", "Direct database calls"],
				filesAffected: ["src/repositories/UserRepository.ts", "src/repositories/ProductRepository.ts"],
				status: "accepted",
				tags: ["architecture", "data-access"],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			const id = await memory.saveDesignDecision(decision)
			const retrieved = await memory.getDesignDecision(id)

			expect(retrieved).not.toBeNull()
			expect(retrieved!.title).toBe("Use Repository Pattern")
			expect(retrieved!.status).toBe("accepted")
			expect(retrieved!.alternatives).toHaveLength(2)
			expect(retrieved!.filesAffected).toContain("src/repositories/UserRepository.ts")
		})

		it("should list design decisions", async () => {
			const decision1: DesignDecision = {
				id: "",
				title: "Decision 1",
				description: "First decision",
				rationale: "Rationale 1",
				alternatives: [],
				filesAffected: [],
				status: "accepted",
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			const decision2: DesignDecision = {
				id: "",
				title: "Decision 2",
				description: "Second decision",
				rationale: "Rationale 2",
				alternatives: [],
				filesAffected: [],
				status: "proposed",
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			await memory.saveDesignDecision(decision1)
			await memory.saveDesignDecision(decision2)

			const all = await memory.listDesignDecisions()
			expect(all).toHaveLength(2)

			const accepted = await memory.listDesignDecisions({ status: "accepted" })
			expect(accepted).toHaveLength(1)
			expect(accepted[0].title).toBe("Decision 1")
		})

		it("should update design decision status", async () => {
			const decision: DesignDecision = {
				id: "",
				title: "Test Decision",
				description: "Test description",
				rationale: "Test rationale",
				alternatives: [],
				filesAffected: [],
				status: "proposed",
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			const id = await memory.saveDesignDecision(decision)
			const updated = await memory.updateDesignDecisionStatus(id, "accepted")

			expect(updated).toBe(true)

			const retrieved = await memory.getDesignDecision(id)
			expect(retrieved!.status).toBe("accepted")
		})

		it("should get decisions for a specific file", async () => {
			const decision: DesignDecision = {
				id: "",
				title: "File-specific Decision",
				description: "A decision affecting a specific file",
				rationale: "Important rationale",
				alternatives: [],
				filesAffected: ["src/main.ts"],
				status: "accepted",
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			const id = await memory.saveDesignDecision(decision)
			const decisions = await memory.getDecisionsForFile("src/main.ts")

			expect(decisions).toHaveLength(1)
			expect(decisions[0].id).toBe(id)
		})
	})

	describe("Best Practices", () => {
		it("should save and retrieve best practices", async () => {
			const practice: BestPractice = {
				id: "",
				category: "error-handling",
				title: "Use Result Types",
				description: "Prefer using Result types over exceptions for expected errors",
				examples: ['return { ok: true, value: x }', 'return { ok: false, error: e }'],
				rationale: "Improves type safety and reduces exception overhead",
				files: ["src/utils/result.ts"],
				createdAt: Date.now(),
			}

			const id = await memory.saveBestPractice(practice)
			const retrieved = await memory.getBestPractices("error-handling")

			expect(retrieved).toHaveLength(1)
			expect(retrieved[0].title).toBe("Use Result Types")
		})

		it("should get best practices for a file", async () => {
			const practice: BestPractice = {
				id: "",
				category: "testing",
				title: "Use Mocks",
				description: "Mock external dependencies in tests",
				examples: ["mockExternalService()"],
				rationale: "Improves test isolation",
				files: ["src/services/payment.ts"],
				createdAt: Date.now(),
			}

			await memory.saveBestPractice(practice)
			const retrieved = await memory.getBestPracticesForFile("src/services/payment.ts")

			expect(retrieved).toHaveLength(1)
			expect(retrieved[0].category).toBe("testing")
		})
	})

	describe("Project Context", () => {
		it("should save and retrieve project context", async () => {
			const context: ProjectContext = {
				projectPath: "/path/to/project",
				projectName: "My Project",
				architecture: "Clean Architecture",
				languages: ["TypeScript", "Python"],
				frameworks: ["Express", "React"],
				keyFiles: ["src/main.ts", "package.json"],
				lastUpdated: Date.now(),
			}

			await memory.saveProjectContext(context)
			const retrieved = await memory.getProjectContext()

			expect(retrieved).not.toBeNull()
			expect(retrieved!.projectName).toBe("My Project")
			expect(retrieved!.languages).toContain("TypeScript")
			expect(retrieved!.frameworks).toContain("Express")
		})
	})

	describe("Historical Context", () => {
		it("should get historical context for a file", async () => {
			// Save a design decision affecting a file
			const decision: DesignDecision = {
				id: "",
				title: "Historical Decision",
				description: "A past decision",
				rationale: "Historical rationale",
				alternatives: [],
				filesAffected: ["src/historical.ts"],
				status: "accepted",
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			await memory.saveDesignDecision(decision)

			// Save a best practice for the file
			const practice: BestPractice = {
				id: "",
				category: "style",
				title: "Code Style",
				description: "Follow style guide",
				examples: [],
				rationale: "Consistency",
				files: ["src/historical.ts"],
				createdAt: Date.now(),
			}

			await memory.saveBestPractice(practice)

			const historicalContext = await memory.getHistoricalContext("src/historical.ts")

			expect(historicalContext.decisions).toHaveLength(1)
			expect(historicalContext.bestPractices).toHaveLength(1)
		})
	})

	describe("Search", () => {
		it("should search across decisions and best practices", async () => {
			const decision: DesignDecision = {
				id: "",
				title: "Authentication Decision",
				description: "Use JWT for authentication",
				rationale: "Better security",
				alternatives: [],
				filesAffected: [],
				status: "accepted",
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			await memory.saveDesignDecision(decision)

			const practice: BestPractice = {
				id: "",
				category: "security",
				title: "Security Best Practice",
				description: "Validate all inputs",
				examples: [],
				rationale: "Prevents attacks",
				files: [],
				createdAt: Date.now(),
			}

			await memory.saveBestPractice(practice)

			const results = await memory.search("security")

			expect(results.decisions.length + results.bestPractices.length).toBeGreaterThan(0)
		})
	})
})
