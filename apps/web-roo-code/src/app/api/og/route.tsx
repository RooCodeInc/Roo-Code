import { ImageResponse } from "@vercel/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

async function loadGoogleFont(font: string, text: string) {
	const url = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`
	const css = await (await fetch(url)).text()
	const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

	if (resource && resource[1]) {
		const response = await fetch(resource[1])
		if (response.status === 200) {
			return await response.arrayBuffer()
		}
	}

	throw new Error("failed to load font data")
}

export async function GET(request: NextRequest) {
	const requestUrl = new URL(request.url)
	const { searchParams } = requestUrl

	// Get title and description from query params
	const title = searchParams.get("title") || "Roo Code"
	const description = searchParams.get("description") || ""

	// Combine all text that will be displayed for font loading
	const displayText = title + description

	// Check if we should try to use the background image
	const useBackgroundImage = searchParams.get("bg") !== "false"

	// Dynamically get the base URL from the current request
	// This ensures it works correctly in development, preview, and production environments
	const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`
	const backgroundUrl = `${baseUrl}/og/base.png`

	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					position: "relative",
					// Use gradient background as default/fallback
					background: "linear-gradient(135deg, #1e3a5f 0%, #0f1922 50%, #1a2332 100%)",
				}}>
				{/* Optional Background Image - only render if explicitly requested */}
				{useBackgroundImage && (
					<div
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: "100%",
							display: "flex",
						}}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={backgroundUrl}
							alt=""
							width={1200}
							height={630}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
							}}
						/>
					</div>
				)}

				{/* Text Content */}
				<div
					style={{
						position: "absolute",
						display: "flex",
						flexDirection: "column",
						justifyContent: "flex-end",
						top: "220px",
						left: "80px",
						right: "80px",
						bottom: "80px",
					}}>
					{/* Main Title */}
					<h1
						style={{
							fontSize: 70,
							fontWeight: 700,
							fontFamily: "Inter, Helvetica Neue, Helvetica, sans-serif",
							color: "white",
							lineHeight: 1.2,
							margin: 0,
							maxHeight: "2.4em",
							overflow: "hidden",
						}}>
						{title}
					</h1>

					{/* Secondary Description */}
					{description && (
						<h2
							style={{
								fontSize: 70,
								fontWeight: 400,
								fontFamily: "Inter, Helvetica Neue, Helvetica, Arial, sans-serif",
								color: "rgba(255, 255, 255, 0.9)",
								lineHeight: 1.2,
								margin: 0,
								maxHeight: "2.4em",
								overflow: "hidden",
							}}>
							{description}
						</h2>
					)}
				</div>
			</div>
		),
		{
			width: 1200,
			height: 630,
			fonts: [
				{
					name: "Inter",
					data: await loadGoogleFont("Inter", displayText),
					style: "normal",
					weight: 400,
				},
				{
					name: "Inter",
					data: await loadGoogleFont("Inter:wght@700", displayText),
					style: "normal",
					weight: 700,
				},
			],
			// Cache for 7 days in production, 3 seconds in development
			headers: {
				"Cache-Control":
					process.env.NODE_ENV === "production"
						? "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400"
						: "public, max-age=3, s-maxage=3",
			},
		},
	)
}
