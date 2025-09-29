import React, { type ReactNode } from "react"
import clsx from "clsx"
import { ThemeClassNames } from "@docusaurus/theme-common"
import SocialIcons from "@site/src/components/SocialIcons"
import type { Props } from "@theme/Footer/Layout"

export default function FooterLayout({ style, links, logo, copyright }: Props): ReactNode {
	return (
		<footer
			className={clsx(ThemeClassNames.layout.footer.container, "footer", {
				"footer--dark": style === "dark",
			})}>
			<div className="container container-fluid">
				<div className="footer__main">
					<div className="footer__brand">
						{logo && <div className="footer__logo-container">{logo}</div>}
						<div className="footer__tagline">
							Empowering developers to build better software faster with AI-powered tools and insights.
						</div>
						<div className="footer__social-icons">
							<SocialIcons />
						</div>
					</div>
					<div className="footer__links-wrapper">{links}</div>
				</div>
				{copyright && <div className="footer__bottom">{copyright}</div>}
			</div>
		</footer>
	)
}
