/* eslint-disable @typescript-eslint/no-unused-vars */

import "react"

declare module "react" {
	interface HTMLAttributes<T> {
		inert?: boolean
	}
}

declare global {
	namespace React {
		interface HTMLAttributes<T> {
			inert?: boolean
		}
	}
}
