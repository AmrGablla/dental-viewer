# Nginx Deployment Guide

This guide will help you deploy the Dental Viewer application using Nginx as a reverse proxy.

## Architecture

- **Nginx** (Port 80): Serves frontend static files and proxies API requests
- **Node.js Backend** (Port 3001, localhost only): Handles API requests

## Prerequisites

1. Node.js and npm installed
2. Nginx installed
3. Application built and configured

## Step-by-Step Deployment

### Step 1: Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### Step 2: Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Configure Backend Environment

```bash
cd ~/dental-viewer/backend
cp env.example .env
```

Edit `backend/.env`:
```env
PORT=3001
JWT_SECRET=your-very-secure-random-secret-key-change-this
NODE_ENV=production
```

### Step 4: Configure Frontend Environment

```bash
cd ~/dental-viewer
echo "VITE_API_BASE_URL=http://64.226.107.42/api" > .env
```

### Step 5: Install Dependencies and Build

```bash
# Backend dependencies
cd ~/dental-viewer/backend
npm install --production

# Frontend dependencies
cd ~/dental-viewer
npm install

# Build frontend
npm run build
```

### Step 6: Configure Nginx

1. Copy the nginx configuration:

```bash
sudo cp ~/dental-viewer/nginx.conf /etc/nginx/sites-available/dental-viewer
```

2. Update the paths in the nginx config file if your project is in a different location:

```bash
sudo nano /etc/nginx/sites-available/dental-viewer
```

Update these lines if needed:
- `root /root/dental-viewer/dist;` - Path to your dist folder
- `alias /root/dental-viewer/backend/uploads;` - Path to your uploads folder

3. Create symbolic link to enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/dental-viewer /etc/nginx/sites-enabled/
```

4. Remove default nginx site (optional):

```bash
sudo rm /etc/nginx/sites-enabled/default
```

5. Test nginx configuration:

```bash
sudo nginx -t
```

6. If test passes, reload nginx:

```bash
sudo systemctl reload nginx
```

### Step 7: Start Backend with PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start backend
cd ~/dental-viewer/backend
pm2 start server.js --name dental-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on reboot
pm2 startup
# Follow the command it outputs (usually involves copying a command)
```

### Step 8: Configure Firewall

```bash
# Allow HTTP traffic
sudo ufw allow 'Nginx Full'
# Or specifically:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # For HTTPS later

# Enable firewall if not already enabled
sudo ufw enable
```

### Step 9: Verify Deployment

1. Test backend directly:
   ```bash
   curl http://127.0.0.1:3001/api/health
   ```

2. Test through nginx:
   ```bash
   curl http://localhost/api/health
   ```

3. Test in browser:
   Open: `http://64.226.107.42`
   - Should show login page
   - Default credentials: `admin` / `admin123`

## Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload nginx (after config changes)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# View nginx access logs
sudo tail -f /var/log/nginx/access.log
```

## PM2 Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs dental-backend

# Restart backend
pm2 restart dental-backend

# Stop backend
pm2 stop dental-backend

# Monitor
pm2 monit
```

## Troubleshooting

### Backend not responding
- Check if backend is running: `pm2 list`
- Check backend logs: `pm2 logs dental-backend`
- Test backend directly: `curl http://127.0.0.1:3001/api/health`

### Nginx 502 Bad Gateway
- Backend might not be running
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify backend is listening on 127.0.0.1:3001

### Files not found (404)
- Check if dist folder exists: `ls -la ~/dental-viewer/dist`
- Verify paths in nginx config match actual locations
- Check nginx error logs

### Permission issues
- Ensure nginx has read access to dist folder
- Check uploads folder permissions: `chmod -R 755 ~/dental-viewer/backend/uploads`

## Security Recommendations

1. **SSL Certificate**: Set up HTTPS with Let's Encrypt
2. **Firewall**: Only allow necessary ports
3. **JWT Secret**: Use a strong random secret
4. **File Permissions**: Restrict access to sensitive directories

## Future: SSL/HTTPS Setup

When ready for HTTPS:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate (requires domain name)
sudo certbot --nginx -d your-domain.com
```

Then update frontend `.env`:
```env
VITE_API_BASE_URL=https://your-domain.com/api
```

## File Structure

```
/root/dental-viewer/
├── dist/              # Frontend build (served by nginx)
├── backend/
│   ├── server.js      # Backend API (runs on 127.0.0.1:3001)
│   ├── uploads/       # Uploaded files (served by nginx)
│   └── .env          # Backend environment variables
├── .env              # Frontend environment variables
└── nginx.conf        # Nginx configuration template
```

