## Prerequisites

- Node.js (v16 or higher) - Download from [nodejs.org](https://nodejs.org/)
- Firebase project with Realtime Database enabled
- FSEconomy World account

### 1. Install Node.js
Download and install Node.js from the official website. This will also install npm (Node Package Manager).

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create/select your project
3. Download the service account key:
   - Project Settings → Service Accounts → Generate new private key
   - Save as `serviceAccountKey.json` in this directory

### 3. Install Dependencies
```bash
npm install
```

### 4. Test Firebase Connection
```bash
npm run test-firebase
```

This will verify your Firebase setup is working correctly.

### 5. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your FSEconomy credentials:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 6. Run Locally
```bash
npm start
```

The server will run on `http://localhost:3000`

### 5. Test Sync
```bash
npm run sync
```

### 6. Deploy to Production
Deploy to Heroku, Vercel, or any Node.js hosting:

**Heroku:**
```bash
heroku create your-app-name
git push heroku main
```

**Environment Variables:**
Set these in your hosting platform:
- `FSE_USERNAME`
- `FSE_PASSWORD`

### 7. Update Website
In `western-skies-air-live_1.html`, update the sync URL:
```javascript
const response = await fetch('https://your-deployed-url.com/sync', {
```

## API Endpoints

- `POST /sync` - Trigger FSEconomy data sync
- `GET /health` - Health check

## Data Flow

1. **Login** to FSEconomy using credentials
2. **Scrape** aircraft data, flight logs, and stats
3. **Update** Firebase Realtime Database
4. **Website** displays live data from Firebase

## Security Notes

- Never commit `serviceAccountKey.json` or `.env` to git
- Use environment variables for sensitive data
- Consider rate limiting the sync endpoint

## Troubleshooting

- Check FSEconomy login credentials
- Verify Firebase service account permissions
- Check server logs for scraping errors
- FSEconomy may change their HTML structure over time