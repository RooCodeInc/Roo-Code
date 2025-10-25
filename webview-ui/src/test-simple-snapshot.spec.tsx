import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import React from "react"

describe("Simple Snapshot Tests", () => {
	it("should create basic snapshot", () => {
		const TestComponent = () => (
			<div data-testid="simple-test">
				<span>Hello World</span>
			</div>
		)

		const { container } = render(<TestComponent />)

		// Test simple assertion without snapshot for now
		expect(container.querySelector('[data-testid="simple-test"]')).toBeTruthy()
		expect(container.querySelector("span")).toBeTruthy()
		expect(container.querySelector("span")?.textContent).toBe("Hello World")
	})

	it("should test component structure", () => {
		const TestComponent = () => (
			<div data-testid="structure-test">
				<h1>Title</h1>
				<p>Content</p>
			</div>
		)

		const { container } = render(<TestComponent />)

		expect(container.querySelector('[data-testid="structure-test"]')).toBeTruthy()
		expect(container.querySelector("h1")?.textContent).toBe("Title")
		expect(container.querySelector("p")?.textContent).toBe("Content")
	})
})
