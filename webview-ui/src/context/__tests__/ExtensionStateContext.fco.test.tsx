import React from "react"
import { render, screen, act, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { ExtensionStateContextProvider, useExtensionState } from "../ExtensionStateContext"
import { ExtensionMessage } from "@roo/ExtensionMessage"

// Mock vscode utilities
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/utils/textMateToHljs", () => ({
	convertTextMateToHljs: vi.fn((theme) => theme),
}))

// Test component to access context
const TestComponent = () => {
	const state = useExtensionState()
	return (
		<div>
			<div data-testid="files-changed-enabled">{state.filesChangedEnabled.toString()}</div>
			<div data-testid="current-file-changeset">
				{state.currentFileChangeset ? JSON.stringify(state.currentFileChangeset) : "undefined"}
			</div>
			<div data-testid="history-preview-collapsed">{state.historyPreviewCollapsed?.toString()}</div>
			<div data-testid="always-allow-followup-questions">{state.alwaysAllowFollowupQuestions.toString()}</div>
			<div data-testid="followup-auto-approve-timeout">
				{state.followupAutoApproveTimeoutMs?.toString() || "undefined"}
			</div>
			<div data-testid="include-task-history-in-enhance">{state.includeTaskHistoryInEnhance?.toString()}</div>
			<div data-testid="experiments">{JSON.stringify(state.experiments)}</div>
			<button onClick={() => state.setFilesChangedEnabled(!state.filesChangedEnabled)}>
				Toggle Files Changed
			</button>
			<button onClick={() => state.setCurrentFileChangeset({ baseCheckpoint: "abc123", files: [] })}>
				Set Changeset
			</button>
			<button onClick={() => state.setHistoryPreviewCollapsed(!state.historyPreviewCollapsed)}>
				Toggle History Collapsed
			</button>
			<button onClick={() => state.setAlwaysAllowFollowupQuestions(!state.alwaysAllowFollowupQuestions)}>
				Toggle Followup Questions
			</button>
			<button onClick={() => state.setFollowupAutoApproveTimeoutMs(5000)}>Set Followup Timeout</button>
			<button onClick={() => state.setIncludeTaskHistoryInEnhance(!state.includeTaskHistoryInEnhance)}>
				Toggle Task History In Enhance
			</button>
			<button
				onClick={() =>
					state.setExperimentEnabled("filesChangedOverview", !state.experiments.filesChangedOverview)
				}>
				Toggle FCO Experiment
			</button>
		</div>
	)
}

describe("ExtensionStateContext - FCO Features", () => {
	let mockAddEventListener: ReturnType<typeof vi.fn>
	let mockRemoveEventListener: ReturnType<typeof vi.fn>
	let messageHandler: ((event: MessageEvent) => void) | null = null

	beforeEach(() => {
		mockAddEventListener = vi.fn((event, handler) => {
			if (event === "message") {
				messageHandler = handler
			}
		})
		mockRemoveEventListener = vi.fn()

		Object.defineProperty(window, "addEventListener", {
			value: mockAddEventListener,
			writable: true,
		})
		Object.defineProperty(window, "removeEventListener", {
			value: mockRemoveEventListener,
			writable: true,
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
		messageHandler = null
	})

	describe("Initial State", () => {
		it("should initialize with correct FCO default values", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(screen.getByTestId("files-changed-enabled")).toHaveTextContent("true")
			expect(screen.getByTestId("current-file-changeset")).toHaveTextContent("undefined")
			expect(screen.getByTestId("history-preview-collapsed")).toHaveTextContent("false")
			expect(screen.getByTestId("always-allow-followup-questions")).toHaveTextContent("false")
			expect(screen.getByTestId("followup-auto-approve-timeout")).toHaveTextContent("undefined")
			expect(screen.getByTestId("include-task-history-in-enhance")).toHaveTextContent("true")
		})

		it("should initialize with default experiment values", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			const experimentsText = screen.getByTestId("experiments").textContent
			const experiments = JSON.parse(experimentsText || "{}")

			// Should include default experiments including FCO
			expect(experiments).toHaveProperty("filesChangedOverview")
		})
	})

	describe("State Setters", () => {
		it("should update filesChangedEnabled state", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(screen.getByTestId("files-changed-enabled")).toHaveTextContent("true")

			act(() => {
				screen.getByText("Toggle Files Changed").click()
			})

			expect(screen.getByTestId("files-changed-enabled")).toHaveTextContent("false")
		})

		it("should update currentFileChangeset state", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(screen.getByTestId("current-file-changeset")).toHaveTextContent("undefined")

			act(() => {
				screen.getByText("Set Changeset").click()
			})

			const changesetText = screen.getByTestId("current-file-changeset").textContent
			const changeset = JSON.parse(changesetText || "{}")
			expect(changeset).toEqual({
				baseCheckpoint: "abc123",
				files: [],
			})
		})

		it("should update historyPreviewCollapsed state", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(screen.getByTestId("history-preview-collapsed")).toHaveTextContent("false")

			act(() => {
				screen.getByText("Toggle History Collapsed").click()
			})

			expect(screen.getByTestId("history-preview-collapsed")).toHaveTextContent("true")
		})

		it("should update alwaysAllowFollowupQuestions state", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(screen.getByTestId("always-allow-followup-questions")).toHaveTextContent("false")

			act(() => {
				screen.getByText("Toggle Followup Questions").click()
			})

			expect(screen.getByTestId("always-allow-followup-questions")).toHaveTextContent("true")
		})

		it("should update followupAutoApproveTimeoutMs state", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(screen.getByTestId("followup-auto-approve-timeout")).toHaveTextContent("undefined")

			act(() => {
				screen.getByText("Set Followup Timeout").click()
			})

			expect(screen.getByTestId("followup-auto-approve-timeout")).toHaveTextContent("5000")
		})

		it("should update includeTaskHistoryInEnhance state", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(screen.getByTestId("include-task-history-in-enhance")).toHaveTextContent("true")

			act(() => {
				screen.getByText("Toggle Task History In Enhance").click()
			})

			expect(screen.getByTestId("include-task-history-in-enhance")).toHaveTextContent("false")
		})

		it("should update experiment enabled state", () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			const initialExperimentsText = screen.getByTestId("experiments").textContent
			const initialExperiments = JSON.parse(initialExperimentsText || "{}")
			const initialFCOState = initialExperiments.filesChangedOverview

			act(() => {
				screen.getByText("Toggle FCO Experiment").click()
			})

			const updatedExperimentsText = screen.getByTestId("experiments").textContent
			const updatedExperiments = JSON.parse(updatedExperimentsText || "{}")
			expect(updatedExperiments.filesChangedOverview).toBe(!initialFCOState)
		})
	})

	describe("Message Handling", () => {
		it("should handle state message with FCO fields", async () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			expect(messageHandler).toBeTruthy()

			const stateMessage: ExtensionMessage = {
				type: "state",
				state: {
					// Added required fields for ExtensionState
					taskSyncEnabled: false,
					featureRoomoteControlEnabled: false,
					version: "1.0.0",
					clineMessages: [],
					taskHistory: [],
					shouldShowAnnouncement: false,
					allowedCommands: [],
					deniedCommands: [],
					soundEnabled: false,
					soundVolume: 0.5,
					ttsEnabled: false,
					ttsSpeed: 1.0,
					diffEnabled: false,
					enableCheckpoints: true,
					fuzzyMatchThreshold: 1.0,
					language: "en",
					writeDelayMs: 1000,
					browserViewportSize: "900x600",
					screenshotQuality: 75,
					terminalOutputLineLimit: 500,
					terminalOutputCharacterLimit: 50000,
					terminalShellIntegrationTimeout: 4000,
					mcpEnabled: true,
					enableMcpServerCreation: false,
					remoteControlEnabled: false,
					alwaysApproveResubmit: false,
					requestDelaySeconds: 5,
					currentApiConfigName: "default",
					listApiConfigMeta: [],
					mode: "code",
					customModePrompts: {},
					customSupportPrompts: {},
					experiments: { filesChangedOverview: true },
					enhancementApiConfigId: "",
					condensingApiConfigId: "",
					customCondensingPrompt: "",
					hasOpenedModeSelector: false,
					autoApprovalEnabled: false,
					customModes: [],
					maxOpenTabsContext: 20,
					maxWorkspaceFiles: 200,
					cwd: "",
					browserToolEnabled: true,
					telemetrySetting: "unset",
					showRooIgnoredFiles: true,
					renderContext: "sidebar",
					maxReadFileLine: -1,
					maxImageFileSize: 5,
					maxTotalImageSize: 20,
					pinnedApiConfigs: {},
					terminalZshOhMy: false,
					maxConcurrentFileReads: 5,
					terminalZshP10k: false,
					terminalZdotdir: false,
					terminalCompressProgressBar: true,
					historyPreviewCollapsed: true,
					cloudUserInfo: null,
					cloudIsAuthenticated: false,
					sharingEnabled: false,
					organizationAllowList: { allowAll: true, providers: {} },
					organizationSettingsVersion: -1,
					autoCondenseContext: true,
					autoCondenseContextPercent: 100,
					profileThresholds: {},
					codebaseIndexConfig: {
						codebaseIndexEnabled: true,
						codebaseIndexQdrantUrl: "http://localhost:6333",
						codebaseIndexEmbedderProvider: "openai",
						codebaseIndexEmbedderBaseUrl: "",
						codebaseIndexEmbedderModelId: "",
						codebaseIndexSearchMaxResults: undefined,
						codebaseIndexSearchMinScore: undefined,
					},
					codebaseIndexModels: { ollama: {}, openai: {} },
					alwaysAllowUpdateTodoList: true,
					includeDiagnosticMessages: true,
					maxDiagnosticMessages: 50,
					openRouterImageApiKey: "",
					openRouterImageGenerationSelectedModel: "",
					apiConfiguration: {},
					// FCO specific fields
					alwaysAllowFollowupQuestions: true,
					followupAutoApproveTimeoutMs: 3000,
					includeTaskHistoryInEnhance: false,
					marketplaceItems: [],
					marketplaceInstalledMetadata: { project: {}, global: {} },
				},
			}

			act(() => {
				messageHandler?.(new MessageEvent("message", { data: stateMessage }))
			})

			await waitFor(() => {
				expect(screen.getByTestId("always-allow-followup-questions")).toHaveTextContent("true")
				expect(screen.getByTestId("followup-auto-approve-timeout")).toHaveTextContent("3000")
				expect(screen.getByTestId("include-task-history-in-enhance")).toHaveTextContent("false")
				expect(screen.getByTestId("history-preview-collapsed")).toHaveTextContent("true")
			})

			const experimentsText = screen.getByTestId("experiments").textContent
			const experiments = JSON.parse(experimentsText || "{}")
			expect(experiments.filesChangedOverview).toBe(true)
		})

		it("should handle filesChanged message", async () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			const mockChangeset = {
				baseCheckpoint: "abc123",
				files: [
					{
						uri: "/test/file1.ts",
						type: "edit" as const,
						fromCheckpoint: "abc123",
						toCheckpoint: "def456",
						linesAdded: 5,
						linesRemoved: 2,
					},
				],
			}

			const filesChangedMessage: ExtensionMessage = {
				type: "filesChanged",
				filesChanged: mockChangeset,
			}

			act(() => {
				messageHandler?.(new MessageEvent("message", { data: filesChangedMessage }))
			})

			await waitFor(() => {
				const changesetText = screen.getByTestId("current-file-changeset").textContent
				const changeset = JSON.parse(changesetText || "{}")
				expect(changeset).toEqual(mockChangeset)
			})
		})

		it("should handle filesChanged message with undefined to clear changeset", async () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			// First set a changeset
			const mockChangeset = {
				baseCheckpoint: "abc123",
				files: [
					{
						uri: "/test/file1.ts",
						type: "edit" as const,
						fromCheckpoint: "abc123",
						toCheckpoint: "def456",
						linesAdded: 5,
						linesRemoved: 2,
					},
				],
			}

			act(() => {
				messageHandler?.(
					new MessageEvent("message", {
						data: { type: "filesChanged", filesChanged: mockChangeset },
					}),
				)
			})

			await waitFor(() => {
				expect(screen.getByTestId("current-file-changeset")).not.toHaveTextContent("undefined")
			})

			// Then clear it
			const clearMessage: ExtensionMessage = {
				type: "filesChanged",
				filesChanged: undefined,
			}

			act(() => {
				messageHandler?.(new MessageEvent("message", { data: clearMessage }))
			})

			await waitFor(() => {
				expect(screen.getByTestId("current-file-changeset")).toHaveTextContent("undefined")
			})
		})

		it("should handle partial state updates for FCO fields", async () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			// Send partial state with only FCO fields
			const partialStateMessage: ExtensionMessage = {
				type: "state",
				state: {
					// Added required fields for ExtensionState
					taskSyncEnabled: false,
					featureRoomoteControlEnabled: false,
					version: "1.0.0",
					clineMessages: [],
					taskHistory: [],
					shouldShowAnnouncement: false,
					allowedCommands: [],
					deniedCommands: [],
					soundEnabled: false,
					soundVolume: 0.5,
					ttsEnabled: false,
					ttsSpeed: 1.0,
					diffEnabled: false,
					enableCheckpoints: true,
					fuzzyMatchThreshold: 1.0,
					language: "en",
					writeDelayMs: 1000,
					browserViewportSize: "900x600",
					screenshotQuality: 75,
					terminalOutputLineLimit: 500,
					terminalOutputCharacterLimit: 50000,
					terminalShellIntegrationTimeout: 4000,
					mcpEnabled: true,
					enableMcpServerCreation: false,
					remoteControlEnabled: false,
					alwaysApproveResubmit: false,
					requestDelaySeconds: 5,
					currentApiConfigName: "default",
					listApiConfigMeta: [],
					mode: "code",
					customModePrompts: {},
					customSupportPrompts: {},
					experiments: {},
					enhancementApiConfigId: "",
					condensingApiConfigId: "",
					customCondensingPrompt: "",
					hasOpenedModeSelector: false,
					autoApprovalEnabled: false,
					customModes: [],
					maxOpenTabsContext: 20,
					maxWorkspaceFiles: 200,
					cwd: "",
					browserToolEnabled: true,
					telemetrySetting: "unset",
					showRooIgnoredFiles: true,
					renderContext: "sidebar",
					maxReadFileLine: -1,
					maxImageFileSize: 5,
					maxTotalImageSize: 20,
					pinnedApiConfigs: {},
					terminalZshOhMy: false,
					maxConcurrentFileReads: 5,
					terminalZshP10k: false,
					terminalZdotdir: false,
					terminalCompressProgressBar: true,
					historyPreviewCollapsed: false,
					cloudUserInfo: null,
					cloudIsAuthenticated: false,
					sharingEnabled: false,
					organizationAllowList: { allowAll: true, providers: {} },
					organizationSettingsVersion: -1,
					autoCondenseContext: true,
					autoCondenseContextPercent: 100,
					profileThresholds: {},
					codebaseIndexConfig: {
						codebaseIndexEnabled: true,
						codebaseIndexQdrantUrl: "http://localhost:6333",
						codebaseIndexEmbedderProvider: "openai",
						codebaseIndexEmbedderBaseUrl: "",
						codebaseIndexEmbedderModelId: "",
						codebaseIndexSearchMaxResults: undefined,
						codebaseIndexSearchMinScore: undefined,
					},
					codebaseIndexModels: { ollama: {}, openai: {} },
					alwaysAllowUpdateTodoList: true,
					includeDiagnosticMessages: true,
					maxDiagnosticMessages: 50,
					openRouterImageApiKey: "",
					openRouterImageGenerationSelectedModel: "",
					apiConfiguration: {},
					// Only some FCO fields
					alwaysAllowFollowupQuestions: true,
					followupAutoApproveTimeoutMs: 2000,
				},
			}

			act(() => {
				messageHandler?.(new MessageEvent("message", { data: partialStateMessage }))
			})

			await waitFor(() => {
				expect(screen.getByTestId("always-allow-followup-questions")).toHaveTextContent("true")
				expect(screen.getByTestId("followup-auto-approve-timeout")).toHaveTextContent("2000")
				// These should maintain their default values since not included in partial update
				expect(screen.getByTestId("include-task-history-in-enhance")).toHaveTextContent("true")
			})
		})
	})

	describe("Context Integration", () => {
		it("should throw error when useExtensionState is used outside provider", () => {
			const TestComponentWithoutProvider = () => {
				useExtensionState()
				return <div>Test</div>
			}

			// Suppress console.error for this test
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			expect(() => {
				render(<TestComponentWithoutProvider />)
			}).toThrow("useExtensionState must be used within an ExtensionStateContextProvider")

			consoleSpy.mockRestore()
		})

		it("should provide all FCO context values correctly", () => {
			const ContextValueChecker = () => {
				const context = useExtensionState()

				// Check that all FCO-related values are provided
				const fcoValues = {
					filesChangedEnabled: context.filesChangedEnabled,
					setFilesChangedEnabled: typeof context.setFilesChangedEnabled,
					currentFileChangeset: context.currentFileChangeset,
					setCurrentFileChangeset: typeof context.setCurrentFileChangeset,
					historyPreviewCollapsed: context.historyPreviewCollapsed,
					setHistoryPreviewCollapsed: typeof context.setHistoryPreviewCollapsed,
					alwaysAllowFollowupQuestions: context.alwaysAllowFollowupQuestions,
					setAlwaysAllowFollowupQuestions: typeof context.setAlwaysAllowFollowupQuestions,
					followupAutoApproveTimeoutMs: context.followupAutoApproveTimeoutMs,
					setFollowupAutoApproveTimeoutMs: typeof context.setFollowupAutoApproveTimeoutMs,
					includeTaskHistoryInEnhance: context.includeTaskHistoryInEnhance,
					setIncludeTaskHistoryInEnhance: typeof context.setIncludeTaskHistoryInEnhance,
					setExperimentEnabled: typeof context.setExperimentEnabled,
				}

				return <div data-testid="fco-values">{JSON.stringify(fcoValues)}</div>
			}

			render(
				<ExtensionStateContextProvider>
					<ContextValueChecker />
				</ExtensionStateContextProvider>,
			)

			const fcoValuesText = screen.getByTestId("fco-values").textContent
			const fcoValues = JSON.parse(fcoValuesText || "{}")

			expect(fcoValues.filesChangedEnabled).toBe(true)
			expect(fcoValues.setFilesChangedEnabled).toBe("function")
			expect(fcoValues.currentFileChangeset).toBeUndefined()
			expect(fcoValues.setCurrentFileChangeset).toBe("function")
			expect(fcoValues.historyPreviewCollapsed).toBe(false)
			expect(fcoValues.setHistoryPreviewCollapsed).toBe("function")
			expect(fcoValues.alwaysAllowFollowupQuestions).toBe(false)
			expect(fcoValues.setAlwaysAllowFollowupQuestions).toBe("function")
			expect(fcoValues.followupAutoApproveTimeoutMs).toBeUndefined()
			expect(fcoValues.setFollowupAutoApproveTimeoutMs).toBe("function")
			expect(fcoValues.includeTaskHistoryInEnhance).toBe(true)
			expect(fcoValues.setIncludeTaskHistoryInEnhance).toBe("function")
			expect(fcoValues.setExperimentEnabled).toBe("function")
		})
	})

	describe("Edge Cases", () => {
		it("should handle malformed state messages gracefully", async () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			// Send malformed message
			const malformedMessage: any = {
				type: "state",
				// Missing state property
			}

			// Should not throw
			act(() => {
				messageHandler?.(new MessageEvent("message", { data: malformedMessage }))
			})

			// Context should still be functional
			expect(screen.getByTestId("files-changed-enabled")).toHaveTextContent("true")
		})

		it("should handle undefined values in state messages", async () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			const stateWithUndefinedMessage: ExtensionMessage = {
				type: "state",
				state: {
					// Added required fields for ExtensionState
					taskSyncEnabled: false,
					featureRoomoteControlEnabled: false,
					version: "1.0.0",
					clineMessages: [],
					taskHistory: [],
					shouldShowAnnouncement: false,
					allowedCommands: [],
					deniedCommands: [],
					soundEnabled: false,
					soundVolume: 0.5,
					ttsEnabled: false,
					ttsSpeed: 1.0,
					diffEnabled: false,
					enableCheckpoints: true,
					fuzzyMatchThreshold: 1.0,
					language: "en",
					writeDelayMs: 1000,
					browserViewportSize: "900x600",
					screenshotQuality: 75,
					terminalOutputLineLimit: 500,
					terminalOutputCharacterLimit: 50000,
					terminalShellIntegrationTimeout: 4000,
					mcpEnabled: true,
					enableMcpServerCreation: false,
					remoteControlEnabled: false,
					alwaysApproveResubmit: false,
					requestDelaySeconds: 5,
					currentApiConfigName: "default",
					listApiConfigMeta: [],
					mode: "code",
					customModePrompts: {},
					customSupportPrompts: {},
					experiments: {},
					enhancementApiConfigId: "",
					condensingApiConfigId: "",
					customCondensingPrompt: "",
					hasOpenedModeSelector: false,
					autoApprovalEnabled: false,
					customModes: [],
					maxOpenTabsContext: 20,
					maxWorkspaceFiles: 200,
					cwd: "",
					browserToolEnabled: true,
					telemetrySetting: "unset",
					showRooIgnoredFiles: true,
					renderContext: "sidebar",
					maxReadFileLine: -1,
					maxImageFileSize: 5,
					maxTotalImageSize: 20,
					pinnedApiConfigs: {},
					terminalZshOhMy: false,
					maxConcurrentFileReads: 5,
					terminalZshP10k: false,
					terminalZdotdir: false,
					terminalCompressProgressBar: true,
					historyPreviewCollapsed: false,
					cloudUserInfo: null,
					cloudIsAuthenticated: false,
					sharingEnabled: false,
					organizationAllowList: { allowAll: true, providers: {} },
					organizationSettingsVersion: -1,
					autoCondenseContext: true,
					autoCondenseContextPercent: 100,
					profileThresholds: {},
					codebaseIndexConfig: {
						codebaseIndexEnabled: true,
						codebaseIndexQdrantUrl: "http://localhost:6333",
						codebaseIndexEmbedderProvider: "openai",
						codebaseIndexEmbedderBaseUrl: "",
						codebaseIndexEmbedderModelId: "",
						codebaseIndexSearchMaxResults: undefined,
						codebaseIndexSearchMinScore: undefined,
					},
					codebaseIndexModels: { ollama: {}, openai: {} },
					alwaysAllowUpdateTodoList: true,
					includeDiagnosticMessages: true,
					maxDiagnosticMessages: 50,
					openRouterImageApiKey: "",
					openRouterImageGenerationSelectedModel: "",
					apiConfiguration: {},
					// Undefined FCO values
					alwaysAllowFollowupQuestions: undefined as any,
					followupAutoApproveTimeoutMs: undefined,
					includeTaskHistoryInEnhance: undefined as any,
				},
			}

			act(() => {
				messageHandler?.(new MessageEvent("message", { data: stateWithUndefinedMessage }))
			})

			// Should maintain existing values when undefined is sent
			await waitFor(() => {
				expect(screen.getByTestId("always-allow-followup-questions")).toHaveTextContent("false")
				expect(screen.getByTestId("followup-auto-approve-timeout")).toHaveTextContent("undefined")
				expect(screen.getByTestId("include-task-history-in-enhance")).toHaveTextContent("true")
			})
		})

		it("should handle rapid state updates correctly", async () => {
			render(
				<ExtensionStateContextProvider>
					<TestComponent />
				</ExtensionStateContextProvider>,
			)

			// Send multiple rapid updates
			const updates = [
				{ alwaysAllowFollowupQuestions: true, followupAutoApproveTimeoutMs: 1000 },
				{ alwaysAllowFollowupQuestions: false, followupAutoApproveTimeoutMs: 2000 },
				{ alwaysAllowFollowupQuestions: true, followupAutoApproveTimeoutMs: 3000 },
			]

			updates.forEach((update, _index) => {
				const stateMessage: ExtensionMessage = {
					type: "state",
					state: {
						// Added required fields for ExtensionState
						taskSyncEnabled: false,
						featureRoomoteControlEnabled: false,
						version: "1.0.0",
						clineMessages: [],
						taskHistory: [],
						shouldShowAnnouncement: false,
						allowedCommands: [],
						deniedCommands: [],
						soundEnabled: false,
						soundVolume: 0.5,
						ttsEnabled: false,
						ttsSpeed: 1.0,
						diffEnabled: false,
						enableCheckpoints: true,
						fuzzyMatchThreshold: 1.0,
						language: "en",
						writeDelayMs: 1000,
						browserViewportSize: "900x600",
						screenshotQuality: 75,
						terminalOutputLineLimit: 500,
						terminalOutputCharacterLimit: 50000,
						terminalShellIntegrationTimeout: 4000,
						mcpEnabled: true,
						enableMcpServerCreation: false,
						remoteControlEnabled: false,
						alwaysApproveResubmit: false,
						requestDelaySeconds: 5,
						currentApiConfigName: "default",
						listApiConfigMeta: [],
						mode: "code",
						customModePrompts: {},
						customSupportPrompts: {},
						experiments: {},
						enhancementApiConfigId: "",
						condensingApiConfigId: "",
						customCondensingPrompt: "",
						hasOpenedModeSelector: false,
						autoApprovalEnabled: false,
						customModes: [],
						maxOpenTabsContext: 20,
						maxWorkspaceFiles: 200,
						cwd: "",
						browserToolEnabled: true,
						telemetrySetting: "unset",
						showRooIgnoredFiles: true,
						renderContext: "sidebar",
						maxReadFileLine: -1,
						maxImageFileSize: 5,
						maxTotalImageSize: 20,
						pinnedApiConfigs: {},
						terminalZshOhMy: false,
						maxConcurrentFileReads: 5,
						terminalZshP10k: false,
						terminalZdotdir: false,
						terminalCompressProgressBar: true,
						historyPreviewCollapsed: false,
						cloudUserInfo: null,
						cloudIsAuthenticated: false,
						sharingEnabled: false,
						organizationAllowList: { allowAll: true, providers: {} },
						organizationSettingsVersion: -1,
						autoCondenseContext: true,
						autoCondenseContextPercent: 100,
						profileThresholds: {},
						codebaseIndexConfig: {
							codebaseIndexEnabled: true,
							codebaseIndexQdrantUrl: "http://localhost:6333",
							codebaseIndexEmbedderProvider: "openai",
							codebaseIndexEmbedderBaseUrl: "",
							codebaseIndexEmbedderModelId: "",
							codebaseIndexSearchMaxResults: undefined,
							codebaseIndexSearchMinScore: undefined,
						},
						codebaseIndexModels: { ollama: {}, openai: {} },
						alwaysAllowUpdateTodoList: true,
						includeDiagnosticMessages: true,
						maxDiagnosticMessages: 50,
						openRouterImageApiKey: "",
						openRouterImageGenerationSelectedModel: "",
						apiConfiguration: {},
						...update,
					},
				}

				act(() => {
					messageHandler?.(new MessageEvent("message", { data: stateMessage }))
				})
			})

			// Should reflect the last update
			await waitFor(() => {
				expect(screen.getByTestId("always-allow-followup-questions")).toHaveTextContent("true")
				expect(screen.getByTestId("followup-auto-approve-timeout")).toHaveTextContent("3000")
			})
		})
	})
})
