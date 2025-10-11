/**
 * 格式化时间戳为 HH:MM 格式
 * @param timestamp Unix 时间戳（毫秒）
 * @returns 格式化后的时间字符串，例如 "08:37"
 */
export function formatMessageTime(timestamp: number): string {
	const date = new Date(timestamp)
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")
	return `${hours}:${minutes}`
}
