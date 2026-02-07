/**
 * Tests for clipboard utilities using OSC 52 escape sequences.
 */

import { copyToClipboard, clearClipboard } from "../clipboard.js"

describe("copyToClipboard", () => {
	let writeSpy: ReturnType<typeof vi.fn>
	let originalWrite: typeof process.stdout.write

	beforeEach(() => {
		originalWrite = process.stdout.write
		writeSpy = vi.fn()
		process.stdout.write = writeSpy as typeof process.stdout.write
	})

	afterEach(() => {
		process.stdout.write = originalWrite
	})

	const ESC = String.fromCharCode(0x1b)
	const BEL = String.fromCharCode(0x07)
	const OSC52_RE = new RegExp(`^${ESC}\\]52;c;(.*)${BEL}$`)

	it("writes OSC 52 escape sequence for simple text", () => {
		copyToClipboard("hello")
		expect(writeSpy).toHaveBeenCalledTimes(1)

		const output = writeSpy.mock.calls[0]![0] as string
		expect(output).toMatch(OSC52_RE)

		// Verify base64 encoding
		const base64Match = output.match(OSC52_RE)
		expect(base64Match).toBeTruthy()
		const base64 = base64Match![1]!
		expect(Buffer.from(base64, "base64").toString("utf-8")).toBe("hello")
	})

	it("handles empty string", () => {
		copyToClipboard("")
		expect(writeSpy).toHaveBeenCalledTimes(1)

		const output = writeSpy.mock.calls[0]![0] as string
		const base64Match = output.match(OSC52_RE)
		const base64 = base64Match![1]!
		expect(Buffer.from(base64, "base64").toString("utf-8")).toBe("")
	})

	it("handles multiline text", () => {
		const text = "line 1\nline 2\nline 3"
		copyToClipboard(text)

		const output = writeSpy.mock.calls[0]![0] as string
		const base64Match = output.match(OSC52_RE)
		const base64 = base64Match![1]!
		expect(Buffer.from(base64, "base64").toString("utf-8")).toBe(text)
	})

	it("handles unicode characters", () => {
		const text = "Hello 世界 🚀"
		copyToClipboard(text)

		const output = writeSpy.mock.calls[0]![0] as string
		const base64Match = output.match(OSC52_RE)
		const base64 = base64Match![1]!
		expect(Buffer.from(base64, "base64").toString("utf-8")).toBe(text)
	})

	it("handles special characters", () => {
		const text = "\t\r\n\0"
		copyToClipboard(text)

		const output = writeSpy.mock.calls[0]![0] as string
		const base64Match = output.match(OSC52_RE)
		const base64 = base64Match![1]!
		expect(Buffer.from(base64, "base64").toString("utf-8")).toBe(text)
	})

	it("handles large text", () => {
		const largeText = "a".repeat(10000)
		copyToClipboard(largeText)

		const output = writeSpy.mock.calls[0]![0] as string
		const base64Match = output.match(OSC52_RE)
		const base64 = base64Match![1]!
		expect(Buffer.from(base64, "base64").toString("utf-8")).toBe(largeText)
	})
})

describe("clearClipboard", () => {
	let writeSpy: ReturnType<typeof vi.fn>
	let originalWrite: typeof process.stdout.write

	beforeEach(() => {
		originalWrite = process.stdout.write
		writeSpy = vi.fn()
		process.stdout.write = writeSpy as typeof process.stdout.write
	})

	afterEach(() => {
		process.stdout.write = originalWrite
	})

	it("writes OSC 52 clear sequence", () => {
		clearClipboard()
		expect(writeSpy).toHaveBeenCalledTimes(1)
		expect(writeSpy).toHaveBeenCalledWith("\x1b]52;c;!\x07")
	})
})
