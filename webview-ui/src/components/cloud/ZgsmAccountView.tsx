import { useCallback, useEffect, useState, useMemo, memo } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { StarIcon, StarFilledIcon, CheckCircledIcon } from "@radix-ui/react-icons"

import type { ProviderSettings, QuotaInfo } from "@roo-code/types"
import { TelemetryEventName } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { telemetryClient } from "@src/utils/TelemetryClient"
import { useEvent } from "react-use"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { useZgsmUserInfo } from "@src/hooks/useZgsmUserInfo"

type AccountViewProps = {
	apiConfiguration?: ProviderSettings
	onDone: () => void
}

// Quota information skeleton component
const QuotaSkeleton = memo(() => (
	<div className="w-full mt-0 space-y-2">
		<div className="bg-vscode-editor-inactiveSelectionBackground/30 backdrop-blur-sm rounded-lg p-2.5 animate-pulse">
			<div className="flex justify-between items-center mb-1.5">
				<div className="h-3 bg-vscode-editor-inactiveSelectionBackground/50 rounded w-16"></div>
				<div className="h-4 bg-vscode-editor-inactiveSelectionBackground/50 rounded w-8"></div>
			</div>
			<div className="h-1.5 bg-vscode-editor-inactiveSelectionBackground/50 rounded-full"></div>
		</div>
		<div className="grid grid-cols-2 gap-2">
			<div className="bg-vscode-editor-inactiveSelectionBackground/20 backdrop-blur-sm rounded-lg p-2 animate-pulse">
				<div className="flex items-center gap-1.5 mb-1">
					<div className="w-2 h-2 bg-vscode-editor-inactiveSelectionBackground/50 rounded-full"></div>
					<div className="h-3 bg-vscode-editor-inactiveSelectionBackground/50 rounded w-12"></div>
				</div>
				<div className="h-4 bg-vscode-editor-inactiveSelectionBackground/50 rounded w-16"></div>
			</div>
			<div className="bg-vscode-editor-inactiveSelectionBackground/20 backdrop-blur-sm rounded-lg p-2 animate-pulse">
				<div className="flex items-center gap-1.5 mb-1">
					<div className="w-2 h-2 bg-vscode-editor-inactiveSelectionBackground/50 rounded-full"></div>
					<div className="h-3 bg-vscode-editor-inactiveSelectionBackground/50 rounded w-12"></div>
				</div>
				<div className="h-4 bg-vscode-editor-inactiveSelectionBackground/50 rounded w-16"></div>
			</div>
		</div>
	</div>
))

// Star status card component
const StarStatusCard = memo(
	({
		quotaInfo,
		onStarRepository,
		_t,
	}: {
		quotaInfo?: QuotaInfo
		onStarRepository: () => void
		_t: (key: string) => string
	}) => {
		const isStarred = quotaInfo?.is_star === "true"

		if (!quotaInfo) return null

		return (
			<div className="w-full mt-3 bg-vscode-editor-inactiveSelectionBackground/30 backdrop-blur-sm rounded-lg px-3 hover:bg-vscode-editor-inactiveSelectionBackground/50 transition-colors duration-200">
				{isStarred ? (
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<StarFilledIcon className="w-4 h-4 text-yellow-400" />
							<div>
								<p className="text-sm font-medium text-vscode-foreground">{_t("account:starThanks")}</p>
								<p className="text-xs text-vscode-descriptionForeground">
									{_t("account:starThanksDesc")}
								</p>
							</div>
						</div>
						<CheckCircledIcon className="w-5 h-5 text-yellow-400" />
					</div>
				) : (
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<StarIcon className="w-4 h-4 text-vscode-descriptionForeground" />
							<div>
								<p className="text-sm font-medium text-vscode-foreground">
									{_t("account:starProject")}
								</p>
								<p className="text-xs text-vscode-descriptionForeground">
									{_t("account:starProjectDesc")}
								</p>
							</div>
						</div>
						<button
							onClick={onStarRepository}
							className="px-3 py-1.5 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground text-xs font-medium rounded transition-colors duration-200 flex items-center gap-1">
							<StarIcon className="w-3 h-3" />
							{_t("account:starButton")}
						</button>
					</div>
				)}
			</div>
		)
	},
)

// Optimized quota information display component
const QuotaInfoDisplay = memo(
	({ quotaInfo, showQuotaInfo, t }: { quotaInfo: QuotaInfo; showQuotaInfo: boolean; t: (key: string) => string }) => {
		// Cache calculation results
		const quotaCalculations = useMemo(() => {
			const hasQuota = quotaInfo.total_quota || quotaInfo.used_quota
			const usagePercentage =
				quotaInfo.used_quota && quotaInfo.total_quota
					? ((quotaInfo.used_quota / quotaInfo.total_quota) * 100)?.toFixed(2) || "0"
					: "0"
			const progressWidth =
				quotaInfo.used_quota && quotaInfo.total_quota
					? Math.max((quotaInfo.used_quota / quotaInfo.total_quota) * 100, 2)
					: 0
			const isStarred = quotaInfo.is_star === "true"

			return {
				hasQuota,
				usagePercentage,
				progressWidth,
				isStarred,
				totalQuotaDisplay: quotaInfo.total_quota ? quotaInfo.total_quota.toLocaleString() : "",
				usedQuotaDisplay: quotaInfo.used_quota ? quotaInfo.used_quota.toLocaleString() : "",
			}
		}, [quotaInfo.total_quota, quotaInfo.used_quota, quotaInfo.is_star])

		if (!quotaCalculations.hasQuota) {
			return null
		}

		return (
			<div
				className={`w-full mt-0 space-y-2 transition-all duration-500 ease-out transform ${
					showQuotaInfo ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-98"
				}`}
				style={{
					willChange: showQuotaInfo ? "auto" : "transform, opacity",
				}}>
				<div
					className={`bg-vscode-editor-inactiveSelectionBackground/50 backdrop-blur-sm rounded-lg p-2.5 hover:bg-vscode-editor-inactiveSelectionBackground/70 transition-colors duration-200 transform ${
						showQuotaInfo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
					}`}
					style={{
						transitionDelay: showQuotaInfo ? "50ms" : "0ms",
					}}>
					<div className="flex justify-between items-center mb-1.5">
						<span className="text-xs text-vscode-descriptionForeground font-medium">
							{t("cloud:quota.usageRate")}
						</span>
						<span className="text-sm font-bold text-vscode-foreground">
							{quotaCalculations.usagePercentage}%
						</span>
					</div>
					<div className="relative">
						<div className="h-1.5 bg-vscode-input-background/50 rounded-full overflow-hidden">
							<div
								className="h-full rounded-full transition-all duration-500 ease-out"
								style={{
									width: `${quotaCalculations.progressWidth}%`,
									background: "linear-gradient(135deg, #007aff, #00d4aa)",
									transform: showQuotaInfo ? "scaleX(1)" : "scaleX(0)",
									transformOrigin: "left",
									transitionDelay: showQuotaInfo ? "100ms" : "0ms",
								}}></div>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div
						className={`bg-vscode-editor-inactiveSelectionBackground/30 backdrop-blur-sm rounded-lg p-2 hover:bg-vscode-editor-inactiveSelectionBackground/50 transition-colors duration-200 group transform ${
							showQuotaInfo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
						}`}
						style={{
							transitionDelay: showQuotaInfo ? "100ms" : "0ms",
						}}>
						<div className="flex items-center gap-1.5 mb-1">
							<div className="w-2 h-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full"></div>
							<span className="text-xs text-vscode-descriptionForeground font-medium">
								{t("cloud:quota.totalQuota")}
							</span>
						</div>
						<div className="flex items-baseline gap-1">
							<span className="text-sm font-bold text-vscode-foreground group-hover:text-vscode-focusBorder transition-colors">
								{quotaCalculations.totalQuotaDisplay}
							</span>
							{quotaInfo.total_quota && (
								<span className="text-xs text-vscode-descriptionForeground opacity-60">Credit</span>
							)}
						</div>
					</div>

					<div
						className={`bg-vscode-editor-inactiveSelectionBackground/30 backdrop-blur-sm rounded-lg p-2 hover:bg-vscode-editor-inactiveSelectionBackground/50 transition-colors duration-200 group transform ${
							showQuotaInfo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
						}`}
						style={{
							transitionDelay: showQuotaInfo ? "150ms" : "0ms",
						}}>
						<div className="flex items-center gap-1.5 mb-1">
							<div className="w-2 h-2 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full"></div>
							<span className="text-xs text-vscode-descriptionForeground font-medium">
								{t("cloud:quota.usedQuota")}
							</span>
						</div>
						<div className="flex items-baseline gap-1">
							<span className="text-sm font-bold text-vscode-foreground group-hover:text-vscode-focusBorder transition-colors">
								{quotaCalculations.usedQuotaDisplay}
							</span>
							{quotaInfo.used_quota && (
								<span className="text-xs text-vscode-descriptionForeground opacity-60">Credit</span>
							)}
						</div>
					</div>
				</div>
			</div>
		)
	},
)

const ZgsmAccountViewComponent = ({ apiConfiguration, onDone }: AccountViewProps) => {
	const { t } = useAppTranslation()
	const [quotaInfo, setQuotaInfo] = useState<QuotaInfo>()
	const [showQuotaInfo, setShowQuotaInfo] = useState(false)
	const [isLoadingQuota, setIsLoadingQuota] = useState(false)
	const { userInfo, logoPic, hash } = useZgsmUserInfo(apiConfiguration?.zgsmAccessToken)
	console.log("New Credit hash: ", hash)

	// Cache static resource URI
	const coLogoUri = useMemo(() => (window as any).COSTRICT_BASE_URI + "/logo.svg", [])

	// Cache event handler function
	const handleConnectClick = useCallback(() => {
		// Send telemetry for account connect action
		telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_CLICKED)
		vscode.postMessage({ type: "zgsmLogin", apiConfiguration })
	}, [apiConfiguration])

	const handleLogoutClick = useCallback(() => {
		// Send telemetry for account logout action
		telemetryClient.capture(TelemetryEventName.ACCOUNT_LOGOUT_CLICKED)
		vscode.postMessage({ type: "zgsmLogout" })
	}, [])

	const handleVisitCloudWebsite = useCallback(() => {
		// Send telemetry for cloud website visit
		telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_CLICKED)
		const cloudUrl = `${apiConfiguration?.zgsmBaseUrl?.trim() || "https://zgsm.sangfor.com"}/credit/manager?state=${hash}`
		vscode.postMessage({ type: "openExternal", url: cloudUrl })
	}, [apiConfiguration?.zgsmBaseUrl, hash])

	const handleStarRepository = useCallback(() => {
		vscode.postMessage({ type: "openExternal", url: "https://github.com/zgsm-ai/costrict" })
	}, [])

	const onMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			switch (message.type) {
				case "zgsmLogined": {
					// Reset animation state to prepare for next display
					setShowQuotaInfo(false)
					setIsLoadingQuota(false)
					onDone()
					break
				}
				case "zgsmQuotaInfo": {
					setQuotaInfo(message?.values)
					setIsLoadingQuota(false)
					// Use requestAnimationFrame to optimize animation timing
					requestAnimationFrame(() => {
						setTimeout(() => {
							setShowQuotaInfo(true)
						}, 100)
					})
					break
				}
			}
		},
		[onDone],
	)

	useEffect(() => {
		if (!apiConfiguration?.zgsmAccessToken) {
			setQuotaInfo(undefined)
			setShowQuotaInfo(false)
			setIsLoadingQuota(false)
			return
		}

		// Reset animation state
		setShowQuotaInfo(false)
		setIsLoadingQuota(true)

		// Immediately fetch quota information
		vscode.postMessage({ type: "fetchZgsmQuotaInfo" })

		// Set timer but reduce frequency to minimize performance impact
		const timer = setInterval(() => {
			if (document.visibilityState === "visible") {
				vscode.postMessage({ type: "fetchZgsmQuotaInfo" })
			}
		}, 15_000) // Increased to 15 seconds to reduce request frequency

		return () => {
			clearInterval(timer)
		}
	}, [apiConfiguration?.zgsmAccessToken])

	// Handle page visibility changes
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && apiConfiguration?.zgsmAccessToken) {
				vscode.postMessage({ type: "fetchZgsmQuotaInfo" })
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	}, [apiConfiguration?.zgsmAccessToken])

	useEvent("message", onMessage)

	return (
		<div className="flex flex-col h-full p-6 bg-vscode-editor-background">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-xl font-semibold text-vscode-foreground">{t("cloud:title")}</h1>
				<VSCodeButton appearance="primary" onClick={onDone}>
					{t("settings:common.done")}
				</VSCodeButton>
			</div>
			{apiConfiguration?.zgsmAccessToken ? (
				<>
					{userInfo && (
						<div className="flex flex-col items-center mb-0">
							<div className="w-14 h-14 mb-2 rounded-full overflow-hidden ring-1 ring-vscode-focusBorder/20 hover:ring-vscode-focusBorder/40 transition-all duration-200">
								{logoPic ? (
									<img
										src={logoPic}
										alt={t("account:profilePicture")}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-vscode-button-background to-vscode-button-hoverBackground text-vscode-button-foreground text-lg font-medium">
										{userInfo?.name?.charAt(0) || userInfo?.email?.charAt(0) || "Costrict"}
									</div>
								)}
							</div>
							{userInfo.name && (
								<h2 className="text-base font-semibold text-vscode-foreground mb-0.5">
									{userInfo.name}
								</h2>
							)}
							{userInfo?.email && (
								<p className="text-xs text-vscode-descriptionForeground mb-1">{userInfo?.email}</p>
							)}
							{userInfo.id && (
								<h2 className="text-xs text-vscode-descriptionForeground mb-1">ID: {userInfo.id}</h2>
							)}
							{/* Star status card */}
							{quotaInfo?.is_star != null && (
								<StarStatusCard quotaInfo={quotaInfo} onStarRepository={handleStarRepository} _t={t} />
							)}
							{/* Quota information display area */}
							{isLoadingQuota && !quotaInfo && <QuotaSkeleton />}
							{quotaInfo && (
								<QuotaInfoDisplay quotaInfo={quotaInfo} showQuotaInfo={showQuotaInfo} t={t} />
							)}
						</div>
					)}
					<div className="flex flex-col gap-2 mt-4">
						<VSCodeButton appearance="primary" onClick={handleVisitCloudWebsite} className="w-full">
							{t("account:visitCloudWebsite")}
						</VSCodeButton>
						<div className="flex gap-2 mt-4">
							<VSCodeButton appearance="secondary" onClick={handleLogoutClick} className="w-[50%]">
								{t("cloud:logOut")}
							</VSCodeButton>
							<VSCodeButton appearance="secondary" onClick={handleConnectClick} className="w-[50%]">
								{t("settings:providers.getZgsmApiKeyAgain")}
							</VSCodeButton>
						</div>
					</div>
				</>
			) : (
				<>
					<div className="flex flex-col items-center mb-6 text-center">
						<div className="w-16 h-16 mb-4 flex items-center justify-center bg-gradient-to-br from-vscode-editor-inactiveSelectionBackground to-vscode-editor-inactiveSelectionBackground/50 rounded-xl">
							<div
								className="w-10 h-10 bg-vscode-foreground"
								style={{
									WebkitMaskImage: `url('${coLogoUri}')`,
									WebkitMaskRepeat: "no-repeat",
									WebkitMaskSize: "contain",
									maskImage: `url('${coLogoUri}')`,
									maskRepeat: "no-repeat",
									maskSize: "contain",
								}}>
								<img src={coLogoUri} alt="Costrict logo" className="w-10 h-10 opacity-0" />
							</div>
						</div>
						<h2 className="text-lg font-semibold text-vscode-foreground mb-1">{t("account:signIn")}</h2>
					</div>

					<div className="flex flex-col gap-4">
						<VSCodeButton appearance="primary" onClick={handleConnectClick} className="w-full">
							{t("account:cloudBenefitsTitle")}
						</VSCodeButton>
					</div>
				</>
			)}
		</div>
	)
}

export const ZgsmAccountView = memo(ZgsmAccountViewComponent)
