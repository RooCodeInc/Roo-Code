import workerpool from "workerpool"

import type { NeutralContentBlock } from "../core/task-persistence"

import { tiktoken } from "../utils/tiktoken"

import { type CountTokensResult } from "./types"

async function countTokens(content: NeutralContentBlock[]): Promise<CountTokensResult> {
	try {
		const count = await tiktoken(content)
		return { success: true, count }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		}
	}
}

workerpool.worker({ countTokens })
