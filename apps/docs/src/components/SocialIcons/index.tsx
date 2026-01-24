import React from "react"
import { FaBluesky, FaDiscord, FaGithub, FaLinkedin, FaReddit, FaTiktok, FaXTwitter } from "react-icons/fa6"
import {
	DISCORD_URL,
	REDDIT_URL,
	TWITTER_URL,
	BLUESKY_URL,
	LINKEDIN_URL,
	TIKTOK_URL,
	GITHUB_MAIN_REPO_URL,
} from "../../constants"

const SocialIcons: React.FC = () => {
	const socialLinks = [
		{
			href: GITHUB_MAIN_REPO_URL,
			icon: FaGithub,
			label: "GitHub",
		},
		{
			href: DISCORD_URL,
			icon: FaDiscord,
			label: "Discord",
		},
		{
			href: REDDIT_URL,
			icon: FaReddit,
			label: "Reddit",
		},
		{
			href: TWITTER_URL,
			icon: FaXTwitter,
			label: "X (Twitter)",
		},
		{
			href: LINKEDIN_URL,
			icon: FaLinkedin,
			label: "LinkedIn",
		},
		{
			href: TIKTOK_URL,
			icon: FaTiktok,
			label: "TikTok",
		},
		{
			href: BLUESKY_URL,
			icon: FaBluesky,
			label: "Bluesky",
		},
	]

	return (
		<div
			style={{
				display: "flex",
				gap: "1rem",
				flexWrap: "wrap",
				justifyContent: "center",
			}}>
			{socialLinks.map(({ href, icon: Icon, label }) => (
				<a
					key={label}
					href={href}
					aria-label={label}
					className="footer__link-item"
					style={{
						textDecoration: "none",
						transition: "opacity 0.2s ease",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.opacity = "0.7"
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.opacity = "1"
					}}>
					<Icon size={24} />
				</a>
			))}
		</div>
	)
}

export default SocialIcons
