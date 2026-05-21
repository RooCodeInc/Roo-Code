import { permanentRedirect } from "next/navigation"

import { buildQueryString, type RedirectSearchParams } from "./_redirect-utils"

type PageProps = {
	searchParams?: Promise<RedirectSearchParams>
}

export default async function WorkersV2Page({ searchParams }: PageProps) {
	const sp = (await searchParams) ?? {}
	permanentRedirect(`/evals/recommendations${buildQueryString(sp)}`)
}
