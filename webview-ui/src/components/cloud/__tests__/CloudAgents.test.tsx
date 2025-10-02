import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import CloudAgents from "../CloudAgents"

// Mock window.open
const mockWindowOpen = vi.fn()
window.open = mockWindowOpen

// Mock fetch
global.fetch = vi.fn()

describe("CloudAgents", () => {
	beforeEach(() => {
		mockWindowOpen.mockClear()
		;(global.fetch as any).mockClear()
	})

	const defaultProps = {
		cloudApiUrl: "https://app.roocode.com",
		sessionToken: undefined,
	}

	it("should render mock data when no session token is provided", async () => {
		render(<CloudAgents {...defaultProps} />)

		// Wait for the component to load
		await waitFor(() => {
			expect(screen.getByText("Cloud Agents")).toBeInTheDocument()
		})

		// Check if mock agents are displayed
		expect(screen.getByText("Code Assistant")).toBeInTheDocument()
		expect(screen.getByText("Test Generator")).toBeInTheDocument()
		expect(screen.getByText("Code Reviewer")).toBeInTheDocument()
		expect(screen.getByText("Documentation Writer")).toBeInTheDocument()

		// Check agent types
		expect(screen.getByText("code")).toBeInTheDocument()
		expect(screen.getByText("test")).toBeInTheDocument()
		expect(screen.getByText("review")).toBeInTheDocument()
		expect(screen.getByText("docs")).toBeInTheDocument()
	})

	it("should handle agent click and open correct URL", async () => {
		render(<CloudAgents {...defaultProps} />)

		await waitFor(() => {
			expect(screen.getByText("Code Assistant")).toBeInTheDocument()
		})

		// Click on an agent
		const codeAssistant = screen.getByText("Code Assistant").closest("div.cursor-pointer")
		fireEvent.click(codeAssistant!)

		expect(mockWindowOpen).toHaveBeenCalledWith("https://app.roocode.com/cloud-agents/1", "_blank")
	})

	it("should handle create button click", async () => {
		render(<CloudAgents {...defaultProps} />)

		await waitFor(() => {
			expect(screen.getByText("Cloud Agents")).toBeInTheDocument()
		})

		// Find and click the create button (Plus icon button)
		const createButton = screen.getByTitle("Create new agent")
		fireEvent.click(createButton)

		expect(mockWindowOpen).toHaveBeenCalledWith("https://app.roocode.com/cloud-agents/create", "_blank")
	})

	it("should show empty state when no agents and handle create button", async () => {
		// Mock fetch to return empty agents
		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ agents: [] }),
		})

		render(<CloudAgents {...defaultProps} sessionToken="test-token" />)

		await waitFor(() => {
			expect(screen.getByText("Create your first cloud agent")).toBeInTheDocument()
		})

		// Check for the create agent button in empty state
		const createButton = screen.getByRole("button", { name: /Create Agent/i })
		expect(createButton).toBeInTheDocument()

		fireEvent.click(createButton)

		expect(mockWindowOpen).toHaveBeenCalledWith("https://app.roocode.com/cloud-agents/create", "_blank")
	})

	it("should use mock data when API call fails", async () => {
		// Mock fetch to fail
		;(global.fetch as any).mockRejectedValueOnce(new Error("API Error"))

		render(<CloudAgents {...defaultProps} sessionToken="test-token" />)

		await waitFor(() => {
			expect(screen.getByText("Cloud Agents")).toBeInTheDocument()
		})

		// Should still show mock data
		expect(screen.getByText("Code Assistant")).toBeInTheDocument()
		expect(screen.getByText("Test Generator")).toBeInTheDocument()
		expect(screen.getByText("Code Reviewer")).toBeInTheDocument()
		expect(screen.getByText("Documentation Writer")).toBeInTheDocument()
	})

	it("should not render anything while loading", () => {
		const { container } = render(<CloudAgents {...defaultProps} />)

		// Initially should be empty (loading state returns null)
		expect(container.firstChild).toBeNull()
	})

	it("should fetch agents from API when session token is provided", async () => {
		const mockAgents = [
			{ id: "api-1", name: "API Agent 1", type: "api-type-1", icon: "🤖" },
			{ id: "api-2", name: "API Agent 2", type: "api-type-2", icon: "🎯" },
		]

		;(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ agents: mockAgents }),
		})

		render(<CloudAgents {...defaultProps} sessionToken="test-token" />)

		await waitFor(() => {
			expect(screen.getByText("Cloud Agents")).toBeInTheDocument()
		})

		// Check API call was made with correct headers
		expect(global.fetch).toHaveBeenCalledWith("https://app.roocode.com/api/cloud_agents", {
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer test-token",
			},
		})

		// Check if API agents are displayed
		expect(screen.getByText("API Agent 1")).toBeInTheDocument()
		expect(screen.getByText("API Agent 2")).toBeInTheDocument()
		expect(screen.getByText("api-type-1")).toBeInTheDocument()
		expect(screen.getByText("api-type-2")).toBeInTheDocument()
	})
})
