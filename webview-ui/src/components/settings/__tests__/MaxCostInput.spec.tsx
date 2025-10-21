import { render, screen, fireEvent } from "@testing-library/react"
import { ReactElement } from "react"
import { MaxCostInput } from "../MaxCostInput"

// Wrapper component to provide React context
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
	return children as ReactElement
}

// Custom render function with React context
const customRender = (ui: ReactElement, options = {}) => render(ui, { wrapper: TestWrapper, ...options })

vi.mock("@/utils/vscode", () => ({
	vscode: { postMessage: vi.fn() },
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => {
		const translations: Record<string, string> = {
			"settings:autoApprove.apiCostLimit.title": "Max API Cost",
			"settings:autoApprove.apiCostLimit.unlimited": "Unlimited",
		}
		return { t: (key: string) => translations[key] || key }
	},
}))

describe("MaxCostInput", () => {
	const mockOnValueChange = vi.fn()

	beforeEach(() => {
		mockOnValueChange.mockClear()
	})

	it("shows empty input when allowedMaxCost is undefined", () => {
		customRender(<MaxCostInput allowedMaxCost={undefined} onValueChange={mockOnValueChange} />)

		const input = screen.getByPlaceholderText("Unlimited")
		expect(input).toHaveValue("")
	})

	it("shows formatted cost value when allowedMaxCost is provided", () => {
		customRender(<MaxCostInput allowedMaxCost={5.5} onValueChange={mockOnValueChange} />)

		const input = screen.getByPlaceholderText("Unlimited")
		expect(input).toHaveValue("5.5")
	})

	it("calls onValueChange when input changes", () => {
		customRender(<MaxCostInput allowedMaxCost={undefined} onValueChange={mockOnValueChange} />)

		const input = screen.getByPlaceholderText("Unlimited")
		fireEvent.input(input, { target: { value: "10.25" } })

		expect(mockOnValueChange).toHaveBeenCalledWith(10.25)
	})

	it("calls onValueChange with undefined when input is cleared", () => {
		customRender(<MaxCostInput allowedMaxCost={5.0} onValueChange={mockOnValueChange} />)

		const input = screen.getByPlaceholderText("Unlimited")
		fireEvent.input(input, { target: { value: "" } })

		expect(mockOnValueChange).toHaveBeenCalledWith(undefined)
	})

	it("handles decimal input correctly", () => {
		customRender(<MaxCostInput allowedMaxCost={undefined} onValueChange={mockOnValueChange} />)

		const input = screen.getByPlaceholderText("Unlimited")
		fireEvent.input(input, { target: { value: "2.99" } })

		expect(mockOnValueChange).toHaveBeenCalledWith(2.99)
	})

	it("accepts zero as a valid value", () => {
		customRender(<MaxCostInput allowedMaxCost={undefined} onValueChange={mockOnValueChange} />)

		const input = screen.getByPlaceholderText("Unlimited")
		fireEvent.input(input, { target: { value: "0" } })

		expect(mockOnValueChange).toHaveBeenCalledWith(0)
	})

	it("allows typing decimal values starting with zero", () => {
		customRender(<MaxCostInput allowedMaxCost={undefined} onValueChange={mockOnValueChange} />)

		const input = screen.getByPlaceholderText("Unlimited")
		fireEvent.input(input, { target: { value: "0.15" } })

		expect(mockOnValueChange).toHaveBeenCalledWith(0.15)
	})
})
