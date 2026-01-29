# Deployment Guide

This guide explains how to deploy the Auto backend infrastructure to various platforms.

## Railway Deployment

### Prerequisites
- GitHub account
- Railway account

### Steps
1. Fork this repository to your GitHub account
2. Create a new app on Railway:
   - Go to https://railway.app
   - Click "New Project"
   - Connect your GitHub repository
3. Set environment variables in Railway dashboard:
   - `JWT_SECRET` (generate a secure secret)
   - `OLLAMA_URL` (default: `http://localhost:11434`)
   - `PORT` (default: `3000`)
   - `ALLOWED_ORIGINS` (comma-separated list of allowed origins)
4. Deploy the project

Railway will automatically install dependencies and start the server.

## Heroku Deployment

### Prerequisites
- Heroku account
- Heroku CLI installed

### Steps
1. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```

2. Add the Node.js buildpack:
   ```bash
   heroku buildpacks:set heroku/nodejs
   ```

3. Set environment variables:
   ```bash
   heroku config:set JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   heroku config:set OLLAMA_URL=http://localhost:11434
   heroku config:set PORT=3000
   heroku config:set ALLOWED_ORIGINS=http://localhost:8080,https://sohaltweil.github.io
   ```

4. Deploy to Heroku:
   ```bash
   git push heroku main
   ```

## VPS Deployment

### Prerequisites
- Linux VPS with Node.js and npm installed
- Git

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/Faustus3/Auto.git
   cd Auto
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   echo "JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   OLLAMA_URL=http://localhost:11434
   PORT=3000
   ALLOWED_ORIGINS=http://localhost:8080,https://sohaltweil.github.io" > .env
   ```

4. Start the server:
   ```bash
   node backend/server.js
   ```

### Using PM2 for Process Management
For production deployment, use PM2 to manage the process:

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the server with PM2:
   ```bash
   pm2 start backend/server.js --name "auto-backend"
   ```

3. Save the PM2 process list:
   ```bash
   pm2 save
   ```

4. Set PM2 to start on boot:
   ```bash
   pm2 startup
   ```

## Docker Deployment

### Prerequisites
- Docker installed

### Steps
1. Build the Docker image:
   ```bash
   docker build -t auto-backend .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 \
     -e JWT_SECRET=your-super-secret-jwt-key-change-this-in-production \
     -e OLLAMA_URL=http://localhost:11434 \
     -e PORT=3000 \
     auto-backend
   ```

## Environment Variables

The following environment variables are required:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-jwt-key-change-this-in-production` |
| `OLLAMA_URL` | URL of Ollama API | `http://localhost:11434` |
| `PORT` | Port to run the server on | `3000` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins | `http://localhost:8080,https://sohaltweil.github.io` |

## Security Considerations

1. **Change default secrets**: Never use default JWT_SECRET in production
2. **Use HTTPS**: Deploy with SSL certificates
3. **Rate limiting**: The server includes built-in rate limiting
4. **Input validation**: All endpoints validate input data
5. **Regular updates**: Keep dependencies updated

## Monitoring

### Health Endpoint
The server provides a health check endpoint:
```
GET /health
```

### Logging
The server logs important events to stdout, which can be captured by your deployment platform.

## Backup Strategy

1. Regular database backups (if using persistent storage)
2. Version control of code and configuration
3. Environment variable backups