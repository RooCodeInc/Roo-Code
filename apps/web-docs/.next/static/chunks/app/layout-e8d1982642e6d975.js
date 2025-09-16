;(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
	[177],
	{
		2097: () => {},
		3310: (e, t, n) => {
			var o, i
			!(function (r) {
				var s
				void 0 !== (i = "function" == typeof (o = r) ? o.call(t, n, t, e) : o) && (e.exports = i),
					(e.exports = r())
			})(function () {
				function e() {
					for (var e = 0, t = {}; e < arguments.length; e++) {
						var n = arguments[e]
						for (var o in n) t[o] = n[o]
					}
					return t
				}
				function t(e) {
					return e.replace(/(%[0-9A-Z]{2})+/g, decodeURIComponent)
				}
				return (function n(o) {
					function i() {}
					function r(t, n, r) {
						if ("undefined" != typeof document) {
							"number" == typeof (r = e({ path: "/" }, i.defaults, r)).expires &&
								(r.expires = new Date(new Date() * 1 + 864e5 * r.expires)),
								(r.expires = r.expires ? r.expires.toUTCString() : "")
							try {
								var s = JSON.stringify(n)
								;/^[\{\[]/.test(s) && (n = s)
							} catch (e) {}
							;(n = o.write
								? o.write(n, t)
								: encodeURIComponent(String(n)).replace(
										/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g,
										decodeURIComponent,
									)),
								(t = encodeURIComponent(String(t))
									.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent)
									.replace(/[\(\)]/g, escape))
							var c = ""
							for (var a in r) r[a] && ((c += "; " + a), !0 !== r[a] && (c += "=" + r[a].split(";")[0]))
							return (document.cookie = t + "=" + n + c)
						}
					}
					function s(e, n) {
						if ("undefined" != typeof document) {
							for (
								var i = {}, r = document.cookie ? document.cookie.split("; ") : [], s = 0;
								s < r.length;
								s++
							) {
								var c = r[s].split("="),
									a = c.slice(1).join("=")
								n || '"' !== a.charAt(0) || (a = a.slice(1, -1))
								try {
									var l = t(c[0])
									if (((a = (o.read || o)(a, l) || t(a)), n))
										try {
											a = JSON.parse(a)
										} catch (e) {}
									if (((i[l] = a), e === l)) break
								} catch (e) {}
							}
							return e ? i[e] : i
						}
					}
					return (
						(i.set = r),
						(i.get = function (e) {
							return s(e, !1)
						}),
						(i.getJSON = function (e) {
							return s(e, !0)
						}),
						(i.remove = function (t, n) {
							r(t, "", e(n, { expires: -1 }))
						}),
						(i.defaults = {}),
						(i.withConverter = n),
						i
					)
				})(function () {})
			})
		},
		4420: (e, t, n) => {
			Promise.resolve().then(n.t.bind(n, 5904, 23)),
				Promise.resolve().then(n.t.bind(n, 2097, 23)),
				Promise.resolve().then(n.bind(n, 7535))
		},
		5904: (e) => {
			e.exports = {
				style: { fontFamily: "'Inter', 'Inter Fallback'", fontStyle: "normal" },
				className: "__className_f367f3",
			}
		},
		7535: (e, t, n) => {
			"use strict"
			n.d(t, { CookieConsent: () => k })
			var o,
				i = n(4545),
				r = n(3310),
				s = n.n(r),
				c = function (e) {
					var t = e.condition,
						n = e.wrapper,
						o = e.children
					return t ? n(o) : o
				}
			function a() {
				return (a = Object.assign
					? Object.assign.bind()
					: function (e) {
							for (var t = 1; t < arguments.length; t++) {
								var n = arguments[t]
								for (var o in n) Object.prototype.hasOwnProperty.call(n, o) && (e[o] = n[o])
							}
							return e
						}).apply(this, arguments)
			}
			function l(e, t) {
				return (l = Object.setPrototypeOf
					? Object.setPrototypeOf.bind()
					: function (e, t) {
							return (e.__proto__ = t), e
						})(e, t)
			}
			var u = { TOP: "top", BOTTOM: "bottom" }
			!(function (e) {
				;(e.STRICT = "strict"), (e.LAX = "lax"), (e.NONE = "none")
			})(o || (o = {}))
			var p = { HIDDEN: "hidden", BY_COOKIE_VALUE: "byCookieValue" },
				d = "CookieConsent",
				b = ["children"],
				f = {
					disableStyles: !1,
					hideOnAccept: !0,
					hideOnDecline: !0,
					location: u.BOTTOM,
					visible: p.BY_COOKIE_VALUE,
					onAccept: function (e) {},
					onDecline: function () {},
					cookieName: d,
					cookieValue: "true",
					declineCookieValue: "false",
					setDeclineCookie: !0,
					buttonText: "I understand",
					declineButtonText: "I decline",
					debug: !1,
					expires: 365,
					containerClasses: "CookieConsent",
					contentClasses: "",
					buttonClasses: "",
					buttonWrapperClasses: "",
					declineButtonClasses: "",
					buttonId: "rcc-confirm-button",
					declineButtonId: "rcc-decline-button",
					extraCookieOptions: {},
					disableButtonStyles: !1,
					enableDeclineButton: !1,
					flipButtons: !1,
					sameSite: o.LAX,
					ButtonComponent: function (e) {
						var t = e.children,
							n = (function (e, t) {
								if (null == e) return {}
								var n,
									o,
									i = {},
									r = Object.keys(e)
								for (o = 0; o < r.length; o++) (n = r[o]), t.indexOf(n) >= 0 || (i[n] = e[n])
								return i
							})(e, b)
						return i.createElement("button", Object.assign({}, n), t)
					},
					overlay: !1,
					overlayClasses: "",
					onOverlayClick: function () {},
					acceptOnOverlayClick: !1,
					ariaAcceptLabel: "Accept cookies",
					ariaDeclineLabel: "Decline cookies",
					acceptOnScroll: !1,
					acceptOnScrollPercentage: 25,
					customContentAttributes: {},
					customContainerAttributes: {},
					customButtonProps: {},
					customDeclineButtonProps: {},
					customButtonWrapperAttributes: {},
					style: {},
					buttonStyle: {},
					declineButtonStyle: {},
					contentStyle: {},
					overlayStyle: {},
				},
				m = {
					visible: !1,
					style: {
						alignItems: "baseline",
						background: "#353535",
						color: "white",
						display: "flex",
						flexWrap: "wrap",
						justifyContent: "space-between",
						left: "0",
						position: "fixed",
						width: "100%",
						zIndex: "999",
					},
					buttonStyle: {
						background: "#ffd42d",
						border: "0",
						borderRadius: "0px",
						boxShadow: "none",
						color: "black",
						cursor: "pointer",
						flex: "0 0 auto",
						padding: "5px 10px",
						margin: "15px",
					},
					declineButtonStyle: {
						background: "#c12a2a",
						border: "0",
						borderRadius: "0px",
						boxShadow: "none",
						color: "#e5e5e5",
						cursor: "pointer",
						flex: "0 0 auto",
						padding: "5px 10px",
						margin: "15px",
					},
					contentStyle: { flex: "1 0 300px", margin: "15px" },
					overlayStyle: {
						position: "fixed",
						left: 0,
						top: 0,
						width: "100%",
						height: "100%",
						zIndex: "999",
						backgroundColor: "rgba(0,0,0,0.3)",
					},
				},
				v = function (e) {
					void 0 === e && (e = d)
					var t = s().get(e)
					return void 0 === t ? s().get(y(e)) : t
				},
				y = function (e) {
					return e + "-legacy"
				},
				h = (function (e) {
					function t() {
						var t
						return (
							(t = e.apply(this, arguments) || this),
							(t.state = m),
							(t.handleScroll = function () {
								var e = a({}, f, t.props).acceptOnScrollPercentage,
									n = document.documentElement,
									o = document.body,
									i = "scrollTop",
									r = "scrollHeight"
								;((n[i] || o[i]) / ((n[r] || o[r]) - n.clientHeight)) * 100 > e && t.accept(!0)
							}),
							(t.removeScrollListener = function () {
								t.props.acceptOnScroll && window.removeEventListener("scroll", t.handleScroll)
							}),
							t
						)
					}
					;(t.prototype = Object.create(e.prototype)), (t.prototype.constructor = t), l(t, e)
					var n = t.prototype
					return (
						(n.componentDidMount = function () {
							var e = this.props.debug
							;(void 0 === this.getCookieValue() || e) &&
								(this.setState({ visible: !0 }),
								this.props.acceptOnScroll &&
									window.addEventListener("scroll", this.handleScroll, { passive: !0 }))
						}),
						(n.componentWillUnmount = function () {
							this.removeScrollListener()
						}),
						(n.accept = function (e) {
							void 0 === e && (e = !1)
							var t,
								n = a({}, f, this.props),
								o = n.cookieName,
								i = n.cookieValue,
								r = n.hideOnAccept,
								s = n.onAccept
							this.setCookie(o, i),
								s(null != (t = e) && t),
								r && (this.setState({ visible: !1 }), this.removeScrollListener())
						}),
						(n.overlayClick = function () {
							var e = a({}, f, this.props),
								t = e.acceptOnOverlayClick,
								n = e.onOverlayClick
							t && this.accept(), n()
						}),
						(n.decline = function () {
							var e = a({}, f, this.props),
								t = e.cookieName,
								n = e.declineCookieValue,
								o = e.hideOnDecline,
								i = e.onDecline
							e.setDeclineCookie && this.setCookie(t, n), i(), o && this.setState({ visible: !1 })
						}),
						(n.setCookie = function (e, t) {
							var n = this.props,
								i = n.extraCookieOptions,
								r = n.expires,
								c = n.sameSite,
								l = this.props.cookieSecurity
							void 0 === l && (l = !window.location || "https:" === window.location.protocol)
							var u = a({ expires: r }, i, { sameSite: c, secure: l })
							c === o.NONE && s().set(y(e), t, u), s().set(e, t, u)
						}),
						(n.getCookieValue = function () {
							return v(this.props.cookieName)
						}),
						(n.render = function () {
							var e = this
							switch (this.props.visible) {
								case p.HIDDEN:
									return null
								case p.BY_COOKIE_VALUE:
									if (!this.state.visible) return null
							}
							var t = this.props,
								n = t.location,
								o = t.style,
								r = t.buttonStyle,
								s = t.declineButtonStyle,
								l = t.contentStyle,
								d = t.disableStyles,
								b = t.buttonText,
								f = t.declineButtonText,
								m = t.containerClasses,
								v = t.contentClasses,
								y = t.buttonClasses,
								h = t.buttonWrapperClasses,
								g = t.declineButtonClasses,
								k = t.buttonId,
								C = t.declineButtonId,
								O = t.disableButtonStyles,
								x = t.enableDeclineButton,
								S = t.flipButtons,
								B = t.ButtonComponent,
								w = t.overlay,
								E = t.overlayClasses,
								j = t.overlayStyle,
								I = t.ariaAcceptLabel,
								D = t.ariaDeclineLabel,
								N = t.customContainerAttributes,
								A = t.customContentAttributes,
								_ = t.customButtonProps,
								T = t.customDeclineButtonProps,
								L = t.customButtonWrapperAttributes,
								P = {},
								R = {},
								U = {},
								V = {},
								W = {}
							switch (
								(d
									? ((P = Object.assign({}, o)),
										(R = Object.assign({}, r)),
										(U = Object.assign({}, s)),
										(V = Object.assign({}, l)),
										(W = Object.assign({}, j)))
									: ((P = Object.assign({}, a({}, this.state.style, o))),
										(V = Object.assign({}, a({}, this.state.contentStyle, l))),
										(W = Object.assign({}, a({}, this.state.overlayStyle, j))),
										O
											? ((R = Object.assign({}, r)), (U = Object.assign({}, s)))
											: ((R = Object.assign({}, a({}, this.state.buttonStyle, r))),
												(U = Object.assign({}, a({}, this.state.declineButtonStyle, s))))),
								n)
							) {
								case u.TOP:
									P.top = "0"
									break
								case u.BOTTOM:
									P.bottom = "0"
							}
							var F = []
							return (
								x &&
									F.push(
										i.createElement(
											B,
											Object.assign(
												{
													key: "declineButton",
													style: U,
													className: g,
													id: C,
													"aria-label": D,
													onClick: function () {
														e.decline()
													},
												},
												T,
											),
											f,
										),
									),
								F.push(
									i.createElement(
										B,
										Object.assign(
											{
												key: "acceptButton",
												style: R,
												className: y,
												id: k,
												"aria-label": I,
												onClick: function () {
													e.accept()
												},
											},
											_,
										),
										b,
									),
								),
								S && F.reverse(),
								i.createElement(
									c,
									{
										condition: w,
										wrapper: function (t) {
											return i.createElement(
												"div",
												{
													style: W,
													className: E,
													onClick: function () {
														e.overlayClick()
													},
												},
												t,
											)
										},
									},
									i.createElement(
										"div",
										Object.assign({ className: "" + m, style: P }, N),
										i.createElement(
											"div",
											Object.assign({ style: V, className: v }, A),
											this.props.children,
										),
										i.createElement(
											"div",
											Object.assign({ className: "" + h }, L),
											F.map(function (e) {
												return e
											}),
										),
									),
								)
							)
						}),
						t
					)
				})(i.Component)
			h.defaultProps = f
			var g = n(7093)
			function k(e) {
				let {
						text: t = "Like pretty much everyone else, we use cookies. We assume you're OK with it, but you can opt out if you want.",
						buttonText: n = "Accept",
						onAccept: o,
						onDecline: r,
						enableDeclineButton: s = !0,
						declineButtonText: c = "Decline",
						className: a = "",
						cookieName: l = "roo-code-cookie-consent",
						debug: u = !1,
					} = e,
					p = {
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
					d = {
						...p,
						background: "transparent",
						color: "var(--cookie-consent-text, #0a0a0a)",
						border: "1px solid var(--cookie-consent-border, #e5e5e5)",
					},
					[b, f] = i.useState(!1)
				i.useEffect(() => {
					let e = () => {
						f(document.documentElement.classList.contains("dark"))
					}
					e()
					let t = new MutationObserver(e)
					return (
						t.observe(document.documentElement, { attributes: !0, attributeFilter: ["class"] }),
						() => t.disconnect()
					)
				}, [])
				let m = { ...p, background: b ? "#fafafa" : "#0a0a0a", color: b ? "#0a0a0a" : "#fafafa" },
					v = {
						...d,
						color: b ? "#fafafa" : "#0a0a0a",
						border: "1px solid ".concat(b ? "#262626" : "#e5e5e5"),
					}
				return (0, g.jsx)(h, {
					location: "bottom",
					buttonText: n,
					declineButtonText: c,
					cookieName: l,
					style: {
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
						background: b ? "rgba(0, 0, 0, 0.95)" : "rgba(255, 255, 255, 0.95)",
						color: b ? "#fafafa" : "#0a0a0a",
						borderTop: "1px solid ".concat(b ? "#262626" : "#e5e5e5"),
					},
					buttonStyle: m,
					declineButtonStyle: v,
					contentStyle: { flex: 1, margin: 0, marginRight: "1rem" },
					expires: 365,
					enableDeclineButton: s,
					onAccept: o,
					onDecline: r,
					debug: u,
					containerClasses: "CookieConsent ".concat(a),
					buttonClasses: "cookie-consent-accept",
					declineButtonClasses: "cookie-consent-decline",
					contentClasses: "cookie-consent-content",
					overlayClasses: "cookie-consent-overlay",
					buttonWrapperClasses: "cookie-consent-buttons",
					children: t,
				})
			}
		},
	},
	(e) => {
		var t = (t) => e((e.s = t))
		e.O(0, [326, 335, 550, 358], () => t(4420)), (_N_E = e.O())
	},
])
