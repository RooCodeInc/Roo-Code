import { LOGO_COMPACT, LOGO_MINI, LOGO_WIDE, selectLogoForWidth } from "../logo-data.js"

describe("selectLogoForWidth", () => {
	it("returns wide logo for large terminals", () => {
		expect(selectLogoForWidth(132)).toBe(LOGO_WIDE)
		expect(selectLogoForWidth(200)).toBe(LOGO_WIDE)
	})

	it("returns compact logo for medium terminals", () => {
		expect(selectLogoForWidth(112)).toBe(LOGO_COMPACT)
		expect(selectLogoForWidth(131)).toBe(LOGO_COMPACT)
	})

	it("returns mini logo for narrow terminals", () => {
		expect(selectLogoForWidth(111)).toBe(LOGO_MINI)
		expect(selectLogoForWidth(80)).toBe(LOGO_MINI)
	})
})

describe("logo variant structure", () => {
	it("contains multiline content in each variant", () => {
		expect(LOGO_WIDE.split("\n").length).toBeGreaterThan(8)
		expect(LOGO_COMPACT.split("\n").length).toBeGreaterThan(6)
		expect(LOGO_MINI.split("\n").length).toBe(4)
	})
})
