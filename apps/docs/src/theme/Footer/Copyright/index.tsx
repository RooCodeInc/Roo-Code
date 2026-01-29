import React, { type ReactNode } from "react"
import type { Props } from "@theme/Footer/Copyright"

export default function FooterCopyright({ copyright }: Props): ReactNode {
	return (
		<div
			className="footer__copyright"
			// Developer provided the HTML, so assume it's safe.

			dangerouslySetInnerHTML={{ __html: copyright }}
		/>
	)
}
