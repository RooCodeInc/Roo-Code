import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	turbopack: {
		root: path.join(__dirname, "../.."),
	},
	transpilePackages: ["@roo-code/types"],
}

export default nextConfig
