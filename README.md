# Auto Dashboard

A personal dashboard application with authentication, blog, notes, and AI integration using Ollama.

## Features

- User authentication (login/register)
- Personal blog with CRUD operations
- Notes section for ideas and thoughts
- Integration with Ollama AI for text generation
- Utility tracker for cryptocurrency data
- Responsive design with cyberpunk aesthetic

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env` file (see `.env.example`)
4. Start the server:
   ```bash
   npm start
   ```
   or for development with auto-restart:
   ```bash
   npm run dev
   ```

## Project Structure

```
.
├── backend/
│   ├── server.js          # Main server file
│   ├── auth-service.js    # Authentication service
│   ├── ollama-service.js  # Ollama API service
│   ├── data-service.js    # Data persistence service
│   └── ...
├── data/
│   └── users.json         # User data storage
├── assets/
│   └── utility-tracker.js # Utility tracker functionality
├── index.html             # Main HTML file
├── script.js              # Client-side JavaScript
└── style.css              # CSS styling
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

### Ollama
- `POST /api/ollama/generate` - Generate text using Ollama
- `GET /api/ollama/status` - Check Ollama service status

### Data
- `POST /api/data/save` - Save user data
- `GET /api/data/load/:key` - Load user data
- `GET /api/data/keys` - List user data keys

## Environment Variables

Create a `.env` file with the following variables:

```
PORT=3000
OLLAMA_URL=http://localhost:11434
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000
```

## Development

This project uses:
- Node.js with Express.js
- JWT for authentication
- bcrypt for password hashing
- Ollama for AI text generation
- Local storage for demo purposes

## License

MIT