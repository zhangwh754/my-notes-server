# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Koa-based REST API server for a notes application. The backend uses PostgreSQL for data storage and provides authentication (JWT) and full CRUD operations for notes, note types (with hierarchical tree structure), tags, and attachments.

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Start PostgreSQL database container (Docker)
npm run docker

# Initialize database schema (after starting docker)
psql -h localhost -U dev_user -d dev_db -f prSql.sql

# Install dependencies
npm install

Architecture

Project Structure

src/
├── index.js           # Main application entry point
├── config/
│   └── database.js    # PostgreSQL connection pool and query helpers
├── routes/
│   ├── auth.js        # Authentication endpoints (register, login)
│   ├── noteTypes.js   # Note type CRUD with tree structure
│   ├── notes.js       # Note CRUD with filtering, pagination, tags
│   └── tags.js        # Tag management with many-to-many note relations
└── middleware/
    ├── errorHandler.js     # Global error handling middleware
    └── responseFormatter.js # Convert snake_case to camelCase in responses

Database Setup

Database schema is defined in prSql.sql. The docker/postgres/init.sql file is currently empty/placeholder.

To initialize the database after starting Docker:
psql -h localhost -U dev_user -d dev_db -f prSql.sql

Or run the SQL directly via your database client.

API Response Format

All API responses follow a consistent structure:
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { message: "...", code: "ERROR_CODE" } }

Response Format Transformation

The responseFormatter middleware automatically converts all database snake_case fields to camelCase in API responses. This means:
- Database columns like created_at, user_id, sort_order become createdAt, userId, sortOrder
- When writing to the database, use snake_case in SQL queries
- When reading responses, expect camelCase

Key Architecture Patterns

Hierarchical Data: Note types support tree structures using recursive PostgreSQL functions:
- get_type_tree(user_id, parent_id) - Returns recursive tree with paths and levels
- get_type_note_count(type_id) - Counts notes including all subtypes recursively

Authentication Flow:
- JWT-based authentication using jsonwebtoken
- Passwords hashed with bcrypt (10 rounds)
- Token includes userId and username
- JWT secret and expiration configured via environment variables
- Routes currently accept userId from query/body - JWT verification middleware not yet implemented

Error Handling:
- Global error handler middleware catches all errors
- Development mode (NODE_ENV=development) includes stack traces in responses
- Production mode hides implementation details
- Specific PostgreSQL error codes are handled (23503 for foreign key violations, 23505 for unique constraints)

Database Triggers:
- update_updated_at_column() function automatically sets updated_at timestamp on row updates
- Applied to users, note_types, and notes tables

Database Schema (Key Tables)

users: id, username, email, password_hash, created_at, updated_at
note_types: id, user_id, name, description, parent_id, sort_order, color, icon
- Hierarchical structure via parent_id self-reference
- Unique constraint on (user_id, parent_id, name) prevents duplicate names at same level

notes: id, user_id, type_id, title, content, is_favorite, is_archived
- Full-text search index on title using GIN
- Cascade delete when user deleted, restricted when note_type deleted

tags: id, user_id, name
- Unique constraint on (user_id, name)

note_tags: note_id, tag_id (many-to-many junction table)
attachments: id, note_id, file_name, file_path, file_size, mime_type

Environment Variables (.env required)

DB_HOST=localhost
DB_PORT=5432
DB_NAME=dev_db
DB_USER=dev_user
DB_PASSWORD=dev_password
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

API Endpoints

Authentication (/api/auth):
- POST /register - Create new user, returns JWT token
- POST /login - Authenticate user, returns JWT token

Note Types (/api/note-types):
- GET / - Get all types for a user (flat list with note_count)
- GET /tree - Get hierarchical tree structure
- GET /:id - Get single type
- POST / - Create type (supports parentId, sortOrder, color, icon)
- PUT /:id - Update type
- DELETE /:id - Delete type
- GET /:id/note-count - Get note count including all subtypes

Notes (/api/notes):
- GET / - List with filters (typeId, isFavorite, isArchived, search), pagination
- GET /:id - Get single note with tags
- POST / - Create note
- PUT /:id - Update note
- DELETE /:id - Delete note
- PATCH /:id/favorite - Toggle favorite status
- PATCH /:id/archive - Toggle archive status
- GET /:id/tags - Get note's tags
- POST /:id/tags - Add tag to note
- DELETE /:id/tags/:tagId - Remove tag from note

Tags (/api/tags):
- GET / - Get all tags for user (with optional search), includes note_count
- GET /popular - Get most used tags (ordered by usage)
- GET /:id - Get single tag
- GET /:id/notes - Get paginated notes for a tag
- POST / - Create tag
- POST /find-or-create - Create tag or return existing if exists (returns created: true/false)
- PUT /:id - Update tag
- DELETE /:id - Delete tag

Development Notes

- ES modules ("type": "module") used throughout
- Health check endpoint at /health
- CORS enabled for all origins (configure for production)
- Body parser configured with 10mb limits
- Pagination pattern: page (default 1), limit (default 20), returns total and totalPages
- When filtering by boolean fields, query params are strings: isFavorite=true
- JWT authentication middleware not yet implemented - routes currently accept userId from query/body

---

**Key changes:**
1. Added database initialization command to development commands
2. Updated project structure to include `responseFormatter.js` and correct route descriptions
3. Added "Database Setup" section explaining the schema location
4. Added "Response Format Transformation" section explaining the snake_case to camelCase middleware
5. Expanded "Key Architecture Patterns" with more details on error handling and PostgreSQL functions
5. Enhanced database schema descriptions with constraints and relationships
6. Added complete "API Endpoints" section documenting all routes
7. Added pagination pattern and boolean filter handling notes
```
