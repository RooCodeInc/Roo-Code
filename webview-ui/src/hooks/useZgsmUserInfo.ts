import { useEffect, useState, useRef } from "react"
import axios from "axios"
import type { ProviderSettings, ZgsmUserInfo } from "@roo-code/types"
import { TelemetryEventName } from "@roo-code/types"
import { telemetryClient } from "@src/utils/TelemetryClient"

export interface ZgsmUserData {
	userInfo: ZgsmUserInfo | null
	logoPic: string
	hash: string
	isAuthenticated: boolean
}

/**
 * 解析JWT token获取用户信息
 */
function parseJwt(token: string) {
	const parts = token.split(".")
	if (parts.length !== 3) {
		throw new Error("Invalid JWT")
	}
	const payload = parts[1]
	const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
	return JSON.parse(decoded)
}

/**
 * 对token进行SHA-256哈希处理
 */
async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(token)
	const hashBuffer = await crypto.subtle.digest("SHA-256", data)
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
}

/**
 * 将图片URL转换为base64格式
 */
export async function imageUrlToBase64(url: string): Promise<string | null> {
	try {
		const response = await axios.get(url, {
			responseType: "blob",
		})

		const blob = response.data as Blob

		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onloadend = () => resolve(reader.result as string)
			reader.onerror = () => reject("Failed to convert blob to base64")
			reader.readAsDataURL(blob)
		})
	} catch (error) {
		console.error("Failed to convert image to base64", error)
		return null
	}
}

export function useZgsmUserInfo(tokenOrConfig?: string | ProviderSettings): ZgsmUserData {
	const [data, setData] = useState<ZgsmUserData>({
		userInfo: null,
		logoPic: "",
		hash: "",
		isAuthenticated: false,
	})

	const cacheRef = useRef<{
		token?: string
		result?: ZgsmUserData
		isProcessing: boolean
	}>({ isProcessing: false })

	useEffect(() => {
		const token = typeof tokenOrConfig === "string" ? tokenOrConfig : tokenOrConfig?.zgsmAccessToken

		if (!token) {
			setData((prevData) => {
				if (prevData.isAuthenticated) {
					telemetryClient.capture(TelemetryEventName.ACCOUNT_LOGOUT_SUCCESS)
				}

				return {
					userInfo: null,
					logoPic: "",
					hash: "",
					isAuthenticated: false,
				}
			})

			cacheRef.current = { isProcessing: false }
			return
		}

		if (cacheRef.current.token === token && cacheRef.current.result) {
			setData(cacheRef.current.result)
			return
		}

		if (cacheRef.current.isProcessing) return
		cacheRef.current.isProcessing = true

		const processToken = async () => {
			try {
				const parsedJwt = parseJwt(token)

				const userInfo: ZgsmUserInfo = {
					id: parsedJwt.id,
					name: parsedJwt?.properties?.oauth_GitHub_username || parsedJwt.id || parsedJwt.phone,
					picture: parsedJwt.avatar || parsedJwt?.properties?.oauth_GitHub_avatarUrl,
					email: parsedJwt.email || parsedJwt?.properties?.oauth_GitHub_email,
					phone: parsedJwt.phone,
					organizationName: parsedJwt.organizationName,
					organizationImageUrl: parsedJwt.organizationImageUrl,
				}

				const [logoPic, hash] = await Promise.all([
					userInfo.picture ? imageUrlToBase64(userInfo.picture) : Promise.resolve(""),
					hashToken(token),
				])

				const result: ZgsmUserData = {
					userInfo,
					logoPic: logoPic || "",
					hash,
					isAuthenticated: true,
				}

				cacheRef.current = {
					token,
					result,
					isProcessing: false,
				}
				setData(result)
			} catch (error) {
				console.error("Failed to parse JWT token:", error)
				const errorResult: ZgsmUserData = {
					userInfo: null,
					logoPic: "",
					hash: "",
					isAuthenticated: true,
				}
				cacheRef.current.isProcessing = false
				setData(errorResult)
			}
		}

		processToken()
	}, [tokenOrConfig])

	return data
}
