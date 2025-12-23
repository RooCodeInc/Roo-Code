// npx vitest src/components/welcome/__tests__/WelcomeViewProvider.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"

import * as ExtensionStateContext from "@src/context/ExtensionStateContext"
const { ExtensionStateContextProvider } = ExtensionStateContext

import WelcomeViewProvider from "../WelcomeViewProvider"
import { vscode } from "@src/utils/vscode"

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children, onClick }: any) => (
		<button onClick={onClick} data-testid="vscode-link">
			{children}
		</button>
	),
	VSCodeProgressRing: () => <div data-testid="progress-ring">Loading...</div>,
	VSCodeTextField: ({ value, onKeyUp, placeholder }: any) => (
		<input data-testid="text-field" type="text" value={value} onChange={onKeyUp} placeholder={placeholder} />
	),
}))

// Mock Button component
vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, variant }: any) => (
		<button onClick={onClick} data-testid={`button-${variant}`}>
			{children}
		</button>
	),
}))

// Mock ApiOptions
vi.mock("../../settings/ApiOptions", () => ({
	default: () => <div data-testid="api-options">API Options Component</div>,
}))

// Mock Tab components
vi.mock("../../common/Tab", () => ({
	Tab: ({ children }: any) => <div data-testid="tab">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
}))

// Mock RooHero
vi.mock("../RooHero", () => ({
	default: () => <div data-testid="roo-hero">Roo Hero</div>,
}))

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
	ArrowRight: () => <span data-testid="arrow-right-icon">→</span>,
	BadgeInfo: () => <span data-testid="badge-info-icon">ℹ</span>,
	TriangleAlert: () => <span data-testid="triangle-alert-icon">⚠</span>,
}))

// Mock vscode utility
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	Trans: ({ i18nKey, children }: any) => <span data-testid={`trans-${i18nKey}`}>{children || i18nKey}</span>,
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const renderWelcomeViewProvider = (extensionState = {}) => {
	const useExtensionStateMock = vi.spyOn(ExtensionStateContext, "useExtensionState")
	useExtensionStateMock.mockReturnValue({
		apiConfiguration: {},
		currentApiConfigName: "default",
		setApiConfiguration: vi.fn(),
		uriScheme: "vscode",
		cloudIsAuthenticated: false,
		...extensionState,
	} as any)

	render(
		<ExtensionStateContextProvider>
			<WelcomeViewProvider />
		</ExtensionStateContextProvider>,
	)

	return useExtensionStateMock
}

describe("WelcomeViewProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Roo Provider as primary option", () => {
		it("renders Roo provider option by default", () => {
			renderWelcomeViewProvider()

			// Should show the greeting heading
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()

			// Should show the description
			expect(screen.getByText(/welcome:providerSignup.rooCloudDescription/)).toBeInTheDocument()

			// Should show "Get Started" button
			expect(screen.getByTestId("button-primary")).toBeInTheDocument()

			// Should show "use another provider" link
			const useAnotherProviderLink = screen
				.getAllByTestId("vscode-link")
				.find((link) => link.textContent?.includes("welcome:providerSignup.useAnotherProvider"))
			expect(useAnotherProviderLink).toBeInTheDocument()
		})

		it("does not show API options initially", () => {
			renderWelcomeViewProvider()

			// API options should not be visible initially
			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})

		it("switches to custom provider when 'use another provider' is clicked", () => {
			renderWelcomeViewProvider()

			// Find and click the "use another provider" link
			const useAnotherProviderLink = screen
				.getAllByTestId("vscode-link")
				.find((link) => link.textContent?.includes("welcome:providerSignup.useAnotherProvider"))
			fireEvent.click(useAnotherProviderLink!)

			// Should now show API options
			expect(screen.getByTestId("api-options")).toBeInTheDocument()

			// Should show "back to Roo" link
			const useRooProviderLink = screen
				.getAllByTestId("vscode-link")
				.find((link) => link.textContent?.includes("welcome:providerSignup.backToRoo"))
			expect(useRooProviderLink).toBeInTheDocument()
		})

		it("switches back to Roo provider when 'back to Roo' is clicked", () => {
			renderWelcomeViewProvider()

			// Switch to custom provider first
			const useAnotherProviderLink = screen
				.getAllByTestId("vscode-link")
				.find((link) => link.textContent?.includes("welcome:providerSignup.useAnotherProvider"))
			fireEvent.click(useAnotherProviderLink!)

			// Verify we're on custom provider screen
			expect(screen.getByTestId("api-options")).toBeInTheDocument()

			// Click "back to Roo" link
			const useRooProviderLink = screen
				.getAllByTestId("vscode-link")
				.find((link) => link.textContent?.includes("welcome:providerSignup.backToRoo"))
			fireEvent.click(useRooProviderLink!)

			// Should be back on Roo provider screen
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()
			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})
	})

	describe("Get Started button", () => {
		it("triggers Roo sign-in when on Roo provider screen", () => {
			renderWelcomeViewProvider()

			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "rooCloudSignIn",
				useProviderSignup: true,
			})
		})

		it("validates and saves configuration when on custom provider screen", () => {
			renderWelcomeViewProvider({
				apiConfiguration: {
					apiProvider: "anthropic",
					anthropicApiKey: "test-key",
				},
			})

			// Switch to custom provider
			const useAnotherProviderLink = screen
				.getAllByTestId("vscode-link")
				.find((link) => link.textContent?.includes("welcome:providerSignup.useAnotherProvider"))
			fireEvent.click(useAnotherProviderLink!)

			// Click Get Started on custom provider
			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should attempt to save configuration
			expect(vscode.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "upsertApiConfiguration",
				}),
			)
		})
	})

	describe("Auth in progress state", () => {
		it("shows waiting state after clicking Get Started on Roo provider", () => {
			renderWelcomeViewProvider()

			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should show progress ring
			expect(screen.getByTestId("progress-ring")).toBeInTheDocument()

			// Should show waiting heading
			expect(screen.getByText(/welcome:waitingForCloud.heading/)).toBeInTheDocument()
		})

		it("shows Go Back button in waiting state", () => {
			renderWelcomeViewProvider()

			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should show secondary button (Go Back)
			expect(screen.getByTestId("button-secondary")).toBeInTheDocument()
		})

		it("returns to provider selection when Go Back is clicked", () => {
			renderWelcomeViewProvider()

			// Enter waiting state
			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Click Go Back
			const goBackButton = screen.getByTestId("button-secondary")
			fireEvent.click(goBackButton)

			// Should be back on provider selection screen
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()
			expect(screen.queryByTestId("progress-ring")).not.toBeInTheDocument()
		})
	})
})
