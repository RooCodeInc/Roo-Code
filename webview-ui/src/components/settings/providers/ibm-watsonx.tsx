import { useCallback, useState, useEffect, useRef } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { ModelInfo, watsonxDefaultModelId, type OrganizationAllowList, type ProviderSettings } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { vscode } from "@src/utils/vscode"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { inputEventTransform } from "../transforms"
import { RouterName } from "@roo/api"
import { ModelPicker } from "../ModelPicker"

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
				if (providerName === "ibm-watsonx") {
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

		if (platform === "ibmCloud" && (!apiKey || !baseUrl || !projectId)) {
			setRefreshStatus("error")
			setRefreshError(t("settings:providers.refreshModels.missingConfig"))
			return
		}

		if (platform === "cloudPak") {
			if (!baseUrl) {
				setRefreshStatus("error")
				setRefreshError(t("settings:validation.watsonx.baseUrl"))
				return
			}

			if (!projectId) {
				setRefreshStatus("error")
				setRefreshError(t("settings:validation.watsonx.projectId"))
				return
			}

			if (!username) {
				setRefreshStatus("error")
				setRefreshError(t("settings:validation.watsonx.username"))
				return
			}

			if (authType === "apiKey" && !apiKey) {
				setRefreshStatus("error")
				setRefreshError(t("settings:validation.watsonx.apiKey"))
				return
			}

			if (authType === "password" && !password) {
				setRefreshStatus("error")
				setRefreshError(t("settings:validation.watsonx.password"))
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
				authType: authType,
				username: username,
				password: password,
				region: selectedRegion,
			},
		})
	}, [apiConfiguration, setRefreshStatus, setRefreshError, t, selectedRegion])

	// Refresh models when component mounts if API key is available
	useEffect(() => {
		const shouldFetchIbmCloud =
			!initialModelFetchAttempted.current &&
			apiConfiguration.watsonxPlatform === "ibmCloud" &&
			apiConfiguration.watsonxApiKey &&
			apiConfiguration.watsonxProjectId

		const shouldFetchCloudPak =
			apiConfiguration.watsonxPlatform === "cloudPak" &&
			apiConfiguration.watsonxBaseUrl &&
			apiConfiguration.watsonxProjectId &&
			apiConfiguration.watsonxUsername &&
			((apiConfiguration.watsonxAuthType === "password" && apiConfiguration.watsonxPassword) ||
				(apiConfiguration.watsonxAuthType === "apiKey" && apiConfiguration.watsonxApiKey))

		if (
			(shouldFetchIbmCloud || shouldFetchCloudPak) &&
			(!watsonxModels || Object.keys(watsonxModels).length === 0)
		) {
			initialModelFetchAttempted.current = true
			handleRefreshModels()
		}
	}, [
		apiConfiguration.watsonxApiKey,
		apiConfiguration.watsonxPassword,
		apiConfiguration.watsonxProjectId,
		apiConfiguration.watsonxBaseUrl,
		apiConfiguration.watsonxUsername,
		apiConfiguration.watsonxPlatform,
		apiConfiguration.watsonxAuthType,
		watsonxModels,
		handleRefreshModels,
	])

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
						{t("settings:providers.watsonx.urlDescription")}
					</div>
				</div>
			)}

			<div className="w-full mb-1">
				<VSCodeTextField
					value={apiConfiguration?.watsonxProjectId || ""}
					onInput={handleInputChange("watsonxProjectId")}
					placeholder={t("settings:providers.watsonx.projectId")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.watsonx.projectId")}</label>
				</VSCodeTextField>
			</div>

			{apiConfiguration.watsonxPlatform === "ibmCloud" && (
				<div className="w-full mb-1">
					<VSCodeTextField
						value={apiConfiguration?.watsonxApiKey || ""}
						type="password"
						onInput={handleInputChange("watsonxApiKey")}
						placeholder={t("settings:providers.watsonx.apiKey")}
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.watsonx.apiKey")}</label>
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
							placeholder={t("settings:providers.watsonx.username")}
							className="w-full">
							<label className="block font-medium mb-1">{t("settings:providers.watsonx.username")}</label>
						</VSCodeTextField>
					</div>

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

					{apiConfiguration.watsonxAuthType === "apiKey" ? (
						<div className="w-full mb-1">
							<VSCodeTextField
								value={apiConfiguration?.watsonxApiKey || ""}
								type="password"
								onInput={handleInputChange("watsonxApiKey")}
								placeholder={t("settings:providers.watsonx.apiKey")}
								className="w-full">
								<label className="block font-medium mb-1">
									{t("settings:providers.watsonx.apiKey")}
								</label>
							</VSCodeTextField>
							<div className="text-sm text-vscode-descriptionForeground mt-1">
								{t("settings:providers.apiKeyStorageNotice")}
							</div>
						</div>
					) : (
						<div className="w-full mb-1">
							<VSCodeTextField
				value={apiConfiguration.watsonxPassword || ""}
								type="password"
								onInput={handleInputChange("watsonxPassword")}
								placeholder={t("settings:providers.watsonx.password")}
								className="w-full">
								<label className="block font-medium mb-1">
									{t("settings:providers.watsonx.password")}
								</label>
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
						!apiConfiguration.watsonxProjectId ||
						(apiConfiguration.watsonxPlatform === "ibmCloud" &&
							(!apiConfiguration.watsonxApiKey || !apiConfiguration.watsonxProjectId)) ||
						(apiConfiguration.watsonxPlatform === "cloudPak" &&
							(!apiConfiguration.watsonxBaseUrl ||
								!apiConfiguration.watsonxProjectId ||
								!apiConfiguration.watsonxUsername ||
								(apiConfiguration.watsonxAuthType === "apiKey" && !apiConfiguration.watsonxApiKey) ||
								(apiConfiguration.watsonxAuthType === "password" && !apiConfiguration.watsonxPassword)))
					}
					className="w-full mb-1"
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
