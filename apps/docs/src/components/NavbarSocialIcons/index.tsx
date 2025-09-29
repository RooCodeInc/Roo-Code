import React from "react"
import { FaReddit, FaDiscord } from "react-icons/fa6"
import { REDDIT_URL, DISCORD_URL } from "@site/src/constants"
import styles from "./styles.module.css"

export default function NavbarSocialIcons(): JSX.Element {
	const socialLinks = [
		{
			href: REDDIT_URL,
			icon: FaReddit,
			label: "Reddit",
		},
		{
			href: DISCORD_URL,
			icon: FaDiscord,
			label: "Discord",
		},
	]

	return (
		<div className={styles.socialIcons}>
			{socialLinks.map(({ href, icon: Icon, label }) => (
				<a
					key={label}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.socialLink}
					title={label}
					aria-label={label}>
					<Icon />
				</a>
			))}
		</div>
	)
}
