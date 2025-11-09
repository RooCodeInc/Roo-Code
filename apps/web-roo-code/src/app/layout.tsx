import React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { Inter } from "next/font/google"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { CookieConsentWrapper } from "@/components/CookieConsentWrapper"

import { Providers } from "@/components/providers"

import Shell from "./shell"

import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

const OG_TITLE = "Meet Roo Code"
const OG_DESCRIPTION = "The AI dev team that gets things done."

export const metadata: Metadata = {
	metadataBase: new URL(SEO.url),
	title: {
		template: "%s | Roo Code",
		default: SEO.title,
	},
	description: SEO.description,
	alternates: {
		canonical: SEO.url,
	},
	icons: {
		icon: [
			{ url: "/favicon.ico" },
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png" }],
		other: [
			{
				rel: "android-chrome-192x192",
				url: "/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				rel: "android-chrome-512x512",
				url: "/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	},
	openGraph: {
		title: SEO.title,
		description: SEO.description,
		url: SEO.url,
		siteName: SEO.name,
		images: [
			{
				url: ogImageUrl(OG_TITLE, OG_DESCRIPTION),
				width: 1200,
				height: 630,
				alt: OG_TITLE,
			},
		],
		locale: SEO.locale,
		type: "website",
	},
	twitter: {
		card: SEO.twitterCard,
		title: SEO.title,
		description: SEO.description,
		images: [ogImageUrl(OG_TITLE, OG_DESCRIPTION)],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-snippet": -1,
			"max-image-preview": "large",
			"max-video-preview": -1,
		},
	},
	keywords: [...SEO.keywords],
	applicationName: SEO.name,
	category: SEO.category,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link
					rel="stylesheet"
					type="text/css"
					href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css"
				/>
			</head>
			<body className={inter.className}>
				{/* Google Tag Manager Script */}
				<Script
					id="google-tag-manager"
					strategy="afterInteractive"
					dangerouslySetInnerHTML={{
						__html: `
							(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
							new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
							j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
							'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
							})(window,document,'script','dataLayer','GTM-M2JZHV8N');
						`,
					}}
				/>
				{/* Google Tag Manager (noscript) */}
				<noscript>
					<iframe
						src="https://www.googletagmanager.com/ns.html?id=GTM-M2JZHV8N"
						height="0"
						width="0"
						style={{ display: "none", visibility: "hidden" }}
					/>
				</noscript>
				{/* End Google Tag Manager (noscript) */}
				<div itemScope itemType="https://schema.org/WebSite">
					<link itemProp="url" href={SEO.url} />
					<meta itemProp="name" content={SEO.name} />
				</div>
				<Providers>
					<Shell>{children}</Shell>
					<CookieConsentWrapper />
				</Providers>
			</body>
		</html>
	)
}
