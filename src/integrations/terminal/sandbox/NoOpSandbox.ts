import type { CommandSandbox } from "./types"

/**
 * No-op sandbox that passes commands through unchanged.
 * Used when sandboxing is disabled.
 */
export class NoOpSandbox implements CommandSandbox {
	async isAvailable(): Promise<boolean> {
		return true
	}

	wrapCommand(command: string, _cwd: string): string {
		return command
	}
}
