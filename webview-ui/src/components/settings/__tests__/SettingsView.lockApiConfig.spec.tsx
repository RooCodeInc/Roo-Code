// pnpm --filter @roo-code/vscode-webview test src/components/settings/__tests__/SettingsView.lockApiConfig.spec.tsx

import { render, screen, fireEvent, within } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { vscode } from "@/utils/vscode"
import { ExtensionStateContextProvider } from "@/context/ExtensionStateContext"

import SettingsView from "../SettingsView"

vi.mock("@src/utils/vscode", () => ({ vscode: { postMessage: vi.fn() } }))

vi.mock("../ApiConfigManager", () => ({
	__esModule: true,
	default: ({ currentApiConfigName }: any) => (
		<div data-testid="api-config-management">
			<span>Current config: {currentApiConfigName}</span>
		</div>
	),
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, appearance, "data-testid": dataTestId }: any) =>
		appearance === "icon" ? (
			<button
				onClick={onClick}
				className="codicon codicon-close"
				aria-label="Remove command"
				data-testid={dataTestId}>
				<span className="codicon codicon-close" />
			</button>
		) : (
			<button onClick={onClick} data-appearance={appearance} data-testid={dataTestId}>
				{children}
			</button>
		),
	VSCodeCheckbox: ({ children, onChange, checked, "data-testid": dataTestId }: any) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange({ target: { checked: e.target.checked } })}
				aria-label={typeof children === "string" ? children : undefined}
				data-testid={dataTestId}
			/>
			{children}
		</label>
	),
	VSCodeTextField: ({ value, onInput, placeholder, "data-testid": dataTestId }: any) => (
		<input
			type="text"
			value={value}
			onChange={(e) => onInput?.({ target: { value: e.target.value } })}
			placeholder={placeholder}
			data-testid={dataTestId}
		/>
	),
	VSCodeLink: ({ children, href }: any) => <a href={href || "#"}>{children}</a>,
	VSCodeRadio: ({ value, checked, onChange }: any) => (
		<input type="radio" value={value} checked={checked} onChange={onChange} />
	),
	VSCodeRadioGroup: ({ children, onChange }: any) => <div onChange={onChange}>{children}</div>,
	VSCodeTextArea: ({ value, onChange, rows, className, "data-testid": dataTestId }: any) => (
		<textarea
			value={value}
			onChange={onChange}
			rows={rows}
			className={className}
			data-testid={dataTestId}
			role="textbox"
		/>
	),
}))

vi.mock("../../../components/common/Tab", () => ({
	...vi.importActual("../../../components/common/Tab"),
	Tab: ({ children }: any) => <div data-testid="tab-container">{children}</div>,
	TabHeader: ({ children }: any) => <div data-testid="tab-header">{children}</div>,
	TabContent: ({ children, "data-testid": dataTestId }: any) => (
		<div data-testid={dataTestId || "tab-content"}>{children}</div>
	),
	TabList: ({ children, value, onValueChange, "data-testid": dataTestId }: any) => {
		;(window as any).__onValueChange = onValueChange
		return (
			<div data-testid={dataTestId} data-value={value}>
				{children}
			</div>
		)
	},
	TabTrigger: ({ children, value, "data-testid": dataTestId, onClick, isSelected }: any) => {
		const handleClick = () => {
			if (onClick) onClick()
			const onValueChange = (window as any).__onValueChange
			if (onValueChange) onValueChange(value)
		}

		return (
			<button data-testid={dataTestId} data-value={value} data-selected={isSelected} onClick={handleClick}>
				{children}
			</button>
		)
	},
}))

vi.mock("@/components/ui", async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...(actual as any),
		ToggleSwitch: ({ checked, onChange, "aria-label": ariaLabel, "data-testid": dataTestId }: any) => (
			<button
				role="switch"
				aria-checked={checked}
				aria-label={ariaLabel}
				data-testid={dataTestId}
				onClick={onChange}>
				Toggle
			</button>
		),
		Checkbox: ({ checked, onCheckedChange, id, className, ...props }: any) => (
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onCheckedChange?.(e.target.checked)}
				id={id}
				className={className}
				{...props}
			/>
		),
		Textarea: ({ value, onChange, placeholder, id, className, ...props }: any) => (
			<textarea
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				id={id}
				className={className}
				{...props}
			/>
		),
		StandardTooltip: ({ children }: any) => <>{children}</>,
		Tooltip: ({ children }: any) => <>{children}</>,
		TooltipContent: ({ children }: any) => <>{children}</>,
		TooltipProvider: ({ children }: any) => <>{children}</>,
		TooltipTrigger: ({ children }: any) => <>{children}</>,
		Input: ({ value, onChange, placeholder, "data-testid": dataTestId }: any) => (
			<input type="text" value={value} onChange={onChange} placeholder={placeholder} data-testid={dataTestId} />
		),
		Button: ({ children, onClick, ...props }: any) => (
			<button onClick={onClick} {...props}>
				{children}
			</button>
		),
		SearchableSelect: ({ value, onValueChange, options, placeholder }: any) => (
			<select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid="searchable-select">
				{placeholder && <option value="">{placeholder}</option>}
				{options?.map((opt: any) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		),
		AlertDialog: ({ children, open }: any) => (
			<div data-testid="alert-dialog" data-open={open}>
				{children}
			</div>
		),
		AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
		AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
		AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
		AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
		AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
		AlertDialogAction: ({ children, onClick }: any) => (
			<button data-testid="alert-dialog-action" onClick={onClick}>
				{children}
			</button>
		),
		AlertDialogCancel: ({ children, onClick }: any) => (
			<button data-testid="alert-dialog-cancel" onClick={onClick}>
				{children}
			</button>
		),
		Collapsible: ({ children, open }: any) => (
			<div className="collapsible-mock" data-open={open}>
				{children}
			</div>
		),
		CollapsibleTrigger: ({ children, className, onClick }: any) => (
			<div className={`collapsible-trigger-mock ${className || ""}`} onClick={onClick}>
				{children}
			</div>
		),
		CollapsibleContent: ({ children, className }: any) => (
			<div className={`collapsible-content-mock ${className || ""}`}>{children}</div>
		),
		Dialog: ({ children, ...props }: any) => (
			<div data-testid="dialog" {...props}>
				{children}
			</div>
		),
		DialogContent: ({ children, ...props }: any) => (
			<div data-testid="dialog-content" {...props}>
				{children}
			</div>
		),
		DialogHeader: ({ children, ...props }: any) => (
			<div data-testid="dialog-header" {...props}>
				{children}
			</div>
		),
		DialogTitle: ({ children, ...props }: any) => (
			<div data-testid="dialog-title" {...props}>
				{children}
			</div>
		),
		DialogDescription: ({ children, ...props }: any) => (
			<div data-testid="dialog-description" {...props}>
				{children}
			</div>
		),
		DialogFooter: ({ children, ...props }: any) => (
			<div data-testid="dialog-footer" {...props}>
				{children}
			</div>
		),
	}
})

vi.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange }: any) => (
		<label>
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{children}
		</label>
	),
}))

vi.mock("../ApiOptions", () => ({
	__esModule: true,
	default: () => <div data-testid="api-options">ApiOptions</div>,
}))

const mockPostMessage = (state: any) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				ttsEnabled: false,
				ttsSpeed: 1,
				soundEnabled: false,
				soundVolume: 0.5,
				lockApiConfigAcrossModes: false,
				...state,
			},
		},
		"*",
	)
}

const renderSettingsView = (initialState: any = {}) => {
	const onDone = vi.fn()
	const queryClient = new QueryClient()

	const result = render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<SettingsView onDone={onDone} targetSection="providers" />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)

	// Hydrate initial state
	mockPostMessage(initialState)

	const getSettingsContent = () => screen.getByTestId("settings-content")

	return { onDone, getSettingsContent, result, queryClient }
}

describe("SettingsView - Lock API Config Across Modes", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the lock API config checkbox in the providers tab", () => {
		const { getSettingsContent } = renderSettingsView()
		const content = getSettingsContent()
		const checkbox = within(content).getByTestId("lock-api-config-across-modes-checkbox")
		expect(checkbox).toBeInTheDocument()
	})

	it("initializes with lockApiConfigAcrossModes unchecked by default", () => {
		const { getSettingsContent } = renderSettingsView()
		const content = getSettingsContent()
		const checkbox = within(content).getByTestId("lock-api-config-across-modes-checkbox")
		expect(checkbox).not.toBeChecked()
	})

	it("toggles the checkbox when clicked", () => {
		const { getSettingsContent } = renderSettingsView()
		const content = getSettingsContent()
		const checkbox = within(content).getByTestId("lock-api-config-across-modes-checkbox")

		// Initially unchecked
		expect(checkbox).not.toBeChecked()

		// Click to enable
		fireEvent.click(checkbox)
		expect(checkbox).toBeChecked()

		// Click to disable
		fireEvent.click(checkbox)
		expect(checkbox).not.toBeChecked()
	})

	it("sends lockApiConfigAcrossModes=true message when saving with checkbox enabled", () => {
		const { getSettingsContent } = renderSettingsView()
		const content = getSettingsContent()

		// Enable the lock checkbox
		const checkbox = within(content).getByTestId("lock-api-config-across-modes-checkbox")
		fireEvent.click(checkbox)

		// Click Save
		const saveButton = screen.getByTestId("save-button")
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "lockApiConfigAcrossModes",
				bool: true,
			}),
		)
	})

	it("sends lockApiConfigAcrossModes=false message when saving with checkbox disabled", () => {
		const { getSettingsContent } = renderSettingsView()
		const content = getSettingsContent()

		// Enable then disable the lock checkbox
		const checkbox = within(content).getByTestId("lock-api-config-across-modes-checkbox")
		fireEvent.click(checkbox) // enable
		fireEvent.click(checkbox) // disable

		// Click Save
		const saveButton = screen.getByTestId("save-button")
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "lockApiConfigAcrossModes",
				bool: false,
			}),
		)
	})
})
