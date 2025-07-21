# cPanel/LiteSpeed Deployment Guide

## cPanel/LiteSpeed Specific Issues

### Session Management Challenges:
1. **LiteSpeed interference** - LiteSpeed can interfere with Node.js session handling
2. **Process isolation** - Multiple Node.js processes can't share sessions
3. **Proxy headers** - LiteSpeed acts as a reverse proxy
4. **Cookie handling** - Different cookie behavior in cPanel environment

## Environment Setup

### 1. Create .env file:

```bash
# Environment
NODE_ENV=Production

# Session
SESSION_SECRET=your-super-secure-session-secret

# Database
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name

# Cookie Domain (if needed)
COOKIE_DOMAIN=.yourdomain.com
```

### 2. cPanel Node.js Configuration:

1. **Node.js Version**: Use Node.js 18+ (LTS recommended)
2. **Application Root**: Set to your project directory
3. **Startup File**: `app.js`
4. **Node.js App URL**: Your domain or subdomain
5. **Environment Variables**: Set in cPanel Node.js interface

### 3. cPanel Specific Settings:

#### In cPanel Node.js Selector:
- **Node.js Version**: 18.x or higher
- **Application Mode**: Production
- **Application URL**: Your domain
- **Application Root**: `/home/username/public_html/your-app`
- **Application Startup File**: `app.js`
- **Passenger App Type**: Node.js

#### Environment Variables in cPanel:
```
NODE_ENV=Production
SESSION_SECRET=your-secure-secret
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=your-database-name
```

### 4. File Permissions:

```bash
# Set proper permissions for cPanel
chmod 755 /home/username/public_html/your-app
chmod 644 /home/username/public_html/your-app/*.js
chmod 644 /home/username/public_html/your-app/*.json
chmod 755 /home/username/public_html/your-app/public
chmod 755 /home/username/public_html/your-app/public/uploads
```

### 5. Database Setup:

1. **Create MySQL Database** in cPanel
2. **Create Database User** with proper permissions
3. **Run the application** - it will create the sessions table automatically

## Troubleshooting

### Session Issues:

1. **Check Node.js Version**: Ensure you're using Node.js 18+
2. **Restart Application**: Stop and restart the Node.js app in cPanel
3. **Check Logs**: Look at the application logs in cPanel
4. **Test Session Endpoints**: Use `/session-debug` to test session functionality

### Common cPanel Issues:

1. **Process Manager**: cPanel may restart your app - ensure it starts properly
2. **Memory Limits**: cPanel has memory restrictions - monitor usage
3. **File Permissions**: Ensure proper file permissions (755 for dirs, 644 for files)
4. **Database Connections**: Ensure database credentials are correct

### LiteSpeed Specific:

1. **Proxy Headers**: The app now handles LiteSpeed's proxy headers
2. **Session Persistence**: Using MySQL store for cross-process session sharing
3. **Cookie Settings**: Optimized for LiteSpeed environment

## Testing

After deployment:

1. **Visit `/session-debug`** to test session functionality
2. **Test login flow** - should persist sessions
3. **Check server logs** for any errors
4. **Test file uploads** - ensure uploads directory is writable

## Security Notes

- Change `SESSION_SECRET` to a secure random string
- Use HTTPS in production
- Set proper file permissions
- Keep dependencies updated
- Monitor application logs regularly 