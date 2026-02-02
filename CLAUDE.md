# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal dashboard application with authentication, blog, notes, and AI integration using Ollama. The application features a cyberpunk aesthetic with Fibonacci-based design elements.

## Code Architecture

The application follows a clear separation of concerns with:
- A Node.js/Express.js backend server handling API routes and business logic
- A frontend HTML/CSS/JavaScript interface with interactive components
- Authentication via JWT tokens with bcrypt password hashing
- Data persistence using local JSON files for demo purposes
- Integration with Ollama AI service for text generation

## Key Components

### Backend Structure
- `backend/server.js`: Main server entry point with all API routes
- `backend/auth-service.js`: Handles user registration, login, and token management
- `backend/ollama-service.js`: Wrapper for Ollama API interactions
- `backend/data-service.js`: Manages user data persistence
- `data/users.json`: User data storage (JSON file)

### Frontend Structure
- `index.html`: Main application layout with all UI components
- `script.js`: Client-side JavaScript for interactive functionality
- `style.css`: Styling with cyberpunk and Fibonacci design elements
- `assets/utility-tracker.js`: Utility tracker functionality

## Development Commands

### Starting the Application
1. Install dependencies: `npm install`
2. Set up environment variables in `.env` file (see `.env.example`)
3. Start the server: `npm start` or `npm run dev` for development with auto-restart

### API Endpoints
- Authentication: `/api/auth/register`, `/api/auth/login`, `/api/auth/verify`
- Ollama: `/api/ollama/generate`, `/api/ollama/status`
- Data: `/api/data/save`, `/api/data/load/:key`, `/api/data/keys`

## Environment Setup

Create a `.env` file with:
- `JWT_SECRET`: Secret key for JWT tokens
- `OLLAMA_URL`: URL for Ollama service
- `PORT`: Server port (default 3000)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins

## Testing and Debugging

The application is designed to work with a local Ollama instance running on `http://localhost:11434`. For testing authentication, users must be created in `data/users.json` before login attempts can succeed.

## Key Technical Details

- Passwords are hashed using bcrypt
- JWT tokens are used for authentication
- All API routes are protected and require authentication where appropriate
- The frontend communicates with backend via RESTful API calls
- The application uses local file storage for data persistence in development