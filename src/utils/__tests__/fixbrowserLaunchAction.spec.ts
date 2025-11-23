import { describe, it, expect, beforeEach } from "vitest"
import { fixBrowserLaunchAction } from "../fixbrowserLaunchAction"

describe("fixBrowserLaunchAction", () => {
	describe("URL only scenarios", () => {
		it("should return 'launch' when only URL is provided without action", () => {
			const params: any = { url: "https://example.com" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
			expect(params.action).toBe("launch")
		})

		it("should return 'launch' when URL is provided and action is undefined", () => {
			const params = { url: "https://test.com", action: undefined }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
			expect(params.action).toBe("launch")
		})

		it("should return 'launch' when URL is provided and action is empty string", () => {
			const params = { url: "https://test.com", action: "" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
			expect(params.action).toBe("launch")
		})
	})

	describe("Action mapping scenarios", () => {
		it("should map 'open_url' to 'launch'", () => {
			const params = { url: "https://example.com", action: "open_url" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'navigate_to' to 'launch'", () => {
			const params = { url: "https://example.com", action: "navigate_to" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'navigateto' to 'launch'", () => {
			const params = { url: "https://example.com", action: "navigateto" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'browse_to' to 'launch'", () => {
			const params = { url: "https://example.com", action: "browse_to" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'browseto' to 'launch'", () => {
			const params = { url: "https://example.com", action: "browseto" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'load' to 'launch'", () => {
			const params = { url: "https://example.com", action: "load" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'jump_to' to 'launch'", () => {
			const params = { url: "https://example.com", action: "jump_to" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'jumpto' to 'launch'", () => {
			const params = { url: "https://example.com", action: "jumpto" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'open' to 'launch'", () => {
			const params = { url: "https://example.com", action: "open" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'navigator' to 'launch'", () => {
			const params = { url: "https://example.com", action: "navigator" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'navigate' to 'launch'", () => {
			const params = { url: "https://example.com", action: "navigate" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should map 'goto' to 'launch'", () => {
			const params = { url: "https://example.com", action: "goto" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
		})

		it("should handle case insensitive mapping", () => {
			const testCases = [
				"OPEN_URL",
				"Navigate_To",
				"NaViGaTeTo",
				"BROWSE_TO",
				"BROWSETO",
				"LOAD",
				"JUMP_TO",
				"JUMPTO",
				"OPEN",
				"NAVIGATOR",
				"NAVIGATE",
				"GOTO",
			]

			testCases.forEach((action) => {
				const params = { url: "https://example.com", action }
				const result = fixBrowserLaunchAction(params)
				expect(result).toBe("launch")
			})
		})
	})

	describe("Valid action scenarios", () => {
		it("should return 'launch' unchanged for valid launch action", () => {
			const params = { url: "https://example.com", action: "launch" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
			expect(params.action).toBe("launch")
		})

		it("should return 'click' unchanged for valid click action", () => {
			const params = { url: "https://example.com", action: "click" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("click")
			expect(params.action).toBe("click")
		})

		it("should return 'type' unchanged for valid type action", () => {
			const params = { url: "https://example.com", action: "type" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("type")
			expect(params.action).toBe("type")
		})

		it("should return 'press' unchanged for valid press action", () => {
			const params = { url: "https://example.com", action: "press" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("press")
			expect(params.action).toBe("press")
		})

		it("should return 'scroll_down' unchanged for valid scroll_down action", () => {
			const params = { url: "https://example.com", action: "scroll_down" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("scroll_down")
			expect(params.action).toBe("scroll_down")
		})

		it("should return 'scroll_up' unchanged for valid scroll_up action", () => {
			const params = { url: "https://example.com", action: "scroll_up" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("scroll_up")
			expect(params.action).toBe("scroll_up")
		})

		it("should return 'hover' unchanged for valid hover action", () => {
			const params = { url: "https://example.com", action: "hover" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("hover")
			expect(params.action).toBe("hover")
		})

		it("should return 'resize' unchanged for valid resize action", () => {
			const params = { url: "https://example.com", action: "resize" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("resize")
			expect(params.action).toBe("resize")
		})

		it("should return 'close' unchanged for valid close action", () => {
			const params = { url: "https://example.com", action: "close" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("close")
			expect(params.action).toBe("close")
		})
	})

	describe("Edge cases", () => {
		it("should handle empty params object", () => {
			const params: any = {}
			const result = fixBrowserLaunchAction(params)

			expect(result).toBeUndefined()
			expect(params.action).toBeUndefined()
		})

		it("should handle null params", () => {
			const params = null
			const result = fixBrowserLaunchAction(params)

			expect(result).toBeUndefined()
		})

		it("should handle undefined params", () => {
			const params = undefined
			const result = fixBrowserLaunchAction(params)

			expect(result).toBeUndefined()
		})

		it("should handle params with action but no URL", () => {
			const params = { action: "navigate_to" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
			expect(params.action).toBe("launch")
		})

		it("should not modify valid actions when URL is not present", () => {
			const params = { action: "click" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("click")
			expect(params.action).toBe("click")
		})

		it("should handle partial similar action names", () => {
			const params = { url: "https://example.com", action: "navigates" }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("navigates")
			expect(params.action).toBe("navigates")
		})

		it("should handle non-string action values", () => {
			const params = { url: "https://example.com", action: 123 }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe(123)
			expect(params.action).toBe(123)
		})
	})

	describe("Integration scenarios", () => {
		it("should handle complex parameter objects", () => {
			const params = {
				url: "https://example.com",
				action: "open_url",
				coordinate: "100,200@800x600",
				text: "test text",
				size: "1280,720",
			}
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
			expect(params.action).toBe("launch")
			expect(params.url).toBe("https://example.com")
			expect(params.coordinate).toBe("100,200@800x600")
			expect(params.text).toBe("test text")
			expect(params.size).toBe("1280,720")
		})

		it("should maintain other properties unchanged", () => {
			const originalParams = {
				url: "https://example.com",
				action: "navigate_to",
				coordinate: "150,250@1024x768",
				text: "Hello World",
				size: "1920,1080",
				extraProperty: "should remain",
			}
			const params = { ...originalParams }
			const result = fixBrowserLaunchAction(params)

			expect(result).toBe("launch")
			expect(params.action).toBe("launch")
			expect(params.url).toBe("https://example.com")
			expect(params.coordinate).toBe("150,250@1024x768")
			expect(params.text).toBe("Hello World")
			expect(params.size).toBe("1920,1080")
			expect(params.extraProperty).toBe("should remain")
		})
	})
})
