import { vi } from "vitest"

// Mock VSCode API for testing
export const vscode = {
	postMessage: vi.fn(),
	// Add other VSCode API methods as needed
	setState: vi.fn(),
	getState: vi.fn(),
}