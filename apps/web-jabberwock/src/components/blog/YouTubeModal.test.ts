import { describe, it, expect } from "vitest"
import { extractYouTubeVideoId, extractYouTubeTimestamp, isYouTubeUrl } from "./YouTubeModal"

describe("isYouTubeUrl", () => {
	it("should return true for youtube.com/watch URLs", () => {
		expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
		expect(isYouTubeUrl("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
		expect(isYouTubeUrl("https://youtube.com/watch?v=abc123_-XYZ")).toBe(true)
	})

	it("should return true for youtu.be URLs", () => {
		expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true)
		expect(isYouTubeUrl("http://youtu.be/abc123_-XYZ")).toBe(true)
	})

	it("should return true for youtube.com/embed URLs", () => {
		expect(isYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(true)
	})

	it("should return true for youtube.com/v URLs", () => {
		expect(isYouTubeUrl("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe(true)
	})

	it("should return false for non-YouTube URLs", () => {
		expect(isYouTubeUrl("https://www.google.com")).toBe(false)
		expect(isYouTubeUrl("https://vimeo.com/123456")).toBe(false)
		expect(isYouTubeUrl("https://example.com/youtube.com")).toBe(false)
	})

	it("should return false for invalid URLs", () => {
		expect(isYouTubeUrl("not a url")).toBe(false)
		expect(isYouTubeUrl("")).toBe(false)
	})
})

describe("extractYouTubeVideoId", () => {
	it("should extract video ID from youtube.com/watch URLs", () => {
		expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
		expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=abc123_-XYZ&list=PLxyz")).toBe("abc123_-XYZ")
		expect(extractYouTubeVideoId("https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
	})

	it("should extract video ID from youtu.be URLs", () => {
		expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
		expect(extractYouTubeVideoId("https://youtu.be/abc123_-XYZ?t=42")).toBe("abc123_-XYZ")
	})

	it("should extract video ID from youtube.com/embed URLs", () => {
		expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
	})

	it("should extract video ID from youtube.com/v URLs", () => {
		expect(extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
	})

	it("should return null for non-YouTube URLs", () => {
		expect(extractYouTubeVideoId("https://www.google.com")).toBeNull()
		expect(extractYouTubeVideoId("https://vimeo.com/123456")).toBeNull()
	})

	it("should return null for invalid URLs", () => {
		expect(extractYouTubeVideoId("not a url")).toBeNull()
		expect(extractYouTubeVideoId("")).toBeNull()
	})
})

describe("extractYouTubeTimestamp", () => {
	describe("numeric timestamps (seconds)", () => {
		it("should extract timestamp in seconds from youtube.com URLs", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")).toBe(42)
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?t=120&v=dQw4w9WgXcQ")).toBe(120)
		})

		it("should extract timestamp from youtu.be URLs", () => {
			expect(extractYouTubeTimestamp("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe(42)
			expect(extractYouTubeTimestamp("https://youtu.be/dQw4w9WgXcQ?t=3600")).toBe(3600)
		})

		it("should extract timestamp from start= URLs", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=42")).toBe(42)
			expect(extractYouTubeTimestamp("https://www.youtube.com/embed/dQw4w9WgXcQ?start=120")).toBe(120)
		})

		it("should extract timestamp from fragment (#t=) URLs", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=42")).toBe(42)
		})
	})

	describe("h/m/s format timestamps", () => {
		it("should parse hours, minutes, and seconds", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s")).toBe(3723) // 1*3600 + 2*60 + 3
		})

		it("should parse minutes and seconds", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2m30s")).toBe(150) // 2*60 + 30
		})

		it("should parse seconds only", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s")).toBe(45)
		})

		it("should parse hours and minutes", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h30m")).toBe(5400) // 1*3600 + 30*60
		})

		it("should parse hours only", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2h")).toBe(7200) // 2*3600
		})

		it("should be case-insensitive", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1H2M3S")).toBe(3723)
		})
	})

	describe("colon-separated timestamps", () => {
		it("should parse mm:ss format", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1:23")).toBe(83)
		})

		it("should parse hh:mm:ss format", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1:02:03")).toBe(3723)
		})
	})

	describe("edge cases", () => {
		it("should return 0 when no timestamp is present", () => {
			expect(extractYouTubeTimestamp("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(0)
			expect(extractYouTubeTimestamp("https://youtu.be/dQw4w9WgXcQ")).toBe(0)
		})

		it("should return 0 for non-YouTube URLs", () => {
			expect(extractYouTubeTimestamp("https://www.google.com")).toBe(0)
		})

		it("should return 0 for invalid URLs", () => {
			expect(extractYouTubeTimestamp("not a url")).toBe(0)
			expect(extractYouTubeTimestamp("")).toBe(0)
		})
	})
})
