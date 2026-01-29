import React, { useState, useEffect } from "react"
import { VscGitPullRequest, VscClose } from "react-icons/vsc"
import styles from "./styles.module.css"

// Change this key whenever you change the banner
// to announce something new
const BANNER_DISMISSED_KEY = "reviewer-banner-dismissed"

export function AnnouncementBanner() {
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		// Check if banner was previously dismissed
		const isDismissed = localStorage.getItem(BANNER_DISMISSED_KEY)
		if (!isDismissed) {
			setIsVisible(true)
		}
	}, [])

	const handleDismiss = () => {
		setIsVisible(false)
		localStorage.setItem(BANNER_DISMISSED_KEY, "true")
	}

	if (!isVisible) {
		return null
	}

	return (
		<div className={styles.announcementBanner} role="complementary" aria-label="Product announcement">
			<div className={styles.bannerContent}>
				<VscGitPullRequest size={20} color="#ffffff" />
				<span className={styles.bannerHeadline}>
					Get comprehensive, actionable reviews directly in your PRs.
				</span>
				<a
					className={styles.bannerLink}
					href="https://roocode.com/reviewer?utm_source=docs&utm_medium=banner&utm_campaign=reviewer_promo"
					target="_blank"
					rel="noopener noreferrer">
					Try Roo&apos;s PR Reviewer
				</a>
				<button
					className={styles.dismissButton}
					onClick={handleDismiss}
					aria-label="Dismiss announcement"
					type="button">
					<VscClose size={18} />
				</button>
			</div>
		</div>
	)
}
