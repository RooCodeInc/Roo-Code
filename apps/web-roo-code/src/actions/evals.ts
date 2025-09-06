"use server"

import { getModelId, rooCodeSettingsSchema } from "@roo-code/types"
import { getRuns, getLanguageScores } from "@roo-code/evals"

export async function getEvalRuns() {
	const languageScores = await getLanguageScores()

	const runs = (await getRuns())
		.filter((run) => !!run.taskMetrics)
		.filter(({ settings }) => rooCodeSettingsSchema.safeParse(settings).success)
		.sort((a, b) => b.passed - a.passed)
		.map((run) => {
			const settings = rooCodeSettingsSchema.parse(run.settings)

			return {
				...run,
				label: run.description || run.model,
				score: Math.round((run.passed / (run.passed + run.failed)) * 100),
				languageScores: languageScores[run.id],
				taskMetrics: run.taskMetrics!,
				modelId: getModelId(settings),
			}
		})

	return runs
}
