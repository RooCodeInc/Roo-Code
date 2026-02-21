# Intent Map - Spatial Code-to-Intent Mapping

## INT-001: JWT Authentication Migration

| File                   | AST Node           | Intent Status |
| ---------------------- | ------------------ | ------------- |
| src/auth/middleware.ts | authenticateUser() | IN_PROGRESS   |
| src/auth/token.ts      | generateToken()    | IN_PROGRESS   |
| src/middleware/jwt.ts  | jwtVerify()        | PENDING       |

## INT-002: Weather API Integration

| File                      | AST Node       | Intent Status |
| ------------------------- | -------------- | ------------- |
| src/api/weather/routes.ts | GET /weather   | DRAFT         |
| src/services/weather.ts   | fetchWeather() | DRAFT         |

## INT-003: Database Migration to PostgreSQL

| File                              | AST Node           | Intent Status |
| --------------------------------- | ------------------ | ------------- |
| src/db/connection.ts              | createConnection() | DRAFT         |
| src/db/migrations/001_initial.sql | schema             | DRAFT         |

## INT-004: React Component Refactoring

| File                           | AST Node    | Intent Status |
| ------------------------------ | ----------- | ------------- |
| src/components/Dashboard.tsx   | Dashboard   | DRAFT         |
| src/components/UserProfile.tsx | UserProfile | DRAFT         |

## INT-005: API Rate Limiting Implementation

| File                         | AST Node      | Intent Status |
| ---------------------------- | ------------- | ------------- |
| src/middleware/rate-limit.ts | rateLimiter() | DRAFT         |
| src/config/rate-limits.ts    | config        | DRAFT         |

## Last Updated

2026-02-18T11:00:00Z
