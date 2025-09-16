import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@roo-code/cookie-consent"],
}

export default nextConfig
