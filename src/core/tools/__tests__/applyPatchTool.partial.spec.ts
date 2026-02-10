import path from "path"

import type { MockedFunction } from "vitest"

import type { ToolUse } from "../../../shared/tools"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"
import type { Task } from "../../task/Task"
import { ApplyPatchTool } from "../ApplyPatchTool"

vi.mock("../../../utils/pathUtils", () => ({
	isPathOutsideWorkspace: vi.fn(),
}))

interface PartialApplyPatchPayload {
	tool: string
	path: string
	diff: string
	isOutsideWorkspace: boolean
}

function parsePartialApplyPatchPayload(payloadText: string): PartialApplyPatchPayload {
	const parsed: unknown = JSON.parse(payloadText)

	if (!parsed || typeof parsed !== "object") {
		throw new Error("Expected partial apply_patch payload to be a JSON object")
	}

	const payload = parsed as Record<string, unknown>

	return {
		tool: typeof payload.tool === "string" ? payload.tool : "",
		path: typeof payload.path === "string" ? payload.path : "",
		diff: typeof payload.diff === "string" ? payload.diff : "",
		isOutsideWorkspace: typeof payload.isOutsideWorkspace === "boolean" ? payload.isOutsideWorkspace : false,
	}
}

describe("ApplyPatchTool.handlePartial", () => {
	const cwd = path.join(path.sep, "workspace", "project")
	const mockedIsPathOutsideWorkspace = isPathOutsideWorkspace as MockedFunction<typeof isPathOutsideWorkspace>

	let askSpy: MockedFunction<Task["ask"]>
	let mockTask: Pick<Task, "cwd" | "ask">
	let tool: ApplyPatchTool

	beforeEach(() => {
		vi.clearAllMocks()

		askSpy = vi.fn().mockRejectedValue(new Error("ask() rejection is ignored for partial rows")) as MockedFunction<
			Task["ask"]
		>
		mockTask = {
			cwd,
			ask: askSpy,
		}

		mockedIsPathOutsideWorkspace.mockImplementation((absolutePath) =>
			absolutePath.replace(/\\/g, "/").includes("/outside/"),
		)
		tool = new ApplyPatchTool()
	})

	afterEach(() => {
		tool.resetPartialState()
	})

	function createPartialBlock(patchText?: string): ToolUse<"apply_patch"> {
		const params: ToolUse<"apply_patch">["params"] = {}
		if (patchText !== undefined) {
			params.patch = patchText
		}

		return {
			type: "tool_use",
			name: "apply_patch",
			params,
			partial: true,
		}
	}

	async function executePartial(patchText?: string): Promise<PartialApplyPatchPayload> {
		await tool.handlePartial(mockTask as Task, createPartialBlock(patchText))

		const call = askSpy.mock.calls.at(-1)
		expect(call).toBeDefined()

		if (!call) {
			throw new Error("Expected task.ask() to be called")
		}

		expect(call[0]).toBe("tool")
		expect(call[2]).toBe(true)

		const payloadText = call[1]
		expect(typeof payloadText).toBe("string")

		if (typeof payloadText !== "string") {
			throw new Error("Expected partial payload text to be a string")
		}

		return parsePartialApplyPatchPayload(payloadText)
	}

	it("emits non-empty path from the first complete file header", async () => {
		const patchText = `*** Begin Patch
*** Update File: src/first.ts
@@
-old
+new
*** End Patch`

		const payload = await executePartial(patchText)

		expect(payload.path).toBe("src/first.ts")
		expect(payload.path.length).toBeGreaterThan(0)
	})

	it("uses first header path deterministically for multi-file patches", async () => {
		const patchText = `*** Begin Patch
*** Add File: docs/first.md
+content
*** Update File: src/second.ts
@@
-a
+b
*** End Patch`

		const payload = await executePartial(patchText)

		expect(payload.path).toBe("docs/first.md")
	})

	it("keeps stable first path when trailing second header is truncated", async () => {
		/**
		 * The final line has no trailing newline on purpose, simulating streaming truncation.
		 * `extractFirstPathFromPatch()` should ignore this incomplete line and keep the first path.
		 */
		const patchText = `*** Begin Patch
*** Update File: src/stable-first.ts
@@
-old
+new
*** Update File: src/truncated-second`

		const payload = await executePartial(patchText)

		expect(payload.path).toBe("src/stable-first.ts")
		expect(payload.path).not.toBe("")
	})

	it("falls back to deterministic non-blank path when no header is present", async () => {
		const patchText = "*** Begin Patch\n@@\n-old\n+new"

		const firstPayload = await executePartial(patchText)
		const secondPayload = await executePartial(patchText)

		const expectedFallbackPath = path.basename(cwd)
		expect(firstPayload.path).toBe(expectedFallbackPath)
		expect(secondPayload.path).toBe(expectedFallbackPath)
		expect(firstPayload.path.length).toBeGreaterThan(0)
	})

	it("reflects isOutsideWorkspace for both derived and fallback paths", async () => {
		const derivedPatch = `*** Begin Patch
*** Update File: outside/derived.ts
@@
-old
+new
*** End Patch`
		const fallbackPatch = "*** Begin Patch\n@@\n-old\n+new"

		const derivedPayload = await executePartial(derivedPatch)
		const fallbackPayload = await executePartial(fallbackPatch)

		expect(derivedPayload.path).toBe("outside/derived.ts")
		expect(derivedPayload.isOutsideWorkspace).toBe(true)

		expect(fallbackPayload.path).toBe(path.basename(cwd))
		expect(fallbackPayload.isOutsideWorkspace).toBe(false)
	})

	it("preserves appliedDiff partial payload contract", async () => {
		const payload = await executePartial(undefined)

		expect(payload.tool).toBe("appliedDiff")
		expect(payload.diff).toBe("Parsing patch...")
		expect(payload.path).toBe(path.basename(cwd))
		expect(typeof payload.isOutsideWorkspace).toBe("boolean")
	})
})
