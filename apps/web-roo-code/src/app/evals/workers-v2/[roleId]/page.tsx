import { permanentRedirect } from "next/navigation"

import { buildQueryString, type RedirectSearchParams } from "../_redirect-utils"

type PageProps = {
	params: Promise<{ roleId: string }>
	searchParams?: Promise<RedirectSearchParams>
}

export default async function WorkersV2RolePage({ params, searchParams }: PageProps) {
	const { roleId } = await params
	const sp = (await searchParams) ?? {}
	permanentRedirect(`/evals/workers/${roleId}${buildQueryString(sp)}`)
}
