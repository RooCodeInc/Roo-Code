/**
 * Tests for centralized UI message redaction in taskMessages.ts
 * Verifies:
 *  - saveTaskMessages() sanitizes sensitive payloads before persistence
 *  - readTaskMessages() sanitizes legacy payloads on read as a safety net
 *  - Idempotency and non-string handling
 */

import * as path from "path"

// Mocks
let writtenPath: string | null = null
let writtenData: any = null

vi.mock("../../../utils/safeWriteJson", () => {
	return {
		safeWriteJson: vi.fn(async (p: string, data: any) => {
			writtenPath = p
			writtenData = data
		}),
	}
})

vi.mock("../../../utils/storage", () => {
	return {
		getTaskDirectoryPath: vi.fn(async (_globalStoragePath: string, _taskId: string) => "/tmp/taskdir"),
	}
})

let fileExists = true
vi.mock("../../../utils/fs", () => {
	return {
		fileExistsAtPath: vi.fn(async (_p: string) => fileExists),
	}
})

// For read sanitization tests - simulate raw file contents
let mockReadFilePayload: string = "[]"
vi.mock("fs/promises", async (importOriginal) => {
	const actual = await importOriginal<any>()
	return {
		...actual,
		readFile: vi.fn(async (_p: string, _enc: string) => mockReadFilePayload),
	}
})

// SUT
import { readTaskMessages, saveTaskMessages } from "../taskMessages"
import { GlobalFileNames } from "../../../shared/globalFileNames"

describe("taskMessages redaction", () => {
	beforeEach(() => {
		writtenPath = null
		writtenData = null
		fileExists = true
		mockReadFilePayload = "[]"
	})

	it("saveTaskMessages() should sanitize sensitive tags and JSON 'request' envelope", async () => {
		const messages = [
			// JSON api_req_started envelope
			{
				ts: 1,
				type: "say",
				say: "api_req_started",
				text: JSON.stringify({
					request:
						"Header\n" +
						"<files>s1</files>\n" +
						"<file_content>topsecret</file_content>\n" +
						"<content type='text'>inner</content>\n" +
						"<file x='y'>body</file>",
					apiProtocol: "anthropic",
				}),
			},
			// Raw UI text with various tags
			{
				ts: 2,
				type: "say",
				say: "text",
				text:
					"pre " +
					"<files>multi</files> " +
					"<file id='1'>abc</file> " +
					"<content>blob</content> " +
					"<file_content>secretbytes</file_content> " +
					"post",
			},
			// Non-sensitive string should remain identical
			{ ts: 3, type: "say", say: "text", text: "no sensitive" },
			// Non-string text should be left untouched
			{ ts: 4, type: "say", say: "text", text: undefined },
		] as any[]

		await saveTaskMessages({ messages, taskId: "t1", globalStoragePath: "/any" })

		// Assert path used
		expect(writtenPath).toBe(path.join("/tmp/taskdir", GlobalFileNames.uiMessages))
		expect(Array.isArray(writtenData)).toBe(true)

		const [m1, m2, m3, m4] = writtenData as any[]

		// m1: JSON envelope should be sanitized inside request
		const m1Obj = JSON.parse(m1.text || "{}")
		expect(typeof m1Obj.request).toBe("string")
		expect(m1Obj.request).toContain("<file_content>[omitted]</file_content>")
		expect(m1Obj.request).toContain("<content>[omitted]</content>")
		expect(m1Obj.request).toContain("<file>[omitted]</file>")
		expect(m1Obj.request).toContain("<files>[omitted]</files>")
		// Original payloads should not remain
		expect(m1Obj.request).not.toContain("topsecret")
		expect(m1Obj.request).not.toContain("inner")
		expect(m1Obj.request).not.toContain("body")
		expect(m1Obj.request).not.toContain("multi")

		// m2: raw text with tags should be scrubbed
		expect(m2.text).toContain("<file_content>[omitted]</file_content>")
		expect(m2.text).toContain("<content>[omitted]</content>")
		expect(m2.text).toContain("<file>[omitted]</file>")
		expect(m2.text).toContain("<files>[omitted]</files>")
		expect(m2.text).not.toContain("secretbytes")
		expect(m2.text).not.toContain("blob")
		expect(m2.text).not.toContain("abc")
		expect(m2.text).not.toContain("multi")

		// m3: unchanged safe content
		expect(m3.text).toBe("no sensitive")

		// m4: undefined remains undefined
		expect(m4.text).toBeUndefined()
	})

	it("readTaskMessages() should sanitize legacy on read", async () => {
		const legacy = [
			{
				ts: 10,
				type: "say",
				say: "api_req_started",
				text: JSON.stringify({
					request: "X <file_content>L3gacy</file_content> Y",
					apiProtocol: "anthropic",
				}),
			},
			{
				ts: 11,
				type: "say",
				say: "text",
				text: "pre <files>bundle</files> post",
			},
		]
		mockReadFilePayload = JSON.stringify(legacy)

		const result = await readTaskMessages({ taskId: "t2", globalStoragePath: "/any" })

		expect(result.length).toBe(2)
		const [r1, r2] = result as any[]

		const r1Obj = JSON.parse(r1.text || "{}")
		expect(r1Obj.request).toContain("<file_content>[omitted]</file_content>")
		expect(r1Obj.request).not.toContain("L3gacy")

		expect(r2.text).toContain("<files>[omitted]</files>")
		expect(r2.text).not.toContain("bundle")
	})

	it("sanitization should be idempotent", async () => {
		const alreadySanitized = [
			{
				ts: 20,
				type: "say",
				say: "text",
				text: "A <file_content>[omitted]</file_content> B <content>[omitted]</content>",
			},
		]
		await saveTaskMessages({ messages: alreadySanitized as any[], taskId: "t3", globalStoragePath: "/any" })
		expect(writtenData[0].text).toBe("A <file_content>[omitted]</file_content> B <content>[omitted]</content>")
	})
})
