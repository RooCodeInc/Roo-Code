import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { ChatContextBar } from "../ChatContextBar"
import { MentionInfo } from "../lexical/LexicalMentionPlugin"

describe("ChatContextBar", () => {
	const mockMentions: MentionInfo[] = [
		{
			displayName: "test-file.ts",
			icon: "data:image/svg+xml;base64,test",
			type: "file",
			path: "/test-file.ts",
		},
		{
			displayName: "src",
			icon: "data:image/svg+xml;base64,folder",
			type: "folder",
			path: "/src/",
		},
	]

	const mockImages = ["data:image/png;base64,test1", "data:image/png;base64,test2"]

	const defaultProps = {
		validMentions: [],
		selectedImages: [],
		onRemoveMention: vi.fn(),
		onRemoveImage: vi.fn(),
	}

	it("should not render when no mentions or images", () => {
		const { container } = render(<ChatContextBar {...defaultProps} />)
		expect(container.firstChild).toBeNull()
	})

	it("should render mentions with unified styling", () => {
		render(<ChatContextBar {...defaultProps} validMentions={mockMentions} />)

		expect(screen.getByText("test-file.ts")).toBeInTheDocument()
		expect(screen.getByText("src")).toBeInTheDocument()

		// Check that both mentions have the same styling classes
		const mentionElements = screen.getAllByText(/test-file\.ts|src/).map((el) => el.closest("div"))
		mentionElements.forEach((element) => {
			expect(element).toHaveClass("bg-vscode-input-background")
			expect(element).toHaveClass("text-vscode-input-foreground")
			expect(element).toHaveClass("rounded")
			expect(element).toHaveClass("text-xs")
		})
	})

	it("should render images with unified styling", () => {
		render(<ChatContextBar {...defaultProps} selectedImages={mockImages} />)

		expect(screen.getByText("Image #1")).toBeInTheDocument()
		expect(screen.getByText("Image #2")).toBeInTheDocument()

		// Check that both images have the same styling classes as mentions
		const imageElements = screen.getAllByText(/Image #[12]/).map((el) => el.closest("div"))
		imageElements.forEach((element) => {
			expect(element).toHaveClass("bg-vscode-input-background")
			expect(element).toHaveClass("text-vscode-input-foreground")
			expect(element).toHaveClass("rounded")
			expect(element).toHaveClass("text-xs")
		})
	})

	it("should show remove button on hover for mentions", () => {
		render(<ChatContextBar {...defaultProps} validMentions={mockMentions} />)

		const mentionElement = screen.getByText("test-file.ts").closest("div")!
		fireEvent.mouseEnter(mentionElement)

		// Should show X button instead of icon
		expect(screen.getByRole("button")).toBeInTheDocument()
	})

	it("should show remove button on hover for images", () => {
		render(<ChatContextBar {...defaultProps} selectedImages={mockImages} />)

		const imageElement = screen.getByText("Image #1").closest("div")!
		fireEvent.mouseEnter(imageElement)

		// Should show X button instead of image
		expect(screen.getByRole("button")).toBeInTheDocument()
	})

	it("should call onRemoveMention when mention remove button is clicked", () => {
		const onRemoveMention = vi.fn()
		render(<ChatContextBar {...defaultProps} validMentions={mockMentions} onRemoveMention={onRemoveMention} />)

		const mentionElement = screen.getByText("test-file.ts").closest("div")!
		fireEvent.mouseEnter(mentionElement)

		const removeButton = screen.getByRole("button")
		fireEvent.click(removeButton)

		expect(onRemoveMention).toHaveBeenCalledWith(0)
	})

	it("should call onRemoveImage when image remove button is clicked", () => {
		const onRemoveImage = vi.fn()
		render(<ChatContextBar {...defaultProps} selectedImages={mockImages} onRemoveImage={onRemoveImage} />)

		const imageElement = screen.getByText("Image #1").closest("div")!
		fireEvent.mouseEnter(imageElement)

		const removeButton = screen.getByRole("button")
		fireEvent.click(removeButton)

		expect(onRemoveImage).toHaveBeenCalledWith(0)
	})

	it("should render both mentions and images together", () => {
		render(<ChatContextBar {...defaultProps} validMentions={mockMentions} selectedImages={mockImages} />)

		expect(screen.getByText("test-file.ts")).toBeInTheDocument()
		expect(screen.getByText("src")).toBeInTheDocument()
		expect(screen.getByText("Image #1")).toBeInTheDocument()
		expect(screen.getByText("Image #2")).toBeInTheDocument()
	})
})
