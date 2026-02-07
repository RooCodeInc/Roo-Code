/**
 * Tests for terminal utility functions.
 */

import { getTerminalBackgroundColor } from "../terminal.js"

describe("getTerminalBackgroundColor", () => {
	let originalIsTTY: boolean
	let mockSetRawMode: ReturnType<typeof vi.fn>
	let mockOn: ReturnType<typeof vi.fn>
	let mockRemoveListener: ReturnType<typeof vi.fn>
	let mockStdoutWrite: ReturnType<typeof vi.fn>

	beforeEach(() => {
		originalIsTTY = process.stdin.isTTY
		mockSetRawMode = vi.fn()
		mockOn = vi.fn()
		mockRemoveListener = vi.fn()
		mockStdoutWrite = vi.fn()

		process.stdin.setRawMode = mockSetRawMode as typeof process.stdin.setRawMode
		process.stdin.on = mockOn as typeof process.stdin.on
		process.stdin.removeListener = mockRemoveListener as typeof process.stdin.removeListener
		process.stdout.write = mockStdoutWrite as typeof process.stdout.write
	})

	afterEach(() => {
		process.stdin.isTTY = originalIsTTY
	})

	it("returns 'dark' if not in a TTY", async () => {
		process.stdin.isTTY = false
		const result = await getTerminalBackgroundColor()
		expect(result).toBe("dark")
	})

	it("detects dark background from rgb: format", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			// Simulate dark terminal response (low RGB values)
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;rgb:1000/1000/1000\x07"))
			}, 10)
		})

		const result = await getTerminalBackgroundColor()
		expect(result).toBe("dark")
	})

	it("detects light background from rgb: format", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			// Simulate light terminal response (high RGB values)
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;rgb:f000/f000/f000\x07"))
			}, 10)
		})

		const result = await getTerminalBackgroundColor()
		expect(result).toBe("light")
	})

	it("detects dark background from hex # format", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			// Dark color: #2d2d2d
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;#2d2d2d\x07"))
			}, 10)
		})

		const result = await getTerminalBackgroundColor()
		expect(result).toBe("dark")
	})

	it("detects light background from hex # format", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			// Light color: #f0f0f0
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;#f0f0f0\x07"))
			}, 10)
		})

		const result = await getTerminalBackgroundColor()
		expect(result).toBe("light")
	})

	it("returns 'dark' if timeout occurs", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation(() => {
			// Don't call handler - let it timeout
		})

		const result = await getTerminalBackgroundColor()
		expect(result).toBe("dark")
	}, 2000)

	it("cleans up listeners after response", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;rgb:8000/8000/8000\x07"))
			}, 10)
		})

		await getTerminalBackgroundColor()
		expect(mockSetRawMode).toHaveBeenCalledWith(false)
		expect(mockRemoveListener).toHaveBeenCalled()
	})

	it("writes OSC 11 query sequence", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;rgb:1000/1000/1000\x07"))
			}, 10)
		})

		await getTerminalBackgroundColor()
		expect(mockStdoutWrite).toHaveBeenCalledWith("\x1b]11;?\x07")
	})

	it("handles luminance boundary at 0.5", async () => {
		process.stdin.isTTY = true

		// Test just below threshold (luminance = 0.499...)
		mockOn.mockImplementationOnce((event: string, handler: (data: Buffer) => void) => {
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;#7f7f7f\x07"))
			}, 10)
		})

		const darkResult = await getTerminalBackgroundColor()
		expect(darkResult).toBe("dark")

		// Test just above threshold (luminance = 0.501...)
		mockOn.mockImplementationOnce((event: string, handler: (data: Buffer) => void) => {
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;#808080\x07"))
			}, 10)
		})

		const lightResult = await getTerminalBackgroundColor()
		expect(lightResult).toBe("light")
	})

	it("handles black background", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;#000000\x07"))
			}, 10)
		})

		const result = await getTerminalBackgroundColor()
		expect(result).toBe("dark")
	})

	it("handles white background", async () => {
		process.stdin.isTTY = true

		mockOn.mockImplementation((event: string, handler: (data: Buffer) => void) => {
			setTimeout(() => {
				handler(Buffer.from("\x1b]11;#ffffff\x07"))
			}, 10)
		})

		const result = await getTerminalBackgroundColor()
		expect(result).toBe("light")
	})
})
