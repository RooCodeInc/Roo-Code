import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	turbopack: {
		root: path.join(__dirname, "../.."),
	},
	webpack: (config) => {
		// Enable .js -> .ts/.tsx resolution for workspace packages using NodeNext
		// module resolution (e.g. @roo-code/types, @roo-code/ipc, @roo-code/cloud)
		config.resolve.extensionAlias = {
			".js": [".ts", ".tsx", ".js", ".jsx"],
			".mjs": [".mts", ".mjs"],
			".cjs": [".cts", ".cjs"],
		}
		return config
	},
}

export default nextConfig
