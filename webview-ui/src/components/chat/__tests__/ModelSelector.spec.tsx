import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"

import { ModelSelector } from "../ModelSelector"

const mockUseSelectedModel = vi.hoisted(() => vi.fn())
const mockFilterModels = vi.hoisted(() => vi.fn())
const mockModelsByProvider = vi.hoisted(() => ({
	anthropic: {
		"claude-sonnet": { displayName: "Claude Sonnet" },
		"claude-haiku": { displayName: "Claude Haiku" },
	},
})) as Record<string, Record<string, any>>

vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => document.body,
}))

vi.mock("@/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: (apiConfiguration?: any) => mockUseSelectedModel(apiConfiguration),
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		organizationAllowList: undefined,
		routerModels: undefined,
	}),
}))

vi.mock("@/components/settings/utils/organizationFilters", () => ({
	filterModels: (...args: any[]) => mockFilterModels(...args),
}))

vi.mock("@/components/settings/constants", () => ({
	MODELS_BY_PROVIDER: mockModelsByProvider,
}))

vi.mock("@/components/ui", () => {
	const CommandItem = React.forwardRef<HTMLDivElement, any>(({ onSelect, children, ...props }, ref) => (
		<div
			ref={ref}
			role="option"
			tabIndex={0}
			onClick={() => onSelect?.()}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault()
					onSelect?.()
				}
			}}
			{...props}>
			{children}
		</div>
	))

	return {
		Popover: ({ children }: any) => <div data-testid="popover-root">{children}</div>,
		PopoverTrigger: ({ children, ...props }: any) => (
			<button type="button" data-testid="model-selector-trigger" {...props}>
				{children}
			</button>
		),
		PopoverContent: ({ children, ...props }: any) => (
			<div data-testid="model-selector-content" {...props}>
				{children}
			</div>
		),
		StandardTooltip: ({ children }: any) => <>{children}</>,
		Button: ({ children, onClick, ...props }: any) => (
			<button type="button" onClick={onClick} {...props}>
				{children}
			</button>
		),
		Command: ({ children }: any) => <div data-testid="command-root">{children}</div>,
		CommandList: ({ children, ...props }: any) => (
			<div data-testid="command-list" {...props}>
				{children}
			</div>
		),
		CommandGroup: ({ children, ...props }: any) => (
			<div data-testid="command-group" {...props}>
				{children}
			</div>
		),
		CommandItem,
		CommandEmpty: ({ children, ...props }: any) => (
			<div data-testid="command-empty" {...props}>
				{children}
			</div>
		),
	}
})

describe("ModelSelector", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockModelsByProvider.anthropic = {
			"claude-sonnet": { displayName: "Claude Sonnet" },
			"claude-haiku": { displayName: "Claude Haiku" },
		}
		mockFilterModels.mockImplementation((models: Record<string, any>) => models)
		mockUseSelectedModel.mockReturnValue({
			provider: "anthropic",
			id: "claude-sonnet",
			info: { displayName: "Claude Sonnet" },
		})
	})

	test("renders selected model label and options", () => {
		render(
			<ModelSelector
				apiConfiguration={{ apiProvider: "anthropic", apiModelId: "claude-sonnet" } as any}
				title="chat:modelSelector.title"
				open
				onOpenChange={vi.fn()}
				onModelSelect={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("model-selector-label")).toHaveTextContent("Claude Sonnet")
		expect(screen.getByTestId("model-option-claude-sonnet")).toBeInTheDocument()
		expect(screen.getByTestId("model-option-claude-haiku")).toBeInTheDocument()
	})

	test("invokes onModelSelect with the chosen model", () => {
		const onModelSelect = vi.fn()

		const onOpenChange = vi.fn()

		render(
			<ModelSelector
				apiConfiguration={{ apiProvider: "anthropic", apiModelId: "claude-sonnet" } as any}
				title="chat:modelSelector.title"
				open
				onOpenChange={onOpenChange}
				onModelSelect={onModelSelect}
			/>,
		)

		fireEvent.click(screen.getByTestId("model-option-claude-haiku"))

		expect(onModelSelect).toHaveBeenCalledWith(
			"claude-haiku",
			expect.objectContaining({ displayName: "Claude Haiku" }),
		)
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	test("shows empty state when no models are available", () => {
		mockModelsByProvider.anthropic = {}
		mockFilterModels.mockReturnValue({})
		mockUseSelectedModel.mockReturnValue({
			provider: "anthropic",
			id: undefined,
			info: undefined,
		})

		const onOpenChange = vi.fn()

		render(
			<ModelSelector
				apiConfiguration={{ apiProvider: "anthropic" } as any}
				title="chat:modelSelector.title"
				open
				onOpenChange={onOpenChange}
				onModelSelect={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("command-empty")).toHaveTextContent("chat:modelSelector.emptyState")
	})

	test("supports keyboard navigation and selection", () => {
		const onModelSelect = vi.fn()
		const onOpenChange = vi.fn()

		render(
			<ModelSelector
				apiConfiguration={{ apiProvider: "anthropic", apiModelId: "claude-sonnet" } as any}
				title="chat:modelSelector.title"
				open
				onOpenChange={onOpenChange}
				onModelSelect={onModelSelect}
			/>,
		)

		const searchInput = screen.getByTestId("model-selector-search")

		fireEvent.keyDown(searchInput, { key: "ArrowDown" })
		fireEvent.keyDown(searchInput, { key: "Enter" })

		expect(onModelSelect).toHaveBeenCalledWith(
			"claude-haiku",
			expect.objectContaining({ displayName: "Claude Haiku" }),
		)
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	test("does not overwrite search input when hovering or clearing", () => {
		render(
			<ModelSelector
				apiConfiguration={{ apiProvider: "anthropic", apiModelId: "claude-sonnet" } as any}
				title="chat:modelSelector.title"
				open
				onOpenChange={vi.fn()}
				onModelSelect={vi.fn()}
			/>,
		)

		const searchInput = screen.getByTestId("model-selector-search") as HTMLInputElement
		expect(searchInput.value).toBe("")

		fireEvent.mouseEnter(screen.getByTestId("model-option-claude-haiku"))
		expect(searchInput.value).toBe("")

		fireEvent.change(searchInput, { target: { value: "claude" } })
		expect(searchInput.value).toBe("claude")

		fireEvent.change(searchInput, { target: { value: "" } })
		expect(searchInput.value).toBe("")
	})

	test("search matches name but not description", () => {
		mockModelsByProvider.anthropic = {
			"grok-3-mini": { displayName: "grok-3-mini", description: "Powerful reasoning model" },
			"stepfun-ai/step3": { displayName: "stepfun", description: "Mini model for experimentation" },
		}
		mockFilterModels.mockImplementation((models: Record<string, any>) => models)
		mockUseSelectedModel.mockReturnValue({
			provider: "anthropic",
			id: "grok-3-mini",
			info: { displayName: "grok-3-mini" },
		})

		render(
			<ModelSelector
				apiConfiguration={{ apiProvider: "anthropic", apiModelId: "grok-3-mini" } as any}
				title="chat:modelSelector.title"
				open
				onOpenChange={vi.fn()}
				onModelSelect={vi.fn()}
			/>,
		)

		const searchInput = screen.getByTestId("model-selector-search") as HTMLInputElement
		fireEvent.change(searchInput, { target: { value: "mini" } })

		expect(screen.getByTestId("model-option-grok-3-mini")).toBeInTheDocument()
		expect(screen.queryByTestId("model-option-stepfun-ai/step3")).not.toBeInTheDocument()
	})

	test("opens provider settings when settings button is clicked", () => {
		const onOpenChange = vi.fn()

		render(
			<ModelSelector
				apiConfiguration={{ apiProvider: "anthropic", apiModelId: "claude-sonnet" } as any}
				title="chat:modelSelector.title"
				open
				onOpenChange={onOpenChange}
				onModelSelect={vi.fn()}
			/>,
		)

		const settingsButton = screen.getByRole("button", { name: "chat:modelSelector.settings" })
		fireEvent.click(settingsButton)

		expect(onOpenChange).toHaveBeenCalledWith(false)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "switchTab",
			tab: "settings",
			values: { section: "providers" },
		})
	})
})
