declare module "@site/src/constants" {
	export const GITHUB_REPO_URL: string
	export const GITHUB_ISSUES_URL: string
	export const GITHUB_NEW_ISSUE_URL: string
	export const DISCORD_URL: string
	export const REDDIT_URL: string
	export const TWITTER_URL: string
	export const BLUESKY_URL: string
	export const LINKEDIN_URL: string
	export const TIKTOK_URL: string
	export const GITHUB_MAIN_REPO_URL: string
	export const GITHUB_ISSUES_MAIN_URL: string
	export const GITHUB_FEATURES_URL: string
	export const VSCODE_MARKETPLACE_URL: string
	export const MAC_DIRECT_DOWNLOAD_URL: string
	export const WINDOWS_DIRECT_DOWNLOAD_URL: string
	export const LINUX_DIRECT_DOWNLOAD_URL: string
}

declare module "@site/src/components/Codicon" {
	const Codicon: React.FC<{ name: string }>
	export default Codicon
}

declare module "@site/src/components/CopyPageURL" {
	const CopyPageURL: React.FC
	export default CopyPageURL
}

declare module "@site/src/components/SocialIcons" {
	const SocialIcons: React.FC
	export default SocialIcons
}

declare module "@site/src/components/GitHubInstallButtons" {
	const GitHubInstallButtons: React.FC
	export default GitHubInstallButtons
}

declare module "@site/src/components/NavbarSocialIcons" {
	const NavbarSocialIcons: React.FC
	export default NavbarSocialIcons
}

declare module "@site/docs/tutorial-videos.json" {
	interface Video {
		id: string
		title: string
	}
	const videos: { videos: Video[] }
	export default videos
}
