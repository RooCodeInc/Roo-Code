/* eslint-disable react/jsx-no-target-blank */

"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { RxGithubLogo } from "react-icons/rx"
import { VscVscode } from "react-icons/vsc"
import { HiMenu } from "react-icons/hi"

import { EXTERNAL_LINKS } from "@/lib/constants"
import { useLogoSrc } from "@/lib/hooks/use-logo-src"
import { ScrollButton } from "@/components/ui"
import ThemeToggle from "@/components/chromes/theme-toggle"
import { X } from "lucide-react"
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

interface NavBarProps {
	stars: string | null
	downloads: string | null
}

export function NavBar({ stars, downloads }: NavBarProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const logoSrc = useLogoSrc()

	return (
		<header className="sticky font-light top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
			<div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
				<div className="flex items-center flex-shrink-0">
					<Link href="/" className="flex items-center">
						<Image src={logoSrc} alt="Roo Code Logo" width={130} height={24} className="h-[24px] w-auto" />
					</Link>
				</div>

				{/* Desktop Navigation */}
				<NavigationMenu className="grow ml-6 hidden text-sm md:flex">
					<NavigationMenuList>
						<NavigationMenuItem>
							<NavigationMenuLink
								asChild
								className={cn(navigationMenuTriggerStyle(), "bg-transparent font-light")}>
								<a href={EXTERNAL_LINKS.DOCUMENTATION} target="_blank">
									Docs
								</a>
							</NavigationMenuLink>
						</NavigationMenuItem>

						<NavigationMenuItem>
							<NavigationMenuLink
								asChild
								className={cn(navigationMenuTriggerStyle(), "bg-transparent font-light")}>
								<Link href="/blog">Blog</Link>
							</NavigationMenuLink>
						</NavigationMenuItem>

						<NavigationMenuItem>
							<NavigationMenuLink
								asChild
								className={cn(navigationMenuTriggerStyle(), "bg-transparent font-light")}>
								<Link href="/evals">Evals</Link>
							</NavigationMenuLink>
						</NavigationMenuItem>

						<NavigationMenuItem>
							<NavigationMenuLink
								asChild
								className={cn(navigationMenuTriggerStyle(), "bg-transparent font-light")}>
								<a href={EXTERNAL_LINKS.DISCORD} target="_blank" rel="noopener noreferrer">
									Discord
								</a>
							</NavigationMenuLink>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>

				<div className="hidden md:flex md:items-center md:space-x-4 flex-shrink-0 font-medium">
					<div className="flex flex-row space-x-2 flex-shrink-0">
						<ThemeToggle />
						<Link
							href={EXTERNAL_LINKS.GITHUB}
							target="_blank"
							className="hidden items-center gap-1.5 text-sm hover:text-foreground md:flex whitespace-nowrap">
							<RxGithubLogo className="h-4 w-4" />
							{stars !== null && <span>{stars}</span>}
						</Link>
					</div>
					<a
						href={EXTERNAL_LINKS.CLOUD_APP_LOGIN}
						target="_blank"
						rel="noopener noreferrer"
						className="hidden items-center gap-1.5 rounded-md py-2 text-sm border border-primary-background px-4 text-primary-background transition-all duration-200 hover:shadow-lg hover:scale-105 lg:flex">
						Log in
					</a>
					<Link
						href={EXTERNAL_LINKS.MARKETPLACE}
						target="_blank"
						className="hidden items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-all duration-200 hover:shadow-lg hover:scale-105 md:flex whitespace-nowrap">
						<VscVscode className="-mr-[2px] mt-[1px] h-4 w-4" />
						<span>
							Install <span className="font-black max-lg:text-xs">&middot;</span>
						</span>
						{downloads !== null && <span>{downloads}</span>}
					</Link>
				</div>

				{/* Mobile Menu Button */}
				<button
					aria-expanded={isMenuOpen}
					onClick={() => setIsMenuOpen(!isMenuOpen)}
					className="relative z-10 flex items-center justify-center rounded-full p-2 transition-colors hover:bg-accent md:hidden"
					aria-label="Toggle mobile menu">
					<HiMenu className={`h-6 w-6 ${isMenuOpen ? "hidden" : "block"}`} />
					<X className={`h-6 w-6 ${isMenuOpen ? "block" : "hidden"}`} />
				</button>
			</div>

			{/* Mobile Menu Panel - Full Screen */}
			<div
				className={`fixed top-16 left-0 bg-background right-0 z-[100] transition-all duration-200 pointer-events-none md:hidden ${isMenuOpen ? "block h-dvh" : "hidden"}`}>
				<nav className="flex flex-col justify-between h-full pb-16 overflow-y-auto bg-background pointer-events-auto">
					{/* Main navigation items */}
					<div className="grow-1 py-4 font-semibold text-lg">
						<a
							href={EXTERNAL_LINKS.DOCUMENTATION}
							target="_blank"
							className="block w-full p-5 py-4 text-left text-foreground active:opacity-50"
							onClick={() => setIsMenuOpen(false)}>
							Docs
						</a>

						<Link
							href="/blog"
							className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
							onClick={() => setIsMenuOpen(false)}>
							Blog
						</Link>
						<ScrollButton
							targetId="faq"
							className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
							onClick={() => setIsMenuOpen(false)}>
							FAQ
						</ScrollButton>
						<Link
							href="/evals"
							className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
							onClick={() => setIsMenuOpen(false)}>
							Evals
						</Link>
						<a
							href={EXTERNAL_LINKS.DISCORD}
							target="_blank"
							rel="noopener noreferrer"
							className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
							onClick={() => setIsMenuOpen(false)}>
							Discord
						</a>
					</div>

					{/* Bottom section with Cloud Login and stats */}
					<div className="border-t border-border">
						<div className="flex items-center justify-around px-6 pt-2">
							<Link
								href={EXTERNAL_LINKS.GITHUB}
								target="_blank"
								className="inline-flex items-center gap-2 rounded-md p-3 text-sm transition-colors hover:bg-accent hover:text-foreground"
								onClick={() => setIsMenuOpen(false)}>
								<RxGithubLogo className="h-6 w-6" />
								{stars !== null && <span>{stars}</span>}
							</Link>
							<div className="flex items-center rounded-md p-3 transition-colors hover:bg-accent">
								<ThemeToggle />
							</div>
							<Link
								href={EXTERNAL_LINKS.MARKETPLACE}
								target="_blank"
								className="inline-flex items-center gap-2 rounded-md p-3 text-sm transition-colors hover:bg-accent hover:text-foreground"
								onClick={() => setIsMenuOpen(false)}>
								<VscVscode className="h-6 w-6" />
								{downloads !== null && <span>{downloads}</span>}
							</Link>
						</div>
						<div className="flex gap-2 px-4 pb-4">
							<a
								href={EXTERNAL_LINKS.CLOUD_APP_LOGIN}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-2 rounded-full border border-primary bg-background p-4 w-full text-base font-semibold text-primary"
								onClick={() => setIsMenuOpen(false)}>
								Log in
							</a>
						</div>
					</div>
				</nav>
			</div>
		</header>
	)
}
