import { describe, it, expect, beforeEach } from "vitest"
import { CompletionMarkers } from "../CompletionMarkers"

describe("CompletionMarkers", () => {
	let markers: CompletionMarkers

	beforeEach(() => {
		markers = new CompletionMarkers({ enabled: true })
	})

	describe("wrapCommandForPowerShell", () => {
		it("should wrap PowerShell commands with markers", () => {
			const command = "Get-Process"
			const wrapped = markers.wrapCommandForPowerShell(command)

			expect(wrapped).toContain(command)
			expect(wrapped).toContain("ROOCODE_CMD_START")
			expect(wrapped).toContain("ROOCODE_CMD_END")
			expect(wrapped).toContain("Write-Host")
		})

		it("should handle empty commands", () => {
			const wrapped = markers.wrapCommandForPowerShell("")

			expect(wrapped).toContain("ROOCODE_CMD_START")
			expect(wrapped).toContain("ROOCODE_CMD_END")
		})

		it("should handle multi-line commands", () => {
			const command = `Get-Process |
				Where-Object {$_.CPU -gt 10} |
				Select-Object Name, CPU`
			const wrapped = markers.wrapCommandForPowerShell(command)

			expect(wrapped).toContain(command)
			expect(wrapped).toContain("ROOCODE_CMD_START")
			expect(wrapped).toContain("ROOCODE_CMD_END")
		})

		it("should return command as-is when disabled", () => {
			markers.setEnabled(false)
			const command = "Get-Process"
			const wrapped = markers.wrapCommandForPowerShell(command)

			expect(wrapped).toBe(command)
		})
	})

	describe("wrapCommandForBash", () => {
		it("should wrap Bash commands with markers", () => {
			const command = "ls -la"
			const wrapped = markers.wrapCommandForBash(command)

			expect(wrapped).toContain(command)
			expect(wrapped).toContain("ROOCODE_CMD_START")
			expect(wrapped).toContain("ROOCODE_CMD_END")
			expect(wrapped).toContain("echo")
		})

		it("should capture exit code", () => {
			const command = "ls -la"
			const wrapped = markers.wrapCommandForBash(command)

			expect(wrapped).toContain("__exit_code=$?")
			expect(wrapped).toContain("EXIT_CODE=$__exit_code")
		})

		it("should return command as-is when disabled", () => {
			markers.setEnabled(false)
			const command = "ls -la"
			const wrapped = markers.wrapCommandForBash(command)

			expect(wrapped).toBe(command)
		})
	})

	describe("getStartMarker", () => {
		it("should generate start marker with nonce", () => {
			const marker = markers.getStartMarker()

			expect(marker).toContain("ROOCODE_CMD_START")
			expect(marker).toMatch(/:[a-f0-9]+$/) // Hex nonce
		})

		it("should return empty string when disabled", () => {
			markers.setEnabled(false)
			const marker = markers.getStartMarker()

			expect(marker).toBe("")
		})

		it("should include timestamp when configured", () => {
			markers = new CompletionMarkers({ enabled: true, includeTimestamp: true })
			const marker = markers.getStartMarker()

			expect(marker).toMatch(/:\d+$/) // Timestamp at end
		})
	})

	describe("getEndMarker", () => {
		it("should generate end marker with nonce", () => {
			// First generate start marker to set nonce
			markers.getStartMarker()
			const marker = markers.getEndMarker()

			expect(marker).toContain("ROOCODE_CMD_END")
			expect(marker).toMatch(/:[a-f0-9]+/) // Hex nonce
		})

		it("should include exit code when provided", () => {
			markers.getStartMarker()
			const marker = markers.getEndMarker(0)

			expect(marker).toContain("EXIT_CODE=0")
		})

		it("should return empty string when disabled", () => {
			markers.setEnabled(false)
			const marker = markers.getEndMarker()

			expect(marker).toBe("")
		})
	})

	describe("hasStartMarker", () => {
		it("should detect start marker in output", () => {
			const startMarker = markers.getStartMarker()
			const output = `Some output\n${startMarker}\nMore output`

			const result = markers.hasStartMarker(output)
			expect(result).toBe(true)
		})

		it("should not detect start marker when absent", () => {
			markers.getStartMarker() // Set nonce
			const output = "Some regular output without markers"

			const result = markers.hasStartMarker(output)
			expect(result).toBe(false)
		})

		it("should check for nonce when enabled", () => {
			const startMarker = markers.getStartMarker()
			const nonce = startMarker.split(":")[1]
			const wrongOutput = `▶▶▶ ROOCODE_CMD_START:wrongnonce`
			const correctOutput = `▶▶▶ ROOCODE_CMD_START:${nonce}`

			expect(markers.hasStartMarker(wrongOutput)).toBe(false)
			expect(markers.hasStartMarker(correctOutput)).toBe(true)
		})
	})

	describe("hasEndMarker", () => {
		it("should detect end marker in output", () => {
			markers.getStartMarker() // Set nonce
			const endMarker = markers.getEndMarker()
			const output = `Some output\n${endMarker}\nMore output`

			const result = markers.hasEndMarker(output)
			expect(result).toBe(true)
		})

		it("should not detect end marker when absent", () => {
			markers.getStartMarker() // Set nonce
			const output = "Some regular output without markers"

			const result = markers.hasEndMarker(output)
			expect(result).toBe(false)
		})
	})

	describe("extractContentBetweenMarkers", () => {
		it("should extract content between markers", () => {
			const startMarker = markers.getStartMarker()
			const endMarker = markers.getEndMarker(0)
			const commandOutput = "Command output here\nWith multiple lines"
			const output = `${startMarker}\n${commandOutput}\n${endMarker}`

			const result = markers.extractContentBetweenMarkers(output)
			expect(result).not.toBe(null)
			expect(result?.content).toBe(commandOutput)
			expect(result?.exitCode).toBe(0)
		})

		it("should return null when markers are incomplete", () => {
			const startMarker = markers.getStartMarker()
			const output = `${startMarker}\nCommand output here`

			const result = markers.extractContentBetweenMarkers(output)
			expect(result).toBe(null)
		})

		it("should extract exit code when present", () => {
			const startMarker = markers.getStartMarker()
			const nonce = startMarker.split(":")[1]
			const output = `${startMarker}\nCommand output\n◀◀◀ ROOCODE_CMD_END:${nonce}:EXIT_CODE=42`

			const result = markers.extractContentBetweenMarkers(output)
			expect(result?.exitCode).toBe(42)
		})
	})

	describe("removeMarkers", () => {
		it("should remove both markers from output", () => {
			const startMarker = markers.getStartMarker()
			const endMarker = markers.getEndMarker()
			const commandOutput = "Command output here"
			const output = `${startMarker}\n${commandOutput}\n${endMarker}`

			const cleaned = markers.removeMarkers(output)
			expect(cleaned).not.toContain("ROOCODE_CMD_START")
			expect(cleaned).not.toContain("ROOCODE_CMD_END")
			expect(cleaned).toBe(commandOutput)
		})

		it("should handle output without markers", () => {
			const output = "Regular output without any markers"
			const cleaned = markers.removeMarkers(output)
			expect(cleaned).toBe(output)
		})
	})

	describe("isEnabled", () => {
		it("should return enabled state", () => {
			expect(markers.isEnabled()).toBe(true)

			markers.setEnabled(false)
			expect(markers.isEnabled()).toBe(false)

			markers.setEnabled(true)
			expect(markers.isEnabled()).toBe(true)
		})
	})

	describe("reset", () => {
		it("should reset the current nonce", () => {
			const marker1 = markers.getStartMarker()
			markers.reset()
			const marker2 = markers.getStartMarker()

			// Different nonces after reset
			const nonce1 = marker1.split(":")[1]
			const nonce2 = marker2.split(":")[1]
			expect(nonce1).not.toBe(nonce2)
		})
	})

	describe("fromConfig", () => {
		it("should create markers with custom configuration", () => {
			const customMarkers = CompletionMarkers.fromConfig({
				enabled: true,
				startMarker: ">>> START",
				endMarker: "<<< END",
				includeExitCode: false,
				useNonce: false,
			})

			const startMarker = customMarkers.getStartMarker()
			const endMarker = customMarkers.getEndMarker()

			expect(startMarker).toBe(">>> START")
			expect(endMarker).toBe("<<< END")
		})
	})

	describe("getPowerShellInitScript", () => {
		it("should return PowerShell initialization script", () => {
			const script = CompletionMarkers.getPowerShellInitScript()

			expect(script).toContain("Invoke-RooCodeCommand")
			expect(script).toContain("ROOCODE_CMD_START")
			expect(script).toContain("ROOCODE_CMD_END")
			expect(script).toContain("Set-Alias")
		})
	})

	describe("getBashInitScript", () => {
		it("should return Bash initialization script", () => {
			const script = CompletionMarkers.getBashInitScript()

			expect(script).toContain("roo_code_command")
			expect(script).toContain("ROOCODE_CMD_START")
			expect(script).toContain("ROOCODE_CMD_END")
			expect(script).toContain("alias roo=")
		})
	})
})
