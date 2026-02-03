# ZROK Setup Guide for Auto Dashboard

This guide explains how to set up zrok to make your Auto Dashboard accessible from anywhere.

## What is zrok?

zrok is a secure, open-source tunneling service that creates a public URL for your locally running applications. Perfect for sharing your dashboard or accessing it from your phone.

---

## Prerequisites

- Node.js installed (v18 or higher)
- zrok CLI installed
- zrok account (free tier available)

---

## Step 1: Install zrok

### Windows (PowerShell)
```powershell
winget install zrok
```

### macOS
```bash
brew install zrok
```

### Linux
Download from: https://github.com/openziti/zrok/releases

---

## Step 2: Create zrok Account

1. Go to https://zrok.io
2. Sign up for a free account
3. Verify your email
4. Get your **invite token** from the dashboard

---

## Step 3: Enable zrok

In your terminal, run:

```bash
zrok enable <your-invite-token>
```

Replace `<your-invite-token>` with the token from your zrok dashboard.

---

## Step 4: Test zrok

Verify zrok is working:

```bash
zrok share public http://localhost:3001
```

You should see a public URL like `https://abc123.zrok.io`. Press `Ctrl+C` to stop.

---

## Step 5: Start Your Dashboard

### Automatic (Recommended)

We created `start-server.js` for you. Simply run:

```bash
node start-server.js
```

This will:
1. Start the Node.js backend on port 3001
2. Create a zrok tunnel automatically
3. Display your public URL
4. Keep both running in the terminal

### Manual (Alternative)

If you prefer manual control:

**Terminal 1 - Start Server:**
```bash
cd backend
npm install  # only first time
node server.js
```

**Terminal 2 - Start zrok:**
```bash
zrok share public http://localhost:3001
```

---

## Usage

### Local Development
- Access at: `http://localhost:3000` (or wherever you host the frontend)
- API calls go to: `http://localhost:3001`

### Public Access (zrok)
- Access at: `https://xxx.zrok.io`
- API calls automatically go to the same domain
- No configuration needed - the frontend auto-detects!

---

## Troubleshooting

### "zrok is not enabled"
Run: `zrok enable <your-token>`

### "zrok command not found"
Make sure zrok is in your PATH or reinstall it.

### Server won't start
Check that port 3001 is not already in use:
```bash
# Windows
netstat -ano | findstr :3001

# macOS/Linux
lsof -i :3001
```

### zrok URL not appearing
Wait 10-30 seconds. Sometimes it takes time to establish the tunnel.

---

## Stopping

Press `Ctrl+C` in the terminal running `start-server.js`. Both the server and zrok tunnel will stop gracefully.

---

## Security Notes

- zrok URLs are public but hard to guess
- Your dashboard still requires login with JWT tokens
- Data is stored locally in the `data/` directory
- zrok tunnels are temporary - the URL changes each time you restart

---

## Next Steps

- Customize your dashboard in `index.html` and `style.css`
- Add more features to the backend in `backend/server.js`
- Check `backend/.env` to configure port and JWT secret

---

## Support

- zrok documentation: https://docs.zrok.io
- zrok dashboard: https://zrok.io

---

**Happy Dashboarding! 🚀**
