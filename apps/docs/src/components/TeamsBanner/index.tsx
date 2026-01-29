import React, { useState, useEffect } from "react"
import styles from "./styles.module.css"

export function TeamsBanner(): React.ReactElement | null {
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		// Check localStorage to see if banner was dismissed
		const isDismissed = localStorage.getItem("teamsBannerDismissed")
		if (!isDismissed) {
			setIsVisible(true)
		}
	}, [])

	const handleDismiss = () => {
		setIsVisible(false)
		localStorage.setItem("teamsBannerDismissed", "true")
	}

	if (!isVisible) {
		return null
	}

	return (
		<div className={styles.teamsBanner} role="banner" aria-label="Roo Code Teams announcement">
			<div className={styles.teamsBannerContent}>
				<span className={styles.teamsBannerHeadline}>Ship Faster with Roo Code Teams.</span>
				<a
					className={styles.teamsBannerLink}
					href="https://app.roocode.com/l/teams?utm_source=docs&utm_medium=banner&utm_campaign=teams_promo"
					target="_blank"
					rel="noopener noreferrer">
					Get early access now.
				</a>
			</div>
			<button
				className={styles.teamsBannerDismiss}
				onClick={handleDismiss}
				aria-label="Dismiss banner"
				type="button">
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true">
					<path
						d="M12.5 3.5L3.5 12.5M3.5 3.5L12.5 12.5"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
		</div>
	)
}

export default TeamsBanner
