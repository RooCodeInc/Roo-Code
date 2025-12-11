/**
 * Deepgram Speech-to-Text Service
 *
 * Handles real-time speech transcription using Deepgram's WebSocket streaming API.
 * @see https://developers.deepgram.com/docs/live-streaming-audio
 */

import * as vscode from "vscode"

export interface DeepgramTranscriptResult {
	transcript: string
	confidence: number
	isFinal: boolean
	speechFinal: boolean
	words?: Array<{
		word: string
		start: number
		end: number
		confidence: number
		punctuatedWord: string
	}>
}

export interface DeepgramConfig {
	apiKey: string
	model?: string // Default: nova-3
	language?: string // Default: en
	punctuate?: boolean // Default: true
	smartFormat?: boolean // Default: true
	interimResults?: boolean // Default: true
	endpointing?: number | boolean // Default: 300ms
	sampleRate?: number // Default: 16000
	encoding?: string // Default: linear16
}

type TranscriptCallback = (result: DeepgramTranscriptResult) => void
type ErrorCallback = (error: Error) => void
type StateCallback = (state: "connecting" | "connected" | "disconnected" | "error") => void

/**
 * Service for managing Deepgram WebSocket connections and audio streaming
 */
export class DeepgramService {
	private static instance: DeepgramService | null = null
	private websocket: WebSocket | null = null
	private config: DeepgramConfig | null = null
	private onTranscriptCallbacks: TranscriptCallback[] = []
	private onErrorCallbacks: ErrorCallback[] = []
	private onStateChangeCallbacks: StateCallback[] = []
	private connectionState: "connecting" | "connected" | "disconnected" | "error" = "disconnected"
	private keepAliveInterval: NodeJS.Timeout | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 3

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): DeepgramService {
		if (!DeepgramService.instance) {
			DeepgramService.instance = new DeepgramService()
		}
		return DeepgramService.instance
	}

	/**
	 * Configure the service with API key and options
	 */
	public configure(config: DeepgramConfig): void {
		this.config = {
			model: "nova-3",
			language: "en",
			punctuate: true,
			smartFormat: true,
			interimResults: true,
			endpointing: 300,
			sampleRate: 16000,
			encoding: "linear16",
			...config,
		}
	}

	/**
	 * Build WebSocket URL with query parameters
	 */
	private buildWebSocketUrl(): string {
		if (!this.config) {
			throw new Error("DeepgramService not configured. Call configure() first.")
		}

		const params = new URLSearchParams()
		params.append("model", this.config.model || "nova-3")
		params.append("language", this.config.language || "en")
		params.append("punctuate", String(this.config.punctuate ?? true))
		params.append("smart_format", String(this.config.smartFormat ?? true))
		params.append("interim_results", String(this.config.interimResults ?? true))
		params.append("sample_rate", String(this.config.sampleRate || 16000))
		params.append("encoding", this.config.encoding || "linear16")
		params.append("channels", "1")

		if (this.config.endpointing !== undefined) {
			params.append("endpointing", String(this.config.endpointing))
		}

		return `wss://api.deepgram.com/v1/listen?${params.toString()}`
	}

	/**
	 * Connect to Deepgram WebSocket
	 */
	public async connect(): Promise<void> {
		if (!this.config?.apiKey) {
			throw new Error("Deepgram API key not configured")
		}

		if (this.websocket && this.connectionState === "connected") {
			console.log("Roo Code <Deepgram>: Already connected")
			return
		}

		this.setConnectionState("connecting")

		return new Promise((resolve, reject) => {
			try {
				const url = this.buildWebSocketUrl()
				console.log("Roo Code <Deepgram>: Connecting to WebSocket...")

				// Use global WebSocket (available in VS Code extension host)
				// Note: In extension context, we may need to use a different WebSocket implementation
				const WebSocketImpl = (globalThis as any).WebSocket || require("ws")
				const ws = new WebSocketImpl(url, {
					headers: {
						Authorization: `Token ${this.config!.apiKey}`,
					},
				})
				this.websocket = ws

				ws.onopen = () => {
					console.log("Roo Code <Deepgram>: WebSocket connected")
					this.setConnectionState("connected")
					this.reconnectAttempts = 0
					this.startKeepAlive()
					resolve()
				}

				ws.onmessage = (event: MessageEvent) => {
					this.handleMessage(event.data)
				}

				ws.onerror = (event: Event) => {
					console.error("Roo Code <Deepgram>: WebSocket error:", event)
					this.setConnectionState("error")
					this.notifyError(new Error("WebSocket connection error"))
					reject(new Error("WebSocket connection error"))
				}

				ws.onclose = (event: CloseEvent) => {
					console.log("Roo Code <Deepgram>: WebSocket closed:", event.code, event.reason)
					this.stopKeepAlive()
					this.setConnectionState("disconnected")

					// Attempt reconnect if unexpected close
					if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
						this.reconnectAttempts++
						console.log(
							`Roo Code <Deepgram>: Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
						)
						setTimeout(() => this.connect(), 1000 * this.reconnectAttempts)
					}
				}
			} catch (error) {
				console.error("Roo Code <Deepgram>: Failed to create WebSocket:", error)
				this.setConnectionState("error")
				reject(error)
			}
		})
	}

	/**
	 * Send audio data to Deepgram
	 */
	public sendAudio(audioData: ArrayBuffer | Uint8Array): void {
		if (!this.websocket || this.connectionState !== "connected") {
			console.warn("Roo Code <Deepgram>: Cannot send audio - not connected")
			return
		}

		try {
			this.websocket.send(audioData)
		} catch (error) {
			console.error("Roo Code <Deepgram>: Failed to send audio:", error)
			this.notifyError(error instanceof Error ? error : new Error("Failed to send audio"))
		}
	}

	/**
	 * Send finalize message to flush pending transcriptions
	 */
	public finalize(): void {
		if (!this.websocket || this.connectionState !== "connected") {
			return
		}

		try {
			this.websocket.send(JSON.stringify({ type: "Finalize" }))
		} catch (error) {
			console.error("Roo Code <Deepgram>: Failed to send finalize:", error)
		}
	}

	/**
	 * Disconnect from Deepgram
	 */
	public disconnect(): void {
		this.stopKeepAlive()

		if (this.websocket) {
			try {
				// Send close message before disconnecting
				this.websocket.send(JSON.stringify({ type: "CloseStream" }))
				this.websocket.close(1000, "Client disconnect")
			} catch (error) {
				// Ignore errors during disconnect
			}
			this.websocket = null
		}

		this.setConnectionState("disconnected")
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(data: string): void {
		try {
			const message = JSON.parse(data)

			if (message.type === "Results") {
				const channel = message.channel
				if (channel?.alternatives?.length > 0) {
					const alternative = channel.alternatives[0]
					const result: DeepgramTranscriptResult = {
						transcript: alternative.transcript || "",
						confidence: alternative.confidence || 0,
						isFinal: message.is_final ?? false,
						speechFinal: message.speech_final ?? false,
						words: alternative.words?.map((w: any) => ({
							word: w.word,
							start: w.start,
							end: w.end,
							confidence: w.confidence,
							punctuatedWord: w.punctuated_word,
						})),
					}

					// Only notify if there's actual content
					if (result.transcript.trim()) {
						this.notifyTranscript(result)
					}
				}
			} else if (message.type === "Metadata") {
				console.log("Roo Code <Deepgram>: Received metadata:", message.request_id)
			} else if (message.type === "UtteranceEnd") {
				console.log("Roo Code <Deepgram>: Utterance ended")
			} else if (message.type === "SpeechStarted") {
				console.log("Roo Code <Deepgram>: Speech started")
			}
		} catch (error) {
			console.error("Roo Code <Deepgram>: Failed to parse message:", error)
		}
	}

	/**
	 * Start keep-alive interval
	 */
	private startKeepAlive(): void {
		this.stopKeepAlive()
		this.keepAliveInterval = setInterval(() => {
			if (this.websocket && this.connectionState === "connected") {
				try {
					this.websocket.send(JSON.stringify({ type: "KeepAlive" }))
				} catch (error) {
					console.error("Roo Code <Deepgram>: KeepAlive failed:", error)
				}
			}
		}, 10000) // Every 10 seconds
	}

	/**
	 * Stop keep-alive interval
	 */
	private stopKeepAlive(): void {
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			this.keepAliveInterval = null
		}
	}

	/**
	 * Set and notify connection state change
	 */
	private setConnectionState(state: "connecting" | "connected" | "disconnected" | "error"): void {
		this.connectionState = state
		this.onStateChangeCallbacks.forEach((cb) => cb(state))
	}

	/**
	 * Get current connection state
	 */
	public getConnectionState(): "connecting" | "connected" | "disconnected" | "error" {
		return this.connectionState
	}

	/**
	 * Register transcript callback
	 */
	public onTranscript(callback: TranscriptCallback): () => void {
		this.onTranscriptCallbacks.push(callback)
		return () => {
			this.onTranscriptCallbacks = this.onTranscriptCallbacks.filter((cb) => cb !== callback)
		}
	}

	/**
	 * Register error callback
	 */
	public onError(callback: ErrorCallback): () => void {
		this.onErrorCallbacks.push(callback)
		return () => {
			this.onErrorCallbacks = this.onErrorCallbacks.filter((cb) => cb !== callback)
		}
	}

	/**
	 * Register state change callback
	 */
	public onStateChange(callback: StateCallback): () => void {
		this.onStateChangeCallbacks.push(callback)
		return () => {
			this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter((cb) => cb !== callback)
		}
	}

	/**
	 * Notify all transcript callbacks
	 */
	private notifyTranscript(result: DeepgramTranscriptResult): void {
		this.onTranscriptCallbacks.forEach((cb) => cb(result))
	}

	/**
	 * Notify all error callbacks
	 */
	private notifyError(error: Error): void {
		this.onErrorCallbacks.forEach((cb) => cb(error))
	}

	/**
	 * Check if API key is configured
	 */
	public isConfigured(): boolean {
		return !!this.config?.apiKey
	}

	/**
	 * Dispose the service
	 */
	public dispose(): void {
		this.disconnect()
		this.onTranscriptCallbacks = []
		this.onErrorCallbacks = []
		this.onStateChangeCallbacks = []
		DeepgramService.instance = null
	}
}
