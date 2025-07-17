# cPanel Deployment Guide

## Environment Setup

### 1. Create .env file in your project root:

```bash
# Environment
NODE_ENV=production

# Session
SESSION_SECRET=your-super-secure-session-secret-change-this-in-production

# Database
DB_HOST=amelia.ducimus.digital
DB_PORT=3306
DB_USER=anniejeanphoto_appUser
DB_PASSWORD=your-actual-database-password
DB_NAME=anniejeanphoto_app

# Email (if needed)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-password

# App
BASE_URL=https://your-domain.com
FORCE_HTTPS=true
```

### 2. Set up Node.js in cPanel:

1. Go to cPanel → Node.js Selector
2. Create a new Node.js app
3. Set the Node.js version to 18 or higher
4. Set the application root to your project directory
5. Set the application URL
6. Set the application startup file to `app.js`

### 3. Install Dependencies:

```bash
npm install
```

### 4. Run Setup Scripts:

```bash
npm run setup
npm run test-session-store
npm run test-env
```

### 5. Start the Application:

```bash
npm start
```

## Troubleshooting

### Session Issues:
- Make sure `NODE_ENV=production` is set in .env
- Verify database credentials are correct
- Check that the sessions table was created

### Login Issues (req.body undefined):
- **Most Common Cause**: cPanel Node.js configuration issues
- **Solution**: Check Node.js version and restart the application
- **Alternative**: The app now has fallback body parsing for cPanel

### File Upload Issues:
- Ensure `/public/uploads` directory exists and is writable
- Check file permissions on the uploads directory

## cPanel-Specific Issues

### Body Parsing Problems:
If you're getting `req.body undefined` errors:

1. **Check Node.js Version**: Ensure you're using Node.js 18+ in cPanel
2. **Restart Application**: Stop and restart the Node.js app in cPanel
3. **Check Logs**: Look at the application logs in cPanel
4. **Test Endpoint**: Use `/test-body` endpoint to verify body parsing

### Testing Steps:
1. Deploy the updated code
2. Visit `https://your-domain.com/testServer.html`
3. Test the body parsing endpoint
4. Check server logs for debugging information

### Common cPanel Issues:
- **Node.js Version**: Some cPanel hosts have outdated Node.js versions
- **Memory Limits**: cPanel may have memory restrictions
- **File Permissions**: Ensure proper file permissions (755 for directories, 644 for files)
- **Process Manager**: Use PM2 or similar process manager for production

## Testing

After deployment, test:
1. Login functionality
2. File uploads
3. Session persistence
4. Form submissions

## Security Notes

- Change `SESSION_SECRET` to a secure random string
- Use HTTPS in production
- Set proper file permissions
- Keep dependencies updated 