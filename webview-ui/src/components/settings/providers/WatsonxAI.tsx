import { useCallback, useState, useEffect, useRef } from "react"
import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { ModelInfo, watsonxAiDefaultModelId, type OrganizationAllowList, type ProviderSettings } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { vscode } from "@src/utils/vscode"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { inputEventTransform } from "../transforms"
import { RouterName } from "@roo/api"
import { ModelPicker } from "../ModelPicker"
import { Trans } from "react-i18next"

const WATSONX_REGIONS = {
	"us-south": "Dallas",
	"eu-de": "Frankfurt",
	"eu-gb": "London",
	"jp-tok": "Tokyo",
	"au-syd": "Sydney",
	"ca-tor": "Toronto",
	"ap-south-1": "Mumbai",
}

const REGION_TO_URL = {
	"us-south": "https://us-south.ml.cloud.ibm.com",
	"eu-de": "https://eu-de.ml.cloud.ibm.com",
	"eu-gb": "https://eu-gb.ml.cloud.ibm.com",
	"jp-tok": "https://jp-tok.ml.cloud.ibm.com",
	"au-syd": "https://au-syd.ml.cloud.ibm.com",
	"ca-tor": "https://ca-tor.ml.cloud.ibm.com",
	"ap-south-1": "https://ap-south-1.aws.wxai.ibm.com",
	custom: "",
}

type WatsonxAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const WatsonxAI = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
}: WatsonxAIProps) => {
	const { t } = useAppTranslation()
	const [watsonxModels, setWatsonxModels] = useState<Record<string, ModelInfo> | null>(null)
	const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
	const [refreshError, setRefreshError] = useState<string | undefined>()
	const watsonxErrorJustReceived = useRef(false)
	const initialModelFetchAttempted = useRef(false)

	useEffect(() => {
		if (!apiConfiguration.watsonxPlatform) {
			setApiConfigurationField("watsonxPlatform", "ibmCloud")
		}
	}, [apiConfiguration.watsonxPlatform, setApiConfigurationField])

	const getCurrentRegion = () => {
		const baseUrl = apiConfiguration?.watsonxBaseUrl || ""
		const regionEntry = Object.entries(REGION_TO_URL).find(([_, url]) => url === baseUrl)
		return regionEntry ? regionEntry[0] : "us-south"
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
				const defaultRegion = "us-south"
				setSelectedRegion(defaultRegion)
				setApiConfigurationField("watsonxRegion", defaultRegion)
				setApiConfigurationField("watsonxBaseUrl", REGION_TO_URL[defaultRegion])
				setApiConfigurationField("watsonxUsername", "")
				setApiConfigurationField("watsonxPassword", "")
				setApiConfigurationField("watsonxAuthType", "apiKey")
			} else {
				setSelectedRegion("custom")
				setApiConfigurationField("watsonxBaseUrl", "")
				setApiConfigurationField("watsonxAuthType", "apiKey")
				setApiConfigurationField("watsonxRegion", "")
			}
		},
		[setApiConfigurationField],
	)

	const handleAuthTypeChange = useCallback(
		(newAuthType: "apiKey" | "password") => {
			setApiConfigurationField("watsonxAuthType", newAuthType)
			if (newAuthType === "apiKey") {
				setApiConfigurationField("watsonxPassword", "")
			} else {
				setApiConfigurationField("watsonxApiKey", "")
			}
		},
		[setApiConfigurationField],
	)

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "singleRouterModelFetchResponse" && !message.success) {
				const providerName = message.values?.provider as RouterName
				if (providerName === "watsonx") {
					watsonxErrorJustReceived.current = true
					setRefreshStatus("error")
					setRefreshError(message.error)
				}
			} else if (message.type === "watsonxModels") {
				setWatsonxModels(message.watsonxModels ?? {})
				if (refreshStatus === "loading") {
					if (!watsonxErrorJustReceived.current) {
						setRefreshStatus("success")
					} else {
						watsonxErrorJustReceived.current = false
					}
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [refreshStatus, refreshError, t])

	const handleInputChange = useCallback(
		<E,>(field: keyof ProviderSettings, transform: (event: E) => any = inputEventTransform) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const handleRefreshModels = useCallback(() => {
		setRefreshStatus("loading")
		setRefreshError(undefined)
		watsonxErrorJustReceived.current = false

		const apiKey = apiConfiguration.watsonxApiKey
		const platform = apiConfiguration.watsonxPlatform
		const username = apiConfiguration.watsonxUsername
		const authType = apiConfiguration.watsonxAuthType
		const password = apiConfiguration.watsonxPassword
		const projectId = apiConfiguration.watsonxProjectId

		let baseUrl = ""
		if (platform === "ibmCloud") {
			baseUrl = REGION_TO_URL[selectedRegion as keyof typeof REGION_TO_URL]
		} else {
			baseUrl = apiConfiguration.watsonxBaseUrl || ""
		}

		if (platform === "ibmCloud" && (!apiKey || !baseUrl)) {
			setRefreshStatus("error")
			setRefreshError(t("settings:providers.refreshModels.missingConfig"))
			return
		}

		if (platform === "cloudPak") {
			if (!baseUrl) {
				setRefreshStatus("error")
				setRefreshError("URL is required for IBM Cloud Pak for Data")
				return
			}

			if (!username) {
				setRefreshStatus("error")
				setRefreshError("Username is required for IBM Cloud Pak for Data")
				return
			}

			if (authType === "apiKey" && !apiKey) {
				setRefreshStatus("error")
				setRefreshError("API Key is required for IBM Cloud Pak for Data")
				return
			}

			if (authType === "password" && !password) {
				setRefreshStatus("error")
				setRefreshError("Password is required for IBM Cloud Pak for Data")
				return
			}
		}

		vscode.postMessage({
			type: "requestWatsonxModels",
			values: {
				apiKey: apiKey,
				projectId: projectId,
				platform: platform,
				baseUrl: baseUrl,
				username: username,
				authType: authType,
				password: password,
				region: selectedRegion,
			},
		})
	}, [apiConfiguration, setRefreshStatus, setRefreshError, t, selectedRegion])

	// Refresh models when component mounts if API key is available
	useEffect(() => {
		if (
			!initialModelFetchAttempted.current &&
			apiConfiguration.watsonxApiKey &&
			(!watsonxModels || Object.keys(watsonxModels).length === 0)
		) {
			initialModelFetchAttempted.current = true
			handleRefreshModels()
		}
	}, [apiConfiguration.watsonxApiKey, watsonxModels, handleRefreshModels])

	return (
		<>
			{/* Platform Selection */}
			<div className="w-full mb-1">
				<label className="block font-medium mb-1">Platform</label>
				<Select
					value={apiConfiguration.watsonxPlatform}
					onValueChange={(value) => handlePlatformChange(value as "ibmCloud" | "cloudPak")}>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Select a platform" />
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
					<label className="block font-medium mb-1">Region</label>
					<Select value={selectedRegion} onValueChange={handleRegionSelect}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Select a region" />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(WATSONX_REGIONS).map(([regionCode, regionName]) => (
								<SelectItem key={regionCode} value={regionCode}>
									{regionName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						Selected endpoint: {REGION_TO_URL[selectedRegion as keyof typeof REGION_TO_URL]}
					</div>
				</div>
			)}

			{/* IBM Cloud Pak for Data specific fields */}
			{apiConfiguration.watsonxPlatform === "cloudPak" && (
				<div className="w-full mb-1">
					<VSCodeTextField
						value={apiConfiguration.watsonxBaseUrl}
						onInput={handleInputChange("watsonxBaseUrl")}
						placeholder="https://your-cp4d-instance.example.com"
						className="w-full">
						<label className="block font-medium mb-1">URL</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						Enter the full URL of your IBM Cloud Pak for Data instance
					</div>
				</div>
			)}

			<div className="w-full mb-1">
				<VSCodeTextField
					value={apiConfiguration?.watsonxProjectId || ""}
					onInput={handleInputChange("watsonxProjectId")}
					placeholder="Project ID"
					className="w-full">
					<label className="block font-medium mb-1">Project ID</label>
				</VSCodeTextField>
			</div>

			{apiConfiguration.watsonxPlatform === "ibmCloud" && (
				<div className="w-full mb-1">
					<VSCodeTextField
						value={apiConfiguration?.watsonxApiKey || ""}
						type="password"
						onInput={handleInputChange("watsonxApiKey")}
						placeholder={t("settings:placeholders.apiKey")}
						className="w-full">
						<label className="block font-medium mb-1">API Key</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						{t("settings:providers.apiKeyStorageNotice")}
					</div>
				</div>
			)}

			{apiConfiguration.watsonxPlatform === "cloudPak" && (
				<>
					<div className="w-full mb-1">
						<VSCodeTextField
							value={apiConfiguration.watsonxUsername ? apiConfiguration.watsonxUsername : ""}
							onInput={handleInputChange("watsonxUsername")}
							placeholder="Username"
							className="w-full">
							<label className="block font-medium mb-1">Username</label>
						</VSCodeTextField>
					</div>

					<div className="w-full mb-1">
						<label className="block font-medium mb-1">Authentication Type</label>
						<Select
							value={apiConfiguration.watsonxAuthType}
							onValueChange={(value) => handleAuthTypeChange(value as "apiKey" | "password")}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select authentication type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="apiKey">API Key</SelectItem>
								<SelectItem value="password">Password</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{apiConfiguration.watsonxAuthType === "apiKey" ? (
						<div className="w-full mb-1">
							<VSCodeTextField
								value={apiConfiguration?.watsonxApiKey || ""}
								type="password"
								onInput={handleInputChange("watsonxApiKey")}
								placeholder="API Key"
								className="w-full">
								<label className="block font-medium mb-1">API Key</label>
							</VSCodeTextField>
							<div className="text-sm text-vscode-descriptionForeground mt-1">
								{t("settings:providers.apiKeyStorageNotice")}
							</div>
						</div>
					) : (
						<div className="w-full mb-1">
							<VSCodeTextField
								value={apiConfiguration.watsonxPassword}
								type="password"
								onInput={handleInputChange("watsonxPassword")}
								placeholder="Password"
								className="w-full">
								<label className="block font-medium mb-1">Password</label>
							</VSCodeTextField>
							<div className="text-sm text-vscode-descriptionForeground mt-1">
								{t("settings:providers.passwordStorageNotice")}
							</div>
						</div>
					)}
				</>
			)}

			<div className="w-full mb-1">
				<Button
					variant="outline"
					onClick={() => {
						handleRefreshModels()
					}}
					disabled={
						refreshStatus === "loading" ||
						(apiConfiguration.watsonxPlatform === "ibmCloud" && !apiConfiguration.watsonxApiKey) ||
						(apiConfiguration.watsonxPlatform === "cloudPak" &&
							(!apiConfiguration.watsonxBaseUrl ||
								!apiConfiguration.watsonxUsername ||
								(apiConfiguration.watsonxAuthType === "apiKey" && !apiConfiguration.watsonxApiKey) ||
								(apiConfiguration.watsonxAuthType === "password" && !apiConfiguration.watsonxPassword)))
					}
					className="w-full md-1"
					title={"Retrieve available models"}>
					<div className="flex items-center gap-2">
						{refreshStatus === "loading" ? (
							<span className="codicon codicon-loading codicon-modifier-spin" />
						) : (
							<span className="codicon codicon-refresh" />
						)}
						{"Retrieve Models"}
					</div>
				</Button>
			</div>

			{refreshStatus === "loading" && (
				<div className="text-sm text-vscode-descriptionForeground mb-1">
					{t("settings:providers.refreshModels.loading")}
				</div>
			)}
			{refreshStatus === "success" && (
				<div className="text-sm text-vscode-foreground mb-1">{"Models retrieved successfully"}</div>
			)}
			{refreshStatus === "error" && (
				<div className="text-sm text-vscode-errorForeground mb-1">
					{refreshError || "Failed to retrieve models"}
				</div>
			)}

			<ModelPicker
				apiConfiguration={apiConfiguration}
				defaultModelId={watsonxAiDefaultModelId}
				models={watsonxModels && Object.keys(watsonxModels).length > 0 ? watsonxModels : {}}
				modelIdKey="watsonxModelId"
				serviceName=""
				serviceUrl=""
				setApiConfigurationField={setApiConfigurationField}
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>

			<div className="text-sm text-vscode-descriptionForeground">
				<Trans
					i18nKey="settings:providers.watsonx.description"
					components={{
						serviceLink: (
							<VSCodeLink
								href={"https://www.ibm.com/products/watsonx-ai/foundation-models"}
								className="text-sm"
							/>
						),
					}}
					values={{ serviceName: "IBM watsonx" }}
				/>
			</div>
		</>
	)
}
