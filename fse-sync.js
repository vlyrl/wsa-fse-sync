require('dotenv').config();
const fs = require('fs');

// Node.js 18 doesn't have File as a global — firebase-admin's undici dependency needs it
if (typeof global.File === 'undefined') {
  try { const { File } = require('buffer'); global.File = File; } catch (_) {}
}

// Airport lat/lon used to tag pireps at sync time so the map never needs a client-side lookup
const AIRPORT_COORDS = {
  KABI:[32.4113,-99.6819],KACT:[31.6113,-97.2305],KADS:[32.9682,-96.8351],
  KAFW:[32.9876,-97.3188],KAMA:[35.2194,-101.706],KAUS:[30.1945,-97.6699],
  KBBD:[31.1793,-99.3239],KBPT:[29.9508,-94.0207],KBRO:[25.9068,-97.4259],
  KBAZ:[29.7073,-97.8663],KCDS:[34.4337,-100.285],KCLL:[30.5885,-96.3638],
  KCNM:[32.3373,-104.263],KCRP:[27.7704,-97.5012],KCXO:[30.3518,-95.4147],
  KDAL:[32.8474,-96.8518],KDFW:[32.8968,-97.0380],KDRT:[29.3747,-100.927],
  KELP:[31.8072,-106.378],KEND:[36.3392,-97.9163],KFTW:[32.8197,-97.3625],
  KGAG:[36.2955,-99.7736],KGDP:[31.4226,-104.025],KGGG:[32.3840,-94.7115],
  KGLS:[29.2653,-94.8604],KGRK:[31.0672,-97.8289],KGTU:[30.6788,-97.6794],
  KHDO:[29.3595,-99.1770],KHOB:[32.6875,-103.217],KHOU:[29.6454,-95.2789],
  KIAH:[29.9902,-95.3368],KICT:[37.6499,-97.4331],KINK:[31.7795,-103.200],
  KJCT:[30.5113,-99.7985],KJKV:[31.8493,-94.9634],KLBB:[33.6636,-101.823],
  KLCH:[30.1261,-93.2233],KLFT:[30.2053,-91.9876],KLRD:[27.5438,-99.4615],
  KLIT:[34.7294,-92.2243],KLTS:[34.6667,-99.2667],KLAW:[34.5677,-98.4166],
  KMAF:[31.9425,-102.202],KMCI:[39.2976,-94.7138],KMFE:[26.1758,-98.2386],
  KMLU:[32.5109,-92.0377],KMSY:[29.9934,-90.2580],KMWL:[32.7814,-98.0602],
  KNQI:[27.5077,-97.8096],KOKC:[35.3931,-97.6007],KPPA:[35.6129,-100.996],
  KPNZ:[27.7813,-98.1828],KPRC:[34.6545,-112.420],KPUB:[38.2891,-104.497],
  KRBD:[32.6809,-96.8680],KROW:[33.3016,-104.531],KSAF:[35.6171,-106.088],
  KSAT:[29.5337,-98.4698],KSEP:[33.1779,-98.1978],KSGR:[29.6223,-95.6565],
  KSHV:[32.4466,-93.8256],KSJT:[31.3574,-100.497],KSNK:[32.6959,-100.949],
  KSAO:[28.9817,-100.896],KSPS:[33.9888,-98.4919],KSTL:[38.7487,-90.3700],
  KTRL:[33.5943,-99.0216],KTUL:[36.1984,-95.8881],KTUS:[32.1161,-110.941],
  KTXK:[33.4539,-93.9910],KTYR:[32.3541,-95.4024],KVCT:[28.8526,-96.9185],
  KABQ:[35.0402,-106.609],KBTR:[30.5332,-91.1496],KCOS:[38.8058,-104.701],
  KDEN:[39.8561,-104.674],KDRO:[37.1515,-107.754],KFLG:[35.1385,-111.671],
  KFSM:[35.3366,-94.3674],KGBD:[38.3441,-98.8591],KHYS:[38.8422,-99.2732],
  KLAS:[36.0840,-115.154],KLAX:[33.9425,-118.408],KMIA:[25.7959,-80.2870],
  KORD:[41.9786,-87.9048],KATL:[33.6407,-84.4277],KJFK:[40.6398,-73.7789],
  KPHX:[33.4373,-112.008],KSFO:[37.6213,-122.379],KSAN:[32.7336,-117.190],
  KSLC:[40.7884,-111.978],KXNA:[36.2819,-94.3068],KOWP:[36.4451,-97.9984],
  KGCK:[37.9275,-100.724],KDCA:[38.8521,-77.0377],KSEA:[47.4502,-122.309],
  // South / West Texas
  KCOT:[28.4562,-99.2204],
  '7TE7':[26.3837,-98.3337],
  E29:[30.5857,-100.649], KSOA:[30.5857,-100.649],
  '35TX':[32.4845,-99.826],
  '8F3':[33.6590,-101.237],
  // Mexico
  MMTC:[25.5683,-103.404],MMMY:[25.7785,-100.107],MMMX:[19.4363,-99.0721],
  MMGL:[20.5218,-103.312],MMCU:[28.7029,-105.965],MMTJ:[32.5411,-116.970],
  MMTO:[19.3371,-99.5661],MMCZ:[20.5224,-86.9256],MMVA:[20.6404,-103.220],
  MMSM:[19.6671,-99.0119],MMSD:[23.1523,-109.721],MMLO:[21.2495,-101.481],
  MMAS:[22.0000,-102.318],MMPE:[20.6453,-105.254],MMHO:[29.0959,-111.048],
  MMCS:[31.6361,-106.429],MMMZ:[23.1614,-106.266],MMVR:[19.1459,-96.1873],
  MMTM:[22.2964,-97.8659],MMMT:[25.0000,-105.000],
};


const express = require('express');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Validate environment variables first
if (!process.env.FSE_USER_KEY || !process.env.FSE_SERVICE_KEY || !process.env.RESEND_API_KEY || !process.env.SYNC_SECRET) {
  console.error('❌ ERROR: FSE_USER_KEY, FSE_SERVICE_KEY, RESEND_API_KEY, and SYNC_SECRET must be set!');
  process.exit(1);
}

const axios = require('axios');
const cheerio = require('cheerio');
let admin, db;

function initFirebase() {
  if (db) return;
  try {
    admin = require('firebase-admin');

    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ Firebase credentials loaded from environment variable');
    } else {
      const keyPath = './serviceAccountKey.json';
      console.log('🔍 Looking for Firebase key at: ' + keyPath);
      if (!fs.existsSync(keyPath)) {
        console.error('❌ File not found: ' + keyPath + ' — set FIREBASE_SERVICE_ACCOUNT env var on Railway');
        throw new Error('serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT not set');
      }
      serviceAccount = require(keyPath);
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://wsair-f3c09-default-rtdb.firebaseio.com'
      });
    }
    db = admin.database();
    console.log('✅ Firebase initialized');
  } catch (error) {
    console.error('❌ Firebase error:', error.message);
    db = null;
  }
}

const FSE_API      = 'https://server.fseconomy.net/data';
const FSE_USER_KEY = process.env.FSE_USER_KEY;   // WestonK personal key (auth)
const FSE_READ_KEY = process.env.FSE_SERVICE_KEY; // Western Skies Air LLC group key (data access)

// FETCH JOBS via FSEconomy Data Feeds API
async function fetchJobs() {
  try {
    if (!db) initFirebase();
    console.log('📡 Fetching group assignments via API...');
    const url = FSE_API + '?userkey=' + FSE_USER_KEY + '&format=xml&query=assignments&search=key&readaccesskey=' + FSE_READ_KEY;
    const res = await axios.get(url, { timeout: 20000, responseType: 'text' });
    console.log('   📄 Jobs API response (' + res.status + '):', String(res.data).substring(0, 400));
    const $ = cheerio.load(res.data, { xmlMode: true });
    const jobs = [];

    $('Assignment').each(function(i, el) {
      const id       = $(el).find('Id').text().trim() || ('job-' + i);
      const location = $(el).find('Location').text().trim();
      const from     = $(el).find('From').text().trim();
      const dest     = $(el).find('To').text().trim();
      const payVal   = parseFloat($(el).find('Pay').text()) || 0;
      const pay      = '$' + payVal.toFixed(2);
      const pilotFee = $(el).find('PilotFee').text().trim();
      const units    = $(el).find('Units').text().trim();
      const commodity= $(el).find('Commodity').text().trim() || $(el).find('UnitType').text().trim();
      const nm       = $(el).find('NM').text().trim();
      const brg      = $(el).find('Bearing').text().trim();
      const expires  = $(el).find('Expires').text().trim().split('T')[0];
      const comment  = $(el).find('Comment').text().trim();
      jobs.push({ id, pay, pilotFee, location, from, dest, nm, brg,
        cargo: (units + ' ' + commodity).trim(), comment, expires, status: 'Open', pilot: '' });
    });

    console.log('✅ Fetched ' + jobs.length + ' jobs');
    if (db && jobs.length) {
      const jobObject = jobs.reduce(function(acc, j) { acc[j.id] = j; return acc; }, {});
      await db.ref('jobsAvailable').set(jobObject);
      await db.ref('jobsLastSync').set(new Date().toISOString());
      console.log('✅ Jobs saved to Firebase');
    }
    return jobs;
  } catch (error) {
    console.error('❌ Job fetch failed:', error.message);
    return [];
  }
}

// FETCH AIRCRAFT via FSEconomy Data Feeds API
async function fetchData() {
  try {
    if (!db) initFirebase();
    console.log('📡 Fetching aircraft via API...');
    const url = FSE_API + '?userkey=' + FSE_USER_KEY + '&format=xml&query=aircraft&search=key&readaccesskey=' + FSE_READ_KEY;
    const res = await axios.get(url, { timeout: 20000, responseType: 'text' });
    console.log('   📄 Aircraft API response (' + res.status + '):', String(res.data).substring(0, 400));
    const $ = cheerio.load(res.data, { xmlMode: true });
    const aircraft = [];
    const liveOps  = [];

    $('Aircraft').each(function(i, el) {
      const reg      = $(el).find('Registration').text().trim();
      const type     = $(el).find('MakeModel').text().trim() || 'Unknown';
      const location = $(el).find('Location').text().trim()  || 'Unknown';
      const status   = $(el).find('Status').text().trim()    || 'Available';
      const pilot    = $(el).find('Pilot').text().trim();
      const from     = $(el).find('From').text().trim()      || location;
      const dest     = $(el).find('To').text().trim();
      if (!reg) return;
      console.log('   ✈️  ' + reg + ' (' + type + ') at ' + location + ' — ' + status);
      aircraft.push({ registration: reg, type, location, status });
      if (status.toLowerCase().includes('enroute') && pilot) {
        liveOps.push({ aircraft: reg, type, from, dest, pilot, status: 'Enroute', location });
      }
    });

    console.log('✅ Fetched ' + aircraft.length + ' aircraft (' + liveOps.length + ' enroute)');

    if (db) {
      await db.ref('fleet').remove();
      for (const ac of aircraft) {
        await db.ref('fleet/' + ac.registration).update({ type: ac.type, status: ac.status, location: ac.location });
      }
      // Write enroute live ops
      if (liveOps.length) {
        const liveObj = {};
        liveOps.forEach(function(op) { liveObj['enroute-' + op.aircraft] = op; });
        for (const [k, v] of Object.entries(liveObj)) {
          await db.ref('jobsAvailable/' + k).set(v);
        }
      }
      await db.ref('lastSync').set(new Date().toISOString());
      await fetchJobs();
      console.log('✅ Firebase updated');
    }

    return aircraft;
  } catch (error) {
    console.error('❌ Aircraft fetch failed:', error.message);
    return [];
  }
}

function buildWelcomeEmail(firstName) {
  const name = firstName || 'Pilot';
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#ffffff;padding:40px;border-radius:8px;">
      <div style="border-bottom:2px solid #c8860a;padding-bottom:20px;margin-bottom:30px;">
        <h1 style="font-size:28px;margin:0;letter-spacing:2px;">WESTERN <span style="color:#c8860a;">SKIES</span> AIR</h1>
        <p style="color:#888;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:6px 0 0;">Virtual Charter Airline</p>
      </div>
      <h2 style="color:#c8860a;font-size:20px;">Welcome aboard, ${name}!</h2>
      <p style="color:#cccccc;line-height:1.7;">We're glad to have you on the team at Western Skies Air. To get started flying with us you'll need an FSEconomy account if you don't have one already — it's free and takes about 5 minutes to set up.</p>
      <div style="background:#1c1c1c;border:1px solid #333;border-left:3px solid #c8860a;padding:20px;margin:24px 0;border-radius:4px;">
        <p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c8860a;">Step 1 — Create your FSEconomy account</p>
        <a href="https://www.fseconomy.net/" style="color:#ffffff;font-size:16px;font-weight:bold;">https://www.fseconomy.net/</a>
        <p style="margin:10px 0 0;color:#888;font-size:13px;">Sign up for a free account at FSEconomy World.</p>
      </div>
      <div style="background:#1c1c1c;border:1px solid #333;border-left:3px solid #c8860a;padding:20px;margin:24px 0;border-radius:4px;">
        <p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c8860a;">Step 2 — Contact Chief Pilot</p>
        <p style="margin:0;color:#cccccc;font-size:14px;">Once your FSEconomy account is set up, email Chief Pilot Weston Koenig at <a href="mailto:sashootingwk@gmail.com" style="color:#c8860a;">sashootingwk@gmail.com</a> and he'll get you added to the group so you can access our aircraft and assignments.</p>
      </div>
      <div style="background:#1c1c1c;border:1px solid #333;border-left:3px solid #c8860a;padding:20px;margin:24px 0;border-radius:4px;">
        <p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c8860a;">Step 3 — Check the crew portal</p>
        <p style="margin:0;color:#cccccc;font-size:14px;">Visit the website to see available charters, the fleet status, and the pilot roster. Everything updates live from FSEconomy.</p>
      </div>
      <p style="color:#cccccc;line-height:1.7;margin-top:30px;">Blue skies,<br><strong style="color:#ffffff;">Weston Koenig</strong><br><span style="color:#888;font-size:13px;">Chief Pilot &amp; Director of Operations · Western Skies Air</span></p>
      <div style="border-top:1px solid #333;margin-top:30px;padding-top:20px;">
        <p style="color:#555;font-size:11px;margin:0;">You received this email because you registered at Western Skies Air. Questions? Reply to sashootingwk@gmail.com</p>
      </div>
    </div>
  `;
}

// EXPRESS SERVER
const app = express();
app.use(express.json());

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function requireSecret(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', function(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.post('/send-welcome', requireSecret, async function(req, res) {
  try {
    const { email, firstName } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    console.log('📧 Manual welcome email to ' + email + '...');

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Welcome to Western Skies Air — Next Steps',
      html: buildWelcomeEmail(firstName)
    });

    console.log('✅ Welcome email sent to ' + email);
    res.json({ success: true, sentTo: email });
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});


app.post('/send-custom', requireSecret, async function(req, res) {
  try {
    const { email, firstName, subject, body } = req.body;
    if (!email || !subject || !body) return res.status(400).json({ error: 'email, subject and body are required' });
    const name = firstName || 'Pilot';
    const safeBody = String(body).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    console.log('📧 Custom email to ' + email + ' — ' + subject);
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#ffffff;padding:40px;border-radius:8px;">
          <div style="border-bottom:2px solid #c8860a;padding-bottom:20px;margin-bottom:30px;">
            <h1 style="font-size:28px;margin:0;letter-spacing:2px;">WESTERN <span style="color:#c8860a;">SKIES</span> AIR</h1>
            <p style="color:#888;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:6px 0 0;">Virtual Charter Airline</p>
          </div>
          <p style="color:#cccccc;line-height:1.7;">Hi ${name},</p>
          <div style="color:#cccccc;line-height:1.8;white-space:pre-wrap;">${safeBody}</div>
          <p style="color:#cccccc;line-height:1.7;margin-top:30px;">Blue skies,<br><strong style="color:#ffffff;">Weston Koenig</strong><br><span style="color:#888;font-size:13px;">Chief Pilot &amp; Director of Operations · Western Skies Air</span></p>
          <div style="border-top:1px solid #333;margin-top:30px;padding-top:20px;">
            <p style="color:#555;font-size:11px;margin:0;">Questions? Reply to sashootingwk@gmail.com</p>
          </div>
        </div>
      `
    });
    console.log('✅ Custom email sent to ' + email);
    res.json({ success: true, sentTo: email });
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

let syncInProgress = false;

app.post('/sync', requireSecret, async function(req, res) {
  if (syncInProgress) {
    return res.status(429).json({ error: 'Sync already in progress' });
  }
  syncInProgress = true;
  try {
    initFirebase();
    console.log('\n🔄 Sync request at', new Date().toLocaleTimeString());

    const aircraft = await fetchData();
    const logStats = await fetchLog();
    await checkNewPilots();

    res.json({ success: true, aircraftSynced: aircraft.length, flightsSynced: logStats.flights, hoursFlown: logStats.hoursFlown, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    syncInProgress = false;
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('\n✅ FSEconomy sync server listening on port ' + PORT);
  console.log('📍 POST http://localhost:' + PORT + '/sync - Trigger sync');
  console.log('🏥 GET  http://localhost:' + PORT + '/health - Health check\n');

  // Auto-sync every 10 minutes
  const SYNC_INTERVAL_MS = 10 * 60 * 1000;
  setTimeout(async function autoSync() {
    if (!syncInProgress) {
      console.log('⏰ Auto-sync triggered');
      syncInProgress = true;
      try {
        initFirebase();
        await fetchData();
        await fetchLog();
        await checkNewPilots();
        console.log('⏰ Auto-sync complete');
      } catch(e) {
        console.error('❌ Auto-sync error:', e.message);
      } finally {
        syncInProgress = false;
      }
    }
    setTimeout(autoSync, SYNC_INTERVAL_MS);
  }, SYNC_INTERVAL_MS);
  console.log('⏰ Auto-sync scheduled every 10 minutes\n');
});


// Download OurAirports comprehensive database (covers small strips FSE misses)
async function loadOurAirportsCoords() {
  try {
    console.log('📍 Loading OurAirports database...');
    const res = await axios.get(
      'https://ourairports.com/data/airports.csv',
      { timeout: 30000, responseType: 'text' }
    );
    const lines = String(res.data).split('\n');
    const coords = {};
    let parsed = 0;
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if (line[i] === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += line[i]; }
      }
      result.push(current);
      return result;
    }
    // Header: id,ident,type,name,latitude_deg,longitude_deg,...
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = parseCSVLine(line);
      if (parts.length < 6) continue;
      const ident = parts[1].replace(/"/g, '').trim().toUpperCase();
      if (!ident) continue;
      const lat = parseFloat(parts[4]);
      const lon = parseFloat(parts[5]);
      if (isNaN(lat) || isNaN(lon)) continue;
      coords[ident] = [lat, lon];
      // FSE uses 3-char FAA codes without the K prefix (e.g. "8F3" not "K8F3")
      if (ident.length === 4 && ident[0] === 'K' && !coords[ident.slice(1)]) {
        coords[ident.slice(1)] = [lat, lon];
      }
      parsed++;
    }
    console.log('✅ Loaded ' + parsed + ' OurAirports coords');
    return coords;
  } catch (err) {
    console.warn('⚠️  OurAirports CSV unavailable:', err.message);
    return {};
  }
}

// Download FSEconomy's own airport coordinate database (no auth needed)
async function loadFSEAirportCoords() {
  try {
    console.log('📍 Loading FSE airport database...');
    const res = await axios.get(
      'https://server.fseconomy.net/static/library/icaodata.csv',
      { timeout: 20000, responseType: 'text' }
    );
    const lines = String(res.data).split('\n');
    const coords = {};
    let parsed = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const icao = parts[0].trim().toUpperCase();
      if (!icao || !/^[A-Z0-9]{2,5}$/.test(icao)) continue;
      // CSV format: icao,lat,lon[,name,...]
      let lat = parseFloat(parts[1]);
      let lon = parseFloat(parts[2]);
      if (isNaN(lat) || isNaN(lon)) continue;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      coords[icao] = [lat, lon];
      parsed++;
    }
    console.log('✅ Loaded ' + parsed + ' FSE airport coords');
    return coords;
  } catch (err) {
    console.warn('⚠️  FSE airport CSV unavailable:', err.message);
    return {};
  }
}

// FETCH FLIGHT LOG via FSEconomy Data Feeds API
async function fetchLog() {
  try {
    if (!db) initFirebase();
    console.log('📡 Fetching flight log via API (month by month)...');

    // FSEconomy flight logs must be fetched one month at a time
    const now = new Date();
    const months = [];
    for (let m = 0; m < 18; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    const pireps = [];
    let totalMinutes = 0;
    let totalEarnings = 0;

    for (const { month, year } of months) {
      const url = FSE_API + '?userkey=' + FSE_USER_KEY + '&format=xml&query=flightlogs&search=monthyear&readaccesskey=' + FSE_READ_KEY + '&month=' + month + '&year=' + year;
      try {
        const res = await axios.get(url, { timeout: 20000, responseType: 'text' });
        if (month === now.getMonth() + 1 && year === now.getFullYear()) {
          console.log('   📄 Flightlog sample (' + month + '/' + year + '):', String(res.data).substring(0, 300));
        }
        const $ = cheerio.load(res.data, { xmlMode: true });
        // Log the first entry's raw XML so we can see exact field names
        const firstEntry = $('FlightLog').first();
        if (firstEntry.length && month === now.getMonth() + 1 && year === now.getFullYear()) {
          console.log('   🔍 First FlightLog XML:', firstEntry.toString().substring(0, 800));
        }
        $('FlightLog').each(function(i, el) {
          const type     = $(el).find('Type').text().trim().toLowerCase();
          if (type && type !== 'flight') return; // skip bonus/payment entries
          const pilot    = $(el).find('Pilot').text().trim()    || 'Unknown';
          const dateRaw  = $(el).find('Date').text().trim();
          const date     = dateRaw ? dateRaw.split('T')[0].split(' ')[0] : new Date().toISOString().slice(0, 10);
          const flightTime = parseFloat($(el).find('FlightTime').text()) || 0;
          const aircraft = $(el).find('Aircraft').text().trim() || $(el).find('Registration').text().trim() || 'Unknown';
          const dep      = $(el).find('From').text().trim().toUpperCase() || '???';
          const arr      = $(el).find('To').text().trim().toUpperCase()   || '???';
          const earnings = parseFloat($(el).find('GrossEarnings').text()) || 0;

          if (dep === '???' && arr === '???') return;

          totalMinutes  += flightTime * 60;
          totalEarnings += earnings;
          pireps.push({ date, dep, arr, aircraft, pilot,
            blockTime: parseFloat(flightTime.toFixed(2)), earnings });
        });
      } catch (monthErr) {
        console.warn('   ⚠️  Failed to fetch ' + month + '/' + year + ':', monthErr.message);
      }
    }
    console.log('   Found ' + pireps.length + ' flight reports across 18 months');

    // ── Resolve airport coordinates from FSE airport database ─
    const [fseCoords, ourCoords] = await Promise.all([loadFSEAirportCoords(), loadOurAirportsCoords()]);
    // Priority: our manual table > FSE database > OurAirports (broadest coverage)
    const coordsMap = Object.assign({}, ourCoords, fseCoords, AIRPORT_COORDS);

    const stillMissing = [...new Set(
      pireps.flatMap(p => [p.dep, p.arr]).filter(c => c && c !== '???' && !coordsMap[c])
    )];
    if (stillMissing.length) {
      console.warn('⚠️  No coords found for: ' + stillMissing.join(', '));
    }

    // Tag each pirep with its coordinates
    pireps.forEach(p => {
      const dc = coordsMap[p.dep];
      const ac = coordsMap[p.arr];
      if (dc) { p.depLat = dc[0]; p.depLon = dc[1]; }
      if (ac) { p.arrLat = ac[0]; p.arrLon = ac[1]; }
    });

    const flightCount = pireps.length;
    const hoursFlown  = (totalMinutes / 60).toFixed(1);
    console.log('✅ Flight log: ' + flightCount + ' flights, ' + hoursFlown + ' hours');

    console.log('✅ Total earnings: $' + totalEarnings.toFixed(2));

    if (db) {
      await db.ref('stats').update({
        flights: flightCount,
        hoursFlown: parseFloat(hoursFlown),
        revenue: totalEarnings.toFixed(2)
      });

      if (pireps.length) {
        // Log every pirep we're about to write
        pireps.forEach(function(p, i) {
          console.log('   ✈️  flight-' + i + ': ' + p.dep + ' → ' + p.arr +
            ' depLat=' + p.depLat + ' arrLat=' + p.arrLat);
        });
        const pirepsObj = {};
        pireps.forEach(function(p, i) {
          pirepsObj['flight-' + i] = p;
        });
        await db.ref('pireps').set(pirepsObj);
        // Read back immediately to verify
        const verify = await db.ref('pireps').once('value');
        const writtenCount = verify.exists() ? Object.keys(verify.val()).length : 0;
        console.log('✅ Firebase write verified: ' + writtenCount + ' pireps in DB (expected ' + pireps.length + ')');
        if (writtenCount !== pireps.length) {
          console.error('❌ MISMATCH — Firebase has ' + writtenCount + ' but we wrote ' + pireps.length);
          console.error('   Firebase keys: ' + (verify.exists() ? Object.keys(verify.val()).join(', ') : 'none'));
        }
      }

      // Auto-update each pilot's totalHours by matching fseUsername
      try {
        const usersSnap = await db.ref('usersPublic').once('value');
        if (usersSnap.exists()) {
          const users = usersSnap.val();
          for (const uid of Object.keys(users)) {
            const fseUsername = (users[uid].fseUsername || '').trim().toLowerCase();
            if (!fseUsername) continue;
            const pilotHours = pireps
              .filter(function(p) { return p.pilot.trim().toLowerCase() === fseUsername; })
              .reduce(function(sum, p) { return sum + (p.blockTime || 0); }, 0);
            await db.ref('usersPublic/' + uid).update({ totalHours: parseFloat(pilotHours.toFixed(1)) });
            await db.ref('users/' + uid).update({ totalHours: parseFloat(pilotHours.toFixed(1)) });
            console.log('✅ Updated hours for ' + fseUsername + ': ' + pilotHours.toFixed(1) + ' hrs');
          }
        }
      } catch (e) {
        console.error('❌ Pilot hours update failed:', e.message);
      }
    }

    return { flights: flightCount, hoursFlown: parseFloat(hoursFlown) };
  } catch (error) {
    console.error('❌ Flight log fetch failed:', error.message);
    return { flights: 0, hoursFlown: 0 };
  }
}


// CHECK FOR NEW PILOTS and send welcome emails
async function checkNewPilots() {
  try {
    if (!db) return;
    console.log('👥 Checking for new pilots...');

    // Get current pilot count from Firebase
    const countSnap = await db.ref('pilotCount').get();
    const currentCount = countSnap.exists() ? countSnap.val() : 0;

    // Get last known count we saved
    const lastSnap = await db.ref('_lastKnownPilotCount').get();
    const lastCount = lastSnap.exists() ? lastSnap.val() : currentCount;

    if (currentCount <= lastCount) {
      console.log('   No new pilots since last sync (' + currentCount + ' total)');
      await db.ref('_lastKnownPilotCount').set(currentCount);
      return;
    }

    console.log('   🆕 ' + (currentCount - lastCount) + ' new pilot(s) detected!');

    // Get all users and find ones created since last sync
    const usersSnap = await db.ref('users').get();
    if (!usersSnap.exists()) return;

    const lastSyncSnap = await db.ref('_lastSyncTime').get();
    const lastSyncTime = lastSyncSnap.exists() ? lastSyncSnap.val() : 0;

    const users = usersSnap.val();
    const newPilots = Object.values(users).filter(function(u) {
      return u.createdAt && u.createdAt > lastSyncTime;
    });

    console.log('   Found ' + newPilots.length + ' new pilot(s) to email');

    for (const pilot of newPilots) {
      const firstName = pilot.firstName || 'Pilot';
      const email = pilot.email;
      if (!email) continue;

      console.log('   📧 Sending welcome email to ' + email + '...');
      try {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Welcome to Western Skies Air — Next Steps',
          html: buildWelcomeEmail(firstName)
        });
        console.log('   ✅ Welcome email sent to ' + email);
      } catch (emailErr) {
        console.warn('   ⚠️  Failed to send email to ' + email + ':', emailErr.message);
      }
    }

    // Update last known count and sync time
    await db.ref('_lastKnownPilotCount').set(currentCount);
    await db.ref('_lastSyncTime').set(Date.now());

  } catch (error) {
    console.error('❌ Pilot check failed:', error.message);
  }
}

async function syncFSEData() {
  initFirebase();
  console.log('\n🔄 Manual sync at', new Date().toLocaleTimeString());
  const aircraft = await fetchData();
  const logStats = await fetchLog();
  await checkNewPilots();
  return { success: true, aircraftSynced: aircraft.length, flightsSynced: logStats.flights, hoursFlown: logStats.hoursFlown, timestamp: new Date().toISOString() };
}

module.exports = { fetchData, fetchLog, checkNewPilots, syncFSEData };
