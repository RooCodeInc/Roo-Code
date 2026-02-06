/**
 * Route provider for navigation between home and session views.
 */

import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper.js"
import type { Route } from "../types.js"

export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
	name: "Route",
	init: () => {
		const [store, setStore] = createStore<Route>({ type: "home" })

		return {
			get data() {
				return store
			},
			navigate(route: Route) {
				setStore(route)
			},
		}
	},
})

export type RouteContext = ReturnType<typeof useRoute>
