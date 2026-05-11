require('dotenv').config();
const admin = require('firebase-admin');

// Test Firebase connection
async function testFirebase() {
  try {
    console.log('Testing Firebase connection...');

    // Initialize Firebase Admin
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://wsair-f3c09-default-rtdb.firebaseio.com/'
    });

    // Test database connection
    const db = admin.database();
    const ref = db.ref('test');
    await ref.set({ test: 'connection successful', timestamp: new Date().toISOString() });

    console.log('✅ Firebase connection successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Firebase connection failed:', error.message);
    process.exit(1);
  }
}

testFirebase();