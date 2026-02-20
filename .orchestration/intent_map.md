# Intent Map

Maps business intents to physical files and AST nodes.
Auto-updated by the Hook Engine PostHook on every file write.

---

## INT-001: JWT Authentication Migration

_Updated: 2026-02-18T10:35:00Z_

- `src/auth/jwt.ts`
- `src/middleware/jwt.ts`
- `tests/auth/jwt.test.ts`

**AST Nodes:**
| File | Node Type | Name | Lines |
|------|-----------|------|-------|
| src/auth/jwt.ts | FunctionDeclaration | generateToken | 10–35 |
| src/auth/jwt.ts | FunctionDeclaration | verifyToken | 37–65 |
| src/middleware/jwt.ts | FunctionDeclaration | jwtMiddleware | 5–28 |

---

## INT-002: Weather API Integration

_Updated: 2026-02-18T10:00:00Z_

_(No files written yet — intent is PENDING)_

---

## INT-003: User Profile CRUD

_Updated: 2026-02-18T10:00:00Z_

_(No files written yet — intent is PENDING)_
