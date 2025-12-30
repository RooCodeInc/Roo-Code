import React from "react"

import { render, screen } from "@/utils/test-utils"

import { RateLimitCountdown } from "../RateLimitCountdown"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { seconds?: number }) => {
			if (key === "chat:rateLimit.countdown") {
				return `Rate limiting: ${params?.seconds}s`
			}
			return key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

describe("RateLimitCountdown", () => {
	it("renders with countdown seconds", () => {
		render(<RateLimitCountdown seconds={5} />)

		expect(screen.getByText("Rate limiting: 5s")).toBeInTheDocument()
	})

	it("renders with zero seconds", () => {
		render(<RateLimitCountdown seconds={0} />)

		expect(screen.getByText("Rate limiting: 0s")).toBeInTheDocument()
	})

	it("uses informational styling (not error styling)", () => {
		const { container } = render(<RateLimitCountdown seconds={10} />)

		// Check that the component has the expected informational styling class
		const rootDiv = container.firstChild as HTMLElement
		expect(rootDiv).toHaveClass("text-vscode-descriptionForeground")

		// Verify it does NOT have error-related styling
		expect(rootDiv).not.toHaveClass("text-vscode-errorForeground")
	})

	it("renders the Timer icon", () => {
		const { container } = render(<RateLimitCountdown seconds={5} />)

		// Lucide icons render as SVG elements
		const svgIcon = container.querySelector("svg")
		expect(svgIcon).toBeInTheDocument()
	})
})
