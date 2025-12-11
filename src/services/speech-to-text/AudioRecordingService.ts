import { WebSocket } from "ws"
import { spawn, ChildProcess, execSync } from "child_process"
import * as os from "os"

interface AudioRecordingOptions {
	apiKey: string
	model?: string
	language?: string
	onTranscript: (text: string, isFinal: boolean) => void
	onError: (error: string) => void
	onStateChange: (state: "idle" | "recording" | "connecting" | "error") => void
}

export class AudioRecordingService {
	private static instance: AudioRecordingService | null = null
	private recordingProcess: ChildProcess | null = null
	private websocket: WebSocket | null = null
	private keepAliveInterval: NodeJS.Timeout | null = null
	private isRecording = false
	private options: AudioRecordingOptions | null = null
	private static ffmpegAvailable: boolean | null = null

	private constructor() {}

	static getInstance(): AudioRecordingService {
		if (!AudioRecordingService.instance) {
			AudioRecordingService.instance = new AudioRecordingService()
		}
		return AudioRecordingService.instance
	}

	/**
	 * Check if ffmpeg is installed and available in the system PATH
	 */
	static checkFfmpegAvailable(): { available: boolean; message: string } {
		// Use cached result if available
		if (AudioRecordingService.ffmpegAvailable !== null) {
			return {
				available: AudioRecordingService.ffmpegAvailable,
				message: AudioRecordingService.ffmpegAvailable
					? "ffmpeg is available"
					: AudioRecordingService.getInstallInstructions(),
			}
		}

		try {
			const platform = os.platform()
			const command = platform === "win32" ? "where ffmpeg" : "which ffmpeg"
			execSync(command, { stdio: "pipe" })
			AudioRecordingService.ffmpegAvailable = true
			console.log("Roo Code <STT>: ffmpeg is available")
			return { available: true, message: "ffmpeg is available" }
		} catch {
			AudioRecordingService.ffmpegAvailable = false
			console.log("Roo Code <STT>: ffmpeg is not available")
			return { available: false, message: AudioRecordingService.getInstallInstructions() }
		}
	}

	/**
	 * Get platform-specific installation instructions for ffmpeg
	 */
	private static getInstallInstructions(): string {
		const platform = os.platform()

		if (platform === "win32") {
			return `Speech-to-text requires ffmpeg to be installed.

To install ffmpeg on Windows:

Option 1 - Using winget (recommended):
  winget install ffmpeg

Option 2 - Using Chocolatey:
  choco install ffmpeg

Option 3 - Manual installation:
  1. Download from https://ffmpeg.org/download.html
  2. Extract to a folder (e.g., C:\\ffmpeg)
  3. Add the bin folder to your PATH environment variable
  4. Restart VS Code

After installation, restart VS Code and try again.`
		} else if (platform === "darwin") {
			return `Speech-to-text requires ffmpeg to be installed.

To install ffmpeg on macOS:

Using Homebrew (recommended):
  brew install ffmpeg

If you don't have Homebrew:
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install ffmpeg

After installation, restart VS Code and try again.`
		} else {
			return `Speech-to-text requires ffmpeg to be installed.

To install ffmpeg on Linux:

Ubuntu/Debian:
  sudo apt update && sudo apt install ffmpeg

Fedora:
  sudo dnf install ffmpeg

Arch Linux:
  sudo pacman -S ffmpeg

After installation, restart VS Code and try again.`
		}
	}

	async startRecording(options: AudioRecordingOptions): Promise<void> {
		if (this.isRecording) {
			console.log("Roo Code <STT>: Already recording")
			return
		}

		// Check if ffmpeg is available before attempting to record
		const ffmpegCheck = AudioRecordingService.checkFfmpegAvailable()
		if (!ffmpegCheck.available) {
			console.error("Roo Code <STT>: ffmpeg not found")
			options.onError(ffmpegCheck.message)
			options.onStateChange("error")
			return
		}

		this.options = options
		options.onStateChange("connecting")

		try {
			// Connect to Deepgram WebSocket
			// Optimized Deepgram settings for lower latency and better accuracy
			const params = new URLSearchParams({
				model: options.model || "nova-3",
				language: options.language || "en",
				punctuate: "true",
				smart_format: "true",
				interim_results: "true",
				utterance_end_ms: "1000", // Faster utterance detection
				vad_events: "true", // Voice activity detection
				endpointing: "200", // Faster endpointing (200ms silence = end of phrase)
				sample_rate: "16000",
				encoding: "linear16",
				channels: "1",
			})

			const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`
			console.log("Roo Code <STT>: Connecting to Deepgram...")

			this.websocket = new WebSocket(wsUrl, {
				headers: {
					Authorization: `Token ${options.apiKey}`,
				},
			})

			this.websocket.on("open", () => {
				console.log("Roo Code <STT>: WebSocket connected")
				this.startAudioCapture()
			})

			this.websocket.on("message", (data: Buffer | string) => {
				try {
					const message = JSON.parse(data.toString())
					console.log("Roo Code <STT>: Deepgram message received:", JSON.stringify(message).substring(0, 200))

					if (message.type === "Results" && message.channel?.alternatives?.[0]) {
						const transcript = message.channel.alternatives[0].transcript
						const isFinal = message.is_final || message.speech_final

						console.log("Roo Code <STT>: Transcript:", transcript, "isFinal:", isFinal)

						if (transcript && this.options) {
							this.options.onTranscript(transcript, isFinal)
						}
					} else if (message.type === "Metadata") {
						console.log("Roo Code <STT>: Deepgram metadata received - connection working")
					} else if (message.type === "Error" || message.error) {
						console.error("Roo Code <STT>: Deepgram error:", message)
						if (this.options) {
							this.options.onError(
								"Deepgram error: " + (message.error || message.message || "Unknown error"),
							)
						}
					}
				} catch (error) {
					console.error("Roo Code <STT>: Error parsing message:", error)
				}
			})

			this.websocket.on("error", (error: Error) => {
				console.error("Roo Code <STT>: WebSocket error:", error)
				if (this.options) {
					this.options.onError("Connection error: " + error.message)
					this.options.onStateChange("error")
				}
				this.cleanup()
			})

			this.websocket.on("close", (code: number, reason: Buffer) => {
				console.log("Roo Code <STT>: WebSocket closed:", code, reason.toString())
				if (this.isRecording && this.options) {
					this.options.onStateChange("idle")
				}
				this.cleanup()
			})
		} catch (error) {
			console.error("Roo Code <STT>: Error starting recording:", error)
			options.onError("Failed to start recording: " + (error as Error).message)
			options.onStateChange("error")
			this.cleanup()
		}
	}

	private startAudioCapture(): void {
		if (!this.websocket || !this.options) {
			return
		}

		try {
			const platform = os.platform()
			console.log("Roo Code <STT>: Starting audio capture on platform:", platform)

			if (platform === "win32") {
				this.startWindowsAudioCapture()
			} else if (platform === "darwin") {
				this.startMacAudioCapture()
			} else {
				this.startLinuxAudioCapture()
			}
		} catch (error) {
			console.error("Roo Code <STT>: Error starting audio capture:", error)
			if (this.options) {
				this.options.onError("Failed to access microphone: " + (error as Error).message)
				this.options.onStateChange("error")
			}
			this.cleanup()
		}
	}

	private startWindowsAudioCapture(): void {
		// Use ffmpeg with DirectShow (dshow) to capture from default audio device
		// We need to enumerate audio devices first
		this.detectAndCaptureWindowsAudio()
	}

	private async detectAndCaptureWindowsAudio(): Promise<void> {
		// First, list available audio devices to find the microphone
		const listProcess = spawn("ffmpeg", ["-list_devices", "true", "-f", "dshow", "-i", "dummy"], {
			shell: true,
		})

		let deviceOutput = ""
		listProcess.stderr?.on("data", (data: Buffer) => {
			deviceOutput += data.toString()
		})

		listProcess.on("close", () => {
			console.log("Roo Code <STT>: Device listing output:", deviceOutput)

			// Parse the output to find audio devices
			// FFmpeg outputs device names in format: [dshow @ ...] "Device Name" (audio)
			const audioDeviceMatch = deviceOutput.match(/"([^"]+)"\s+\(audio\)/i)

			if (audioDeviceMatch && audioDeviceMatch[1]) {
				const deviceName = audioDeviceMatch[1]
				console.log("Roo Code <STT>: Found audio device:", deviceName)
				this.startFFmpegWithDevice(deviceName)
			} else {
				// Try with default "Microphone" name or virtual audio cable
				console.log("Roo Code <STT>: No audio device found, trying default names...")
				// Try common device names
				this.startFFmpegWithDevice("Microphone")
			}
		})

		listProcess.on("error", (error: Error) => {
			console.error("Roo Code <STT>: Error listing devices:", error)
			if (this.options) {
				this.options.onError("Failed to list audio devices: " + error.message)
				this.options.onStateChange("error")
			}
			this.cleanup()
		})
	}

	private startFFmpegWithDevice(deviceName: string): void {
		// On Windows with shell: true, we need to construct the command differently
		// to handle device names with spaces properly
		const inputArg = `audio="${deviceName}"`

		console.log("Roo Code <STT>: Starting ffmpeg with device:", deviceName)
		console.log("Roo Code <STT>: Input arg:", inputArg)

		// Use low-latency settings: small buffer, no audio filters, real-time output
		this.recordingProcess = spawn(
			"ffmpeg",
			[
				"-f",
				"dshow",
				"-audio_buffer_size",
				"50", // Small buffer for low latency (50ms)
				"-i",
				inputArg,
				"-ar",
				"16000",
				"-ac",
				"1",
				"-f",
				"s16le",
				"-acodec",
				"pcm_s16le",
				"-fflags",
				"+nobuffer+flush_packets", // Low latency flags
				"-flags",
				"low_delay", // Low delay mode
				"-",
			],
			{
				shell: true,
				// Ensure stdout is piped for audio data
				stdio: ["ignore", "pipe", "pipe"],
			},
		)

		let hasReceivedData = false

		this.recordingProcess.stdout?.on("data", (data: Buffer) => {
			if (!hasReceivedData) {
				hasReceivedData = true
				console.log("Roo Code <STT>: Received first audio chunk, size:", data.length)
			}
			if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
				this.websocket.send(data)
			}
		})

		this.recordingProcess.stderr?.on("data", (data: Buffer) => {
			const msg = data.toString()
			// Log all stderr for debugging
			console.log("Roo Code <STT>: ffmpeg stderr:", msg.trim())
		})

		this.recordingProcess.on("error", (error: Error) => {
			console.error("Roo Code <STT>: ffmpeg error:", error.message)
			if (this.options) {
				this.options.onError("Audio capture failed: " + error.message)
				this.options.onStateChange("error")
			}
			this.cleanup()
		})

		this.recordingProcess.on("close", (code: number | null) => {
			console.log("Roo Code <STT>: ffmpeg closed with code:", code)
			if (this.isRecording) {
				this.cleanup()
			}
		})

		// Wait a moment to see if ffmpeg started successfully
		setTimeout(() => {
			if (this.recordingProcess && !this.recordingProcess.killed) {
				this.isRecording = true
				if (this.options) {
					this.options.onStateChange("recording")
				}

				// Set up keep-alive
				this.keepAliveInterval = setInterval(() => {
					if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
						this.websocket.send(JSON.stringify({ type: "KeepAlive" }))
					}
				}, 10000)

				console.log("Roo Code <STT>: Recording started successfully")
			}
		}, 500)
	}

	private startMacAudioCapture(): void {
		// Use ffmpeg with avfoundation - :0 is the default audio input
		const ffmpegArgs = [
			"-f",
			"avfoundation",
			"-i",
			":0",
			"-ar",
			"16000",
			"-ac",
			"1",
			"-f",
			"s16le",
			"-acodec",
			"pcm_s16le",
			"-",
		]

		this.startFFmpegProcess(ffmpegArgs)
	}

	private startLinuxAudioCapture(): void {
		// Use ffmpeg with pulse (PulseAudio) or alsa
		const ffmpegArgs = [
			"-f",
			"pulse",
			"-i",
			"default",
			"-ar",
			"16000",
			"-ac",
			"1",
			"-f",
			"s16le",
			"-acodec",
			"pcm_s16le",
			"-",
		]

		this.startFFmpegProcess(ffmpegArgs)
	}

	private startFFmpegProcess(ffmpegArgs: string[]): void {
		console.log("Roo Code <STT>: Starting ffmpeg with args:", ffmpegArgs)

		this.recordingProcess = spawn("ffmpeg", ffmpegArgs, {
			shell: os.platform() === "win32",
		})

		this.recordingProcess.stdout?.on("data", (data: Buffer) => {
			if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
				this.websocket.send(data)
			}
		})

		this.recordingProcess.stderr?.on("data", (data: Buffer) => {
			const msg = data.toString()
			if (msg.includes("Input #") || msg.includes("Stream #") || msg.includes("Error") || msg.includes("error")) {
				console.log("Roo Code <STT>: ffmpeg:", msg.trim())
			}
		})

		this.recordingProcess.on("error", (error: Error) => {
			console.error("Roo Code <STT>: ffmpeg error:", error.message)
			if (this.options) {
				this.options.onError(
					"Audio capture requires ffmpeg to be installed.\n\n" +
						"Windows: winget install ffmpeg\n" +
						"Mac: brew install ffmpeg\n" +
						"Linux: sudo apt install ffmpeg",
				)
				this.options.onStateChange("error")
			}
			this.cleanup()
		})

		this.recordingProcess.on("close", (code: number | null) => {
			console.log("Roo Code <STT>: ffmpeg closed with code:", code)
			if (this.isRecording) {
				this.cleanup()
			}
		})

		// Wait a moment to see if ffmpeg started successfully
		setTimeout(() => {
			if (this.recordingProcess && !this.recordingProcess.killed) {
				this.isRecording = true
				if (this.options) {
					this.options.onStateChange("recording")
				}

				// Set up keep-alive
				this.keepAliveInterval = setInterval(() => {
					if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
						this.websocket.send(JSON.stringify({ type: "KeepAlive" }))
					}
				}, 10000)

				console.log("Roo Code <STT>: Recording started successfully")
			}
		}, 500)
	}

	stopRecording(): void {
		console.log("Roo Code <STT>: Stopping recording...")

		// Send finalize to get final transcript
		if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
			this.websocket.send(JSON.stringify({ type: "Finalize" }))

			// Give a short delay for final response
			setTimeout(() => {
				this.cleanup()
			}, 500)
		} else {
			this.cleanup()
		}
	}

	private cleanup(): void {
		// Stop keep-alive
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			this.keepAliveInterval = null
		}

		// Stop recording process
		if (this.recordingProcess) {
			try {
				this.recordingProcess.kill("SIGTERM")
			} catch (error) {
				console.error("Roo Code <STT>: Error stopping recording process:", error)
			}
			this.recordingProcess = null
		}

		// Close WebSocket
		if (this.websocket) {
			try {
				if (this.websocket.readyState === WebSocket.OPEN) {
					this.websocket.close()
				}
			} catch (error) {
				console.error("Roo Code <STT>: Error closing WebSocket:", error)
			}
			this.websocket = null
		}

		this.isRecording = false

		if (this.options) {
			this.options.onStateChange("idle")
		}
	}

	getIsRecording(): boolean {
		return this.isRecording
	}

	dispose(): void {
		this.cleanup()
	}
}
