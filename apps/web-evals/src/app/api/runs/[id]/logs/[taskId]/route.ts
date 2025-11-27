import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import * as fs from "node:fs"
import * as path from "node:path"

import { findTask, findRun } from "@roo-code/evals"

export const dynamic = "force-dynamic"

const LOG_BASE_PATH = "/tmp/evals/runs"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
	const { id, taskId } = await params

	try {
		const runId = Number(id)
		const taskIdNum = Number(taskId)

		if (isNaN(runId) || isNaN(taskIdNum)) {
			return NextResponse.json({ error: "Invalid run ID or task ID" }, { status: 400 })
		}

		// Verify the run exists
		await findRun(runId)

		// Get the task to find its language and exercise
		const task = await findTask(taskIdNum)

		// Verify the task belongs to this run
		if (task.runId !== runId) {
			return NextResponse.json({ error: "Task does not belong to this run" }, { status: 404 })
		}

		// Construct the log file path
		const logFileName = `${task.language}-${task.exercise}.log`
		const logFilePath = path.join(LOG_BASE_PATH, String(runId), logFileName)

		// Check if the log file exists
		if (!fs.existsSync(logFilePath)) {
			return NextResponse.json({ error: "Log file not found", logContent: null }, { status: 200 })
		}

		// Read the log file
		const logContent = fs.readFileSync(logFilePath, "utf-8")

		return NextResponse.json({ logContent })
	} catch (error) {
		console.error("Error reading task log:", error)

		if (error instanceof Error && error.name === "RecordNotFoundError") {
			return NextResponse.json({ error: "Task or run not found" }, { status: 404 })
		}

		return NextResponse.json({ error: "Failed to read log file" }, { status: 500 })
	}
}
