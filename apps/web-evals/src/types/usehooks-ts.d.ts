declare module "usehooks-ts" {
	import type { Dispatch, SetStateAction } from "react"

	export type UseLocalStorageOptions<T> = {
		serializer?: (value: T) => string
		deserializer?: (value: string) => T
		initializeWithValue?: boolean
	}

	export function useLocalStorage<T>(
		key: string,
		initialValue: T | (() => T),
		options?: UseLocalStorageOptions<T>,
	): [T, Dispatch<SetStateAction<T>>, () => void]
}
