require('dotenv').config();
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://wsair-f3c09-default-rtdb.firebaseio.com/'
});

const db = admin.database();

// FSEconomy configuration
const FSE_CONFIG = {
  baseUrl: 'https://server.fseconomy.net',
  // You'll need to add your FSEconomy credentials
  username: process.env.FSE_USERNAME,
  password: process.env.FSE_PASSWORD,
  airline: 'WSA' // Your airline code
};

// Cookie jar for session management
let sessionCookies = '';

async function loginToFSE() {
  try {
    console.log('Logging into FSEconomy...');

    const response = await axios.post(`${FSE_CONFIG.baseUrl}/userctl`, {
      'user': FSE_CONFIG.username,
      'password': FSE_CONFIG.password,
      'event': 'signin'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    // Extract session cookies
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      sessionCookies = cookies.map(cookie => cookie.split(';')[0]).join('; ');
    }

    console.log('Login successful');
    return true;
  } catch (error) {
    console.error('Login failed:', error.message);
    return false;
  }
}

async function fetchAircraftData() {
  try {
    console.log('Fetching aircraft data...');

    const response = await axios.get(`${FSE_CONFIG.baseUrl}/myacft.asp`, {
      headers: {
        'Cookie': sessionCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const aircraft = [];

    // Parse aircraft table
    $('table tr').each((index, row) => {
      if (index === 0) return; // Skip header

      const cols = $(row).find('td');
      if (cols.length >= 8) {
        const registration = $(cols[1]).text().trim();
        const location = $(cols[2]).text().trim();
        const status = $(cols[3]).text().trim();
        const model = $(cols[4]).text().trim();

        // Only process our airline's aircraft
        if (registration.includes('WS')) {
          aircraft.push({
            registration,
            location,
            status: status.toLowerCase(),
            model
          });
        }
      }
    });

    console.log(`Found ${aircraft.length} aircraft`);
    return aircraft;
  } catch (error) {
    console.error('Failed to fetch aircraft data:', error.message);
    return [];
  }
}

async function fetchFlightLog() {
  try {
    console.log('Fetching flight log...');

    const response = await axios.get(`${FSE_CONFIG.baseUrl}/pilotschedule.asp`, {
      headers: {
        'Cookie': sessionCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const flights = [];

    // Parse flight log table
    $('table tr').each((index, row) => {
      if (index === 0) return; // Skip header

      const cols = $(row).find('td');
      if (cols.length >= 6) {
        const date = $(cols[0]).text().trim();
        const route = $(cols[1]).text().trim();
        const aircraft = $(cols[2]).text().trim();
        const pilot = $(cols[3]).text().trim();
        const blockTime = $(cols[4]).text().trim();

        flights.push({
          date,
          route,
          aircraft,
          pilot,
          blockTime: parseFloat(blockTime) || 0,
          status: 'Completed'
        });
      }
    });

    console.log(`Found ${flights.length} recent flights`);
    return flights.slice(0, 20); // Last 20 flights
  } catch (error) {
    console.error('Failed to fetch flight log:', error.message);
    return [];
  }
}

async function fetchStats() {
  try {
    console.log('Fetching airline stats...');

    const response = await axios.get(`${FSE_CONFIG.baseUrl}/groupdata.asp?group=${FSE_CONFIG.airline}`, {
      headers: {
        'Cookie': sessionCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    // Extract stats from the page
    const stats = {
      hours: 0,
      flights: 0,
      revenue: '$0',
      pilots: 0
    };

    // This would need to be customized based on FSEconomy's actual HTML structure
    // For now, return placeholder stats
    console.log('Stats fetched (placeholder)');
    return stats;
  } catch (error) {
    console.error('Failed to fetch stats:', error.message);
    return {
      hours: 0,
      flights: 0,
      revenue: '$0',
      pilots: 0
    };
  }
}

async function updateFirebase(aircraft, flights, stats) {
  try {
    console.log('Updating Firebase...');

    // Update fleet
    const fleetRef = db.ref('fleet');
    for (const ac of aircraft) {
      await fleetRef.child(ac.registration).update({
        status: ac.status,
        location: ac.location,
        model: ac.model
      });
    }

    // Update flight log
    const pirepsRef = db.ref('pireps');
    await pirepsRef.set(null); // Clear existing
    for (const flight of flights) {
      await pirepsRef.push({
        ...flight,
        ts: Date.now()
      });
    }

    // Update stats
    await db.ref('stats').update(stats);

    // Update last sync time
    await db.ref('lastSync').set(Date.now());

    console.log('Firebase updated successfully');
  } catch (error) {
    console.error('Firebase update failed:', error.message);
  }
}

async function syncFSEData() {
  console.log('Starting FSEconomy sync...');

  try {
    // Login to FSEconomy
    const loginSuccess = await loginToFSE();
    if (!loginSuccess) {
      throw new Error('FSEconomy login failed');
    }

    // Fetch data
    const [aircraft, flights, stats] = await Promise.all([
      fetchAircraftData(),
      fetchFlightLog(),
      fetchStats()
    ]);

    // Update Firebase
    await updateFirebase(aircraft, flights, stats);

    console.log('Sync completed successfully');
    return { success: true, aircraft: aircraft.length, flights: flights.length };

  } catch (error) {
    console.error('Sync failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Express server for API endpoint
const express = require('express');
const app = express();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Sync endpoint
app.post('/sync', async (req, res) => {
  console.log('Sync request received');

  try {
    const result = await syncFSEData();

    if (result.success) {
      res.json({
        success: true,
        message: `Synced ${result.aircraft} aircraft and ${result.flights} flights`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Sync endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FSEconomy sync server running on port ${PORT}`);
});

// Export for testing
module.exports = { syncFSEData, loginToFSE, fetchAircraftData, fetchFlightLog };