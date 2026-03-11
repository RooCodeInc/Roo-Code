import { Fraunces, IBM_Plex_Sans } from "next/font/google"

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" })
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" })

export default function EvalsLayout({ children }: { children: React.ReactNode }) {
	return <div className={`${body.variable} ${display.variable} [font-family:var(--font-body)]`}>{children}</div>
}
