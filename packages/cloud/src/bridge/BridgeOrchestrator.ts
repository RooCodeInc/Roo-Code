import crypto from "crypto"
import os from "os"

import type { Socket } from "socket.io-client"

import {
	type TaskProviderLike,
	type CloudUserInfo,
	type ExtensionBridgeCommand,
	type StaticAppProperties,
	type GitProperties,
	ConnectionState,
	ExtensionSocketEvents,
} from "@roo-code/types"

import { SocketTransport } from "./SocketTransport.js"
import { ExtensionChannel } from "./ExtensionChannel.js"

export interface BridgeOrchestratorOptions {
	userId: string
	socketBridgeUrl: string
	token: string
	provider: TaskProviderLike
	sessionId: string
	isCloudAgent: boolean
}

export class BridgeOrchestrator {
	private static instance: BridgeOrchestrator | null = null

	// Core
	private readonly userId: string
	private readonly socketBridgeUrl: string
	private readonly token: string
	private readonly provider: TaskProviderLike
	private readonly instanceId: string
	private readonly appProperties: StaticAppProperties
	private readonly gitProperties?: GitProperties
	private readonly isCloudAgent?: boolean

	// Components
	private socketTransport: SocketTransport
	private extensionChannel: ExtensionChannel

	// Reconnection
	private readonly MAX_RECONNECT_ATTEMPTS = Infinity
	private readonly RECONNECT_DELAY = 1_000
	private readonly RECONNECT_DELAY_MAX = 30_000

	public static getInstance(): BridgeOrchestrator | null {
		return BridgeOrchestrator.instance
	}

	public static isEnabled(user: CloudUserInfo | null, remoteControlEnabled: boolean): boolean {
		// Always disabled if signed out.
		if (!user) {
			return false
		}

		// Disabled by the user's organization?
		if (!user.extensionBridgeEnabled) {
			return false
		}

		// Disabled by the user?
		if (!remoteControlEnabled) {
			return false
		}

		return true
	}

	public static async connectOrDisconnect(
		userInfo: CloudUserInfo,
		remoteControlEnabled: boolean,
		options: BridgeOrchestratorOptions,
	): Promise<void> {
		if (BridgeOrchestrator.isEnabled(userInfo, remoteControlEnabled)) {
			await BridgeOrchestrator.connect(options)
		} else {
			await BridgeOrchestrator.disconnect()
		}
	}

	private static async connect(options: BridgeOrchestratorOptions) {
		const instance = BridgeOrchestrator.instance

		if (!instance) {
			try {
				console.log(`[BridgeOrchestrator#connectOrDisconnect] Connecting...`)

				// Populate telemetry properties before registering the instance.
				await options.provider.getTelemetryProperties()

				BridgeOrchestrator.instance = new BridgeOrchestrator(options)
				await BridgeOrchestrator.instance.socketTransport.connect()
			} catch (error) {
				console.error(
					`[BridgeOrchestrator#connectOrDisconnect] connect() failed: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		} else {
			const connectionState = instance.socketTransport.getConnectionState()

			if (connectionState === ConnectionState.FAILED || connectionState === ConnectionState.DISCONNECTED) {
				console.log(`[BridgeOrchestrator#connectOrDisconnect] Re-connecting... (state: ${connectionState})`)

				instance.socketTransport.reconnect().catch((error) => {
					console.error(
						`[BridgeOrchestrator#connectOrDisconnect] reconnect() failed: ${error instanceof Error ? error.message : String(error)}`,
					)
				})
			} else {
				console.log(
					`[BridgeOrchestrator#connectOrDisconnect] Already connected or connecting (state: ${connectionState})`,
				)
			}
		}
	}

	public static async disconnect() {
		const instance = BridgeOrchestrator.instance

		if (instance) {
			const connectionState = instance.socketTransport.getConnectionState()

			try {
				console.log(`[BridgeOrchestrator#connectOrDisconnect] Disconnecting... (state: ${connectionState})`)
				await instance.socketTransport.disconnect()
			} catch (error) {
				console.error(
					`[BridgeOrchestrator#connectOrDisconnect] disconnect() failed: ${error instanceof Error ? error.message : String(error)}`,
				)
			} finally {
				BridgeOrchestrator.instance = null
			}
		} else {
			console.log(`[BridgeOrchestrator#connectOrDisconnect] Already disconnected`)
		}
	}

	private constructor(options: BridgeOrchestratorOptions) {
		this.userId = options.userId
		this.socketBridgeUrl = options.socketBridgeUrl
		this.token = options.token
		this.provider = options.provider
		this.instanceId = options.sessionId || crypto.randomUUID()
		this.appProperties = { ...options.provider.appProperties, hostname: os.hostname() }
		this.gitProperties = options.provider.gitProperties
		this.isCloudAgent = options.isCloudAgent

		this.socketTransport = new SocketTransport({
			url: this.socketBridgeUrl,
			socketOptions: {
				query: {
					token: this.token,
					clientType: "extension",
					instanceId: this.instanceId,
				},
				transports: ["websocket", "polling"],
				reconnection: true,
				reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
				reconnectionDelay: this.RECONNECT_DELAY,
				reconnectionDelayMax: this.RECONNECT_DELAY_MAX,
			},
			onConnect: async (socket: Socket) => {
				this.setupSocketListeners()
				await this.extensionChannel.onConnect(socket)
			},
			onDisconnect: async () => {
				await this.extensionChannel.onDisconnect()
				await this.extensionChannel.cleanup(this.socketTransport.getSocket())
			},
			onReconnect: async (socket: Socket) => {
				this.setupSocketListeners()
				await this.extensionChannel.onReconnect(socket)
			},
		})

		this.extensionChannel = new ExtensionChannel({
			instanceId: this.instanceId,
			appProperties: this.appProperties,
			gitProperties: this.gitProperties,
			userId: this.userId,
			provider: this.provider,
			isCloudAgent: this.isCloudAgent,
		})
	}

	private setupSocketListeners() {
		const socket = this.socketTransport.getSocket()

		if (!socket) {
			console.error("[BridgeOrchestrator] Socket not available")
			return
		}

		// Remove any existing listeners first to prevent duplicates.
		socket.off(ExtensionSocketEvents.RELAYED_COMMAND)
		socket.off("connected")

		socket.on(ExtensionSocketEvents.RELAYED_COMMAND, (message: ExtensionBridgeCommand) => {
			console.log(
				`[BridgeOrchestrator] on(${ExtensionSocketEvents.RELAYED_COMMAND}) -> ${message.type} for ${message.instanceId}`,
			)

			this.extensionChannel.handleCommand(message)
		})
	}
}
