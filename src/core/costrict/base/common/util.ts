/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
import * as fs from "fs"
import * as os from "os"

import { createHash } from "crypto"
import { Logger } from "./log-util"

/**
 * Get the local IP address
 */
export function getLocalIP() {
	const interfaces = os.networkInterfaces()
	let ipAddress = ""

	for (const interfaceName in interfaces) {
		if (!interfaces[interfaceName]) {
			continue
		}
		for (const iface of interfaces[interfaceName]) {
			// Filter out loopback and unassigned addresses
			if (iface.family === "IPv4" && !iface.internal) {
				ipAddress = iface.address
				break
			}
		}
		if (ipAddress) {
			break
		} // Exit after finding the first valid IP address
	}

	return ipAddress || "No IP found"
}

/**
 * Date format
 */
export enum DateFormat {
	LITE = 1, // Example: 2023-07-04 15:30:15
	DETAIL = 2, // Example: 2023-07-04 15:30:15.274
	ISO = 3, // Example: 2025-01-14T08:00:00.000Z
}
/**
 * Format time information in three formats (see DateFormat)
 */
export function formatTime(dt: Date, format: DateFormat = DateFormat.ISO): string {
	if (!dt) {
		return ""
	}
	if (typeof dt === "string") {
		dt = new Date(dt)
	}
	if (format === DateFormat.ISO) {
		const date = new Date(dt) // Create Date object
		return date.toISOString() // Convert to ISO 8601 format
	}
	const year = dt.getFullYear()
	const month = String(dt.getMonth() + 1).padStart(2, "0")
	const day = String(dt.getDate()).padStart(2, "0")
	const hour = String(dt.getHours()).padStart(2, "0")
	const minute = String(dt.getMinutes()).padStart(2, "0")
	const second = String(dt.getSeconds()).padStart(2, "0")
	const millisecond = String(dt.getMilliseconds()).padStart(3, "0")
	if (format === DateFormat.LITE) {
		return `${year}-${month}-${day} ${hour}:${minute}:${second}`
	} else {
		return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`
	}
}

/**
 * Format time difference, e.g., 1d9h3m3s
 * param differenceInMilliseconds: Time difference (milliseconds)
 */
export function formatTimeDifference(differenceInMilliseconds: number): string {
	// Convert milliseconds to seconds
	const totalSeconds = Math.floor(differenceInMilliseconds / 1000)

	// Calculate days, hours, minutes, and seconds
	const days = Math.floor(totalSeconds / (24 * 3600))
	const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	// Build human-readable string
	let result = ""
	if (days > 0) {
		result += `${days}d`
	}
	if (hours > 0) {
		result += `${hours}h`
	}
	if (minutes > 0) {
		result += `${minutes}m`
	}
	if (seconds > 0) {
		result += `${seconds}s`
	}

	// Return '0s' if no time difference
	return result.trim() || "0s"
}

/**
 * Return a random string of specified length
 */
export function getRandomId(len = 12) {
	const pattern = "x".repeat(len)
	return pattern.replace(/[x]/g, function (c) {
		const r = (Math.random() * 16) | 0,
			v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * Compute the hash of a string
 */
export function computeHash(content: string): string {
	return createHash("sha256").update(content).digest("hex")
}

/**
 * Copy file content: copy the content of file source to file target
 */
export function copyFile(source: string, target: string) {
	try {
		const fileData = fs.readFileSync(source)
		fs.writeFileSync(target, fileData)
	} catch (error) {
		Logger.log("File copied fail!", source, target)
	}
}

/**
 * Debounce function
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function debounce(fn: Function, delay = 500) {
	let timer: string | number | NodeJS.Timeout | null | undefined
	return function (this: any, ...args: any[]) {
		if (timer) {
			clearTimeout(timer)
		}
		timer = setTimeout(() => {
			fn.apply(this, args)
			timer = null
		}, delay)
	}
}

/**
 * Throttle function
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function throttle(fn: Function, delay = 300) {
	let lastCall = 0
	return function (this: any, ...args: any[]) {
		const now = new Date().getTime()
		if (now - lastCall >= delay) {
			lastCall = now
			fn.apply(this, args)
		}
	}
}

/**
 * Mask phone number
 */
export function maskPhoneNumber(phone: string): string {
	// Replace the middle four digits with asterisks using a regular expression
	return phone.replace(/(\+86)(\d{3})\d{4}(\d{4})/, "$2****$3")
}
