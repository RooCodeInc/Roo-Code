import React, { type ReactNode } from "react"
import clsx from "clsx"
import NavbarNavLink from "@theme/NavbarItem/NavbarNavLink"
import type { Props } from "@theme/NavbarItem/DefaultNavbarItem/Mobile"

export default function DefaultNavbarItemMobile({
	className,
	isDropdownItem: _isDropdownItem,
	...props
}: Props): ReactNode {
	return (
		<li className="menu__list-item">
			<NavbarNavLink className={clsx("menu__link", className)} {...props} />
		</li>
	)
}
