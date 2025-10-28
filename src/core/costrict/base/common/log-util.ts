/**
 * Copyright (c) 2024 - Sangfor LTD.
 *
 * All rights reserved. Code licensed under the MIT license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */
/**
 * @description This file contains the Logger class, which provides methods for logging messages with timestamps.
 * @version 1.0.0
 * @date 2024-07-22
 * @author Wang Zheng
 *
 * @example
 * Logger.log('This is a log message');
 * Logger.error('This is an error message');
 */

export class Logger {
	private static formatMessage(): string {
		const timestamp = new Date().toLocaleString()
		return `[CoStrict][${timestamp}] `
	}

	static log(...optionalParams: any[]) {
		console.log(this.formatMessage(), ...optionalParams)
	}

	static info(...optionalParams: any[]) {
		console.info(this.formatMessage(), ...optionalParams)
	}

	static warn(...optionalParams: any[]) {
		console.warn(this.formatMessage(), ...optionalParams)
	}

	static error(...optionalParams: any[]) {
		console.error(this.formatMessage(), ...optionalParams)
	}

	static debug(...optionalParams: any[]) {
		console.debug(this.formatMessage(), ...optionalParams)
	}
}
