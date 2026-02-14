# Mission Board Backend - VPS Deployment Guide

## Step 1: Clone and Setup on VPS

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Clone the repo
git clone https://github.com/iphegde/dashboard.git
cd dashboard/mission-board/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env
```

## Step 2: Configure .env

Edit `.env`:
```
SUPABASE_URL=https://yckghcjicvqdfcrrknzs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PORT=3001
```

**Important:** Use the **service_role key** (not anon key). Get it from Supabase Dashboard → Project Settings → API → service_role secret.

## Step 3: Test the Backend

```bash
npm start
```

You should see:
```
Mission Board API server running on port 3001
WebSocket endpoint: ws://localhost:3001/ws
```

Press Ctrl+C to stop for now.

## Step 4: Run as a Service (PM2)

Install PM2 to keep the backend running:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the backend with PM2
cd /path/to/dashboard/mission-board/backend
pm2 start server.js --name "mission-board-api"

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command PM2 outputs

# Check status
pm2 status
```

## Step 5: Expose to Internet (Nginx Reverse Proxy)

### Option A: Using Nginx (Recommended)

```bash
# Install nginx
sudo apt update
sudo apt install nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/mission-board
```

Add this:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or your VPS IP

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_read_timeout 86400;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/mission-board /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Option B: Direct Port (if no domain)

If you don't have a domain, expose port 3001 directly:

```bash
# Open firewall port
sudo ufw allow 3001

# Or if using iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

Then access via: `http://your-vps-ip:3001`

## Step 6: Add HTTPS (Optional but Recommended)

If you have a domain:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renew
sudo certbot renew --dry-run
```

## Step 7: Test from Anywhere

```bash
# Test health endpoint
curl http://your-vps-ip/api/health
# Or with domain:
curl https://your-domain.com/api/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

## Step 8: Update Frontend

In your frontend `.env`:
```
VITE_SUPABASE_URL=https://yckghcjicvqdfcrrknzs.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

The frontend connects directly to Supabase, so no backend URL needed in frontend!

## Step 9: Update Agent Skill Config

Agents will log to your VPS backend. Create a config:

```bash
# In your agent workspace, create .env
MISSION_BOARD_API_URL=http://your-vps-ip:3001
# Or if using HTTPS:
# MISSION_BOARD_API_URL=https://your-domain.com
```

## Troubleshooting

**"Cannot connect to backend"**
- Check PM2: `pm2 status`
- Check logs: `pm2 logs mission-board-api`
- Check firewall: `sudo ufw status`

**"Port already in use"**
- Find process: `sudo lsof -i :3001`
- Kill it: `sudo kill -9 <pid>`
- Restart: `pm2 restart mission-board-api`

**"CORS errors"**
- Backend already has CORS enabled
- Check your .env has correct Supabase URL

**"WebSocket connection fails"**
- Nginx config needs WebSocket headers (see Step 5)
- Or access directly via IP:port

## Monitoring

```bash
# View logs
pm2 logs mission-board-api

# Monitor resources
pm2 monit

# Restart
pm2 restart mission-board-api

# Update after code changes
git pull
pm2 restart mission-board-api
```

## Security Notes

⚠️ **Important:**
- The service_role key has full database access - keep it secret!
- Use HTTPS in production (Step 6)
- Consider adding API key authentication for production use
- Firewall: Only open ports you need (80, 443, 3001 if direct)

## Your API Endpoints

Once deployed, agents can use:

```
POST   http://your-vps-ip:3001/api/conversations          # Create conversation
POST   http://your-vps-ip:3001/api/conversations/:id/messages  # Add message
GET    http://your-vps-ip:3001/api/conversations          # List all
GET    http://your-vps-ip:3001/api/health                 # Health check
```

## Quick Test Script

```bash
# Create conversation
curl -X POST http://your-vps-ip:3001/api/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "initiator_agent": "test",
    "participants": ["user"],
    "session_id": "test-123",
    "title": "Test"
  }'

# Should return conversation object with id
```

---

Once your backend is deployed, agents can log from anywhere!
