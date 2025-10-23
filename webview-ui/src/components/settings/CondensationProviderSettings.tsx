import React, { useEffect, useRef, useState } from "react"
import {
	VSCodeButton,
	VSCodeDivider,
	VSCodeRadio,
	VSCodeRadioGroup,
	VSCodeTextArea,
	VSCodeLink,
} from "@vscode/webview-ui-toolkit/react"
import { Database, ChevronDown, ChevronUp, AlertCircle, Info } from "lucide-react"

import { vscode } from "@src/utils/vscode"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

interface Provider {
	id: string
	name: string
	description: string
	enabled: boolean
	priority: number
}

type SmartPreset = "conservative" | "balanced" | "aggressive"

interface SmartProviderSettings {
	preset: SmartPreset
	customConfig?: string // JSON string for advanced users
}

const PRESET_DESCRIPTIONS = {
	conservative: {
		title: "Conservative (Quality Priority)",
		description: "Maximum quality with LLM summarization. Slower but preserves more context.",
		stats: "60-70% reduction • $0.02-0.05 cost • 3-8s",
		icon: "🎯",
	},
	balanced: {
		title: "Balanced (Recommended)",
		description: "Optimal balance of speed, cost, and quality. Best for most use cases.",
		stats: "70-80% reduction • $0.005-0.02 cost • 1-4s",
		icon: "⚖️",
	},
	aggressive: {
		title: "Aggressive (Speed Priority)",
		description: "Maximum reduction with minimal cost. Fast but may lose some context.",
		stats: "85-95% reduction • $0-0.01 cost • <500ms",
		icon: "⚡",
	},
}

const PROVIDER_INFO = {
	native: {
		badge: "LLM",
		pros: ["Highest quality", "Intelligent summarization"],
		cons: ["Slower", "More expensive"],
	},
	lossless: {
		badge: "FREE",
		pros: ["Zero cost", "Fast", "No information loss"],
		cons: ["Limited reduction", "Only for duplicates"],
	},
	truncation: {
		badge: "FAST",
		pros: ["Fastest", "Zero cost", "Simple"],
		cons: ["Low quality", "May lose important context"],
	},
	smart: {
		badge: "SMART",
		pros: ["Configurable", "Multi-strategy", "Predictable"],
		cons: ["Requires configuration"],
	},
}

export const CondensationProviderSettings: React.FC = () => {
	console.log("🔍 [CondensationProviderSettings] Component mounting")

	const [_providers, setProviders] = useState<Provider[]>([])
	const [defaultProviderId, setDefaultProviderId] = useState<string>("native")
	const [smartSettings, setSmartSettings] = useState<SmartProviderSettings>({
		preset: "balanced",
		customConfig: undefined,
	})
	const [showAdvanced, setShowAdvanced] = useState(false)
	const [customConfigText, setCustomConfigText] = useState("")
	const [presetConfigJson, setPresetConfigJson] = useState<string>("")
	const [configError, setConfigError] = useState<string | undefined>()

	// Use ref to track current value accessible in closure (prevents stale closure)
	// This resolves race condition where backend messages arrive with outdated values
	const defaultProviderIdRef = useRef<string>("native")

	useEffect(() => {
		console.log("🔍 [CondensationProviderSettings] useEffect running - requesting data from backend")
		// Request initial data
		vscode.postMessage({ type: "getCondensationProviders" })
		console.log("🔍 [CondensationProviderSettings] Message sent to backend: getCondensationProviders")

		// Listen for updates
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			console.log("🔍 [CondensationProviderSettings] Received message:", message.type, message)
			if (message.type === "condensationProviders") {
				console.log("🔍 [CondensationProviderSettings] Processing condensationProviders message:", {
					providers: message.providers,
					defaultProviderId: message.defaultProviderId,
					smartProviderSettings: message.smartProviderSettings,
				})
				setProviders(message.providers || [])

				// Only update defaultProviderId if backend value differs from current ref value
				// This prevents race conditions where backend echoes old value after user selection
				const incomingProviderId = message.defaultProviderId || "native"
				const currentProviderId = defaultProviderIdRef.current

				console.log("🔍 [CondensationProviderSettings] Backend update check:", {
					incomingBackend: incomingProviderId,
					currentRef: currentProviderId,
					willUpdate: incomingProviderId !== currentProviderId,
				})

				if (incomingProviderId !== currentProviderId) {
					setDefaultProviderId(incomingProviderId)
					defaultProviderIdRef.current = incomingProviderId
					console.log(
						"🔍 [CondensationProviderSettings] Updated defaultProviderId from backend:",
						incomingProviderId,
					)
				} else {
					console.log("🔍 [CondensationProviderSettings] Ignoring backend update - same as current value")
				}

				// Load Smart Provider settings if available
				if (message.smartProviderSettings) {
					setSmartSettings(message.smartProviderSettings)

					// Load preset config JSON from backend
					if (message.presetConfigJson) {
						setPresetConfigJson(message.presetConfigJson)
					}

					// If custom config exists, display it; otherwise show preset
					if (message.smartProviderSettings.customConfig) {
						setCustomConfigText(
							JSON.stringify(JSON.parse(message.smartProviderSettings.customConfig), null, 2),
						)
					} else {
						setCustomConfigText(message.presetConfigJson || "")
					}
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleDefaultProviderChange = (providerId: string) => {
		console.log("🔍 [CondensationProviderSettings] User selected provider:", providerId)

		// Update ref immediately to prevent backend race conditions
		defaultProviderIdRef.current = providerId

		// Update local state for responsive UI
		setDefaultProviderId(providerId)

		// Send to backend
		vscode.postMessage({
			type: "setDefaultCondensationProvider",
			providerId,
		})

		console.log("🔍 [CondensationProviderSettings] Ref updated, state synced, backend notified")
	}

	const handleSmartPresetChange = (preset: SmartPreset) => {
		const newSettings = { ...smartSettings, preset }
		setSmartSettings(newSettings)
		vscode.postMessage({
			type: "updateSmartProviderSettings",
			smartProviderSettings: newSettings,
		})
	}

	const handleToggleAdvanced = () => {
		setShowAdvanced(!showAdvanced)
	}

	const validateAndSaveCustomConfig = () => {
		try {
			// Validate JSON
			const parsed = JSON.parse(customConfigText)

			// Basic validation of structure
			if (!parsed.passes || !Array.isArray(parsed.passes)) {
				throw new Error("Configuration must include 'passes' array")
			}

			// Save
			const newSettings = {
				...smartSettings,
				customConfig: customConfigText,
			}
			setSmartSettings(newSettings)
			setConfigError(undefined)

			vscode.postMessage({
				type: "updateSmartProviderSettings",
				smartProviderSettings: newSettings,
			})

			// Show success
			vscode.postMessage({
				type: "showMessage",
				level: "info",
				message: "Custom configuration saved successfully",
			})
		} catch (error) {
			setConfigError(error instanceof Error ? error.message : "Invalid JSON")
		}
	}

	const resetToPreset = () => {
		const newSettings = {
			preset: smartSettings.preset,
			customConfig: undefined,
		}
		setSmartSettings(newSettings)
		setCustomConfigText(presetConfigJson)
		setConfigError(undefined)

		vscode.postMessage({
			type: "updateSmartProviderSettings",
			smartProviderSettings: newSettings,
		})

		// Show success message
		vscode.postMessage({
			type: "showMessage",
			level: "info",
			message: `Reset to ${smartSettings.preset} preset configuration`,
		})
	}

	const getProviderBadge = (providerId: string) => {
		const info = PROVIDER_INFO[providerId as keyof typeof PROVIDER_INFO]
		if (!info) return null

		const badgeColors: Record<string, string> = {
			LLM: "bg-blue-500/20 text-blue-300",
			FREE: "bg-green-500/20 text-green-300",
			FAST: "bg-yellow-500/20 text-yellow-300",
			SMART: "bg-purple-500/20 text-purple-300",
		}

		return <span className={`text-xs px-2 py-0.5 rounded ${badgeColors[info.badge] || ""}`}>{info.badge}</span>
	}

	console.log("🔍 [CondensationProviderSettings] Rendering component", {
		defaultProviderId,
		smartSettings,
		showAdvanced,
		configError,
	})

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Database className="w-4" />
					<div>Context Condensation Provider</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="condensation-provider-settings">
					<p className="text-sm text-vscode-descriptionForeground mb-4">
						Choose how Roo summarizes conversation history when context grows too large. Smart Provider is
						recommended for most users.
					</p>

					<VSCodeDivider />

					{/* Provider Selection */}
					<div className="mt-4">
						<h4 className="mb-3 font-medium">Select Provider</h4>
						<VSCodeRadioGroup
							value={defaultProviderId}
							onChange={(e: Event | React.FormEvent<HTMLElement>) => {
								const target = ((e as CustomEvent)?.detail?.target ||
									(e.target as HTMLInputElement)) as HTMLInputElement
								handleDefaultProviderChange(target.value)
							}}>
							{[
								{
									id: "native",
									name: "Native Provider",
									description:
										"LLM-based intelligent summarization (High quality, slower, expensive)",
								},
								{
									id: "smart",
									name: "Smart Provider",
									description:
										"Intelligent multi-pass condensation with configurable presets (Recommended)",
								},
								{
									id: "lossless",
									name: "Lossless Provider",
									description:
										"Zero-loss optimization via deduplication (Fast, free, limited reduction)",
								},
								{
									id: "truncation",
									name: "Truncation Provider",
									description: "Simple mechanical truncation (Fastest, free, may lose context)",
								},
							].map((provider) => (
								<div key={provider.id} className="mb-3">
									<VSCodeRadio value={provider.id} checked={defaultProviderId === provider.id}>
										<div className="flex items-start justify-between w-full">
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<span className="font-medium">{provider.name}</span>
													{getProviderBadge(provider.id)}
												</div>
												<div className="text-xs text-vscode-descriptionForeground mt-1">
													{provider.description}
												</div>
											</div>
										</div>
									</VSCodeRadio>
								</div>
							))}
						</VSCodeRadioGroup>
					</div>

					{/* Smart Provider Configuration */}
					{defaultProviderId === "smart" && (
						<>
							<VSCodeDivider className="my-4" />
							<div className="mt-4">
								<h4 className="mb-3 font-medium flex items-center gap-2">
									<span>Smart Provider Configuration</span>
									<Info className="w-4 h-4 text-vscode-descriptionForeground" />
								</h4>

								<div className="space-y-2">
									{(["conservative", "balanced", "aggressive"] as SmartPreset[]).map((preset) => {
										const info = PRESET_DESCRIPTIONS[preset]
										return (
											<div
												key={preset}
												className={`p-3 rounded border cursor-pointer transition-colors ${
													smartSettings.preset === preset
														? "border-vscode-focusBorder bg-vscode-list-activeSelectionBackground"
														: "border-vscode-input-border hover:border-vscode-focusBorder"
												}`}
												onClick={() => handleSmartPresetChange(preset)}>
												<div className="flex items-start gap-3">
													<div className="text-2xl mt-0.5">{info.icon}</div>
													<div className="flex-1">
														<div className="flex items-center gap-2 mb-1">
															<span className="font-medium">{info.title}</span>
															{smartSettings.preset === preset && (
																<span className="text-xs text-vscode-button-foreground">
																	✓ Active
																</span>
															)}
														</div>
														<p className="text-sm text-vscode-descriptionForeground mb-2">
															{info.description}
														</p>
														<div className="text-xs text-vscode-descriptionForeground">
															{info.stats}
														</div>
													</div>
												</div>
											</div>
										)
									})}
								</div>

								{/* Advanced Configuration Toggle */}
								<div className="mt-4">
									<VSCodeButton
										appearance="secondary"
										onClick={handleToggleAdvanced}
										className="w-full whitespace-nowrap text-xs px-2 py-1">
										{showAdvanced ? (
											<ChevronUp className="w-3 inline mr-1" />
										) : (
											<ChevronDown className="w-3 inline mr-1" />
										)}
										{showAdvanced ? "Hide" : "Show"} Advanced
									</VSCodeButton>
								</div>

								{/* Advanced JSON Editor */}
								{showAdvanced && (
									<div className="mt-4 p-4 bg-vscode-textBlockQuote-background rounded">
										<div className="flex items-start gap-2 mb-3">
											<AlertCircle className="w-4 h-4 mt-0.5 text-yellow-500" />
											<div className="text-sm">
												<p className="font-medium mb-1">Advanced: Custom Configuration</p>
												<p className="text-vscode-descriptionForeground">
													Edit Smart Provider JSON configuration directly. This overrides the
													selected preset. Use with caution.
												</p>
											</div>
										</div>

										<VSCodeTextArea
											value={customConfigText}
											onChange={(e: any) => setCustomConfigText(e.target.value)}
											rows={15}
											className="w-full font-mono text-xs"
										/>

										{configError && (
											<div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400 flex items-start gap-2">
												<AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
												<span>{configError}</span>
											</div>
										)}

										<div className="mt-3 flex gap-2">
											<VSCodeButton onClick={validateAndSaveCustomConfig}>
												Validate & Save
											</VSCodeButton>
											<VSCodeButton appearance="secondary" onClick={resetToPreset}>
												Reset to Preset
											</VSCodeButton>
										</div>

										<div className="mt-3">
											<VSCodeLink href="https://github.com/RooVetGit/Roo-Code/blob/main/src/core/condense/providers/smart/README.md">
												📚 View Configuration Documentation
											</VSCodeLink>
										</div>
									</div>
								)}
							</div>
						</>
					)}

					{/* Info Box */}
					<div className="mt-6 p-3 bg-vscode-textBlockQuote-background rounded text-xs text-vscode-descriptionForeground">
						<p className="mb-2">
							<strong>About Context Condensation:</strong>
						</p>
						<p className="mb-2">
							When your conversation history exceeds the configured threshold, Roo automatically condenses
							older messages to stay within API token limits while preserving important context.
						</p>
						<p className="mb-0">
							• <strong>Smart Provider</strong> uses intelligent multi-pass strategies for optimal results
							<br />• <strong>Native Provider</strong> uses LLM API calls for high-quality summarization
							<br />• <strong>Lossless Provider</strong> removes duplicates without losing information
							<br />• <strong>Truncation Provider</strong> applies simple mechanical truncation
						</p>
					</div>
				</div>
			</Section>
		</div>
	)
}
