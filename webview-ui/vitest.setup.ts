import "@testing-library/jest-dom"
import { vi, afterEach, beforeAll } from "vitest"
import { cleanup } from "@testing-library/react"
import { configure } from "@testing-library/react"

// Configure React Testing Library
configure({
	testIdAttribute: "data-testid",
	asyncUtilTimeout: 5000,
})

// Setup React DOM environment for tests
beforeAll(() => {
	// Ensure React DOM is properly initialized
	Object.defineProperty(window, "requestAnimationFrame", {
		writable: true,
		value: vi.fn((cb) => setTimeout(cb, 0)),
	})

	// Mock React DOM's render method to ensure proper initialization
	const { createRoot } = require("react-dom/client")
	vi.mock("react-dom/client", () => ({
		createRoot: vi.fn(() => ({
			render: vi.fn(),
			unmount: vi.fn(),
		})),
	}))

	// Mock react-i18next to avoid translation issues in tests
	vi.mock("react-i18next", () => ({
		useTranslation: () => ({
			t: (str: string) => str,
			i18n: {
				changeLanguage: vi.fn(),
				language: "en",
			},
		}),
		initReactI18next: vi.fn(),
	}))
})

// Cleanup after each test
afterEach(() => {
	cleanup()
})

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

// Mock ResizeObserver
class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

// Fix for Microsoft FAST Foundation compatibility with JSDOM
Object.defineProperty(HTMLElement.prototype, "focus", {
	get: function () {
		return (
			this._focus ||
			function () {
				// Mock focus behavior for tests
			}
		)
	},
	set: function (value) {
		this._focus = value
	},
	configurable: true,
})
