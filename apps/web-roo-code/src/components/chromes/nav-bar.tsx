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
import { Brain, ChevronDown, Cloud, Puzzle, Slack, X } from "lucide-react"

function LinearIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
			<path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C19.3336 94.3417 5.63867 80.5968 1.22541 61.5228Z" />
			<path d="M.00189135 46.8891c-.01764375.2833.00143108.5765.05765765.8662.42870855 2.2073.93958605 4.3773 1.52844055 6.5063.3362 1.2154 1.8704 1.5324 2.6694.5765l42.7602-51.17121c.8082-.96676.3586-2.4829-.8213-2.74103-2.1092-.46189-4.2555-.84478-6.4348-1.14529-.2881-.03979-.5805-.05843-.8712-.05583-1.1371.01015-2.2285.57047-2.9144 1.46387L.543385 45.1098c-.35605.4555-.55221 1.0108-.541494 1.5765v.2028Z" />
			<path d="M7.47413 78.5763C5.95136 74.4783 4.89508 70.1874 4.34574 65.7571c-.11115-.8958.68135-1.6505 1.57048-1.4761l69.38238 13.6164c.8691.1706 1.2051 1.2165.583 1.8154-7.0838 6.8254-15.6512 12.091-25.2015 15.2757-.5174.1725-1.0869.131-1.5692-.1141L7.47413 78.5763Z" />
			<path d="M10.0667 87.1726c1.6311 1.5358 3.3347 2.9962 5.1042 4.3749.7181.5592 1.7288.5197 2.3995-.0939l36.4528-33.3725c.6929-.6343.5923-1.7418-.2146-2.3164-3.9746-2.8318-8.1879-5.3425-12.6031-7.4955-.6973-.34-1.5254-.2662-2.1506.1918L10.1041 72.2827c-.6507.4768-.9474 1.2653-.7844 2.0279.6166 2.8848 1.3865 5.7086 2.3044 8.4624.2101.6303.6234 1.1744 1.1681 1.5379l-2.7255 2.8617Z" />
			<path d="M30.9098 21.0292c-3.1675 5.2947-5.7485 10.9641-7.6686 16.9177-.2455.7611.0375 1.5912.6928 2.0326l26.7913 18.0587c.7022.4737 1.6445.3348 2.186-.3225l32.2427-39.1412c.549-.6667.353-1.6701-.4187-2.1215a99.30965 99.30965 0 0 0-16.6623-8.02636c-.6649-.2588-1.4207-.14022-1.9703.309L30.9098 21.0292Z" />
			<path d="M52.8822 97.4268c4.7332-.7003 9.2986-1.9013 13.6391-3.5563.6692-.2552 1.1306-.8583 1.1994-1.5696L72.341 47.4856c.0692-.7162-.2759-1.4034-.8986-1.7878l-34.8323-21.5036c-.73-.4504-1.6842-.2715-2.1975.4123L2.93488 64.0894c-.5248.6986-.35685 1.6987.36563 2.176 11.7672 7.7756 25.6851 12.5163 40.60049 13.3819.5851.034 1.1478-.2018 1.5036-.6305L52.8822 97.4268Z" />
		</svg>
	)
}

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
				<div className="flex items-center">
					<Link href="/" className="flex items-center">
						<Image src={logoSrc} alt="Roo Code Logo" width={130} height={24} className="h-[24px] w-auto" />
					</Link>
				</div>

				{/* Desktop Navigation */}
				<nav className="grow ml-6 hidden text-sm md:flex md:items-center">
					{/* Product Dropdown */}
					<div className="relative group">
						<button className="flex items-center px-4 py-6 gap-1 transition-transform duration-200 hover:scale-105 hover:text-foreground">
							Product
							<ChevronDown className="size-3 ml-1 mt-0.5" />
						</button>
						<div className="absolute left-0 top-12 mt-2 w-[260px] rounded-md border border-border bg-background py-1 shadow-lg opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200">
							<Link
								href="/extension"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground">
								<Puzzle className="size-3 inline mr-2 -mt-0.5" />
								Roo Code VS Code Extension
							</Link>
							<Link
								href="/cloud"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground">
								<Cloud className="size-3 inline mr-2 -mt-0.5" />
								Roo Code Cloud
							</Link>
							<Link
								href="/slack"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground">
								<Slack className="size-3 inline mr-2 -mt-0.5" />
								Roo Code for Slack
							</Link>
							<Link
								href="/linear"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground">
								<LinearIcon className="size-3 inline mr-2 -mt-0.5" />
								Roo Code for Linear
							</Link>
							<Link
								href="/provider"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground">
								<Brain className="size-3 inline mr-2 -mt-0.5" />
								Roo Code Router
							</Link>
						</div>
					</div>
					{/* Resources Dropdown */}
					<div className="relative group">
						<button className="flex items-center px-4 py-6 gap-1 transition-transform duration-200 hover:scale-105 hover:text-foreground">
							Resources
							<ChevronDown className="size-3 ml-1 mt-0.5" />
						</button>
						{/* Dropdown Menu */}
						<div className="absolute left-0 top-12 mt-2 w-40 rounded-md border border-border bg-background py-1 shadow-lg opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200">
							<Link
								href="/evals"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground">
								Evals
							</Link>
							<a
								href={EXTERNAL_LINKS.DISCORD}
								target="_blank"
								rel="noopener noreferrer"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground">
								Discord
							</a>
							<a
								href={EXTERNAL_LINKS.SECURITY}
								target="_blank"
								rel="noopener noreferrer"
								className="block px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground"
								onClick={() => setIsMenuOpen(false)}>
								Trust Center
							</a>
						</div>
					</div>
					<a
						href={EXTERNAL_LINKS.DOCUMENTATION}
						target="_blank"
						className="px-4 py-6 transition-transform duration-200 hover:scale-105 hover:text-foreground">
						Docs
					</a>
					<Link
						href="/pricing"
						className="px-4 py-6 transition-transform duration-200 hover:scale-105 hover:text-foreground">
						Pricing
					</Link>
				</nav>

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
					<a
						href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
						target="_blank"
						rel="noopener noreferrer"
						className="hidden items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-all duration-200 hover:shadow-lg hover:scale-105 md:flex">
						Sign Up
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
							className="block w-full p-5 text-left text-foreground active:opacity-50"
							onClick={() => setIsMenuOpen(false)}>
							Docs
						</a>
						<Link
							href="/pricing"
							className="block w-full p-5 text-left text-foreground active:opacity-50"
							onClick={() => setIsMenuOpen(false)}>
							Pricing
						</Link>

						{/* Product Section */}
						<div className="mt-4 w-full">
							<div className="px-5 pb-2 pt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								Product
							</div>
							<Link
								href="/extension"
								className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
								onClick={() => setIsMenuOpen(false)}>
								Roo Code VS Code Extension
							</Link>
							<Link
								href="/cloud"
								className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
								onClick={() => setIsMenuOpen(false)}>
								Roo Code Cloud
							</Link>
							<Link
								href="/slack"
								className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
								onClick={() => setIsMenuOpen(false)}>
								Roo Code for Slack
							</Link>
							<Link
								href="/linear"
								className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
								onClick={() => setIsMenuOpen(false)}>
								Roo Code for Linear
							</Link>
							<Link
								href="/provider"
								className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
								onClick={() => setIsMenuOpen(false)}>
								Roo Code Router
							</Link>
						</div>

						{/* Resources Section */}
						<div className="mt-4 w-full">
							<div className="px-5 pb-2 pt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								Resources
							</div>
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
							<a
								href={EXTERNAL_LINKS.SECURITY}
								target="_blank"
								rel="noopener noreferrer"
								className="block w-full p-5 py-3 text-left text-foreground active:opacity-50"
								onClick={() => setIsMenuOpen(false)}>
								Security Center
							</a>
						</div>
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
								href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-2 rounded-full border border-primary bg-foreground p-4 w-full text-base font-semibold text-background"
								onClick={() => setIsMenuOpen(false)}>
								Sign up
							</a>
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
