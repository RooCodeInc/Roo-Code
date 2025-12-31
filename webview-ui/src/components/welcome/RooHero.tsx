import { useState } from "react"

const RooHero = () => {
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	return (
		<div className="mb-4 relative forced-color-adjust-none group flex flex-col items-center w-full pt-4">
			<div
				style={{
					backgroundColor: "var(--vscode-foreground)",
					WebkitMaskImage: `url('${imagesBaseUri}/datacoves-logo.svg')`,
					WebkitMaskRepeat: "no-repeat",
					WebkitMaskSize: "contain",
					maskImage: `url('${imagesBaseUri}/datacoves-logo.svg')`,
					maskRepeat: "no-repeat",
					maskSize: "contain",
				}}
				className="z-5 mx-auto group-hover:animate-bounce translate-y-0 transition-transform duration-500">
				<img src={imagesBaseUri + "/datacoves-logo.svg"} alt="Datacoves logo" className="h-12 opacity-0" />
			</div>
		</div>
	)
}

export default RooHero
