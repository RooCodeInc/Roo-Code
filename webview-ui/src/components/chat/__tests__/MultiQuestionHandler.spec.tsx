import { render, screen, fireEvent } from "@/utils/test-utils"
import { vi, describe, it, expect, beforeEach } from "vitest"
import TranslationProvider from "@src/i18n/TranslationContext"
import { MultiQuestionHandler } from "../MultiQuestionHandler"

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		language: "en",
	}),
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: {
			t: (key: string, options?: Record<string, any>) => {
				// Mock specific translations used in tests
				if (key === "chat:questions.questionNumberOfTotal" && options) {
					return `Question ${options.current} of ${options.total}`
				}
				if (key === "chat:questions.typeAnswer") return "Type your answer..."
				if (key === "chat:questions.previous") return "Previous"
				if (key === "chat:questions.next") return "Next"
				if (key === "chat:questions.finish") return "Finish"
				return key
			},
			changeLanguage: vi.fn(),
		},
	}),
}))

// Mock translations
vi.mock("@src/i18n/setup", () => ({
	default: {
		t: (key: string, options?: Record<string, any>) => {
			// Mock specific translations used in tests
			if (key === "chat:questions.questionNumberOfTotal" && options) {
				return `Question ${options.current} of ${options.total}`
			}
			if (key === "chat:questions.typeAnswer") return "Type your answer..."
			if (key === "chat:questions.previous") return "Previous"
			if (key === "chat:questions.next") return "Next"
			if (key === "chat:questions.finish") return "Finish"
			return key
		},
		changeLanguage: vi.fn(),
	},
	loadTranslations: vi.fn(),
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
	<TranslationProvider>{children}</TranslationProvider>
)

describe("MultiQuestionHandler", () => {
	const mockOnSendResponse = vi.fn()

	beforeEach(() => {
		mockOnSendResponse.mockClear()
	})

	it("should render single question correctly", () => {
		const questions = ["What is your name?"]
		render(
			<TestWrapper>
				<MultiQuestionHandler questions={questions} onSendResponse={mockOnSendResponse} />
			</TestWrapper>,
		)

		expect(screen.getByText("Question 1 of 1")).toBeInTheDocument()
		expect(screen.getByText("What is your name?")).toBeInTheDocument()
		expect(screen.getByText("Finish")).toBeInTheDocument()
	})

	it("should render multiple questions with navigation", () => {
		const questions = ["What is your name?", "What is your age?"]
		render(
			<TestWrapper>
				<MultiQuestionHandler questions={questions} onSendResponse={mockOnSendResponse} />
			</TestWrapper>,
		)

		expect(screen.getByText("Question 1 of 2")).toBeInTheDocument()
		expect(screen.getByText("What is your name?")).toBeInTheDocument()
		expect(screen.getByText("Next")).toBeInTheDocument()
		expect(screen.queryByText("Previous")).not.toBeInTheDocument()
		expect(screen.queryByText("Finish")).not.toBeInTheDocument()
	})

	it("should navigate between questions without sending responses", () => {
		const questions = ["What is your name?", "What is your age?"]
		render(
			<TestWrapper>
				<MultiQuestionHandler questions={questions} onSendResponse={mockOnSendResponse} />
			</TestWrapper>,
		)

		const textarea = screen.getByPlaceholderText("Type your answer...")
		fireEvent.change(textarea, { target: { value: "John" } })

		const nextButton = screen.getByText("Next")
		fireEvent.click(nextButton)

		expect(screen.getByText("Question 2 of 2")).toBeInTheDocument()
		expect(screen.getByText("What is your age?")).toBeInTheDocument()
		expect(mockOnSendResponse).not.toHaveBeenCalled()

		const previousButton = screen.getByText("Previous")
		fireEvent.click(previousButton)

		expect(screen.getByText("Question 1 of 2")).toBeInTheDocument()
		expect(screen.getByText("What is your name?")).toBeInTheDocument()
		expect(textarea).toHaveValue("John")
		expect(mockOnSendResponse).not.toHaveBeenCalled()
	})

	it("should only send response when Finish is clicked", () => {
		const questions = ["What is your name?", "What is your age?"]
		render(
			<TestWrapper>
				<MultiQuestionHandler questions={questions} onSendResponse={mockOnSendResponse} />
			</TestWrapper>,
		)

		const textarea = screen.getByPlaceholderText("Type your answer...")
		fireEvent.change(textarea, { target: { value: "John" } })

		const nextButton = screen.getByText("Next")
		fireEvent.click(nextButton)

		fireEvent.change(textarea, { target: { value: "25" } })

		const finishButton = screen.getByText("Finish")
		fireEvent.click(finishButton)

		expect(mockOnSendResponse).toHaveBeenCalledTimes(1)
		expect(mockOnSendResponse).toHaveBeenCalledWith(
			"Question: What is your name?\nAnswer: John\n\nQuestion: What is your age?\nAnswer: 25",
		)
	})

	it("should handle skipped questions", () => {
		const questions = ["What is your name?", "What is your age?"]
		render(
			<TestWrapper>
				<MultiQuestionHandler questions={questions} onSendResponse={mockOnSendResponse} />
			</TestWrapper>,
		)

		const nextButton = screen.getByText("Next")
		fireEvent.click(nextButton) // Skip first question

		const textarea = screen.getByPlaceholderText("Type your answer...")
		fireEvent.change(textarea, { target: { value: "25" } })

		const finishButton = screen.getByText("Finish")
		fireEvent.click(finishButton)

		expect(mockOnSendResponse).toHaveBeenCalledWith(
			"Question: What is your name?\nAnswer: (skipped)\n\nQuestion: What is your age?\nAnswer: 25",
		)
	})

	it("should preserve answers when navigating back and forth", () => {
		const questions = ["Q1", "Q2", "Q3"]
		render(
			<TestWrapper>
				<MultiQuestionHandler questions={questions} onSendResponse={mockOnSendResponse} />
			</TestWrapper>,
		)

		const textarea = screen.getByPlaceholderText("Type your answer...")

		// Answer Q1
		fireEvent.change(textarea, { target: { value: "A1" } })
		fireEvent.click(screen.getByText("Next"))

		// Answer Q2
		fireEvent.change(textarea, { target: { value: "A2" } })
		fireEvent.click(screen.getByText("Next"))

		// Go back to Q1
		fireEvent.click(screen.getByText("Previous"))
		fireEvent.click(screen.getByText("Previous"))

		expect(textarea).toHaveValue("A1")

		// Go to Q2
		fireEvent.click(screen.getByText("Next"))
		expect(textarea).toHaveValue("A2")

		expect(mockOnSendResponse).not.toHaveBeenCalled()
	})
})
