;(() => {
	var e = {}
	;(e.id = 492),
		(e.ids = [492]),
		(e.modules = {
			846: (e) => {
				"use strict"
				e.exports = require("next/dist/compiled/next-server/app-page.runtime.prod.js")
			},
			972: (e, o, t) => {
				Promise.resolve().then(t.bind(t, 3648))
			},
			2711: (e, o, t) => {
				"use strict"
				t.r(o), t.d(o, { default: () => d, metadata: () => a })
				var n = t(811)
				t(4446)
				var r = t(5129),
					s = t.n(r),
					i = t(5374)
				t(8773)
				let a = {
					title: "Roo Code Documentation",
					description: "Documentation for Roo Code - The AI coding assistant for VS Code",
				}
				function d({ children: e }) {
					return (0, n.jsx)("html", {
						lang: "en",
						suppressHydrationWarning: !0,
						children: (0, n.jsxs)("body", {
							className: s().className,
							children: [
								(0, n.jsx)("div", { className: "min-h-screen bg-background", children: e }),
								(0, n.jsx)(i.CookieConsent, {}),
							],
						}),
					})
				}
			},
			3033: (e) => {
				"use strict"
				e.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js")
			},
			3226: (e, o, t) => {
				Promise.resolve().then(t.t.bind(t, 502, 23)),
					Promise.resolve().then(t.t.bind(t, 5552, 23)),
					Promise.resolve().then(t.t.bind(t, 2052, 23)),
					Promise.resolve().then(t.t.bind(t, 807, 23)),
					Promise.resolve().then(t.t.bind(t, 2159, 23)),
					Promise.resolve().then(t.t.bind(t, 9335, 23)),
					Promise.resolve().then(t.t.bind(t, 2951, 23)),
					Promise.resolve().then(t.t.bind(t, 4417, 23))
			},
			3295: (e) => {
				"use strict"
				e.exports = require("next/dist/server/app-render/after-task-async-storage.external.js")
			},
			3394: (e, o, t) => {
				Promise.resolve().then(t.t.bind(t, 8360, 23)),
					Promise.resolve().then(t.t.bind(t, 3510, 23)),
					Promise.resolve().then(t.t.bind(t, 1430, 23)),
					Promise.resolve().then(t.t.bind(t, 7225, 23)),
					Promise.resolve().then(t.t.bind(t, 989, 23)),
					Promise.resolve().then(t.t.bind(t, 7445, 23)),
					Promise.resolve().then(t.t.bind(t, 6557, 23)),
					Promise.resolve().then(t.t.bind(t, 5895, 23))
			},
			3648: (e, o, t) => {
				"use strict"
				t.d(o, { CookieConsent: () => i })
				var n = t(4508),
					r = t(3688),
					s = t(3641)
				function i({
					text: e = "Like pretty much everyone else, we use cookies. We assume you're OK with it, but you can opt out if you want.",
					buttonText: o = "Accept",
					onAccept: t,
					onDecline: i,
					enableDeclineButton: a = !0,
					declineButtonText: d = "Decline",
					className: l = "",
					cookieName: c = "roo-code-cookie-consent",
					debug: p = !1,
				}) {
					let u = {
							background: "var(--cookie-consent-button-bg, #0a0a0a)",
							color: "var(--cookie-consent-button-text, #fafafa)",
							border: "none",
							borderRadius: "6px",
							padding: "8px 16px",
							fontSize: "14px",
							fontWeight: "500",
							cursor: "pointer",
							transition: "all 0.2s ease",
							fontFamily: "inherit",
						},
						b = {
							...u,
							background: "transparent",
							color: "var(--cookie-consent-text, #0a0a0a)",
							border: "1px solid var(--cookie-consent-border, #e5e5e5)",
						},
						[m, f] = n.useState(!1),
						h = {
							background: "var(--cookie-consent-bg, rgba(255, 255, 255, 0.95))",
							color: "var(--cookie-consent-text, #0a0a0a)",
							backdropFilter: "blur(12px)",
							borderTop: "1px solid var(--cookie-consent-border, #e5e5e5)",
							padding: "1rem 2rem",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							flexWrap: "wrap",
							gap: "1rem",
							fontSize: "14px",
							fontFamily: "Inter, system-ui, -apple-system, sans-serif",
							zIndex: 999,
							background: m ? "rgba(0, 0, 0, 0.95)" : "rgba(255, 255, 255, 0.95)",
							color: m ? "#fafafa" : "#0a0a0a",
							borderTop: `1px solid ${m ? "#262626" : "#e5e5e5"}`,
						},
						v = { ...u, background: m ? "#fafafa" : "#0a0a0a", color: m ? "#0a0a0a" : "#fafafa" },
						x = { ...b, color: m ? "#fafafa" : "#0a0a0a", border: `1px solid ${m ? "#262626" : "#e5e5e5"}` }
					return (0, s.jsx)(r.Ay, {
						location: "bottom",
						buttonText: o,
						declineButtonText: d,
						cookieName: c,
						style: h,
						buttonStyle: v,
						declineButtonStyle: x,
						contentStyle: { flex: 1, margin: 0, marginRight: "1rem" },
						expires: 365,
						enableDeclineButton: a,
						onAccept: t,
						onDecline: i,
						debug: p,
						containerClasses: `CookieConsent ${l}`,
						buttonClasses: "cookie-consent-accept",
						declineButtonClasses: "cookie-consent-decline",
						contentClasses: "cookie-consent-content",
						overlayClasses: "cookie-consent-overlay",
						buttonWrapperClasses: "cookie-consent-buttons",
						children: e,
					})
				}
			},
			3873: (e) => {
				"use strict"
				e.exports = require("path")
			},
			4540: (e, o, t) => {
				Promise.resolve().then(t.bind(t, 5374))
			},
			5374: (e, o, t) => {
				"use strict"
				t.d(o, { CookieConsent: () => r })
				var n = t(7741)
				let r = (0, n.registerClientReference)(
					function () {
						throw Error(
							"Attempted to call CookieConsent() from the server but CookieConsent is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.",
						)
					},
					"/data/repos/Roo-Code/packages/cookie-consent/dist/index.js",
					"CookieConsent",
				)
				;(0, n.registerClientReference)(
					function () {
						throw Error(
							"Attempted to call the default export of \"/data/repos/Roo-Code/packages/cookie-consent/dist/index.js\" from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.",
						)
					},
					"/data/repos/Roo-Code/packages/cookie-consent/dist/index.js",
					"default",
				)
			},
			8773: () => {},
			9121: (e) => {
				"use strict"
				e.exports = require("next/dist/server/app-render/action-async-storage.external.js")
			},
			9294: (e) => {
				"use strict"
				e.exports = require("next/dist/server/app-render/work-async-storage.external.js")
			},
			9595: (e, o, t) => {
				"use strict"
				t.r(o),
					t.d(o, {
						GlobalError: () => i.a,
						__next_app__: () => p,
						pages: () => c,
						routeModule: () => u,
						tree: () => l,
					})
				var n = t(8253),
					r = t(1418),
					s = t(2052),
					i = t.n(s),
					a = t(5779),
					d = {}
				for (let e in a)
					0 > ["default", "tree", "pages", "GlobalError", "__next_app__", "routeModule"].indexOf(e) &&
						(d[e] = () => a[e])
				t.d(o, d)
				let l = {
						children: [
							"",
							{
								children: [
									"/_not-found",
									{
										children: [
											"__PAGE__",
											{},
											{
												page: [
													() => Promise.resolve().then(t.t.bind(t, 4544, 23)),
													"next/dist/client/components/not-found-error",
												],
											},
										],
									},
									{},
								],
							},
							{
								layout: [
									() => Promise.resolve().then(t.bind(t, 2711)),
									"/data/repos/Roo-Code/apps/web-docs/src/app/layout.tsx",
								],
								"not-found": [
									() => Promise.resolve().then(t.t.bind(t, 4544, 23)),
									"next/dist/client/components/not-found-error",
								],
								forbidden: [
									() => Promise.resolve().then(t.t.bind(t, 441, 23)),
									"next/dist/client/components/forbidden-error",
								],
								unauthorized: [
									() => Promise.resolve().then(t.t.bind(t, 3670, 23)),
									"next/dist/client/components/unauthorized-error",
								],
							},
						],
					}.children,
					c = [],
					p = { require: t, loadChunk: () => Promise.resolve() },
					u = new n.AppPageRouteModule({
						definition: {
							kind: r.RouteKind.APP_PAGE,
							page: "/_not-found/page",
							pathname: "/_not-found",
							bundlePath: "",
							filename: "",
							appPaths: [],
						},
						userland: { loaderTree: l },
					})
			},
		})
	var o = require("../../webpack-runtime.js")
	o.C(e)
	var t = (e) => o((o.s = e)),
		n = o.X(0, [284], () => t(9595))
	module.exports = n
})()
