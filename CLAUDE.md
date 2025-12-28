# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Koa-based REST API server for a notes application. The backend uses PostgreSQL for data storage and provides authentication (JWT) and CRUD operations for notes, note types (with hierarchical tree structure), tags, and attachments.

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Start PostgreSQL database container (Docker)
npm run docker

# Install dependencies
npm install
```

## Architecture

### Project Structure
```
src/
├── index.js           # Main application entry point
├── config/
│   └── database.js    # PostgreSQL connection pool and query helpers
├── routes/
│   ├── auth.js        # Authentication endpoints (register, login)
│   ├── noteTypes.js   # Note type CRUD with tree structure
│   ├── notes.js       # Note CRUD (planned, commented out)
│   └── tags.js        # Tag management (planned, commented out)
└── middleware/
    └── errorHandler.js # Global error handling middleware
```

### Database Configuration
- PostgreSQL 16 running in Docker (port 5432)
- Connection pool managed via `pg` library
- Connection settings read from `.env` file
- Custom `query()` helper logs execution time and errors

### API Response Format
All API responses follow a consistent structure:
```javascript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { message: "...", code: "ERROR_CODE" } }
```

### Key Architecture Patterns

**Hierarchical Data**: Note types support tree structures using recursive PostgreSQL functions:
- `get_type_tree(user_id, parent_id)` - Returns recursive tree with paths
- `get_type_note_count(type_id)` - Counts notes including all subtypes

**Authentication Flow**:
- JWT-based authentication using `jsonwebtoken`
- Passwords hashed with bcrypt (10 rounds)
- Token includes `userId` and `username`
- JWT secret and expiration configured via environment variables

**Error Handling**:
- Global error handler middleware catches all errors
- Development mode includes stack traces in responses
- Production mode hides implementation details

**Database Triggers**:
- `update_updated_at_column()` function automatically sets `updated_at` timestamp on row updates
- Applied to users, note_types, and notes tables

### Database Schema (Key Tables)

**users**: id, username, email, password_hash, created_at, updated_at
**note_types**: id, user_id, name, description, parent_id, sort_order, color, icon
**notes**: id, user_id, type_id, title, content, is_favorite, is_archived
**tags**: id, user_id, name (many-to-many with notes via note_tags)
**attachments**: id, note_id, file_name, file_path, file_size, mime_type

### Environment Variables (.env required)
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dev_db
DB_USER=dev_user
DB_PASSWORD=dev_password
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

## Development Notes

- ES modules (`"type": "module"`) used throughout
- Routes are prefixed (`/api/auth`, `/api/note-types`, etc.)
- Health check endpoint available at `/health`
- CORS enabled for all origins (configure for production)
- No authentication middleware yet - routes currently accept `userId` from query/body (implement JWT verification middleware for production)
