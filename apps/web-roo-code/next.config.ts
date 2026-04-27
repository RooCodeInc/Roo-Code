import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	turbopack: {
		root: path.join(__dirname, "../.."),
	},
	async redirects() {
		return [
			// Redirect www to non-www
			{
				source: "/:path*",
				has: [{ type: "host", value: "www.roocode.com" }],
				destination: "https://roocode.com/:path*",
				permanent: true,
			},
			// Redirect HTTP to HTTPS
			{
				source: "/:path*",
				has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
				destination: "https://roocode.com/:path*",
				permanent: true,
			},
			// Redirect cloud waitlist to Notion page (kept for extension compatibility)
			{
				source: "/cloud-waitlist",
				destination: "https://roo-code.notion.site/238fd1401b0a8087b858e1ad431507cf?pvs=105",
				permanent: false,
			},
			{
				source: "/extension",
				destination: "/",
				permanent: true,
			},
			{
				source: "/provider/pricing",
				destination: "/",
				permanent: true,
			},
			{
				source: "/pricing",
				destination: "/",
				permanent: true,
			},
			{
				source: "/provider",
				destination: "/",
				permanent: true,
			},
			{
				source: "/cloud",
				destination: "/",
				permanent: true,
			},
			{
				source: "/cloud/team",
				destination: "/",
				permanent: true,
			},
			{
				source: "/enterprise",
				destination: "/",
				permanent: true,
			},
			{
				source: "/slack",
				destination: "/",
				permanent: true,
			},
			{
				source: "/linear",
				destination: "/",
				permanent: true,
			},
			{
				source: "/reviewer",
				destination: "/",
				permanent: true,
			},
			{
				source: "/pr-fixer",
				destination: "/",
				permanent: true,
			},
			{
				source: "/github",
				destination: "/",
				permanent: true,
			},
		]
	},
}

export default nextConfig
