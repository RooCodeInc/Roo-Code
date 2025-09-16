import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { hasConsent, dispatchConsentEvent, onConsentChange, CONSENT_EVENT } from "../consent-manager"

describe("Consent Manager", () => {
	let cookieSpy: vi.SpyInstance

	beforeEach(() => {
		// Mock document.cookie to control its value in tests
		cookieSpy = vi.spyOn(document, "cookie", "get")

		// Clear mock history before each test
		vi.clearAllMocks()
	})

	afterEach(() => {
		// Restore the original document.cookie property
		vi.restoreAllMocks()
	})

	describe("hasConsent", () => {
		it("should return false when no consent cookie exists", () => {
			cookieSpy.mockReturnValue("")
			expect(hasConsent()).toBe(false)
		})

		it('should return false when consent cookie is not "true"', () => {
			cookieSpy.mockReturnValue("roo-code-cookie-consent=false")
			expect(hasConsent()).toBe(false)
		})

		it('should return true when consent cookie is "true"', () => {
			cookieSpy.mockReturnValue("roo-code-cookie-consent=true")
			expect(hasConsent()).toBe(true)
		})

		it("should handle multiple cookies correctly", () => {
			cookieSpy.mockReturnValue("other-cookie=value; roo-code-cookie-consent=true; another-cookie=value2")
			expect(hasConsent()).toBe(true)
		})

		it("should handle cookies with spaces correctly", () => {
			cookieSpy.mockReturnValue("other-cookie=value;  roo-code-cookie-consent=true  ; another-cookie=value2")
			expect(hasConsent()).toBe(true)
		})
	})

	describe("dispatchConsentEvent", () => {
		it("should dispatch a custom event with consented=true", () => {
			const eventListener = vi.fn()
			window.addEventListener(CONSENT_EVENT, eventListener)

			dispatchConsentEvent(true)

			expect(eventListener).toHaveBeenCalledTimes(1)
			const event = eventListener.mock.calls[0][0] as CustomEvent
			expect(event.detail).toEqual({ consented: true })

			window.removeEventListener(CONSENT_EVENT, eventListener)
		})

		it("should dispatch a custom event with consented=false", () => {
			const eventListener = vi.fn()
			window.addEventListener(CONSENT_EVENT, eventListener)

			dispatchConsentEvent(false)

			expect(eventListener).toHaveBeenCalledTimes(1)
			const event = eventListener.mock.calls[0][0] as CustomEvent
			expect(event.detail).toEqual({ consented: false })

			window.removeEventListener(CONSENT_EVENT, eventListener)
		})
	})

	describe("onConsentChange", () => {
		it("should register a listener for consent changes", () => {
			const callback = vi.fn()
			const unsubscribe = onConsentChange(callback)

			// Dispatch a consent event
			dispatchConsentEvent(true)
			expect(callback).toHaveBeenCalledWith(true)

			// Dispatch another event
			dispatchConsentEvent(false)
			expect(callback).toHaveBeenCalledWith(false)
			expect(callback).toHaveBeenCalledTimes(2)

			// Cleanup
			unsubscribe()
		})

		it("should unsubscribe when cleanup function is called", () => {
			const callback = vi.fn()
			const unsubscribe = onConsentChange(callback)

			// Initial event should be received
			dispatchConsentEvent(true)
			expect(callback).toHaveBeenCalledTimes(1)

			// Unsubscribe
			unsubscribe()

			// This event should not be received
			dispatchConsentEvent(false)
			expect(callback).toHaveBeenCalledTimes(1) // Still 1, not 2
		})

		it("should handle multiple listeners independently", () => {
			const callback1 = vi.fn()
			const callback2 = vi.fn()

			const unsubscribe1 = onConsentChange(callback1)
			const unsubscribe2 = onConsentChange(callback2)

			dispatchConsentEvent(true)
			expect(callback1).toHaveBeenCalledWith(true)
			expect(callback2).toHaveBeenCalledWith(true)

			// Unsubscribe first listener
			unsubscribe1()

			dispatchConsentEvent(false)
			expect(callback1).toHaveBeenCalledTimes(1) // Should not receive second event
			expect(callback2).toHaveBeenCalledTimes(2) // Should receive both events

			// Cleanup
			unsubscribe2()
		})
	})
})
