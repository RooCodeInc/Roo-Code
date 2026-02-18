module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow scoped types like feat(hooks): ...
    "scope-enum": [2, "always", ["hooks", "posthook", "prehooks", "docs", "diagrams", "ci", "types", "core", "webview", "tools"]],
  },
}
