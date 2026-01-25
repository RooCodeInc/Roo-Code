import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios"

interface OllamaAxiosConfig {
	baseUrl?: string
	apiKey?: string
	timeout?: number
	retries?: number
	retryDelay?: number
	enableLogging?: boolean
}

export function createOllamaAxiosInstance(config: OllamaAxiosConfig = {}): AxiosInstance {
	const {
		baseUrl = "http://localhost:11434",
		apiKey,
		timeout = 3600000,
		retries = 0,
		retryDelay = 1000,
		enableLogging = false,
	} = config

	const instance = axios.create({
		baseURL: baseUrl,
		timeout: timeout,
		timeoutErrorMessage: `Ollama request timed out after ${timeout}ms`,
		headers: apiKey
			? {
					Authorization: `Bearer ${apiKey}`,
				}
			: {},
		transitional: {
			clarifyTimeoutError: true,
		},
	})

	if (retries > 0) {
		setupRetryInterceptor(instance, { retries, retryDelay })
	}

	if (enableLogging) {
		setupLoggingInterceptor(instance)
	}

	return instance
}

function setupRetryInterceptor(instance: AxiosInstance, config: { retries: number; retryDelay: number }) {
	instance.interceptors.response.use(
		(response) => response,
		async (error: AxiosError) => {
			const axiosConfig = error.config as any

			axiosConfig.__retryCount = axiosConfig.__retryCount || 0
			if (axiosConfig.__retryCount >= config.retries) {
				return Promise.reject(error)
			}

			const shouldRetry =
				error.code === "ECONNREFUSED" ||
				error.code === "ETIMEDOUT" ||
				error.code === "ECONNABORTED" ||
				error.code === "ERR_NETWORK" ||
				(error.response && error.response.status >= 500)

			if (!shouldRetry) {
				return Promise.reject(error)
			}

			axiosConfig.__retryCount += 1
			const delay = config.retryDelay * Math.pow(2, axiosConfig.__retryCount - 1)

			await new Promise((resolve) => setTimeout(resolve, delay))

			return instance(axiosConfig)
		},
	)
}

function setupLoggingInterceptor(instance: AxiosInstance) {
	instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
		;(config as any).metadata = { startTime: Date.now() }
		console.debug("[Ollama] Request:", {
			method: config.method?.toUpperCase(),
			url: `${config.baseURL}${config.url}`,
			timeout: config.timeout,
			timestamp: new Date().toISOString(),
		})
		return config
	})

	instance.interceptors.response.use(
		(response: AxiosResponse) => {
			const startTime = (response.config as any).metadata?.startTime
			const duration = startTime ? Date.now() - startTime : undefined
			console.debug("[Ollama] Response:", {
				status: response.status,
				url: response.config.url,
				durationMs: duration,
				duration: duration ? `${duration}ms` : undefined,
				timestamp: new Date().toISOString(),
			})
			return response
		},
		(error: AxiosError) => {
			const startTime = (error.config as any)?.metadata?.startTime
			const duration = startTime ? Date.now() - startTime : undefined
			console.error("[Ollama] Error:", {
				code: error.code,
				message: error.message,
				status: error.response?.status,
				url: error.config?.url,
				durationMs: duration,
				duration: duration ? `${duration}ms` : undefined,
				timestamp: new Date().toISOString(),
			})
			return Promise.reject(error)
		},
	)
}
