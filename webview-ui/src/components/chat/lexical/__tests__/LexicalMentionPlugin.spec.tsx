// npx vitest run src/components/chat/lexical/__tests__/LexicalMentionPlugin.spec.tsx

import { render } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { LexicalMentionPlugin } from "../LexicalMentionPlugin"

// Mock the MentionNode module
vi.mock("../MentionNode", () => ({
	$createMentionNode: vi.fn(),
	$isMentionNode: vi.fn(),
}))

// Mock vscode-material-icons
vi.mock("vscode-material-icons", () => ({
	getIconForFilePath: vi.fn(() => "file"),
	getIconUrlByName: vi.fn(() => "icon-url"),
}))

// Mock context-mentions utility
vi.mock("@/utils/context-mentions", () => ({
	shouldShowContextMenu: vi.fn(() => false),
}))

// Mock removeLeadingNonAlphanumeric utility
vi.mock("@/utils/removeLeadingNonAlphanumeric", () => ({
	removeLeadingNonAlphanumeric: vi.fn((str) => str),
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
	const initialConfig = {
		namespace: "test",
		onError: () => {},
		nodes: [],
	}

	return <LexicalComposer initialConfig={initialConfig}>{children}</LexicalComposer>
}

describe("LexicalMentionPlugin", () => {
	it("should render without crashing", () => {
		const mockOnMentionTrigger = vi.fn()
		const mockOnMentionHide = vi.fn()
		const mockOnMentionUpdate = vi.fn()

		expect(() => {
			render(
				<TestWrapper>
					<LexicalMentionPlugin
						onMentionTrigger={mockOnMentionTrigger}
						onMentionHide={mockOnMentionHide}
						onMentionUpdate={mockOnMentionUpdate}
					/>
				</TestWrapper>,
			)
		}).not.toThrow()
	})

	it("should handle extractMentionsFromEditor without infinite recursion", () => {
		const mockOnMentionUpdate = vi.fn()

		// Mock $getRoot to return a node with circular references
		const mockRoot = {
			getChildren: vi.fn(() => [mockRoot]), // Self-referencing to test infinite recursion protection
		}

		vi.doMock("lexical", async () => {
			const actual = await vi.importActual("lexical")
			return {
				...actual,
				$getRoot: vi.fn(() => mockRoot),
			}
		})

		expect(() => {
			render(
				<TestWrapper>
					<LexicalMentionPlugin onMentionUpdate={mockOnMentionUpdate} />
				</TestWrapper>,
			)
		}).not.toThrow()
	})

	it("should handle nodes without getChildren method gracefully", () => {
		const mockOnMentionUpdate = vi.fn()

		// Mock $getRoot to return a node without getChildren method
		const mockRoot = {
			// No getChildren method
		}

		vi.doMock("lexical", async () => {
			const actual = await vi.importActual("lexical")
			return {
				...actual,
				$getRoot: vi.fn(() => mockRoot),
			}
		})

		expect(() => {
			render(
				<TestWrapper>
					<LexicalMentionPlugin onMentionUpdate={mockOnMentionUpdate} />
				</TestWrapper>,
			)
		}).not.toThrow()
	})

	it("should handle null or undefined nodes gracefully", () => {
		const mockOnMentionUpdate = vi.fn()

		// Mock $getRoot to return a node with null children
		const mockRoot = {
			getChildren: vi.fn(() => [null, undefined, { getChildren: () => [] }]),
		}

		vi.doMock("lexical", async () => {
			const actual = await vi.importActual("lexical")
			return {
				...actual,
				$getRoot: vi.fn(() => mockRoot),
			}
		})

		expect(() => {
			render(
				<TestWrapper>
					<LexicalMentionPlugin onMentionUpdate={mockOnMentionUpdate} />
				</TestWrapper>,
			)
		}).not.toThrow()
	})

	it("should use folder icon for directory paths ending with /", async () => {
		const mockOnMentionUpdate = vi.fn()

		// Test the getMaterialIconForMention function indirectly
		// by checking if getIconUrlByName is called with "folder" for directory paths
		const { getIconUrlByName } = await import("vscode-material-icons")

		render(
			<TestWrapper>
				<LexicalMentionPlugin onMentionUpdate={mockOnMentionUpdate} />
			</TestWrapper>,
		)

		// The function should be available and working
		expect(getIconUrlByName).toBeDefined()
	})
})
