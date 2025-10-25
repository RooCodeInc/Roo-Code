import { vi } from "vitest"
import "@testing-library/jest-dom"
import "@testing-library/jest-dom/vitest"

// Configure snapshot serialization for better test stability
import { expect } from "vitest"

// Initialize snapshot client for Vitest 4.x
// Note: SnapshotClient doesn't exist in Vitest 4.x, using alternative approach

// Custom snapshot serializer for React components
expect.addSnapshotSerializer({
	test: (val) => val && typeof val === "object" && val.$$typeof === Symbol.for("react.element"),
	serialize: (val, config, indentation, depth, refs, printer) => {
		return printer(val.props.children || val.children, config, indentation, depth, refs)
	},
})

// Mock vscode API
const vscodeApi = {
	postMessage: vi.fn(),
	setState: vi.fn(),
}

// Make vscode API available globally
;(global as any).acquireVsCodeApi = () => vscodeApi
;(global as any).vscode = vscodeApi

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Mock Design System Provider
;(global as any).DesignSystemProvider = ({ children }: { children: any }) => children

// Additional React setup for testing environment
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}))

// Note: Testing Library configuration will be handled in individual test files

// Mock console methods to reduce noise in tests
global.console = {
	...console,
	// Uncomment to ignore specific console methods during tests
	// log: vi.fn(),
	// warn: vi.fn(),
	// error: vi.fn(),
}

// Set up global test utilities
;(global as any).testUtils = {
	waitFor: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}

// Alternative React initialization approach
// Instead of trying to force initialize React in setup,
// we'll let each test handle React initialization properly
beforeAll(() => {
	console.log("🔧 Setting up test environment...")
})

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks()
})
