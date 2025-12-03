import { detectCodeOmission } from "../detect-omission"

describe("detectCodeOmission", () => {
	const originalContent = `function example() {
  // Some code
  const x = 1;
  const y = 2;
  return x + y;
}`

	// Generate content with a specified number of lines (100+ lines triggers detection)
	const generateLongContent = (commentLine: string, length: number = 110) => {
		return `${commentLine}
	${Array.from({ length }, (_, i) => `const x${i} = ${i};`).join("\n")}
	const y = 2;`
	}

	it("should skip comment checks for files under 100 lines", () => {
		const newContent = `// Lines 1-50 remain unchanged
const z = 3;`
		expect(detectCodeOmission(originalContent, newContent)).toBe(false)
	})

	it("should not detect regular comments without omission keywords", () => {
		const newContent = generateLongContent("// Adding new functionality")
		expect(detectCodeOmission(originalContent, newContent)).toBe(false)
	})

	it("should not detect when comment is part of original content", () => {
		const originalWithComment = `// Content remains unchanged
${originalContent}`
		const newContent = generateLongContent("// Content remains unchanged")
		expect(detectCodeOmission(originalWithComment, newContent)).toBe(false)
	})

	it("should not detect code that happens to contain omission keywords", () => {
		const newContent = generateLongContent(`const remains = 'some value';
const unchanged = true;`)
		expect(detectCodeOmission(originalContent, newContent)).toBe(false)
	})

	it("should detect suspicious single-line comment for files with 100+ lines", () => {
		const newContent = generateLongContent("// Previous content remains here\nconst x = 1;")
		expect(detectCodeOmission(originalContent, newContent)).toBe(true)
	})

	it("should detect suspicious Python-style comment for files with 100+ lines", () => {
		const newContent = generateLongContent("# Previous content remains here\nconst x = 1;")
		expect(detectCodeOmission(originalContent, newContent)).toBe(true)
	})

	it("should detect suspicious multi-line comment for files with 100+ lines", () => {
		const newContent = generateLongContent("/* Previous content remains the same */\nconst x = 1;")
		expect(detectCodeOmission(originalContent, newContent)).toBe(true)
	})

	it("should detect suspicious JSX comment for files with 100+ lines", () => {
		const newContent = generateLongContent("{/* Rest of the code remains the same */}\nconst x = 1;")
		expect(detectCodeOmission(originalContent, newContent)).toBe(true)
	})

	it("should detect suspicious HTML comment for files with 100+ lines", () => {
		const newContent = generateLongContent("<!-- Existing content unchanged -->\nconst x = 1;")
		expect(detectCodeOmission(originalContent, newContent)).toBe(true)
	})

	it("should detect suspicious square bracket notation for files with 100+ lines", () => {
		const newContent = generateLongContent(
			"[Previous content from line 1-305 remains exactly the same]\nconst x = 1;",
		)
		expect(detectCodeOmission(originalContent, newContent)).toBe(true)
	})

	it("should not flag legitimate comments in files with 100+ lines when in original", () => {
		const originalWithComment = `// This is a legitimate comment that remains here
${originalContent}`
		const newContent = generateLongContent("// This is a legitimate comment that remains here")
		expect(detectCodeOmission(originalWithComment, newContent)).toBe(false)
	})
})
