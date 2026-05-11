require('dotenv').config();
const fs = require('fs');

// Polyfill ReadableStream for older Node runtimes used by undici/axios
if (typeof global.ReadableStream === 'undefined') {
  try {
    const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
    global.ReadableStream = ReadableStream;
    global.WritableStream = WritableStream;
    global.TransformStream = TransformStream;
    console.log('✅ stream/web polyfill loaded');
  } catch (err) {
    console.warn('⚠️  stream/web polyfill unavailable:', err.message);
  }
}

const express = require('express');

// Validate environment variables first
if (!process.env.FSE_USERNAME || !process.env.FSE_PASSWORD) {
  console.error('❌ ERROR: FSE_USERNAME and FSE_PASSWORD environment variables not set!');
  process.exit(1);
}

// Lazy load heavy dependencies
let admin, db, axios, cheerio;

function initFirebase() {
  if (db) return; // Already initialized
  try {
    admin = require('firebase-admin');
    axios = require('axios');
    cheerio = require('cheerio');
    
    if (!fs.existsSync('./serviceAccountKey.json')) {
      throw new Error('serviceAccountKey.json not found');
    }
    
    const serviceAccount = require('./serviceAccountKey.json');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://wsair-f3c09-default-rtdb.firebaseio.com/'
      });
    }
    db = admin.database();
    console.log('✅ Firebase initialized');
  } catch (error) {
    console.error('⚠️  Firebase error:', error.message);
  }
}

// FSEconomy configuration
const FSE_CONFIG = {
  baseUrl: 'https://server.fseconomy.net',
  username: process.env.FSE_USERNAME,
  password: process.env.FSE_PASSWORD,
  airline: 'WSA'
};

let sessionCookies = '';

async function loginToFSE() {
  try {
    if (!axios) initFirebase();
    console.log('🔐 Logging into FSEconomy...');

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
      validateStatus: () => true
    });

    const cookies = response.headers['set-cookie'];
    if (cookies) {
      sessionCookies = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('✅ FSEconomy login successful');
      return true;
    }
    console.warn('⚠️  No session cookies received');
    return false;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function fetchData() {
  try {
    if (!axios) initFirebase();
    console.log('📡 Fetching aircraft data...');

    const response = await axios.get(`${FSE_CONFIG.baseUrl}/aircraft`, {
      params: {
        airline: FSE_CONFIG.airline
      },
      headers: {
        'Cookie': sessionCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const aircraft = [];

    // Assuming the aircraft are in a table, find the table with aircraft
    $('table tr').each((index, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 3) {
        const registration = $(cols[0]).text().trim();
        const location = $(cols[2]).text().trim() || 'Unknown';
        if (registration && registration.match(/^[A-Z0-9]+$/)) {  // Basic check for registration
          aircraft.push({
            registration,
            location,
            status: 'available'
          });
        }
      }
    });

    console.log(`✅ Fetched ${aircraft.length} aircraft`);
    
    // Update Firebase if available
    if (db) {
      try {
        // Clear existing fleet to remove airplanes not in FSEconomy
        await db.ref('fleet').remove();
        console.log('🗑️ Cleared existing fleet');
        
        for (const ac of aircraft) {
          await db.ref(`fleet/${ac.registration}`).update({
            status: ac.status,
            location: ac.location
          });
        }
        await db.ref('lastSync').set(new Date().toISOString());
        console.log('✅ Firebase updated');
      } catch (fbError) {
        console.warn('⚠️  Firebase update failed:', fbError.message);
      }
    }

    return aircraft;
  } catch (error) {
    console.error('❌ Data fetch failed:', error.message);
    return [];
  }
}

// Express server
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/sync', async (req, res) => {
  try {
    initFirebase();
    console.log('\n🔄 Sync request at', new Date().toLocaleTimeString());

    const loginOk = await loginToFSE();
    if (!loginOk) {
      return res.status(401).json({ error: 'FSEconomy login failed' });
    }

    const aircraft = await fetchData();

    res.json({
      success: true,
      aircraftSynced: aircraft.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ FSEconomy sync server listening on port ${PORT}`);
  console.log(`📍 POST ${PORT}/sync - Trigger FSEconomy sync`);
  console.log(`🏥 GET  ${PORT}/health - Health check\n`);
});

async function syncFSEData() {
  initFirebase();
  console.log('\n🔄 Manual sync at', new Date().toLocaleTimeString());

  const loginOk = await loginToFSE();
  if (!loginOk) {
    throw new Error('FSEconomy login failed');
  }

  const aircraft = await fetchData();

  return {
    success: true,
    aircraftSynced: aircraft.length,
    timestamp: new Date().toISOString()
  };
}

module.exports = { loginToFSE, fetchData, syncFSEData };