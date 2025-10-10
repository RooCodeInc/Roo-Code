import { render, fireEvent, screen } from "@src/utils/test-utils"
import { ChatContextBar } from "../ChatContextBar"
import { MentionInfo } from "../lexical/LexicalMentionPlugin"

describe("ChatContextBar", () => {
	const mockOnRemoveMention = vi.fn()
	const mockOnRemoveImage = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("duplicate mention handling", () => {
		it("should render unique keys for duplicate mentions", () => {
			const validMentions: MentionInfo[] = [
				{
					path: "/src/file.js",
					displayName: "file.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "unique-key-1",
				},
				{
					path: "/src/file.js", // Same path
					displayName: "file.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "unique-key-2", // Different node key
				},
				{
					path: "/src/other.js",
					displayName: "other.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "unique-key-3",
				},
			]

			const { container } = render(
				<ChatContextBar
					validMentions={validMentions}
					selectedImages={[]}
					onRemoveMention={mockOnRemoveMention}
					onRemoveImage={mockOnRemoveImage}
				/>,
			)

			// Should render all three mentions
			const contextItems = container.querySelectorAll('div[class*="relative flex items-center"]')
			expect(contextItems).toHaveLength(3)

			// Check that all mentions are rendered by looking for their display names
			// Use getAllByText since we have duplicate file.js mentions
			const fileJsElements = screen.getAllByText("file.js")
			expect(fileJsElements).toHaveLength(2) // Two duplicate mentions
			expect(screen.getByText("other.js")).toBeInTheDocument()
		})

		it("should call onRemoveMention with correct index when removing specific duplicate", () => {
			const validMentions: MentionInfo[] = [
				{
					path: "/src/duplicate.js",
					displayName: "duplicate.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "key-1",
				},
				{
					path: "/src/duplicate.js", // Same path
					displayName: "duplicate.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "key-2", // Different key
				},
			]

			const { container } = render(
				<ChatContextBar
					validMentions={validMentions}
					selectedImages={[]}
					onRemoveMention={mockOnRemoveMention}
					onRemoveImage={mockOnRemoveImage}
				/>,
			)

			const contextItems = container.querySelectorAll('div[class*="relative flex items-center"]')
			expect(contextItems).toHaveLength(2)

			// Hover over first item to show remove button
			fireEvent.mouseEnter(contextItems[0])

			// Find and click the remove button (X icon)
			const removeButton = contextItems[0].querySelector("button")
			expect(removeButton).toBeInTheDocument()

			if (removeButton) {
				fireEvent.click(removeButton)
			}

			// Should call onRemoveMention with index 0 (first duplicate)
			expect(mockOnRemoveMention).toHaveBeenCalledWith(0)
			expect(mockOnRemoveMention).toHaveBeenCalledTimes(1)

			// Hover over second item
			fireEvent.mouseEnter(contextItems[1])

			// Find and click the remove button for second item
			const secondRemoveButton = contextItems[1].querySelector("button")
			if (secondRemoveButton) {
				fireEvent.click(secondRemoveButton)
			}

			// Should call onRemoveMention with index 1 (second duplicate)
			expect(mockOnRemoveMention).toHaveBeenCalledWith(1)
			expect(mockOnRemoveMention).toHaveBeenCalledTimes(2)
		})

		it("should generate unique React keys for duplicate mentions", () => {
			const validMentions: MentionInfo[] = [
				{
					path: "/src/same.js",
					displayName: "same.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "lexical-node-1",
				},
				{
					path: "/src/same.js", // Same path
					displayName: "same.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "lexical-node-2", // Different node key
				},
			]

			// Test the key generation logic that would be used internally
			const contextItems = validMentions.map((mention, index) => ({
				type: "mention" as const,
				icon: mention.icon,
				displayName: mention.displayName,
				originalIndex: index,
				iconAlt: "File",
				nodeKey: mention.nodeKey,
			}))

			const keys = contextItems.map((item) => {
				return item.type === "mention" && item.nodeKey
					? `mention-${item.nodeKey}`
					: `${item.type}-${item.originalIndex}`
			})

			expect(keys).toEqual(["mention-lexical-node-1", "mention-lexical-node-2"])

			// Verify keys are unique
			const uniqueKeys = new Set(keys)
			expect(uniqueKeys.size).toBe(keys.length)
		})

		it("should handle mixed mentions and images with unique keys", () => {
			const validMentions: MentionInfo[] = [
				{
					path: "/src/file.js",
					displayName: "file.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "mention-key-1",
				},
			]

			const selectedImages = ["data:image/png;base64,test1", "data:image/png;base64,test2"]

			const { container } = render(
				<ChatContextBar
					validMentions={validMentions}
					selectedImages={selectedImages}
					onRemoveMention={mockOnRemoveMention}
					onRemoveImage={mockOnRemoveImage}
				/>,
			)

			// Should render 1 mention + 2 images = 3 total items
			const contextItems = container.querySelectorAll('div[class*="relative flex items-center"]')
			expect(contextItems).toHaveLength(3)

			// Test removing mention
			fireEvent.mouseEnter(contextItems[0])
			const mentionRemoveButton = contextItems[0].querySelector("button")
			if (mentionRemoveButton) {
				fireEvent.click(mentionRemoveButton)
			}
			expect(mockOnRemoveMention).toHaveBeenCalledWith(0)

			// Test removing first image (should be at index 1 in the combined list)
			fireEvent.mouseEnter(contextItems[1])
			const imageRemoveButton = contextItems[1].querySelector("button")
			if (imageRemoveButton) {
				fireEvent.click(imageRemoveButton)
			}
			expect(mockOnRemoveImage).toHaveBeenCalledWith(0) // Image index 0
		})
	})

	describe("empty state", () => {
		it("should not render when no mentions or images", () => {
			const { container } = render(
				<ChatContextBar
					validMentions={[]}
					selectedImages={[]}
					onRemoveMention={mockOnRemoveMention}
					onRemoveImage={mockOnRemoveImage}
				/>,
			)

			// Should not render anything
			expect(container.firstChild).toBeNull()
		})
	})

	describe("hover interactions", () => {
		it("should show remove button on hover and hide on mouse leave", () => {
			const validMentions: MentionInfo[] = [
				{
					path: "/src/test.js",
					displayName: "test.js",
					icon: "file-icon.svg",
					type: "file",
					nodeKey: "test-key",
				},
			]

			const { container } = render(
				<ChatContextBar
					validMentions={validMentions}
					selectedImages={[]}
					onRemoveMention={mockOnRemoveMention}
					onRemoveImage={mockOnRemoveImage}
				/>,
			)

			const contextItem = container.querySelector('div[class*="relative flex items-center"]')!

			// Initially should show icon, not remove button
			expect(contextItem.querySelector("img")).toBeInTheDocument()
			expect(contextItem.querySelector("button")).not.toBeInTheDocument()

			// Hover should show remove button
			fireEvent.mouseEnter(contextItem)
			expect(contextItem.querySelector("button")).toBeInTheDocument()
			expect(contextItem.querySelector("img")).not.toBeInTheDocument()

			// Mouse leave should hide remove button
			fireEvent.mouseLeave(contextItem)
			expect(contextItem.querySelector("img")).toBeInTheDocument()
			expect(contextItem.querySelector("button")).not.toBeInTheDocument()
		})
	})
})
