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

async function test() {
  const snap = await getDocs(collection(db, 'services'));
  const allProviders = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (data.isActive !== false) {
      allProviders.push({ id: doc.id, ...data });
    }
  });

  const category = 'Plumber';
  const query = 'G hn lahore';
  const cleanedCategory = category.replace(/^[:\s\p{P}]+|[:\s\p{P}]+$/gu, "").trim();

  const filteredProviders = allProviders.filter(p => {
    if (p.isBooked) return false;
    const dbCat = (p.category || '').toLowerCase();
    const dbName = (p.serviceName || p.name || '').toLowerCase();
    const dbDesc = (p.description || '').toLowerCase();
    const searchCat = cleanedCategory.toLowerCase();
    const searchQuery = query.toLowerCase();
    
    const isCatMatch = dbCat.includes(searchCat) || searchCat.includes(dbCat) || (dbCat.substring(0, 4) === searchCat.substring(0, 4));
    const isNameMatch = dbName.includes(searchCat) || searchCat.includes(dbName) || dbName.includes(searchQuery) || searchQuery.includes(dbName);
    const isDescMatch = dbDesc.includes(searchCat) || dbDesc.includes(searchQuery);
    
    return isCatMatch || isNameMatch || isDescMatch;
  });

  console.log('Filtered Providers length:', filteredProviders.length);
  console.log('Filtered Providers:', JSON.stringify(filteredProviders, null, 2));
}

test().catch(console.error);
