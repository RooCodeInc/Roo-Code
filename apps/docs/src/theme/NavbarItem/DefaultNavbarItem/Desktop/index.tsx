import React, { type ReactNode } from "react"
import clsx from "clsx"
import NavbarNavLink from "@theme/NavbarItem/NavbarNavLink"
import type { Props } from "@theme/NavbarItem/DefaultNavbarItem/Desktop"

export default function DefaultNavbarItemDesktop({ className, isDropdownItem = false, ...props }: Props): ReactNode {
	const element = (
		<NavbarNavLink
			className={clsx(isDropdownItem ? "dropdown__link" : "navbar__item navbar__link", className)}
			isDropdownLink={isDropdownItem}
			{...props}
		/>
	)

	if (isDropdownItem) {
		return <li>{element}</li>
	}

	return element
}
