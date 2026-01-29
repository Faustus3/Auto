# Quick Start Guide

This guide will help you get the Auto backend infrastructure up and running in 5 minutes.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Ollama (for AI capabilities)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
echo "JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
OLLAMA_URL=http://localhost:11434
PORT=3000
ALLOWED_ORIGINS=http://localhost:8080,https://sohaltweil.github.io" > .env
```

## Step 3: Start the Server

```bash
node backend/server.js
```

## Step 4: Verify Installation

Check if the server is running:
```bash
curl http://localhost:3000/health
```

You should see a JSON response with server status.

## Default Users

The system comes with two default users:
- Username: `finn`, Password: `test`
- Username: `dani`, Password: `test`

## Ollama Setup (Optional)

If you want to use AI features, install and start Ollama:

```bash
# Install Ollama (https://ollama.com/download)
# Then pull a model:
ollama pull llama3.2:latest
```

## Next Steps

1. Access the frontend at `http://localhost:8080` (if running locally)
2. Login with default credentials
3. Explore the blog, notes, and utility tracker features
4. Use the Ollama API proxy for AI integration

## Troubleshooting

### Server won't start
- Make sure all dependencies are installed: `npm install`
- Check if port 3000 is already in use

### Authentication issues
- Verify your `.env` file has correct JWT_SECRET
- Check that you're using correct credentials

### Ollama connection issues
- Ensure Ollama is running: `ollama serve`
- Verify OLLAMA_URL in `.env` points to correct address