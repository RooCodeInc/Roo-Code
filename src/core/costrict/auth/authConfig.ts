import { jwtDecode } from "jwt-decode"
import { getClientId } from "../../../utils/getClientId"

export class ZgsmAuthConfig {
	private static instance: ZgsmAuthConfig

	private constructor() {
		// Private constructor to prevent external instantiation
	}

	public static getInstance(): ZgsmAuthConfig {
		if (!ZgsmAuthConfig.instance) {
			ZgsmAuthConfig.instance = new ZgsmAuthConfig()
		}
		return ZgsmAuthConfig.instance
	}

	/**
	 * Get default login base URL
	 */
	public getDefaultLoginBaseUrl(): string {
		return this.getDefaultApiBaseUrl()
	}

	/**
	 * Get default API base URL
	 */
	public getDefaultApiBaseUrl(): string {
		return "https://zgsm.sangfor.com"
	}

	/**
	 * Get polling interval (milliseconds)
	 */
	public getWaitLoginPollingInterval(): number {
		return 5000 // 5 seconds
	}

	/**
	 * Get token refresh interval (milliseconds)
	 */
	public getTokenRefreshInterval(refreshToken?: string, min = 3): number {
		if (!refreshToken) return 24 * 60 * 60 * 1000 // 24h

		const { exp } = jwtDecode(refreshToken) as any
		const refreshInterval = Math.min((exp - 1800) * 1000 - Date.now(), 2147483647)
		return refreshInterval > 0 ? refreshInterval : min * 1000
	}

	/**
	 * Get maximum polling attempts
	 */
	public getMaxPollingAttempts(): number {
		return 120 // 10 minutes (120 * 5 seconds)
	}

	/**
	 * Get request timeout (milliseconds)
	 */
	public getRequestTimeout(): number {
		return 10000 // 10 seconds
	}

	public getClientId(): string {
		return getClientId()
	}

	/**
	 * Get CoStrict site
	 */
	public getDefaultSite(): string {
		return "https://costrict.ai"
	}
}
