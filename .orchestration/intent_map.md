# Intent Map

## INT-001: Weather API Implementation

- **Status:** IN_PROGRESS
- **Files:**
    - `src/weather/api.js` - Main API endpoints
    - `src/weather/service.js` - Weather service logic
    - `src/weather/utils.js` - Helper functions
- **AST Nodes:**
    - `WeatherService` class
    - `getWeatherData()` function
    - `formatWeatherResponse()` function
- **Dependencies:** OpenWeatherMap API
- **Last Updated:** 2026-02-21

## INT-002: Authentication Middleware

- **Status:** PLANNED
- **Files:**
    - `src/auth/jwt.js` - JWT handling
    - `src/middleware/auth.js` - Auth middleware
    - `src/auth/rate-limit.js` - Rate limiting
- **AST Nodes:**
    - `authenticateToken()` middleware
    - `generateToken()` function
    - `RateLimiter` class
- **Dependencies:** jsonwebtoken, express-rate-limit
- **Last Updated:** 2026-02-21
