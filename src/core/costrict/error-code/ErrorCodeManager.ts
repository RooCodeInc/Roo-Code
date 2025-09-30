import axios from "axios"
import { jwtDecode } from "jwt-decode"
import crypto from "crypto"
import retry from "async-retry"

import { t } from "../../../i18n"
import { ClineProvider } from "../../webview/ClineProvider"
import { TelemetryService } from "@roo-code/telemetry"
import { ZgsmAuthConfig } from "../auth"

export interface IErrorMap {
	[code: string]: {
		message: string
		solution: string
	}
}

export class ErrorCodeManager {
	private static instance: ErrorCodeManager
	private errorMap: IErrorMap = {}
	private unknownError = { message: t("apiErrors:status.unknown"), solution: t("apiErrors:solution.unknown") }
	private provider!: ClineProvider

	private constructor() {}

	public static getInstance(): ErrorCodeManager {
		if (!ErrorCodeManager.instance) {
			ErrorCodeManager.instance = new ErrorCodeManager()
		}
		return ErrorCodeManager.instance
	}

	/**
	 * Initialize error code manager
	 * @param provider ClineProvider instance
	 */
	public async initialize(provider: ClineProvider): Promise<void> {
		try {
			this.provider = provider
			await this.refreshErrorCodes()
		} catch (error) {
			console.error("Failed to initialize ErrorCodeManager:", error)
		}
	}

	/**
	 * Refresh error code mapping
	 */
	public async refreshErrorCodes(): Promise<void> {
		try {
			await retry(
				async () => {
					// Clear existing error code mapping
					this.errorMap = {}
					// Get remote error codes
					const remoteErrorMap = await this.fetchRemoteCodes()
					this.errorMap = remoteErrorMap
					this.provider.setValue("errorCode", remoteErrorMap)
				},
				{
					retries: 2,
				},
			)
		} catch (error) {
			const { errorCode } = await this.provider.getState()
			this.errorMap = (errorCode ?? {}) as IErrorMap
			console.error("Failed to refresh error codes:", error)
		}
	}

	/**
	 * Fetch error codes from remote
	 * @returns Promise<IErrorMap> Remote error code mapping
	 */
	private async fetchRemoteCodes(): Promise<IErrorMap> {
		try {
			const { language, apiConfiguration } = await this.provider.getState()
			const baseUrl = apiConfiguration.zgsmBaseUrl || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()
			const response = await axios.get(`${baseUrl}/costrict/error-code/error_codes_${language}.json`)
			return response.data
		} catch (error) {
			console.error("Failed to fetch remote error codes:", error)
			// Return empty object as fallback for any exception
			return {}
		}
	}
	/**
	 * Parse ZGSM JWT token information
	 * @param zgsmAccessToken JWT token
	 * @returns Object containing expiration time, update time, and old mode login status
	 */
	private parseZgsmTokenInfo(zgsmAccessToken?: string): {
		zgsmApiKeyExpiredAt: string
		zgsmApiKeyUpdatedAt: string
		isOldModeLoginState: boolean
	} {
		if (!zgsmAccessToken) {
			return {
				zgsmApiKeyExpiredAt: "",
				zgsmApiKeyUpdatedAt: "",
				isOldModeLoginState: false,
			}
		}

		try {
			const { exp, iat, universal_id } = jwtDecode(zgsmAccessToken) as any
			return {
				zgsmApiKeyExpiredAt: new Date(exp * 1000).toLocaleString(),
				zgsmApiKeyUpdatedAt: new Date(iat * 1000).toLocaleString(),
				isOldModeLoginState: !universal_id,
			}
		} catch (error) {
			console.error("Failed to decode ZGSM access token:", error)
			return {
				zgsmApiKeyExpiredAt: "",
				zgsmApiKeyUpdatedAt: "",
				isOldModeLoginState: false,
			}
		}
	}

	/**
	 * Parse error response
	 * @param errorCode Error code
	 * @returns Formatted error information object
	 */
	public async parseResponse(error: any, isZgsm = false, taskId: string, instanceId: string): Promise<string> {
		const isHtml = error?.headers && error.headers["content-type"] && error.headers["content-type"] === "text/html"
		let rawError =
			(error.error?.metadata?.raw ? JSON.stringify(error.error.metadata.raw, null, 2) : error.message) ||
			"Unknown error"

		if (!isZgsm) return rawError

		let status = error.status as number
		const { code, headers } = error
		const requestId = headers?.get("x-request-id") ?? null
		const { apiConfiguration, errorCode } = await this.provider.getState()
		const { zgsmApiKeyExpiredAt, zgsmApiKeyUpdatedAt, isOldModeLoginState } = this.parseZgsmTokenInfo(
			apiConfiguration.zgsmAccessToken,
		)
		const defaultError = {
			401: {
				message: isOldModeLoginState
					? t("apiErrors:status.old_mode_token")
					: t("apiErrors:status.401", {
							exp: zgsmApiKeyExpiredAt || "-",
							iat: zgsmApiKeyUpdatedAt || "-",
						}),
				solution: t("apiErrors:solution.401"),
			},
			400: { message: rawError || t("apiErrors:status.400"), solution: t("apiErrors:solution.400") },
			403: { message: rawError || t("apiErrors:status.403"), solution: t("apiErrors:solution.403") },
			404: { message: isHtml ? t("apiErrors:status.404") : rawError, solution: t("apiErrors:solution.404") },
			429: { message: rawError || t("apiErrors:status.429"), solution: t("apiErrors:solution.429") },
			500: { message: isHtml ? t("apiErrors:status.500") : rawError, solution: t("apiErrors:solution.500") },
			502: { message: isHtml ? t("apiErrors:status.502") : rawError, solution: t("apiErrors:solution.502") },
			503: { message: isHtml ? t("apiErrors:status.503") : rawError, solution: t("apiErrors:solution.503") },
			504: { message: isHtml ? t("apiErrors:status.504") : rawError, solution: t("apiErrors:solution.504") },
			undefined: {
				message: rawError || t("apiErrors:status.undefined"),
				solution: t("apiErrors:solution.undefined"),
			},
		} as Record<string | number, { message: string; solution: string }>
		// List of error codes that require authentication
		const authRequiredCodes = [
			"ai-gateway.unauthorized",
			"quota-manager.unauthorized",
			"quota-manager.token_invalid",
			"quota-manager.voucher_expired",
		]
		if (code) {
			const errorMap = Object.keys(this.errorMap).length > 0 ? this.errorMap : (errorCode ?? {}) // Use fetched error codes or fallback to provider state
			let { message, solution } = errorMap[code] || this.unknownError
			if (authRequiredCodes.includes(code)) {
				rawError = message
				message = defaultError["401"].message
				solution = defaultError["401"].solution
				error.status = status = 401
			} else if (code === "ai-gateway.insufficient_quota" || code === "ai-gateway.star_required") {
				const hash = await this.hashToken(apiConfiguration.zgsmAccessToken || "")
				const baseurl = apiConfiguration.zgsmBaseUrl || ZgsmAuthConfig.getInstance().getDefaultLoginBaseUrl()
				const isQuota = code === "ai-gateway.insufficient_quota"

				const solution1 = isQuota
					? t("apiErrors:solution.ai-gateway.insufficientCredits")
					: t("apiErrors:solution.ai-gateway.pleaseStarProject")
				const solution2 = isQuota
					? t("apiErrors:solution.ai-gateway.quotaAcquisition")
					: t("apiErrors:solution.ai-gateway.howToStar")

				const checkRemainingQuotaStr = !isQuota
					? `${t("apiErrors:solution.quota-check.checkRemainingQuota")} “ <a href='${baseurl}/credit/manager/credits?state=${hash}' style="font-size: 12px;color:#0078d4;text-decoration: none;">${t("apiErrors:solution.quota-check.creditUsageStats")}</a> ” ${t("apiErrors:solution.quota-check.viewDetails")}`
					: ""

				solution = `
<span style="color:#E64545;font-size: 12px;">${solution1}</span> <a href='${baseurl}/credit/manager/md-preview?state=${hash}' style="font-size: 12px;color:#0078d4;text-decoration: none;">${solution2}</a>
${checkRemainingQuotaStr}
`
			}
			TelemetryService.instance.captureError(`ApiError_${code}`)
			this.provider.log(`[Costrict#apiErrors] task ${taskId}.${instanceId} Raw Error: ${rawError}`)
			return `${t("apiErrors:request.error_details")}\n\n${message}\n\n${requestId ? `RequestID: ${requestId}\n\n` : ""}${t("apiErrors:request.solution")}\n${solution}`
		}
		const { message, solution } = defaultError[status] || this.unknownError
		if (defaultError[status]) {
			TelemetryService.instance.captureError(
				status === undefined ? `ApiError_unknown` : `ApiError_status_${status}`,
			)
		} else {
			TelemetryService.instance.captureError(`ApiError_unknown`)
		}
		this.provider.log(`[Costrict#apiErrors] task ${taskId}.${instanceId} Raw Error: ${rawError}`)
		return `${t("apiErrors:request.error_details")}\n\n${message}\n\n${requestId ? `RequestID: ${requestId}\n\n` : ""}${t("apiErrors:request.solution")}\n${solution}`
	}
	private async hashToken(token: string) {
		const encoder = new TextEncoder()
		const data = encoder.encode(token)
		const hashBuffer = await crypto.subtle.digest("SHA-256", data)
		return Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
	}

	getErrorMessageByCode(code: string) {
		return this.errorMap[code] || this.unknownError
	}
}
