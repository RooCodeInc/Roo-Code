import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import * as fs from "node:fs"
import * as path from "node:path"
import archiver from "archiver"

import { findRun, getTasks } from "@roo-code/evals"

export const dynamic = "force-dynamic"

const LOG_BASE_PATH = "/tmp/evals/runs"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params

	try {
		const runId = Number(id)

		if (isNaN(runId)) {
			return NextResponse.json({ error: "Invalid run ID" }, { status: 400 })
		}

		// Verify the run exists
		await findRun(runId)

		// Get all tasks for this run
		const tasks = await getTasks(runId)

		// Filter for failed tasks only
		const failedTasks = tasks.filter((task) => task.passed === false)

		if (failedTasks.length === 0) {
			return NextResponse.json({ error: "No failed tasks to export" }, { status: 400 })
		}

		// Create a zip archive
		const archive = archiver("zip", { zlib: { level: 9 } })

		// Collect chunks to build the response
		const chunks: Buffer[] = []

		archive.on("data", (chunk: Buffer) => {
			chunks.push(chunk)
		})

		// Add each failed task's log file to the archive
		const logDir = path.join(LOG_BASE_PATH, String(runId))

		for (const task of failedTasks) {
			const logFileName = `${task.language}-${task.exercise}.log`
			const logFilePath = path.join(logDir, logFileName)

			if (fs.existsSync(logFilePath)) {
				archive.file(logFilePath, { name: logFileName })
			}
		}

		// Finalize the archive
		await archive.finalize()

		// Wait for all data to be collected
		await new Promise<void>((resolve) => {
			archive.on("end", resolve)
		})

		// Combine all chunks into a single buffer
		const zipBuffer = Buffer.concat(chunks)

		// Return the zip file
		return new NextResponse(zipBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="run-${runId}-failed-logs.zip"`,
				"Content-Length": String(zipBuffer.length),
			},
		})
	} catch (error) {
		console.error("Error exporting failed logs:", error)

		if (error instanceof Error && error.name === "RecordNotFoundError") {
			return NextResponse.json({ error: "Run not found" }, { status: 404 })
		}

		return NextResponse.json({ error: "Failed to export logs" }, { status: 500 })
	}
}
