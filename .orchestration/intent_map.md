# Intent Map

## Purpose

This file maps high-level business intents to physical files and AST nodes.
When a manager asks, "Where is the billing logic?", this file provides the answer.

## Intent to File Mapping

### INT-001: Weather API Implementation

- **Scope**: `src/weather/**`, `src/api/weather.ts`
- **Primary Files**:
    - `src/api/weather.ts` - Main API endpoint
    - `src/weather/client.ts` - OpenWeatherMap client
    - `src/weather/types.ts` - Type definitions
    - `src/weather/forecast.ts` - Forecast logic

### INT-002: User Authentication Refactor

- **Scope**: `src/auth/**`, `src/middleware/auth.ts`
- **Primary Files**:
    - `src/auth/middleware.ts` - Auth middleware
    - `src/auth/jwt.ts` - JWT handling
    - `src/auth/oauth.ts` - OAuth2 implementation
    - `src/auth/password.ts` - Password hashing

## Intent Evolution History

(Automatically updated when INTENT_EVOLUTION occurs)

- 2026-02-17: INT-001 created
- 2026-02-17: INT-002 created
