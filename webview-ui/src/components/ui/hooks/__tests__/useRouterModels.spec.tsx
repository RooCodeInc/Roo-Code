import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
import type { ProviderSettings } from "@roo-code/types"

const createWrapper =
	() =>
	({ children }: { children: ReactNode }) => <>{children}</>

const setupUseRouterModels = async () => {
	vi.resetModules()

	const useQueryMock = vi.fn().mockReturnValue({
		data: undefined,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	})

	const postMessageMock = vi.fn()

	vi.doMock("@tanstack/react-query", () => ({
		useQuery: useQueryMock,
	}))

	vi.doMock("@src/utils/vscode", () => ({
		vscode: { postMessage: postMessageMock },
	}))

	const mod = await import("../useRouterModels")

	return {
		useRouterModels: mod.useRouterModels,
		useQueryMock,
		postMessageMock,
	}
}

const setupUseSelectedModel = async () => {
	vi.resetModules()

	const useRouterModelsMock = vi.fn().mockReturnValue({
		data: {
			openrouter: {},
		},
		isLoading: false,
		isError: false,
	})

	vi.doMock("../useRouterModels", () => ({
		useRouterModels: useRouterModelsMock,
	}))

	vi.doMock("../useOpenRouterModelProviders", () => ({
		useOpenRouterModelProviders: vi.fn().mockReturnValue({
			data: {},
			isLoading: false,
			isError: false,
		}),
	}))

	vi.doMock("../useLmStudioModels", () => ({
		useLmStudioModels: vi.fn().mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: false,
		}),
	}))

	vi.doMock("../useOllamaModels", () => ({
		useOllamaModels: vi.fn().mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: false,
		}),
	}))

	const mod = await import("../useSelectedModel")

	return {
		useSelectedModel: mod.useSelectedModel,
		useRouterModelsMock,
	}
}

describe("useRouterModels", () => {
	it("disables auto-fetch by default so callers must refetch explicitly", async () => {
		const { useRouterModels, useQueryMock } = await setupUseRouterModels()
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		renderHook(() => useRouterModels(), { wrapper: createWrapper() })

		expect(useQueryMock).toHaveBeenCalledTimes(1)
		const call = useQueryMock.mock.calls[0][0] as { enabled: boolean }
		expect(call.enabled).toBe(false)
		expect(consoleSpy).toHaveBeenCalledWith("[model-cache/ui] auto-fetch disabled; relying on explicit refresh")

		consoleSpy.mockRestore()
	})

	it("uses provider-scoped query keys and only fetches when queryFn is invoked", async () => {
		vi.useFakeTimers()
		const { useRouterModels, useQueryMock, postMessageMock } = await setupUseRouterModels()

		renderHook(
			() =>
				useRouterModels({
					provider: "roo",
					enabled: true,
				}),
			{ wrapper: createWrapper() },
		)

		expect(useQueryMock).toHaveBeenCalledTimes(1)
		const options = useQueryMock.mock.calls[0][0] as {
			queryKey: [string, string]
			enabled: boolean
			queryFn: () => Promise<Record<string, unknown>>
		}

		expect(options.enabled).toBe(true)
		expect(options.queryKey).toEqual(["routerModels", "roo"])

		const pending = options.queryFn()
		expect(postMessageMock).toHaveBeenCalledWith({ type: "requestRouterModels", values: { provider: "roo" } })

		const response = { roo: { "roo/model": {} } }
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "routerModels",
					values: { provider: "roo" },
					routerModels: response,
				},
			}),
		)

		await act(async () => {
			await expect(pending).resolves.toBe(response)
		})

		vi.useRealTimers()
	})
})

describe("useSelectedModel", () => {
	it("keeps router model queries disabled on mount to avoid implicit fetches", async () => {
		const { useSelectedModel, useRouterModelsMock } = await setupUseSelectedModel()

		const apiConfiguration = {
			apiProvider: "openrouter",
			openRouterModelId: "openrouter/model",
		} as ProviderSettings

		renderHook(() => useSelectedModel(apiConfiguration), { wrapper: createWrapper() })

		expect(useRouterModelsMock).toHaveBeenCalledWith({ enabled: false })
	})
})
