import { useState } from "react"

const RooHero = () => {
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.COSTRICT_BASE_URI || ""
	})

	return (
		<div className="flex flex-col items-center justify-center pb-0 forced-color-adjust-none">
			<div className="mx-auto">
				<img src={imagesBaseUri + "/logo.svg"} alt="Costrict logo" className="h-16" />
			</div>
		</div>
	)
}

export default RooHero
