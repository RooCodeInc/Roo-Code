import { renderHook, act } from "@testing-library/react"
import { vi } from "vitest"
import { useCloudUpsell } from "../useCloudUpsell"
import { TelemetryEventName } from "@roo-code/types"

// Mock vscode
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock telemetryClient
vi.mock("@/utils/TelemetryClient", () => ({
	telemetryClient: {
		capture: vi.fn(),
	},
}))

describe("useCloudUpsell", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("initializes with isOpen as false", () => {
		const { result } = renderHook(() => useCloudUpsell())
		expect(result.current.isOpen).toBe(false)
	})

	it("opens the upsell dialog when openUpsell is called", () => {
		const { result } = renderHook(() => useCloudUpsell())

		act(() => {
			result.current.openUpsell()
		})

		expect(result.current.isOpen).toBe(true)
	})

	it("closes the upsell dialog when closeUpsell is called", () => {
		const { result } = renderHook(() => useCloudUpsell())

		// First open it
		act(() => {
			result.current.openUpsell()
		})
		expect(result.current.isOpen).toBe(true)

		// Then close it
		act(() => {
			result.current.closeUpsell()
		})
		expect(result.current.isOpen).toBe(false)
	})

	it("handles connect action correctly", async () => {
		const { vscode } = await import("@/utils/vscode")
		const { telemetryClient } = await import("@/utils/TelemetryClient")

		const { result } = renderHook(() => useCloudUpsell())

		// Open the dialog first
		act(() => {
			result.current.openUpsell()
		})
		expect(result.current.isOpen).toBe(true)

		// Call handleConnect
		act(() => {
			result.current.handleConnect()
		})

		// Check that telemetry was sent
		expect(telemetryClient.capture).toHaveBeenCalledWith(TelemetryEventName.SHARE_CONNECT_TO_CLOUD_CLICKED)

		// Check that the sign-in message was posted
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "rooCloudSignIn",
		})

		// Check that the dialog was closed
		expect(result.current.isOpen).toBe(false)
	})
})
