import React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { CookieConsent } from "@/components/CookieConsent"

import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
	title: "Roo Code Documentation",
	description: "Documentation for Roo Code - The AI coding assistant for VS Code",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={inter.className}>
				<div className="min-h-screen bg-background">{children}</div>
				<CookieConsent />
			</body>
		</html>
	)
}
