import React from "react"
import { render } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ProviderSettings } from "@roo-code/types"

describe("TaskHeader FilesChangedOverview boundary", () => {
	it("catches errors thrown by FilesChangedOverview", async () => {
		vi.resetModules()

		vi.doMock("react-i18next", () => ({
			useTranslation: () => ({
				t: (key: string) => key,
			}),
			withTranslation: () => (Component: any) => {
				Component.defaultProps = {
					...Component.defaultProps,
					t: (key: string) => key,
				}
				return Component
			},
			initReactI18next: {
				type: "3rdParty",
				init: vi.fn(),
			},
		}))

		const postMessageMock = vi.fn()
		vi.doMock("@/utils/vscode", () => ({
			vscode: {
				postMessage: postMessageMock,
			},
		}))

		const mockExtensionState: {
			apiConfiguration: ProviderSettings
			currentTaskItem: { id: string } | null
			clineMessages: any[]
		} = {
			apiConfiguration: {
				apiProvider: "anthropic",
				apiKey: "test-api-key",
				apiModelId: "claude-3-opus-20240229",
			} as ProviderSettings,
			currentTaskItem: { id: "test-task-id" },
			clineMessages: [],
		}

		vi.doMock("@src/context/ExtensionStateContext", () => ({
			useExtensionState: () => mockExtensionState,
		}))

		vi.doMock("@src/hooks/useCloudUpsell", () => ({
			useCloudUpsell: () => ({
				isOpen: false,
				openUpsell: vi.fn(),
				closeUpsell: vi.fn(),
				handleConnect: vi.fn(),
			}),
		}))

		vi.doMock("@src/components/common/DismissibleUpsell", () => ({
			__esModule: true,
			default: ({ children, ...props }: any) => (
				<div data-testid="dismissible-upsell" {...props}>
					{children}
				</div>
			),
		}))

		vi.doMock("@src/components/cloud/CloudUpsellDialog", () => ({
			CloudUpsellDialog: () => null,
		}))

		vi.doMock("@roo/array", () => ({
			findLastIndex: (array: any[], predicate: (item: any) => boolean) => {
				for (let i = array.length - 1; i >= 0; i--) {
					if (predicate(array[i])) {
						return i
					}
				}
				return -1
			},
		}))

		vi.doMock("../../file-changes/FilesChangedOverview", () => ({
			__esModule: true,
			default: () => {
				throw new Error("FilesChangedOverview exploded")
			},
		}))

		const { default: TaskHeader } = await import("../TaskHeader")

		const defaultProps = {
			task: { type: "say" as const, ts: Date.now(), text: "Test task", images: [] as string[] },
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 0.05,
			contextTokens: 200,
			buttonsDisabled: false,
			handleCondenseContext: vi.fn(),
		}

		const queryClient = new QueryClient()

		expect(() =>
			render(
				<QueryClientProvider client={queryClient}>
					<TaskHeader {...defaultProps} />
				</QueryClientProvider>,
			),
		).not.toThrow()
	})
})
