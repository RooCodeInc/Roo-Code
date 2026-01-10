// npx vitest services/tree-sitter/__tests__/tree-disposal.spec.ts

vi.mock("fs/promises", () => ({
	readFile: vi.fn().mockResolvedValue("function x() {}"),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
}))

vi.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: vi.fn(),
}))

import { parseSourceCodeDefinitionsForFile } from "../index"

describe("tree-sitter tree disposal", () => {
	it("should delete parse trees after extracting captures", async () => {
		const deleteSpy = vi.fn()
		const mockTree = {
			rootNode: {},
			delete: deleteSpy,
		}

		const mockLanguageParsers = {
			ts: {
				parser: {
					parse: vi.fn().mockReturnValue(mockTree),
				},
				query: {
					captures: vi.fn().mockReturnValue([]),
				},
			},
		}

		const { loadRequiredLanguageParsers } = await import("../languageParser")
		;(loadRequiredLanguageParsers as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
			mockLanguageParsers,
		)

		await parseSourceCodeDefinitionsForFile("/test/file.ts")
		expect(deleteSpy).toHaveBeenCalledTimes(1)
	})
})
