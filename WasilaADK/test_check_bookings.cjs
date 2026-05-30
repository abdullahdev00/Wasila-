const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore/lite');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/Mohammad Ahmad/.gemini/antigravity/scratch/Wasila-/WasilaADK/.env' });

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dump() {
  const snap = await getDocs(collection(db, 'bookings'));
  console.log('Total bookings:', snap.docs.length);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id} | User: ${data.userId} | Provider: ${data.providerName} | Date: ${data.date} | Status: ${data.status}`);
  });
}

dump().catch(console.error);
