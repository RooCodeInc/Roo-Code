import { HTMLAttributes, useState, useEffect } from "react"
import { FlaskConical } from "lucide-react"
import { VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import type { Experiments } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import { SetExperimentEnabled, SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { ImageGenerationSettings } from "./ImageGenerationSettings"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	securityCustomConfigPath?: string
	setCachedStateField?: SetCachedStateField<any>
	apiConfiguration?: any
	setApiConfigurationField?: any
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	setOpenRouterImageApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel?: (model: string) => void
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	securityCustomConfigPath: propSecurityCustomConfigPath,
	setCachedStateField,
	apiConfiguration,
	setApiConfigurationField,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	className,
	...props
}: ExperimentalSettingsProps) => {
	const { t } = useAppTranslation()
	const { securityCustomConfigPath: stateSecurityCustomConfigPath, setSecurityCustomConfigPath } = useExtensionState()

	// Use prop if provided, otherwise fall back to internal state
	const securityCustomConfigPath = propSecurityCustomConfigPath ?? stateSecurityCustomConfigPath

	// Use prop function if provided, otherwise use internal state setter with auto-save
	const updateSecurityCustomConfigPath = setCachedStateField
		? (value: string) => setCachedStateField("securityCustomConfigPath", value)
		: (value: string) => {
				setSecurityCustomConfigPath(value)
				// Auto-save when using internal state management
				vscode.postMessage({ type: "securityCustomConfigPath", text: value })
			}

	// Check if the security middleware is enabled
	const isSecurityMiddlewareEnabled = experiments[EXPERIMENT_IDS.SECURITY_MIDDLEWARE] ?? false

	// Config status state
	const [configStatus, setConfigStatus] = useState<{
		globalPath: string
		globalExists: boolean
		projectPath: string
		projectExists: boolean
		customPath?: string
		customExists?: boolean
	} | null>(null)

	// Parse encoded config path that includes enabled state
	const parseConfigValue = (value: string): { enabled: boolean; path: string } => {
		if (value.startsWith("DISABLED:")) {
			return { enabled: false, path: value.substring(9) }
		}
		return { enabled: !!value, path: value }
	}

	const { enabled: configEnabled, path: actualConfigPath } = parseConfigValue(securityCustomConfigPath || "")
	const [enableCustomConfig, setEnableCustomConfig] = useState(configEnabled)

	// Transform full paths to use ~ notation
	const transformPath = (fullPath: string): string => {
		const homeDir = process.env.HOME || "/Users/" + process.env.USER
		if (fullPath.startsWith(homeDir)) {
			return fullPath.replace(homeDir, "~")
		}
		return fullPath
	}

	// Update toggle when custom config path changes
	useEffect(() => {
		const { enabled } = parseConfigValue(securityCustomConfigPath || "")
		setEnableCustomConfig(enabled)
	}, [securityCustomConfigPath])

	// Fetch config status when security middleware is enabled
	useEffect(() => {
		if (isSecurityMiddlewareEnabled) {
			vscode.postMessage({ type: "getSecurityConfigStatus" })
		}
	}, [isSecurityMiddlewareEnabled])

	// Listen for config status response
	useEffect(() => {
		const messageListener = (event: MessageEvent) => {
			if (event.data.type === "securityConfigStatus") {
				setConfigStatus(event.data.configStatus)
			}
		}
		window.addEventListener("message", messageListener)
		return () => window.removeEventListener("message", messageListener)
	}, [])

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<FlaskConical className="w-4" />
					<div>{t("settings:sections.experimental")}</div>
				</div>
			</SectionHeader>

			<Section>
				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
					.map((config) => {
						if (config[0] === "MULTI_FILE_APPLY_DIFF") {
							return (
								<ExperimentalFeature
									key={config[0]}
									experimentKey={config[0]}
									enabled={experiments[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF, enabled)
									}
								/>
							)
						}

						// Special handling for SECURITY_MIDDLEWARE - show custom path input when enabled
						if (config[0] === "SECURITY_MIDDLEWARE") {
							return (
								<div key={config[0]}>
									<ExperimentalFeature
										experimentKey={config[0]}
										enabled={experiments[EXPERIMENT_IDS.SECURITY_MIDDLEWARE] ?? false}
										onChange={(enabled) =>
											setExperimentEnabled(EXPERIMENT_IDS.SECURITY_MIDDLEWARE, enabled)
										}
									/>
									{isSecurityMiddlewareEnabled && (
										<div className="mt-2 ml-6">
											<div className="mb-4">
												<div className="text-sm font-medium mb-2">Config Management</div>
												<p className="text-vscode-descriptionForeground text-xs mb-2">
													Create security configuration files to customize allowed operations
												</p>
												{configStatus && (
													<div className="text-xs space-y-1">
														<div
															className="cursor-pointer text-blue-400 hover:text-blue-300"
															onClick={() => {
																if (configStatus.projectExists) {
																	vscode.postMessage({
																		type: "openFile",
																		text: configStatus.projectPath,
																	})
																} else {
																	vscode.postMessage({
																		type: "createProjectSecurityConfig",
																	})
																}
															}}>
															{configStatus.projectExists ? "✅" : "❌"} Project:
															.roo/security.yaml
														</div>
														<div
															className="cursor-pointer text-blue-400 hover:text-blue-300"
															onClick={() => {
																if (configStatus.globalExists) {
																	vscode.postMessage({
																		type: "openFile",
																		text: configStatus.globalPath,
																	})
																} else {
																	vscode.postMessage({
																		type: "createGlobalSecurityConfig",
																	})
																}
															}}>
															{configStatus.globalExists ? "✅" : "❌"} Global:
															~/.roo/security.yaml
														</div>
														{configStatus.customPath && (
															<div
																className="cursor-pointer text-blue-400 hover:text-blue-300"
																onClick={() => {
																	vscode.postMessage({
																		type: "openFile",
																		text: configStatus.customPath,
																	})
																}}>
																{configStatus.customExists ? "✅" : "❌"}Custom:{" "}
																{configStatus.customPath}
															</div>
														)}
													</div>
												)}
											</div>
											<div>
												<div className="flex items-center gap-2 mb-2">
													<input
														type="checkbox"
														checked={enableCustomConfig}
														onChange={(e) => {
															const isEnabled = e.target.checked
															setEnableCustomConfig(isEnabled)

															if (isEnabled) {
																// Toggle ON: Remove DISABLED prefix (enables custom config)
																updateSecurityCustomConfigPath(actualConfigPath)
															} else {
																// Toggle OFF: Add DISABLED prefix (disables but preserves path)
																const currentPath =
																	actualConfigPath || securityCustomConfigPath || ""
																updateSecurityCustomConfigPath(
																	`DISABLED:${currentPath}`,
																)
															}
														}}
														className="w-3 h-3"
													/>
													<span className="text-sm font-medium">
														Enable custom global configs
													</span>
													{enableCustomConfig && configStatus?.customExists && (
														<span className="text-green-400">✅</span>
													)}
												</div>
												{enableCustomConfig && (
													<div>
														<VSCodeTextField
															value={securityCustomConfigPath || ""}
															placeholder="e.g., ~/company-config/security.yaml"
															onInput={(e: any) =>
																updateSecurityCustomConfigPath(e.target.value)
															}
															style={{ width: "100%" }}>
															<span slot="label">Additional Security Config Path</span>
														</VSCodeTextField>
														<p className="text-vscode-descriptionForeground text-xs mt-1">
															Add path for additional YAML config file. For example:
															~/company-config/security.yaml
														</p>
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							)
						}

						// Special handling for IMAGE_GENERATION - show additional options when enabled
						if (
							config[0] === "IMAGE_GENERATION" &&
							setOpenRouterImageApiKey &&
							setImageGenerationSelectedModel
						) {
							return (
								<ImageGenerationSettings
									key={config[0]}
									enabled={experiments[EXPERIMENT_IDS.IMAGE_GENERATION] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.IMAGE_GENERATION, enabled)
									}
									openRouterImageApiKey={openRouterImageApiKey}
									openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
									setOpenRouterImageApiKey={setOpenRouterImageApiKey}
									setImageGenerationSelectedModel={setImageGenerationSelectedModel}
								/>
							)
						}
						return (
							<ExperimentalFeature
								key={config[0]}
								experimentKey={config[0]}
								enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
								onChange={(enabled) =>
									setExperimentEnabled(
										EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
										enabled,
									)
								}
							/>
						)
					})}
			</Section>
		</div>
	)
}
