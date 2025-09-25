import { useCallback, useEffect, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

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

export const ZgsmAccountView = ({ apiConfiguration, onDone }: AccountViewProps) => {
	const { t } = useAppTranslation()
	const [quotaInfo, setQuotaInfo] = useState<QuotaInfo>()
	const { userInfo, logoPic, hash } = useZgsmUserInfo(apiConfiguration?.zgsmAccessToken)
	console.log("New Credit hash: ", hash)
	const rooLogoUri = (window as any).COSTRICT_BASE_URI + "/logo.svg"

	const handleConnectClick = () => {
		// Send telemetry for account connect action
		telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_CLICKED)

		vscode.postMessage({ type: "zgsmLogin", apiConfiguration })
	}

	const handleLogoutClick = () => {
		// Send telemetry for account logout action
		telemetryClient.capture(TelemetryEventName.ACCOUNT_LOGOUT_CLICKED)
		vscode.postMessage({ type: "zgsmLogout" })
	}

	const handleVisitCloudWebsite = () => {
		// Send telemetry for cloud website visit
		telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_CLICKED)
		const cloudUrl = `${apiConfiguration?.zgsmBaseUrl?.trim() || "https://zgsm.sangfor.com"}/credit/manager?state=${hash}`

		vscode.postMessage({ type: "openExternal", url: cloudUrl })
	}

	const onMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			switch (message.type) {
				case "zgsmLogined": {
					onDone()
					break
				}
				case "zgsmQuotaInfo": {
					setQuotaInfo(message?.values)
					break
				}
			}
		},
		[onDone],
	)

	useEffect(() => {
		const timer = setInterval(async () => {
			vscode.postMessage({ type: "fetchZgsmQuotaInfo" })
		}, 10_000)
		vscode.postMessage({ type: "fetchZgsmQuotaInfo" })
		return () => {
			clearInterval(timer)
		}
	}, [])

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
						<div className="flex flex-col items-center mb-5">
							<div className="w-14 h-14 mb-2 rounded-full overflow-hidden ring-1 ring-vscode-focusBorder/20 hover:ring-vscode-focusBorder/40 transition-all duration-200">
								{logoPic ? (
									<img
										src={logoPic}
										alt={t("account:profilePicture")}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-vscode-button-background to-vscode-button-hoverBackground text-vscode-button-foreground text-lg font-medium">
										{userInfo?.name?.charAt(0) || userInfo?.email?.charAt(0) || "?"}
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
							{userInfo?.organizationName && (
								<div className="flex items-center gap-1.5 px-2 py-0.5 bg-vscode-badge-background/10 rounded-full text-xs text-vscode-descriptionForeground">
									{userInfo.organizationImageUrl && (
										<img
											src={userInfo.organizationImageUrl}
											alt={userInfo.organizationName}
											className="w-3 h-3 rounded object-cover"
										/>
									)}
									<span>{userInfo.organizationName}</span>
								</div>
							)}
							{quotaInfo && (quotaInfo.total_quota || quotaInfo.used_quota) && (
								<div className="w-full mt-3 space-y-2">
									<div className="bg-vscode-editor-inactiveSelectionBackground/50 backdrop-blur-sm rounded-lg p-2.5 hover:bg-vscode-editor-inactiveSelectionBackground/70 transition-all duration-200">
										<div className="flex justify-between items-center mb-1.5">
											<span className="text-xs text-vscode-descriptionForeground font-medium">
												{t("cloud:quota.usageRate")}
											</span>
											<span className="text-sm font-bold text-vscode-foreground">
												{quotaInfo.used_quota && quotaInfo.total_quota
													? `${Math.round((quotaInfo.used_quota / quotaInfo.total_quota) * 100)}%`
													: "0%"}
											</span>
										</div>
										<div className="relative">
											<div className="h-1.5 bg-vscode-input-background/50 rounded-full overflow-hidden">
												<div
													className="h-full rounded-full transition-all duration-700 ease-out"
													style={{
														width: `${
															quotaInfo.used_quota && quotaInfo.total_quota
																? Math.max(
																		(quotaInfo.used_quota / quotaInfo.total_quota) *
																			100,
																		2,
																	)
																: 0
														}%`,
														background: "linear-gradient(135deg, #007aff, #00d4aa)",
													}}></div>
											</div>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-2">
										<div className="bg-vscode-editor-inactiveSelectionBackground/30 backdrop-blur-sm rounded-lg p-2 hover:bg-vscode-editor-inactiveSelectionBackground/50 transition-all duration-200 group">
											<div className="flex items-center gap-1.5 mb-1">
												<div className="w-2 h-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full"></div>
												<span className="text-xs text-vscode-descriptionForeground font-medium">
													{t("cloud:quota.totalQuota")}
												</span>
											</div>
											<div className="flex items-baseline gap-1">
												<span className="text-sm font-bold text-vscode-foreground group-hover:text-vscode-focusBorder transition-colors">
													{quotaInfo.total_quota
														? quotaInfo.total_quota.toLocaleString()
														: "-"}
												</span>
												{quotaInfo.total_quota && (
													<span className="text-xs text-vscode-descriptionForeground opacity-60">
														Credit
													</span>
												)}
											</div>
										</div>

										<div className="bg-vscode-editor-inactiveSelectionBackground/30 backdrop-blur-sm rounded-lg p-2 hover:bg-vscode-editor-inactiveSelectionBackground/50 transition-all duration-200 group">
											<div className="flex items-center gap-1.5 mb-1">
												<div className="w-2 h-2 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full"></div>
												<span className="text-xs text-vscode-descriptionForeground font-medium">
													{t("cloud:quota.usedQuota")}
												</span>
											</div>
											<div className="flex items-baseline gap-1">
												<span className="text-sm font-bold text-vscode-foreground group-hover:text-vscode-focusBorder transition-colors">
													{quotaInfo.used_quota ? quotaInfo.used_quota.toLocaleString() : "-"}
												</span>
												{quotaInfo.used_quota && (
													<span className="text-xs text-vscode-descriptionForeground opacity-60">
														Credit
													</span>
												)}
											</div>
										</div>
									</div>
								</div>
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
									WebkitMaskImage: `url('${rooLogoUri}')`,
									WebkitMaskRepeat: "no-repeat",
									WebkitMaskSize: "contain",
									maskImage: `url('${rooLogoUri}')`,
									maskRepeat: "no-repeat",
									maskSize: "contain",
								}}>
								<img src={rooLogoUri} alt="Costrict logo" className="w-10 h-10 opacity-0" />
							</div>
						</div>
						<h2 className="text-lg font-semibold text-vscode-foreground mb-1">{t("account:signIn")}</h2>
						<p className="text-xs text-vscode-descriptionForeground opacity-80">??????????????</p>
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
