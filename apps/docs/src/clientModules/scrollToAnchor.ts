import type { ClientModule } from "@docusaurus/types"

/**
 * Docusaurus's built-in scroll handler skips hash-based scrolling on initial
 * page load (when previousLocation is null). It assumes the browser handles it
 * natively, but React hydration can reset the scroll position before the
 * browser finishes its native anchor scroll. This client module fills that gap
 * by explicitly scrolling to the hash target after hydration settles.
 *
 * @see https://linear.app/roocode/issue/CLO-805
 */
const scrollToAnchorModule: ClientModule = {
	onRouteDidUpdate({ location, previousLocation }) {
		// Docusaurus core already handles hash scrolling for subsequent
		// navigations. This module only covers the initial page load case.
		if (previousLocation != null) {
			return
		}

		const { hash } = location
		if (!hash) {
			return
		}

		const id = decodeURIComponent(hash.substring(1))
		if (!id) {
			return
		}

		// Wait for the next animation frame so that React hydration has settled
		// and the DOM reflects the final rendered state.
		requestAnimationFrame(() => {
			const element = document.getElementById(id)
			if (element) {
				// scrollIntoView respects the scroll-margin-top set by
				// Docusaurus's anchorTargetStickyNavbar class on headings.
				element.scrollIntoView()
				return
			}

			// If the element wasn't found on the first frame (e.g. lazy-loaded
			// content), retry once after a short delay.
			setTimeout(() => {
				const retryElement = document.getElementById(id)
				retryElement?.scrollIntoView()
			}, 150)
		})
	},
}

export default scrollToAnchorModule
