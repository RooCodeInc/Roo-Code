import * as os from "os"
import * as path from "path"

import { readTaskSessionsFromStoragePath } from "@roo-code/core/cli"

import { listSessions, parseFormat } from "../list.js"

vi.mock("@roo-code/core/cli", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@roo-code/core/cli")>()
	return {
		...actual,
		readTaskSessionsFromStoragePath: vi.fn(),
	}
})

describe("parseFormat", () => {
	it("defaults to json when undefined", () => {
		expect(parseFormat(undefined)).toBe("json")
	})

	it("returns json for 'json'", () => {
		expect(parseFormat("json")).toBe("json")
	})

	it("returns text for 'text'", () => {
		expect(parseFormat("text")).toBe("text")
	})

	it("is case-insensitive", () => {
		expect(parseFormat("JSON")).toBe("json")
		expect(parseFormat("Text")).toBe("text")
		expect(parseFormat("TEXT")).toBe("text")
	})

	it("throws on invalid format", () => {
		expect(() => parseFormat("xml")).toThrow('Invalid format: xml. Must be "json" or "text".')
	})

	it("throws on empty string", () => {
		expect(() => parseFormat("")).toThrow("Invalid format")
	})
})

describe("listSessions", () => {
	const storagePath = path.join(os.homedir(), ".vscode-mock", "global-storage")

	beforeEach(() => {
		vi.clearAllMocks()
	})

	const captureStdout = async (fn: () => Promise<void>): Promise<string> => {
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

		try {
			await fn()
			return stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join("")
		} finally {
			stdoutSpy.mockRestore()
		}
	}

	it("uses the CLI runtime storage path and prints JSON output", async () => {
		vi.mocked(readTaskSessionsFromStoragePath).mockResolvedValue([
			{ id: "s1", task: "Task 1", ts: 1_700_000_000_000, mode: "code" },
		])

		const output = await captureStdout(() => listSessions({ format: "json" }))

		expect(readTaskSessionsFromStoragePath).toHaveBeenCalledWith(storagePath)
		expect(JSON.parse(output)).toEqual({
			sessions: [{ id: "s1", task: "Task 1", ts: 1_700_000_000_000, mode: "code" }],
		})
	})

	it("prints tab-delimited text output with ISO timestamps and formatted titles", async () => {
		vi.mocked(readTaskSessionsFromStoragePath).mockResolvedValue([
			{ id: "s1", task: "Task 1", ts: Date.UTC(2024, 0, 1, 0, 0, 0) },
			{ id: "s2", task: "   ", ts: Date.UTC(2024, 0, 1, 1, 0, 0) },
		])

		const output = await captureStdout(() => listSessions({ format: "text" }))
		const lines = output.trim().split("\n")

		expect(lines).toEqual(["s1\t2024-01-01T00:00:00.000Z\tTask 1", "s2\t2024-01-01T01:00:00.000Z\t(untitled)"])
	})
})
