import { getClientId } from "../../../utils/getClientId"
import { ZgsmAuthApi, ZgsmAuthConfig } from "../auth"
import { PlatformDetector } from "./platform"
import { PlatformResponse, VersionInfo } from "./types"

/**
 * Version API class
 * Used to get client version list information
 */
export class VersionApi {
	private platformDetector: PlatformDetector

	constructor() {
		this.platformDetector = new PlatformDetector()
	}

	/**
	 * Get version list
	 * @returns Promise<PlatformResponse> Returns platform version information
	 * @throws Throws error when API call fails
	 */
	async getVersionList(): Promise<PlatformResponse> {
		const { zgsmBaseUrl } = await ZgsmAuthApi.getInstance().getApiConfiguration()
		const baseUrl = zgsmBaseUrl || ZgsmAuthConfig.getInstance().getDefaultApiBaseUrl()
		const platform = this.platformDetector.platform
		const arch = this.platformDetector.arch
		const url = `${baseUrl}/costrict/costrict/${platform}/${arch}/platform.json`

		try {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"zgsm-request-id": getClientId(),
				},
			})

			if (!response.ok) {
				const errorData = await response.text()
				throw new Error(`Failed to get version list: ${errorData}`)
			}

			const data: PlatformResponse = await response.json()
			return data
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`${url} Error occurred while getting version list: ${error.message}`)
			} else {
				throw new Error(`${url} Unknown error occurred while getting version list`)
			}
		}
	}

	/**
	 * Get latest version information
	 * @returns Promise<VersionInfo> Returns latest version information
	 * @throws Throws error when API call fails
	 */
	async getLatestVersion(): Promise<VersionInfo> {
		const platformData = await this.getVersionList()
		return platformData.newest
	}

	/**
	 * Check if there are available updates
	 * @param currentVersion Current version
	 * @returns Promise<boolean> Returns true if there are available updates, otherwise returns false
	 * @throws Throws error when API call fails
	 */
	async shouldUpdate(currentVersionInfo: VersionInfo): Promise<boolean> {
		try {
			const latestVersion = await this.getLatestVersion()
			if (currentVersionInfo.status === "failed") {
				return true
			}
			// Simple version comparison logic
			if (latestVersion?.versionId?.major > currentVersionInfo?.versionId?.major) {
				return true
			}
			if (
				latestVersion?.versionId?.major === currentVersionInfo?.versionId?.major &&
				latestVersion?.versionId?.minor > currentVersionInfo?.versionId?.minor
			) {
				return true
			}
			if (
				latestVersion?.versionId?.major === currentVersionInfo?.versionId?.major &&
				latestVersion?.versionId?.minor === currentVersionInfo?.versionId?.minor &&
				latestVersion?.versionId?.micro > currentVersionInfo?.versionId?.micro
			) {
				return true
			}

			return false
		} catch (error) {
			throw new Error(
				`Error occurred while checking for updates: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}
}
