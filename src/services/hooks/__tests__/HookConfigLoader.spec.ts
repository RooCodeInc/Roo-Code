/**
 * Tests for HookConfigLoader
 *
 * Covers:
 * - Config parsing (YAML and JSON)
 * - Zod validation
 * - Precedence merging (project > mode > global)
 * - Error handling for invalid configs
 */

import { loadHooksConfig, getHooksForEvent, getHookById } from "../HookConfigLoader"
import type { HooksConfigSnapshot, HookEventType } from "../types"

// Create hoisted mocks
const mockFsPromises = vi.hoisted(() => ({
	readdir: vi.fn(),
	readFile: vi.fn(),
	stat: vi.fn(),
	access: vi.fn(),
}))

vi.mock("fs/promises", () => ({
	default: mockFsPromises,
	readdir: mockFsPromises.readdir,
	readFile: mockFsPromises.readFile,
	stat: mockFsPromises.stat,
	access: mockFsPromises.access,
}))

vi.mock("../../roo-config", () => ({
	getGlobalRooDirectory: () => "/home/user/.roo",
	getProjectRooDirectoryForCwd: (cwd: string) => `${cwd}/.roo`,
}))

describe("HookConfigLoader", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Default stat() implementation so loader can attach createdAt.
		mockFsPromises.stat.mockResolvedValue({
			birthtimeMs: 1,
			ctimeMs: 1,
			mtimeMs: 1,
		} as any)
	})

	describe("loadHooksConfig", () => {
		it("should return empty snapshot when no config files exist", async () => {
			// Mock: no directories exist
			mockFsPromises.readdir.mockRejectedValue({ code: "ENOENT" })

			const result = await loadHooksConfig({ cwd: "/project" })

			expect(result.snapshot.hooksByEvent.size).toBe(0)
			expect(result.snapshot.hooksById.size).toBe(0)
			expect(result.errors).toHaveLength(0)
		})

		it("should parse YAML config files", async () => {
			const yamlContent = `
hooks:
  - id: lint-check
    events: ["PreToolUse"]
    matcher: "Edit|Write"
    command: "./lint.sh"
    timeout: 30
`
			mockFsPromises.readdir.mockImplementation(async (dirPath) => {
				const dir = dirPath.toString()
				if (dir.includes("/.roo/hooks")) {
					return [{ name: "pre-tool.yaml", isFile: () => true, isDirectory: () => false }]
				}
				throw { code: "ENOENT" }
			})
			mockFsPromises.readFile.mockImplementation(async (filePath) => {
				if (filePath.toString().endsWith("pre-tool.yaml")) {
					return yamlContent
				}
				throw { code: "ENOENT" }
			})

			const result = await loadHooksConfig({ cwd: "/project" })

			expect(result.errors).toHaveLength(0)
			expect(result.snapshot.hooksByEvent.has("PreToolUse")).toBe(true)
			const hooks = result.snapshot.hooksByEvent.get("PreToolUse")!
			expect(hooks).toHaveLength(1)
			expect(hooks[0].id).toBe("lint-check")
			expect(hooks[0].command).toBe("./lint.sh")
			expect(hooks[0].timeout).toBe(30)
			expect(hooks[0].createdAt).toBe(1)
		})

		it("should parse JSON config files", async () => {
			const jsonContent = JSON.stringify({
				hooks: [{ id: "notify-slack", events: ["PostToolUse"], command: "./notify.sh" }],
			})

			mockFsPromises.readdir.mockImplementation(async (dirPath) => {
				const dir = dirPath.toString()
				if (dir.includes("/.roo/hooks")) {
					return [{ name: "post-tool.json", isFile: () => true, isDirectory: () => false }]
				}
				throw { code: "ENOENT" }
			})
			mockFsPromises.readFile.mockImplementation(async (filePath) => {
				if (filePath.toString().endsWith("post-tool.json")) {
					return jsonContent
				}
				throw { code: "ENOENT" }
			})

			const result = await loadHooksConfig({ cwd: "/project" })

			expect(result.errors).toHaveLength(0)
			expect(result.snapshot.hooksByEvent.has("PostToolUse")).toBe(true)
		})

		it("should report validation errors for invalid config", async () => {
			// Missing required 'command' field
			const invalidYaml = `
hooks:
  - id: bad-hook
    events: ["PreToolUse"]
    command: ""
`
			mockFsPromises.readdir.mockImplementation(async (dirPath) => {
				const dir = dirPath.toString()
				if (dir.includes("/.roo/hooks")) {
					return [{ name: "invalid.yaml", isFile: () => true, isDirectory: () => false }]
				}
				throw { code: "ENOENT" }
			})
			mockFsPromises.readFile.mockImplementation(async (filePath) => {
				if (filePath.toString().endsWith("invalid.yaml")) {
					return invalidYaml
				}
				throw { code: "ENOENT" }
			})

			const result = await loadHooksConfig({ cwd: "/project" })

			// Should have validation error (command cannot be empty)
			expect(result.errors.length).toBeGreaterThan(0)
			expect(result.errors[0]).toContain("command")
		})

		it("should merge configs with project taking precedence over global", async () => {
			const globalYaml = `
hooks:
  - id: shared-hook
    events: ["PreToolUse"]
    command: "global-command"
`
			const projectYaml = `
hooks:
  - id: shared-hook
    events: ["PreToolUse"]
    command: "project-command"
`
			mockFsPromises.readdir.mockImplementation(async (dirPath) => {
				const dir = dirPath.toString()
				if (dir.includes(".roo/hooks")) {
					return [{ name: "hooks.yaml", isFile: () => true, isDirectory: () => false }]
				}
				throw { code: "ENOENT" }
			})
			mockFsPromises.readFile.mockImplementation(async (filePath) => {
				const path = filePath.toString()
				if (path.includes("/home/user/.roo") && path.endsWith("hooks.yaml")) {
					return globalYaml
				}
				if (path.includes("/project/.roo") && path.endsWith("hooks.yaml")) {
					return projectYaml
				}
				throw { code: "ENOENT" }
			})

			const result = await loadHooksConfig({ cwd: "/project" })

			expect(result.errors).toHaveLength(0)
			const hooks = result.snapshot.hooksByEvent.get("PreToolUse")!
			expect(hooks).toHaveLength(1)
			// Project should take precedence
			expect(hooks[0].command).toBe("project-command")
		})

		it("should include mode-specific hooks when mode is provided", async () => {
			const modeYaml = `
hooks:
  - id: mode-hook
    events: ["PreToolUse"]
    command: "./mode-specific.sh"
`
			mockFsPromises.readdir.mockImplementation(async (dirPath) => {
				const dir = dirPath.toString()
				if (dir.includes("hooks-code")) {
					return [{ name: "hooks.yaml", isFile: () => true, isDirectory: () => false }]
				}
				throw { code: "ENOENT" }
			})
			mockFsPromises.readFile.mockImplementation(async (filePath) => {
				if (filePath.toString().includes("hooks-code")) {
					return modeYaml
				}
				throw { code: "ENOENT" }
			})

			const result = await loadHooksConfig({ cwd: "/project", mode: "code" })

			expect(result.errors).toHaveLength(0)
			expect(result.snapshot.hooksByEvent.has("PreToolUse")).toBe(true)
		})

		it("should set hasProjectHooks flag when project hooks exist", async () => {
			const projectYaml = `
hooks:
  - id: project-hook
    events: ["PreToolUse"]
    command: "./project.sh"
`
			mockFsPromises.readdir.mockImplementation(async (dirPath) => {
				const dir = dirPath.toString()
				if (dir.endsWith("/.roo/hooks")) {
					return [{ name: "hooks.yaml", isFile: () => true, isDirectory: () => false }]
				}
				throw { code: "ENOENT" }
			})
			mockFsPromises.readFile.mockImplementation(async (filePath) => {
				if (filePath.toString().includes("/project/.roo")) {
					return projectYaml
				}
				throw { code: "ENOENT" }
			})

			const result = await loadHooksConfig({ cwd: "/project" })

			expect(result.snapshot.hasProjectHooks).toBe(true)
		})

		it("should preserve multiple events for the same hook ID", async () => {
			const yamlContent = `
hooks:
  - id: multi-event
    events: ["PreToolUse", "PostToolUse"]
    command: "./hook.sh"
`
			mockFsPromises.readdir.mockImplementation(async (dirPath) => {
				const dir = dirPath.toString()
				if (dir.endsWith("/.roo/hooks")) {
					return [{ name: "hooks.yaml", isFile: () => true, isDirectory: () => false }]
				}
				throw { code: "ENOENT" }
			})
			mockFsPromises.readFile.mockResolvedValue(yamlContent)

			const result = await loadHooksConfig({ cwd: "/project" })

			expect(result.errors).toHaveLength(0)

			const preHooks = result.snapshot.hooksByEvent.get("PreToolUse") || []
			const postHooks = result.snapshot.hooksByEvent.get("PostToolUse") || []
			expect(preHooks.map((h) => h.id)).toContain("multi-event")
			expect(postHooks.map((h) => h.id)).toContain("multi-event")

			const hookById = getHookById(result.snapshot, "multi-event")
			expect(hookById).toBeDefined()
			expect(hookById!.events?.sort()).toEqual(["PostToolUse", "PreToolUse"].sort())
		})
	})

	describe("getHooksForEvent", () => {
		const createSnapshot = (
			hooks: Array<{ id: string; event: HookEventType; command: string }>,
		): HooksConfigSnapshot => {
			const hooksByEvent = new Map<HookEventType, any[]>()
			const hooksById = new Map<string, any>()

			for (const h of hooks) {
				const hook = { ...h, enabled: true, _runtimeDisabled: false }
				if (!hooksByEvent.has(h.event)) {
					hooksByEvent.set(h.event, [])
				}
				hooksByEvent.get(h.event)!.push(hook)
				hooksById.set(h.id, hook)
			}

			return {
				hooksByEvent,
				hooksById,
				hasProjectHooks: false,
				loadedAt: new Date(),
				disabledHookIds: new Set<string>(),
			}
		}

		it("should return hooks for specific event", () => {
			const snapshot = createSnapshot([
				{ id: "hook1", event: "PreToolUse", command: "./a.sh" },
				{ id: "hook2", event: "PostToolUse", command: "./b.sh" },
			])

			const result = getHooksForEvent(snapshot, "PreToolUse")

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("hook1")
		})

		it("should exclude disabled hooks", () => {
			const snapshot = createSnapshot([{ id: "hook1", event: "PreToolUse", command: "./a.sh" }])
			// Manually disable the hook
			snapshot.hooksByEvent.get("PreToolUse")![0].enabled = false

			const result = getHooksForEvent(snapshot, "PreToolUse")

			expect(result).toHaveLength(0)
		})

		it("should exclude runtime-disabled hooks", () => {
			const snapshot = createSnapshot([{ id: "hook1", event: "PreToolUse", command: "./a.sh" }])
			// Add hook ID to disabled set
			snapshot.disabledHookIds.add("hook1")

			const result = getHooksForEvent(snapshot, "PreToolUse")

			expect(result).toHaveLength(0)
		})

		it("should return empty array for events with no hooks", () => {
			const snapshot = createSnapshot([])

			const result = getHooksForEvent(snapshot, "Notification")

			expect(result).toHaveLength(0)
		})
	})

	describe("getHookById", () => {
		it("should return hook by ID", () => {
			const snapshot: HooksConfigSnapshot = {
				hooksByEvent: new Map(),
				hooksById: new Map([["my-hook", { id: "my-hook", command: "./test.sh" } as any]]),
				hasProjectHooks: false,
				loadedAt: new Date(),
				disabledHookIds: new Set<string>(),
			}

			const result = getHookById(snapshot, "my-hook")

			expect(result).toBeDefined()
			expect(result!.id).toBe("my-hook")
		})

		it("should return undefined for non-existent hook", () => {
			const snapshot: HooksConfigSnapshot = {
				hooksByEvent: new Map(),
				hooksById: new Map(),
				hasProjectHooks: false,
				loadedAt: new Date(),
				disabledHookIds: new Set<string>(),
			}

			const result = getHookById(snapshot, "non-existent")

			expect(result).toBeUndefined()
		})
	})
})
