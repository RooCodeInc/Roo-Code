import { z } from "zod"

export const checkpointSchema = z.object({
	from: z.string(),
	to: z.string(),
	isInitial: z.boolean().optional(),
})

export type Checkpoint = z.infer<typeof checkpointSchema>
