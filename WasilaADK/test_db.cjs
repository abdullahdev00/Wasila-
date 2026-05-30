const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore/lite');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/Mohammad Ahmad/.gemini/antigravity/scratch/Wasila-/WasilaADK/.env' });

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dump() {
  const snap = await getDocs(collection(db, 'services'));
  const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
  console.log(JSON.stringify(docs, null, 2));
}

dump().catch(console.error);
