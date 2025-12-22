import { useCallback, useState, useEffect, useRef } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import {
	ModelInfo,
	watsonxDefaultModelId,
	REGION_TO_URL,
	type OrganizationAllowList,
	type ProviderSettings,
} from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { vscode } from "@src/utils/vscode"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type WatsonxAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

// Validation helper
const validateRefreshRequest = (
	config: ProviderSettings,
	t: (key: string) => string,
): { valid: boolean; error?: string } => {
	const {
		watsonxPlatform,
		watsonxApiKey,
		watsonxProjectId,
		watsonxBaseUrl,
		watsonxUsername,
		watsonxAuthType,
		watsonxPassword,
	} = config

	if (!watsonxProjectId) {
		return { valid: false, error: t("settings:validation.watsonx.projectId") }
	}

	if (watsonxPlatform === "ibmCloud") {
		if (!watsonxApiKey) return { valid: false, error: t("settings:providers.refreshModels.error") }
	} else if (watsonxPlatform === "cloudPak") {
		if (!watsonxBaseUrl) return { valid: false, error: t("settings:validation.watsonx.baseUrl") }
		if (!watsonxUsername) return { valid: false, error: t("settings:validation.watsonx.username") }
		if (watsonxAuthType === "apiKey" && !watsonxApiKey) {
			return { valid: false, error: t("settings:validation.watsonx.apiKey") }
		}
		if (watsonxAuthType === "password" && !watsonxPassword) {
			return { valid: false, error: t("settings:validation.watsonx.password") }
		}
	}

	return { valid: true }
}

export const WatsonxAI = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
}: WatsonxAIProps) => {
	const { t } = useAppTranslation()
	const [watsonxModels, setWatsonxModels] = useState<Record<string, ModelInfo> | null>(null)
	const initialModelFetchAttempted = useRef(false)

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "watsonxModels") {
				setWatsonxModels(message.watsonxModels ?? {})
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	useEffect(() => {
		if (!apiConfiguration.watsonxPlatform) {
			setApiConfigurationField("watsonxPlatform", "ibmCloud")
		}
		if (apiConfiguration.watsonxPlatform === "ibmCloud" && !apiConfiguration.watsonxRegion) {
			const defaultRegion = "Dallas"
			setApiConfigurationField("watsonxRegion", defaultRegion)
			setApiConfigurationField("watsonxBaseUrl", REGION_TO_URL[defaultRegion])
		}
	}, [apiConfiguration.watsonxPlatform, apiConfiguration.watsonxRegion, setApiConfigurationField])

	const getCurrentRegion = () => {
		const regionEntry = Object.entries(REGION_TO_URL).find(([_, url]) => url === apiConfiguration?.watsonxBaseUrl)
		return regionEntry?.[0] || "Dallas"
	}

	const [selectedRegion, setSelectedRegion] = useState(getCurrentRegion())

	const handleRegionSelect = useCallback(
		(region: string) => {
			setSelectedRegion(region)
			const baseUrl = REGION_TO_URL[region as keyof typeof REGION_TO_URL] || ""
			setApiConfigurationField("watsonxBaseUrl", baseUrl)
			setApiConfigurationField("watsonxRegion", region)
		},
		[setApiConfigurationField],
	)

	const handlePlatformChange = useCallback(
		(newPlatform: "ibmCloud" | "cloudPak") => {
			setApiConfigurationField("watsonxPlatform", newPlatform)

			if (newPlatform === "ibmCloud") {
				const defaultRegion = "Dallas"
				setSelectedRegion(defaultRegion)
				setApiConfigurationField("watsonxRegion", defaultRegion)
				setApiConfigurationField("watsonxBaseUrl", REGION_TO_URL[defaultRegion])
				setApiConfigurationField("watsonxUsername", "")
				setApiConfigurationField("watsonxPassword", "")
			} else {
				setSelectedRegion("custom")
				setApiConfigurationField("watsonxBaseUrl", "")
				setApiConfigurationField("watsonxRegion", "")
			}
			setApiConfigurationField("watsonxAuthType", "apiKey")
		},
		[setApiConfigurationField],
	)

	const handleAuthTypeChange = useCallback(
		(newAuthType: "apiKey" | "password") => {
			setApiConfigurationField("watsonxAuthType", newAuthType)
			setApiConfigurationField(newAuthType === "apiKey" ? "watsonxPassword" : "watsonxApiKey", "")
		},
		[setApiConfigurationField],
	)

	const handleInputChange = useCallback(
		<E,>(field: keyof ProviderSettings, transform: (event: E) => any = inputEventTransform) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	// Auto-fetch models on mount if credentials are available (similar to LMStudio/Ollama pattern)
	useEffect(() => {
		if (initialModelFetchAttempted.current || (watsonxModels && Object.keys(watsonxModels).length > 0)) return

		const { valid } = validateRefreshRequest(apiConfiguration, t)
		if (valid) {
			initialModelFetchAttempted.current = true

			const {
				watsonxPlatform,
				watsonxApiKey,
				watsonxProjectId,
				watsonxUsername,
				watsonxAuthType,
				watsonxPassword,
			} = apiConfiguration
			const baseUrl =
				watsonxPlatform === "ibmCloud"
					? REGION_TO_URL[selectedRegion as keyof typeof REGION_TO_URL]
					: apiConfiguration.watsonxBaseUrl || ""

			vscode.postMessage({
				type: "requestWatsonxModels",
				values: {
					apiKey: watsonxApiKey,
					projectId: watsonxProjectId,
					platform: watsonxPlatform,
					baseUrl,
					authType: watsonxAuthType,
					username: watsonxUsername,
					password: watsonxPassword,
					region: watsonxPlatform === "ibmCloud" ? selectedRegion : undefined,
				},
			})
		}
	}, [apiConfiguration, watsonxModels, t, selectedRegion])

	return (
		<>
			{/* Platform Selection */}
			<div className="w-full mb-1">
				<label className="block font-medium mb-1">{t("settings:providers.watsonx.platform")}</label>
				<Select
					value={apiConfiguration.watsonxPlatform}
					onValueChange={(value) => handlePlatformChange(value as "ibmCloud" | "cloudPak")}>
					<SelectTrigger className="w-full">
						<SelectValue placeholder={t("settings:providers.watsonx.platform")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ibmCloud">IBM Cloud</SelectItem>
						<SelectItem value="cloudPak">IBM Cloud Pak for Data</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* IBM Cloud specific fields */}
			{apiConfiguration.watsonxPlatform === "ibmCloud" && (
				<div className="w-full mb-1">
					<label className="block font-medium mb-1">{t("settings:providers.watsonx.region")}</label>
					<Select value={selectedRegion} onValueChange={handleRegionSelect}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("settings:providers.watsonx.region")} />
						</SelectTrigger>
						<SelectContent>
							{Object.keys(REGION_TO_URL).map((regionCode) => (
								<SelectItem key={regionCode} value={regionCode}>
									{regionCode}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						{t("settings:providers.watsonx.selectedEndpoint")}:{" "}
						{REGION_TO_URL[selectedRegion as keyof typeof REGION_TO_URL]}
					</div>
				</div>
			)}

			{/* IBM Cloud Pak for Data specific fields */}
			{apiConfiguration.watsonxPlatform === "cloudPak" && (
				<>
					<VSCodeTextField
						value={apiConfiguration.watsonxBaseUrl}
						onInput={handleInputChange("watsonxBaseUrl")}
						placeholder="https://your-cp4d-instance.example.com"
						className="w-full mb-1">
						<label className="block font-medium mb-1">URL</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground -mt-1 mb-1">
						{t("settings:providers.watsonx.urlDescription")}
					</div>

					<VSCodeTextField
						value={apiConfiguration.watsonxUsername || ""}
						onInput={handleInputChange("watsonxUsername")}
						placeholder={t("settings:providers.watsonx.username")}
						className="w-full mb-1">
						<label className="block font-medium mb-1">{t("settings:providers.watsonx.username")}</label>
					</VSCodeTextField>

					<div className="w-full mb-1">
						<label className="block font-medium mb-1">{t("settings:providers.watsonx.authType")}</label>
						<Select
							value={apiConfiguration.watsonxAuthType}
							onValueChange={(value) => handleAuthTypeChange(value as "apiKey" | "password")}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t("settings:providers.watsonx.authType")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="apiKey">{t("settings:providers.watsonx.apiKey")}</SelectItem>
								<SelectItem value="password">{t("settings:providers.watsonx.password")}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</>
			)}

			<VSCodeTextField
				value={apiConfiguration?.watsonxProjectId || ""}
				onInput={handleInputChange("watsonxProjectId")}
				placeholder={t("settings:providers.watsonx.projectId")}
				className="w-full mb-1">
				<label className="block font-medium mb-1">{t("settings:providers.watsonx.projectId")}</label>
			</VSCodeTextField>

			{/* Credentials - API Key or Password */}
			{(apiConfiguration.watsonxPlatform === "ibmCloud" || apiConfiguration.watsonxAuthType === "apiKey") && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.watsonxApiKey || ""}
						type="password"
						onInput={handleInputChange("watsonxApiKey")}
						placeholder={t("settings:providers.watsonx.apiKey")}
						className="w-full mb-1">
						<label className="block font-medium mb-1">{t("settings:providers.watsonx.apiKey")}</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground -mt-1 mb-1">
						{t("settings:providers.apiKeyStorageNotice")}
					</div>
				</>
			)}

			{apiConfiguration.watsonxPlatform === "cloudPak" && apiConfiguration.watsonxAuthType === "password" && (
				<>
					<VSCodeTextField
						value={apiConfiguration.watsonxPassword || ""}
						type="password"
						onInput={handleInputChange("watsonxPassword")}
						placeholder={t("settings:providers.watsonx.password")}
						className="w-full mb-1">
						<label className="block font-medium mb-1">{t("settings:providers.watsonx.password")}</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground -mt-1 mb-1">
						{t("settings:providers.passwordStorageNotice")}
					</div>
				</>
			)}

			<ModelPicker
				apiConfiguration={apiConfiguration}
				defaultModelId={watsonxDefaultModelId}
				models={watsonxModels && Object.keys(watsonxModels).length > 0 ? watsonxModels : {}}
				modelIdKey="watsonxModelId"
				serviceName="IBM watsonx"
				serviceUrl="https://www.ibm.com/products/watsonx-ai/foundation-models"
				setApiConfigurationField={setApiConfigurationField}
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
		</>
	)
}
