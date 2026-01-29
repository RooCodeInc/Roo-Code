import React, { useState, useEffect } from "react"
import { RxGithubLogo } from "react-icons/rx"
import { VscVscode } from "react-icons/vsc"
import { GITHUB_MAIN_REPO_URL, SIGN_IN_URL, SIGN_UP_URL, VSCODE_MARKETPLACE_URL } from "@site/src/constants"
import styles from "./styles.module.css"

// Number formatting function
function formatNumber(num: number): string {
	if (num >= 1000000) {
		const truncated = Math.floor((num / 1000000) * 10) / 10
		return truncated.toFixed(1) + "M"
	}
	const truncated = Math.floor((num / 1000) * 10) / 10
	return truncated.toFixed(1) + "k"
}

// GitHub Stars API
async function getGitHubStars() {
	try {
		const res = await fetch("https://api.github.com/repos/RooCodeInc/Roo-Code")
		const data = await res.json()

		if (typeof data.stargazers_count !== "number") {
			console.error("GitHub API: Invalid stargazers count")
			return null
		}

		return formatNumber(data.stargazers_count)
	} catch (error) {
		console.error("Error fetching GitHub stars:", error)
		return null
	}
}

// VS Code Downloads API
async function getVSCodeDownloads() {
	try {
		const res = await fetch("https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json;api-version=7.1-preview.1",
			},
			body: JSON.stringify({
				filters: [
					{
						criteria: [
							{
								filterType: 7,
								value: "RooVeterinaryInc.roo-cline",
							},
						],
					},
				],
				flags: 914,
			}),
		})

		const data = await res.json()
		const statistics = data?.results?.[0]?.extensions?.[0]?.statistics

		if (!statistics) {
			console.error("VSCode API: Missing statistics in response")
			return null
		}

		const installStat = statistics.find(
			(stat: { statisticName: string; value: number }) => stat.statisticName === "install",
		)
		if (!installStat) {
			console.error("VSCode API: Install count not found")
			return null
		}

		return formatNumber(installStat.value)
	} catch (error) {
		console.error("Error fetching VSCode downloads:", error)
		return null
	}
}

export default function GitHubInstallButtons(): React.JSX.Element {
	const [stars, setStars] = useState<string | null>("15.4k")
	const [downloads, setDownloads] = useState<string | null>("574.1k")

	useEffect(() => {
		// Fetch live data
		getGitHubStars().then((count) => {
			if (count) setStars(count)
		})

		getVSCodeDownloads().then((count) => {
			if (count) setDownloads(count)
		})
	}, [])

	return (
		<div className={styles.container}>
			{/* GitHub Button */}
			<a
				href={GITHUB_MAIN_REPO_URL}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.githubButton}
				title="GitHub Repository">
				<RxGithubLogo className={styles.icon} />
				{stars && <span>{stars}</span>}
			</a>

			<a
				href={SIGN_IN_URL}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.secondaryButton}
				title="Log into Roo Code Cloud">
				<span>Log in</span>
			</a>

			<a
				href={SIGN_UP_URL}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.installButton}
				title="Sign up">
				<span>Sign up</span>
			</a>

			{/* Install Button */}
			<a
				href={VSCODE_MARKETPLACE_URL}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.installButton}
				title="Install VS Code Extension">
				<VscVscode className={styles.icon} />
				<span>
					Install <span className={styles.separator}>&middot;</span>
				</span>
				{downloads && <span>{downloads}</span>}
			</a>
		</div>
	)
}
