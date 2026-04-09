# Project Architecture

## Overview

This is a TypeScript/Node.js project with an API layer, services, and type definitions.

## Directory Structure

### API Layer (`src/api/`)

- REST API endpoints and route handlers
- Request/response validation using Zod schemas
- Authentication endpoints (login, register, etc.)
- Error handling middleware

### Services (`src/services/`)

- Business logic layer
- Database operations
- External API integrations
- User management services

### Types (`src/types/`)

- TypeScript type definitions
- Shared interfaces and types
- User models and DTOs

### Configuration (`src/config/`)

- Environment variables
- Application configuration
- Constants (JWT secrets, expiration times, etc.)

## Key Technologies

- Express.js for API routes
- Zod for schema validation
- JWT for authentication
- TypeScript for type safety

## Intent Areas

1. **API Development** - All API endpoints and handlers in `src/api/**`
2. **Service Layer** - Business logic in `src/services/**`
3. **Type Definitions** - Type system in `src/types/**`
4. **Configuration** - Config management in `src/config/**`
