import { render, screen, fireEvent } from "@testing-library/react"
import { ReactNode } from "react"

import { TooltipProvider } from "@/components/ui"

import { ResetToDefault } from "../ResetToDefault"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string }) =>
			options?.defaultValue ? `${key} (${JSON.stringify(options)})` : key,
	}),
}))

// Wrapper component to provide TooltipProvider context
const TestWrapper = ({ children }: { children: ReactNode }) => <TooltipProvider>{children}</TooltipProvider>

const renderWithWrapper = (ui: ReactNode) => render(ui, { wrapper: TestWrapper })

describe("ResetToDefault", () => {
	const mockOnReset = vi.fn()

	beforeEach(() => {
		mockOnReset.mockClear()
	})

	describe("visibility", () => {
		it("should not render when currentValue matches default", () => {
			// browserToolEnabled defaults to true in settingDefaults
			const { container } = render(
				<ResetToDefault settingKey="browserToolEnabled" currentValue={true} onReset={mockOnReset} />,
			)

			expect(container.firstChild).toBeNull()
		})

		it("should not render when currentValue is undefined (using default)", () => {
			const { container } = render(
				<ResetToDefault settingKey="browserToolEnabled" currentValue={undefined} onReset={mockOnReset} />,
			)

			expect(container.firstChild).toBeNull()
		})

		it("should render when currentValue differs from default (boolean)", () => {
			// browserToolEnabled defaults to true, so false should show reset button
			renderWithWrapper(
				<ResetToDefault settingKey="browserToolEnabled" currentValue={false} onReset={mockOnReset} />,
			)

			expect(screen.getByTestId("reset-browserToolEnabled")).toBeInTheDocument()
		})

		it("should render when currentValue differs from default (number)", () => {
			// screenshotQuality defaults to 75
			renderWithWrapper(<ResetToDefault settingKey="screenshotQuality" currentValue={50} onReset={mockOnReset} />)

			expect(screen.getByTestId("reset-screenshotQuality")).toBeInTheDocument()
		})

		it("should render when currentValue differs from default (string)", () => {
			// browserViewportSize defaults to "900x600"
			renderWithWrapper(
				<ResetToDefault settingKey="browserViewportSize" currentValue="1280x800" onReset={mockOnReset} />,
			)

			expect(screen.getByTestId("reset-browserViewportSize")).toBeInTheDocument()
		})
	})

	describe("functionality", () => {
		it("should call onReset when clicked", () => {
			renderWithWrapper(
				<ResetToDefault settingKey="browserToolEnabled" currentValue={false} onReset={mockOnReset} />,
			)

			fireEvent.click(screen.getByTestId("reset-browserToolEnabled"))

			expect(mockOnReset).toHaveBeenCalledTimes(1)
		})

		it("should have the correct aria role (button)", () => {
			renderWithWrapper(<ResetToDefault settingKey="screenshotQuality" currentValue={50} onReset={mockOnReset} />)

			expect(screen.getByRole("button")).toBeInTheDocument()
		})
	})

	describe("custom className", () => {
		it("should apply custom className when provided", () => {
			renderWithWrapper(
				<ResetToDefault
					settingKey="browserToolEnabled"
					currentValue={false}
					onReset={mockOnReset}
					className="custom-class"
				/>,
			)

			const button = screen.getByTestId("reset-browserToolEnabled")
			expect(button).toHaveClass("custom-class")
		})

		it("should use default className when not provided", () => {
			renderWithWrapper(
				<ResetToDefault settingKey="browserToolEnabled" currentValue={false} onReset={mockOnReset} />,
			)

			const button = screen.getByTestId("reset-browserToolEnabled")
			expect(button).toHaveClass("h-6", "w-6", "p-1")
		})
	})
})
