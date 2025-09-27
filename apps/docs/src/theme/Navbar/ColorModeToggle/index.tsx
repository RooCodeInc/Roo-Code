import React, { type ReactNode } from "react"
import { useColorMode, useThemeConfig } from "@docusaurus/theme-common"
import { RxSun, RxMoon } from "react-icons/rx"
import type { Props } from "@theme/Navbar/ColorModeToggle"
import styles from "./styles.module.css"

export default function NavbarColorModeToggle({ className }: Props): ReactNode {
	const { disableSwitch } = useThemeConfig().colorMode
	const { colorMode, setColorMode } = useColorMode()

	if (disableSwitch) {
		return null
	}

	const toggleTheme = () => {
		setColorMode(colorMode === "dark" ? "light" : "dark")
	}

	return (
		<button
			onClick={toggleTheme}
			className={`${styles.themeToggle} ${className || ""}`}
			aria-label="Toggle theme"
			title="Toggle theme">
			{colorMode === "dark" ? <RxSun className={styles.icon} /> : <RxMoon className={styles.icon} />}
		</button>
	)
}
