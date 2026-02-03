# Auto Dashboard

A personal dashboard with authentication, blog, notes, and zrok integration for public access.

## Features

- **User Authentication**: Secure JWT-based login system
- **Blog System**: Create, edit, and manage blog posts with tags
- **Notes**: Personal note-taking with local and cloud sync
- **zrok Integration**: Share your dashboard publicly with automatic tunneling
- **WebGL Background**: Animated neon effects using WebGL shaders

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start with zrok (Recommended)

```bash
node start-server.js
```

This starts both the server and creates a zrok tunnel automatically!

### 3. Or Start Manually

**Terminal 1:**
```bash
cd backend
node server.js
```

**Terminal 2:**
```bash
zrok share public http://localhost:3001
```

### 4. Access

- **Local**: http://localhost:3001
- **Public** (via zrok): https://xxx.zrok.io (shown in terminal)

## Architecture

```
├── index.html          # Frontend
├── script.js           # Frontend logic with zrok auto-detection
├── style.css           # Styling
├── start-server.js     # One-command server + zrok launcher
├── backend/
│   ├── server.js       # Express API server
│   ├── auth-service.js # JWT authentication
│   └── data-service.js # Data persistence
├── data/               # User data storage
└── ZROK_SETUP.md      # Detailed zrok setup guide
```

## Configuration

Edit `backend/.env`:
```
PORT=3001
JWT_SECRET=your-secret-key
```

## zrok Setup

See [ZROK_SETUP.md](ZROK_SETUP.md) for detailed instructions on:
- Installing zrok
- Creating an account
- Getting your invite token
- Troubleshooting

## How It Works

### Auto-Detection

The frontend automatically detects if it's running on a zrok domain:

```javascript
const isZrokDomain = window.location.hostname.includes('zrok.io');
const API_BASE_URL = isZrokDomain 
    ? `${window.location.protocol}//${window.location.host}/api`
    : 'http://localhost:3001/api';
```

This means:
- **Local development**: Uses `localhost:3001`
- **zrok tunnel**: Uses the same domain (no CORS issues!)

### Data Storage

- User data stored in `data/` directory
- Each user has their own subdirectory
- JSON file format for easy debugging

## Scripts

- `node start-server.js` - Start server + zrok tunnel
- `cd backend && node server.js` - Start server only
- `cd backend && npm run dev` - Start with nodemon (auto-reload)

## Security

- JWT tokens for authentication
- bcrypt password hashing
- Rate limiting (100 req/15min per IP)
- CORS configured for zrok domains

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS with WebGL
- **Backend**: Node.js + Express
- **Auth**: JWT + bcrypt
- **Tunnel**: zrok (secure tunneling)

## License

MIT

---

**Happy Dashboarding! 🚀**
