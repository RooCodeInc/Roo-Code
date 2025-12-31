// Manual test for parseThemeString function
// This tests the JSON parsing with comments and trailing commas

const testCases = [
	{
		name: "JSON with comment lines",
		input: `{
  "name": "Test Theme",
  // This is a comment
  "colors": {
    "background": "#000000"
  }
}`,
		shouldParse: true,
	},
	{
		name: "JSON with trailing comma after comment removal",
		input: `{
  "name": "Test Theme",
  "colors": {
    "background": "#000000",
    // Comment here causes trailing comma
  }
}`,
		shouldParse: true,
	},
	{
		name: "JSON with multiple trailing commas",
		input: `{
  "name": "Test Theme",
  // Comment 1
  "colors": {
    "background": "#000000",
    // Comment 2
  },
  // Comment 3
}`,
		shouldParse: true,
	},
	{
		name: "Valid JSON without comments",
		input: `{
  "name": "Test Theme",
  "colors": {
    "background": "#000000"
  }
}`,
		shouldParse: true,
	},
]

function parseThemeString(themeString: string | undefined): any {
	if (!themeString) {
		return {}
	}

	// Remove comment lines
	const withoutComments = themeString
		.split("\n")
		.filter((line) => {
			return !line.trim().startsWith("//")
		})
		.join("\n")

	// Remove trailing commas before closing braces/brackets
	// This handles cases where removing comments leaves trailing commas
	const cleaned = withoutComments.replace(/,(\s*[}\]])/g, "$1")

	try {
		return JSON.parse(cleaned)
	} catch (e) {
		console.error("Error parsing theme string:", e)
		console.error("Cleaned theme string:", cleaned)
		return {}
	}
}

describe("parseThemeString", () => {
	testCases.forEach(({ name, input, shouldParse }) => {
		it(name, () => {
			const result = parseThemeString(input)
			if (shouldParse) {
				expect(result).toBeDefined()
				expect(result).not.toEqual({})
				expect(result.name).toBe("Test Theme")
			} else {
				expect(result).toEqual({})
			}
		})
	})

	it("should return empty object for undefined input", () => {
		const result = parseThemeString(undefined)
		expect(result).toEqual({})
	})

	it("should return empty object for empty string", () => {
		const result = parseThemeString("")
		expect(result).toEqual({})
	})
})
