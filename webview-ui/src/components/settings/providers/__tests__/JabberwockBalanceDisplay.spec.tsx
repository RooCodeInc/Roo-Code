import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { JabberwockBalanceDisplay } from "../JabberwockBalanceDisplay"

// Mock the hooks
vi.mock("@/components/ui/hooks/useJabberwockCreditBalance", () => ({
	useJabberwockCreditBalance: vi.fn(),
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

import { useJabberwockCreditBalance } from "@/components/ui/hooks/useJabberwockCreditBalance"
import { useExtensionState } from "@src/context/ExtensionStateContext"

describe("JabberwockBalanceDisplay", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		;(useExtensionState as any).mockReturnValue({
			cloudApiUrl: undefined,
		})
	})

	it("should render balance formatted to 2 decimal places", () => {
		;(useJabberwockCreditBalance as any).mockReturnValue({
			data: 12.34,
			isLoading: false,
			error: null,
		})

		render(<JabberwockBalanceDisplay />)

		expect(screen.getByText("$12.34")).toBeInTheDocument()
	})

	it("should format balance to 2 decimal places when value has 1 decimal", () => {
		;(useJabberwockCreditBalance as any).mockReturnValue({
			data: 7.8,
			isLoading: false,
			error: null,
		})

		render(<JabberwockBalanceDisplay />)

		expect(screen.getByText("$7.80")).toBeInTheDocument()
	})

	it("should format whole numbers with 2 decimal places", () => {
		;(useJabberwockCreditBalance as any).mockReturnValue({
			data: 5,
			isLoading: false,
			error: null,
		})

		render(<JabberwockBalanceDisplay />)

		expect(screen.getByText("$5.00")).toBeInTheDocument()
	})

	it("should return null when balance is null", () => {
		;(useJabberwockCreditBalance as any).mockReturnValue({
			data: null,
			isLoading: false,
			error: null,
		})

		const { container } = render(<JabberwockBalanceDisplay />)

		expect(container.firstChild).toBeNull()
	})

	it("should return null when balance is undefined", () => {
		;(useJabberwockCreditBalance as any).mockReturnValue({
			data: undefined,
			isLoading: false,
			error: null,
		})

		const { container } = render(<JabberwockBalanceDisplay />)

		expect(container.firstChild).toBeNull()
	})

	it("should return null when there is an error", () => {
		;(useJabberwockCreditBalance as any).mockReturnValue({
			data: null,
			isLoading: false,
			error: "Failed to fetch balance",
		})

		const { container } = render(<JabberwockBalanceDisplay />)

		expect(container.firstChild).toBeNull()
	})

	it("should render when balance is zero", () => {
		;(useJabberwockCreditBalance as any).mockReturnValue({
			data: 0,
			isLoading: false,
			error: null,
		})

		render(<JabberwockBalanceDisplay />)

		expect(screen.getByText("$0.00")).toBeInTheDocument()
	})
})
