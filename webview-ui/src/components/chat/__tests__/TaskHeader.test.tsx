// npx jest src/components/chat/__tests__/TaskHeader.test.tsx

import React from "react"
import { render, screen } from "@testing-library/react"
import TaskHeader from "../TaskHeader"
import { ApiConfiguration } from "../../../../../src/shared/api"

// Mock the vscode API
jest.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock the VSCodeBadge component
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children }: { children: React.ReactNode }) => <div data-testid="vscode-badge">{children}</div>,
}))

// Mock the ExtensionStateContext
jest.mock("../../../context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: {
			apiProvider: "anthropic",
			apiKey: "test-api-key", // Add relevant fields
			apiModelId: "claude-3-opus-20240229", // Add relevant fields
		} as ApiConfiguration, // Optional: Add type assertion if ApiConfiguration is imported
		currentTaskItem: null,
	}),
}))

describe("TaskHeader", () => {
	const defaultProps = {
		task: { text: "Test task", images: [] },
		tokensIn: 100,
		tokensOut: 50,
		doesModelSupportPromptCache: true,
		totalCost: 0.05,
		contextTokens: 200,
		onClose: jest.fn(),
	}

	it("should display cost when totalCost is greater than 0", () => {
		render(
			<TaskHeader
				{...defaultProps}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)
		expect(screen.getByText("$0.05")).toBeInTheDocument()
	})

	it("should not display cost when totalCost is 0", () => {
		render(
			<TaskHeader
				{...defaultProps}
				totalCost={0}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)
		expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is null", () => {
		render(
			<TaskHeader
				{...defaultProps}
				totalCost={null as any}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is undefined", () => {
		render(
			<TaskHeader
				{...defaultProps}
				totalCost={undefined as any}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is NaN", () => {
		render(
			<TaskHeader
				{...defaultProps}
				totalCost={NaN}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})
})

describe("TaskHeader thinking metrics", () => {
	const defaultProps = {
		task: { text: "Test task", images: [] },
		tokensIn: 100,
		tokensOut: 50,
		doesModelSupportPromptCache: true,
		totalCost: 0.05,
		contextTokens: 200,
		onClose: jest.fn(),
	}

	it("should display thinking metrics when both thoughtsTokenCount and thinkingBudget are present and > 0", () => {
		render(
			<TaskHeader
				{...defaultProps}
				thoughtsTokenCount={500}
				thinkingBudget={1000}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		// Expand the task header to see detailed metrics
		screen.getByText("Task").click()

		// Verify thinking section is present
		expect(screen.getByText("Thinking")).toBeInTheDocument()
		expect(screen.getByText("500/1,000")).toBeInTheDocument()
	})

	it("should not display thinking metrics when thoughtsTokenCount is 0", () => {
		render(
			<TaskHeader
				{...defaultProps}
				thoughtsTokenCount={0}
				thinkingBudget={1000}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		// Expand the task header
		screen.getByText("Task").click()

		expect(screen.queryByText("Thinking")).not.toBeInTheDocument()
	})

	it("should not display thinking metrics when thinkingBudget is 0", () => {
		render(
			<TaskHeader
				{...defaultProps}
				thoughtsTokenCount={500}
				thinkingBudget={0}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		// Expand the task header
		screen.getByText("Task").click()

		expect(screen.queryByText("Thinking")).not.toBeInTheDocument()
	})

	it("should not display thinking metrics when values are undefined", () => {
		render(
			<TaskHeader
				{...defaultProps}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		// Expand the task header
		screen.getByText("Task").click()

		expect(screen.queryByText("Thinking")).not.toBeInTheDocument()
	})
})

describe("TaskHeader thinking metrics edge cases", () => {
	const defaultProps = {
		task: { text: "Test task", images: [] },
		tokensIn: 100,
		tokensOut: 50,
		doesModelSupportPromptCache: true,
		totalCost: 0.05,
		contextTokens: 200,
		onClose: jest.fn(),
	}

	it("should handle and format large numbers in thinking metrics", () => {
		render(
			<TaskHeader
				{...defaultProps}
				thoughtsTokenCount={1234567}
				thinkingBudget={9876543}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		screen.getByText("Task").click()
		expect(screen.getByTestId("thinking-metrics")).toHaveTextContent("1.2M/9.9M")
	})

	it("should not display thinking metrics when only thoughtsTokenCount is present", () => {
		render(
			<TaskHeader
				{...defaultProps}
				thoughtsTokenCount={500}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		screen.getByText("Task").click()
		expect(screen.queryByTestId("thinking-metrics")).not.toBeInTheDocument()
	})

	it("should not display thinking metrics when only thinkingBudget is present", () => {
		render(
			<TaskHeader
				{...defaultProps}
				thinkingBudget={1000}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		screen.getByText("Task").click()
		expect(screen.queryByTestId("thinking-metrics")).not.toBeInTheDocument()
	})

	it("should format small numbers without abbreviation", () => {
		render(
			<TaskHeader
				{...defaultProps}
				thoughtsTokenCount={123}
				thinkingBudget={456}
				task={{
					type: "say",
					ts: Date.now(),
					text: "Test task",
					images: [],
				}}
			/>,
		)

		screen.getByText("Task").click()
		expect(screen.getByTestId("thinking-metrics")).toHaveTextContent("123/456")
	})
})
