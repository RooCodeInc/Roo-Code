import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	turbopack: {
		root: path.join(__dirname, "../.."),
	},
	async redirects() {
		return [
			{
				source: "/:path*",
				destination: "https://roomote.dev",
				permanent: true,
			},
		]
	},
}

export default nextConfig
