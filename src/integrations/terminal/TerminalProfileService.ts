import * as vscode from "vscode"

export interface TerminalProfile {
	name: string
	path?: string
	args?: string[]
	icon?: string
	color?: string
	env?: Record<string, string>
}

export interface TerminalProfileInfo {
	name: string
	displayName: string
	shellPath?: string
	isDefault?: boolean
}

export class TerminalProfileService {
	/**
	 * Gets the current platform identifier for terminal profiles
	 */
	private static getPlatform(): string {
		switch (process.platform) {
			case "win32":
				return "windows"
			case "darwin":
				return "osx"
			case "linux":
				return "linux"
			default:
				return "linux"
		}
	}

	/**
	 * Gets all available terminal profiles for the current platform
	 */
	public static getAvailableProfiles(): TerminalProfileInfo[] {
		const platform = this.getPlatform()
		const config = vscode.workspace.getConfiguration("terminal.integrated")

		// Get profiles for the current platform
		const profiles = config.get<Record<string, TerminalProfile>>(`profiles.${platform}`) || {}

		// Get the default profile name
		const defaultProfile = config.get<string>(`defaultProfile.${platform}`)

		// Convert profiles to our format
		const profileInfos: TerminalProfileInfo[] = Object.entries(profiles).map(([name, profile]) => ({
			name,
			displayName: name,
			shellPath: profile.path,
			isDefault: name === defaultProfile,
		}))

		// If no profiles are configured, return an empty array
		// VSCode will use its built-in defaults
		return profileInfos
	}

	/**
	 * Gets the default profile for the current platform
	 */
	public static getDefaultProfile(): TerminalProfileInfo | undefined {
		const platform = this.getPlatform()
		const config = vscode.workspace.getConfiguration("terminal.integrated")

		const defaultProfileName = config.get<string>(`defaultProfile.${platform}`)

		if (defaultProfileName) {
			const profiles = this.getAvailableProfiles()
			return profiles.find((profile) => profile.name === defaultProfileName)
		}

		return undefined
	}

	/**
	 * Gets a specific profile by name
	 */
	public static getProfileByName(name: string): TerminalProfileInfo | undefined {
		const profiles = this.getAvailableProfiles()
		return profiles.find((profile) => profile.name === name)
	}

	/**
	 * Gets the shell path for a given profile name
	 * Returns undefined if profile doesn't exist or doesn't specify a path
	 */
	public static getShellPathForProfile(profileName: string): string | undefined {
		if (!profileName) {
			return undefined
		}

		// Check regular profiles
		const profile = this.getProfileByName(profileName)
		return profile?.shellPath
	}

	/**
	 * Gets the full profile configuration from terminal.integrated.profiles.{platform}
	 */
	public static getProfileConfiguration(profileName: string): Partial<vscode.TerminalOptions> | undefined {
		if (!profileName) {
			return undefined
		}

		const platform = this.getPlatform()
		const config = vscode.workspace.getConfiguration("terminal.integrated")
		const profiles = config.get<Record<string, TerminalProfile>>(`profiles.${platform}`) || {}

		const profile = profiles[profileName]
		if (!profile) {
			return undefined
		}

		// Convert VSCode terminal profile to vscode.TerminalOptions
		const terminalOptions: Partial<vscode.TerminalOptions> = {}

		if (profile.path) {
			terminalOptions.shellPath = profile.path
		}

		if (profile.args) {
			terminalOptions.shellArgs = profile.args
		}

		if (profile.env) {
			terminalOptions.env = profile.env
		}

		if (profile.icon) {
			terminalOptions.iconPath = new vscode.ThemeIcon(profile.icon)
		}

		if (profile.color) {
			terminalOptions.color = new vscode.ThemeColor(profile.color)
		}

		return terminalOptions
	}

	/**
	 * Gets the terminal options that Roo should use for terminals
	 * Priority: 1. User's preferred profile, 2. Default profile, 3. undefined (VSCode default)
	 */
	public static getTerminalOptionsForRoo(preferredProfile?: string): Partial<vscode.TerminalOptions> | undefined {
		// 1. Check user's preferred profile
		if (preferredProfile) {
			const profileConfig = this.getProfileConfiguration(preferredProfile)
			if (profileConfig) {
				return profileConfig
			}
		}

		// 2. Check default profile
		const defaultProfile = this.getDefaultProfile()
		if (defaultProfile) {
			const profileConfig = this.getProfileConfiguration(defaultProfile.name)
			if (profileConfig) {
				return profileConfig
			}
		}

		// 3. Let VSCode use its default
		return undefined
	}

	/**
	 * Gets the shell path that Roo should use for terminals (backward compatibility)
	 * Priority: 1. User's preferred profile, 2. Default profile, 3. undefined (VSCode default)
	 */
	public static getShellPathForRoo(preferredProfile?: string): string | undefined {
		const terminalOptions = this.getTerminalOptionsForRoo(preferredProfile)
		return terminalOptions?.shellPath
	}

	/**
	 * Gets all profiles that should be shown in the UI
	 */
	public static getAllSelectableProfiles(): TerminalProfileInfo[] {
		const profiles = this.getAvailableProfiles()

		// Add a "Default" option that represents using VSCode's default behavior
		profiles.unshift({
			name: "",
			displayName: "Default (VSCode Default)",
			isDefault: false,
		})

		return profiles
	}
}
